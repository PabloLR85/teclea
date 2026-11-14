"use server";

import { revalidatePath } from "next/cache";
import { db, type TestRow } from "@/lib/db";
import { requireStudent } from "@/lib/session";
import { checkEvents, evaluate, normalizeBaremo, type InputEvent } from "@/lib/scoring";
import { insertAttempt, type SubmitResult } from "@/lib/attempts";
import { findForm, PRACTICE_RECORDS, scoreForm, type FormAnswers, type FormTemplate, type StoredForm } from "@/lib/forms";

type Payload = { answers: FormAnswers; submitted: number; events: InputEvent[]; durationMs: number };

function clean(p: Payload, t: FormTemplate, limit: number): Payload | null {
  if (!p || !Array.isArray(p.answers) || !Array.isArray(p.events) || typeof p.durationMs !== "number") return null;
  if (!Number.isFinite(p.durationMs) || p.durationMs <= 0 || p.durationMs > 60 * 60 * 1000) return null;
  const answers = p.answers.slice(0, limit).map((a) => Object.fromEntries(t.fields.map((f) => [f.key, String(a?.[f.key] ?? "").slice(0, 200)])));
  const submitted = Math.max(0, Math.min(limit, Math.floor(Number(p.submitted) || 0), answers.length));
  return { answers, submitted, events: p.events.slice(0, 20000), durationMs: Math.round(p.durationMs) };
}

function typedLength(answers: FormAnswers) {
  return answers.reduce((s, a) => s + Object.values(a).reduce((x, v) => x + v.length, 0), 0);
}

export async function submitFormPractice(formId: string, payload: Payload): Promise<SubmitResult> {
  const { student, klass } = await requireStudent();
  const t = findForm(formId);
  if (!t) return { ok: false, error: "Formulario no encontrado." };
  const p = clean(payload, t, PRACTICE_RECORDS);
  if (!p) return { ok: false, error: "Datos del ejercicio no válidos." };

  const baremo = normalizeBaremo(klass.baremo);
  const s = scoreForm(t, p.answers, p.submitted, PRACTICE_RECORDS);
  const flagged = checkEvents(p.events, typedLength(p.answers), p.durationMs);
  const e = evaluate({ chars: s.chars, errors: s.errors, duration_ms: p.durationMs }, baremo);
  const stored: StoredForm = { form: t.id, answers: p.answers, submitted: p.submitted };
  const error = await insertAttempt({
    student_id: student.id,
    class_id: klass.id,
    mode: "practica",
    lesson_id: `form:${t.id}`,
    chars: s.chars,
    errors: s.errors,
    duration_ms: p.durationMs,
    gross_ppm: e.grossPpm,
    net_ppm: e.netPpm,
    accuracy: e.accuracy,
    flagged: !!flagged,
    flag_reason: flagged,
    typed: JSON.stringify(stored),
  });
  if (error) return { ok: false, error: "No se pudo guardar el resultado." };
  revalidatePath("/practicar");
  return { ok: true, chars: s.chars, errors: s.errors, netPpm: e.netPpm, grossPpm: e.grossPpm, accuracy: e.accuracy, flagged };
}

export async function submitFormTest(testId: string, payload: Payload): Promise<SubmitResult> {
  const { student, klass } = await requireStudent();
  const { data } = await db().from("tests").select("*").eq("id", testId).eq("class_id", klass.id).maybeSingle();
  const test = data as TestRow | null;
  if (!test || !test.content.startsWith("form:")) return { ok: false, error: "Prueba no encontrada." };
  const t = findForm(test.content.slice(5));
  if (!t) return { ok: false, error: "Formulario no encontrado." };

  const { data: session } = await db()
    .from("test_sessions")
    .select("started_at")
    .eq("student_id", student.id)
    .eq("test_id", testId)
    .maybeSingle();
  if (!session) return { ok: false, error: "La prueba no se había iniciado." };

  const p = clean(payload, t, t.records.length);
  if (!p) return { ok: false, error: "Datos de la prueba no válidos." };

  const serverElapsed = Date.now() - Date.parse(session.started_at);
  const limitMs = test.duration_sec * 1000;
  let flagged: string | null = serverElapsed > limitMs + 15000 ? "entregada fuera de tiempo" : null;
  const durationMs = Math.min(Math.max(p.durationMs, 1000), limitMs);
  flagged = flagged ?? checkEvents(p.events, typedLength(p.answers), durationMs);

  const baremo = normalizeBaremo(klass.baremo);
  const s = scoreForm(t, p.answers, p.submitted);
  const e = evaluate({ chars: s.chars, errors: s.errors, duration_ms: durationMs }, baremo);
  const stored: StoredForm = { form: t.id, answers: p.answers, submitted: p.submitted };
  const error = await insertAttempt({
    student_id: student.id,
    class_id: klass.id,
    mode: "prueba",
    test_id: testId,
    chars: s.chars,
    errors: s.errors,
    duration_ms: durationMs,
    gross_ppm: e.grossPpm,
    net_ppm: e.netPpm,
    accuracy: e.accuracy,
    flagged: !!flagged,
    flag_reason: flagged,
    typed: JSON.stringify(stored),
  });
  if (error) {
    console.error("submitFormTest", error);
    return {
      ok: false,
      error: error.code === "23505" ? "Esta prueba ya estaba entregada." : "No se pudo guardar la prueba. Avisa al profesor antes de cerrar la página.",
    };
  }
  revalidatePath("/pruebas");
  return { ok: true, chars: s.chars, errors: s.errors, netPpm: e.netPpm, grossPpm: e.grossPpm, accuracy: e.accuracy, flagged, grade: e.grade };
}
