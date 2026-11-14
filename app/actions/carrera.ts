"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireStudent, requireTeacherClass } from "@/lib/session";
import { checkEvents, computeScore, evaluate, MAX_EXTRA, normalizeBaremo } from "@/lib/scoring";
import { insertAttempt, sanitize, type SubmitPayload, type SubmitResult } from "@/lib/attempts";
import { COUNTDOWN_MS, loadRace, RACE_GRACE_MS, racePhase, raceState, type RaceState } from "@/lib/races";
import type { FormState } from "./profesor";

// ---------------- Alumno ----------------

export async function joinRace(raceId: string): Promise<RaceState | { error: string }> {
  const { student, klass } = await requireStudent();
  const race = await loadRace(raceId, klass.id);
  if (!race) return { error: "Carrera no encontrada." };
  const phase = racePhase(race);
  if (phase === "running" || phase === "finished") return { error: "La carrera ya ha empezado." };
  await db().from("race_participants").upsert({ race_id: raceId, student_id: student.id }, { onConflict: "race_id,student_id", ignoreDuplicates: true });
  return raceState(race, normalizeBaremo(klass.baremo), student.id);
}

export type RaceProgress = { consumed: number; chars: number; errors: number };

// Envia el avance del alumno (si lo hay) y devuelve el estado de la carrera. Se llama cada segundo.
export async function raceTick(raceId: string, progress: RaceProgress | null): Promise<RaceState | { error: string }> {
  const { student, klass } = await requireStudent();
  const race = await loadRace(raceId, klass.id);
  if (!race) return { error: "Carrera no encontrada." };
  if (progress && racePhase(race) === "running") {
    const consumed = Math.max(0, Math.min(race.content.length, Math.floor(Number(progress.consumed) || 0)));
    const chars = Math.max(0, Math.min(race.content.length + MAX_EXTRA, Math.floor(Number(progress.chars) || 0)));
    const errors = Math.max(0, Math.min(chars, Math.floor(Number(progress.errors) || 0)));
    await db()
      .from("race_participants")
      .update({ consumed, chars, errors, updated_at: new Date().toISOString() })
      .eq("race_id", raceId)
      .eq("student_id", student.id)
      .is("finished_at", null);
  }
  return raceState(race, normalizeBaremo(klass.baremo), student.id);
}

export async function submitRace(raceId: string, payload: SubmitPayload): Promise<SubmitResult> {
  const { student, klass } = await requireStudent();
  const race = await loadRace(raceId, klass.id);
  if (!race || !race.starts_at) return { ok: false, error: "Carrera no encontrada." };

  const { data: part } = await db()
    .from("race_participants")
    .select("finished_at")
    .eq("race_id", raceId)
    .eq("student_id", student.id)
    .maybeSingle();
  if (!part) return { ok: false, error: "No estabas inscrito en esta carrera." };
  if (part.finished_at) return { ok: false, error: "Ya habías entregado esta carrera." };

  const p = sanitize(payload, race.content.length + MAX_EXTRA);
  if (!p) return { ok: false, error: "Datos de la carrera no válidos." };

  const startsAt = Date.parse(race.starts_at);
  const limitMs = race.duration_sec * 1000;
  const serverElapsed = Date.now() - startsAt;
  let flagged: string | null = null;
  if (serverElapsed > limitMs + RACE_GRACE_MS) flagged = "entregada fuera de tiempo";
  // El tiempo no puede superar lo que ha pasado realmente desde la salida, ni la duracion de la carrera.
  const durationMs = Math.min(Math.max(p.durationMs, 1000), limitMs, Math.max(serverElapsed, 1000));
  flagged = flagged ?? checkEvents(p.events, p.typed.length, durationMs);

  const baremo = normalizeBaremo(klass.baremo);
  const s = computeScore(race.content, p.typed, durationMs, baremo.penalty);
  const error = await insertAttempt({
    student_id: student.id,
    class_id: klass.id,
    mode: "carrera",
    race_id: raceId,
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
    console.error("submitRace", error);
    return { ok: false, error: error.code === "23505" ? "Ya habías entregado esta carrera." : "No se pudo guardar el resultado." };
  }
  await db()
    .from("race_participants")
    .update({ consumed: s.consumed, chars: s.chars, errors: s.errors, finished_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("race_id", raceId)
    .eq("student_id", student.id);
  const e = evaluate({ chars: s.chars, errors: s.errors, duration_ms: durationMs }, baremo);
  return { ok: true, chars: s.chars, errors: s.errors, netPpm: e.netPpm, grossPpm: e.grossPpm, accuracy: e.accuracy, flagged };
}

// ---------------- Profesor ----------------

export async function createRace(classId: string, _prev: FormState, form: FormData): Promise<FormState> {
  await requireTeacherClass(classId);
  const title = String(form.get("title") ?? "").trim() || "Carrera";
  const own = String(form.get("content") ?? "").replace(/\r?\n+/g, " ").replace(/\s+/g, " ").trim();
  const content = own;
  const durationMin = Number(String(form.get("duration") ?? "").replace(",", "."));
  if (content.length < 50) return { error: "Elige un texto del banco o pega uno de al menos 50 caracteres." };
  if (!Number.isFinite(durationMin) || durationMin < 0.5 || durationMin > 15) return { error: "La duración debe estar entre 0,5 y 15 minutos." };
  const { data, error } = await db()
    .from("races")
    .insert({ class_id: classId, title, content, duration_sec: Math.round(durationMin * 60) })
    .select("id")
    .single();
  if (error || !data) {
    console.error("createRace", error);
    return { error: `No se pudo crear la carrera${error?.message ? `: ${error.message}` : "."}` };
  }
  redirect(`/profesor/clase/${classId}/carrera/${data.id}`);
}

export async function startRace(classId: string, raceId: string) {
  await requireTeacherClass(classId);
  const startsAt = new Date(Date.now() + COUNTDOWN_MS).toISOString();
  await db().from("races").update({ status: "running", starts_at: startsAt }).eq("id", raceId).eq("class_id", classId).eq("status", "waiting");
  revalidatePath(`/profesor/clase/${classId}/carrera/${raceId}`);
}

export async function finishRace(classId: string, raceId: string) {
  await requireTeacherClass(classId);
  await db().from("races").update({ status: "finished" }).eq("id", raceId).eq("class_id", classId);
  revalidatePath(`/profesor/clase/${classId}/carrera/${raceId}`);
}

export async function deleteRace(classId: string, raceId: string) {
  await requireTeacherClass(classId);
  await db().from("races").delete().eq("id", raceId).eq("class_id", classId);
  revalidatePath(`/profesor/clase/${classId}`);
  redirect(`/profesor/clase/${classId}?tab=carreras`);
}

export async function teacherRaceState(classId: string, raceId: string): Promise<RaceState | { error: string }> {
  const { klass } = await requireTeacherClass(classId);
  const race = await loadRace(raceId, classId);
  if (!race) return { error: "Carrera no encontrada." };
  return raceState(race, normalizeBaremo(klass.baremo), null);
}
