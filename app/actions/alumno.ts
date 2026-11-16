"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, type TestRow } from "@/lib/db";
import { endStudentSession, requireStudent, startStudentSession } from "@/lib/session";
import { checkEvents, computeScore, evaluate, MAX_EXTRA, normalizeBaremo, type InputEvent } from "@/lib/scoring";
import { findLesson, isUnlocked, PASS_ACCURACY } from "@/lib/lessons";
import { insertAttempt, sanitize, type SubmitPayload, type SubmitResult } from "@/lib/attempts";
import { closeRun, reopenRun, startRun, type StartResult } from "@/lib/testRuns";

export type { SubmitPayload, SubmitResult };

const MAX_FAILED_LOGINS = 10;

export type LoginState = { error?: string };

export async function loginStudent(_prev: LoginState, form: FormData): Promise<LoginState> {
  const code = String(form.get("code") ?? "").trim().toUpperCase();
  const username = String(form.get("username") ?? "").trim().toLowerCase();
  const pin = String(form.get("pin") ?? "").trim();
  if (!code || !username || !pin) return { error: "Rellena los tres campos." };

  const { data: klass } = await db().from("classes").select("id").eq("code", code).maybeSingle();
  if (!klass) return { error: "No existe ninguna clase con ese código." };

  const { data: student } = await db()
    .from("students")
    .select("id,pin,failed_logins")
    .eq("class_id", klass.id)
    .eq("username", username)
    .maybeSingle();
  if (!student) return { error: "Usuario o PIN incorrectos." };
  if (student.failed_logins >= MAX_FAILED_LOGINS) {
    return { error: "Cuenta bloqueada por demasiados intentos. Pide a tu profesor un PIN nuevo." };
  }
  if (student.pin !== pin) {
    await db().from("students").update({ failed_logins: student.failed_logins + 1 }).eq("id", student.id);
    return { error: "Usuario o PIN incorrectos." };
  }
  await db().from("students").update({ failed_logins: 0, last_seen_at: new Date().toISOString() }).eq("id", student.id);
  await startStudentSession(student.id);
  redirect("/practicar");
}

export async function logoutStudent() {
  await endStudentSession();
  redirect("/");
}

export async function updateAlias(_prev: LoginState, form: FormData): Promise<LoginState> {
  const { student } = await requireStudent();
  const alias = String(form.get("alias") ?? "").trim().replace(/\s+/g, " ");
  if (alias.length < 2 || alias.length > 20) return { error: "El alias debe tener entre 2 y 20 caracteres." };
  const { data: same } = await db().from("students").select("id").eq("class_id", student.class_id).ilike("alias", alias.replace(/[%_]/g, "\\$&")).neq("id", student.id);
  if (same && same.length) return { error: "Ese alias ya lo usa un compañero. Elige otro." };
  await db().from("students").update({ alias }).eq("id", student.id);
  revalidatePath("/", "layout");
  return {};
}



export async function submitPractice(lessonId: string, payload: SubmitPayload): Promise<SubmitResult> {
  const { student, klass } = await requireStudent();
  const found = findLesson(lessonId);
  if (!found) return { ok: false, error: "Lección no encontrada." };

  const { data: progress } = await db()
    .from("lesson_progress")
    .select("lesson_id,completed,best_net,best_acc")
    .eq("student_id", student.id);
  const completedSet = new Set((progress ?? []).filter((p) => p.completed).map((p) => p.lesson_id as string));
  if (!isUnlocked(lessonId, completedSet)) return { ok: false, error: "Esta lección todavía está bloqueada." };

  const target = found.lesson.text;
  const p = sanitize(payload, target.length + MAX_EXTRA);
  if (!p) return { ok: false, error: "Datos del ejercicio no válidos." };

  const baremo = normalizeBaremo(klass.baremo);
  const s = computeScore(target, p.typed, p.durationMs, baremo.penalty);
  const flagged = checkEvents(p.events, p.typed.length, p.durationMs);

  const insertError = await insertAttempt({
    student_id: student.id,
    class_id: klass.id,
    mode: "practica",
    lesson_id: lessonId,
    chars: s.chars,
    errors: s.errors,
    duration_ms: p.durationMs,
    gross_ppm: s.grossPpm,
    net_ppm: s.netPpm,
    accuracy: s.accuracy,
    flagged: !!flagged,
    flag_reason: flagged,
    typed: p.typed,
  });
  if (insertError) return { ok: false, error: "No se pudo guardar el resultado. Vuelve a intentarlo." };

  const fullText = s.consumed === target.length;
  const completed = !flagged && fullText && s.accuracy >= PASS_ACCURACY;
  if (!flagged && fullText) {
    const prev = (progress ?? []).find((x) => x.lesson_id === lessonId);
    await db()
      .from("lesson_progress")
      .upsert({
        student_id: student.id,
        lesson_id: lessonId,
        best_net: Math.max(Number(prev?.best_net ?? 0), s.netPpm),
        best_acc: Math.max(Number(prev?.best_acc ?? 0), s.accuracy),
        completed: Boolean(prev?.completed) || completed,
        updated_at: new Date().toISOString(),
      });
  }
  await db().from("students").update({ last_seen_at: new Date().toISOString() }).eq("id", student.id);
  revalidatePath("/practicar");
  const e = evaluate({ chars: s.chars, errors: s.errors, duration_ms: p.durationMs }, baremo);
  return { ok: true, chars: s.chars, errors: s.errors, netPpm: e.netPpm, grossPpm: e.grossPpm, accuracy: e.accuracy, flagged, completed };
}

async function loadTest(testId: string, classId: string): Promise<TestRow | null> {
  const { data } = await db().from("tests").select("*").eq("id", testId).eq("class_id", classId).maybeSingle();
  return (data as TestRow) ?? null;
}

export type { StartResult };

export async function startTest(testId: string): Promise<StartResult> {
  const { student, klass } = await requireStudent();
  const test = await loadTest(testId, klass.id);
  if (!test) return { ok: false, error: "Prueba no encontrada." };
  return startRun(student.id, test);
}

export async function submitTest(testId: string, payload: SubmitPayload): Promise<SubmitResult> {
  const { student, klass } = await requireStudent();
  const test = await loadTest(testId, klass.id);
  if (!test || test.content.startsWith("form:")) return { ok: false, error: "Prueba no encontrada." };

  const p = sanitize(payload, test.content.length + MAX_EXTRA);
  if (!p) return { ok: false, error: "Datos de la prueba no válidos." };

  const run = await closeRun(student.id, test, p.durationMs);
  if (!run.ok) return run;
  const durationMs = run.durationMs;
  const flagged = run.flagged ?? checkEvents(p.events, p.typed.length, durationMs);

  const baremo = normalizeBaremo(klass.baremo);
  const s = computeScore(test.content, p.typed, durationMs, baremo.penalty);
  const error = await insertAttempt({
    student_id: student.id,
    class_id: klass.id,
    mode: "prueba",
    test_id: testId,
    chars: s.chars,
    errors: s.errors,
    duration_ms: durationMs,
    gross_ppm: s.grossPpm,
    net_ppm: s.netPpm,
    accuracy: s.accuracy,
    flagged: !!flagged,
    flag_reason: flagged,
    typed: p.typed,
  });
  if (error) {
    console.error("submitTest", error);
    await reopenRun(run.sessionId);
    return { ok: false, error: "No se pudo guardar la prueba. Vuelve a pulsar entregar o avisa al profesor antes de cerrar la página." };
  }
  // Sin revalidar la pagina en curso: asi el alumno sigue viendo su resultado aunque fuera su ultimo intento
  // Mismo calculo que veran despues el alumno y el profesor
  const e = evaluate({ chars: s.chars, errors: s.errors, duration_ms: durationMs }, baremo);
  return { ok: true, chars: s.chars, errors: s.errors, netPpm: e.netPpm, grossPpm: e.grossPpm, accuracy: e.accuracy, flagged, grade: e.grade };
}
