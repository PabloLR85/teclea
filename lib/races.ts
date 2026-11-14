import "server-only";
import { db } from "./db";
import { evaluate, type Baremo } from "./scoring";

export type RaceRow = {
  id: string;
  class_id: string;
  title: string;
  content: string;
  duration_sec: number;
  status: "waiting" | "running" | "finished";
  starts_at: string | null;
  created_at: string;
};

export type RacePhase = "waiting" | "countdown" | "running" | "finished";

export type Lane = {
  studentId: string;
  alias: string;
  pct: number;
  net: number;
  errors: number;
  finished: boolean;
  me: boolean;
};

export type RaceState = {
  phase: RacePhase;
  serverNow: number;
  startsAt: number | null;
  endsAt: number | null;
  lanes: Lane[];
  joined: boolean;
};

// Segundos de margen para entregar despues de que acabe el tiempo (red lenta, envio automatico).
export const RACE_GRACE_MS = 15000;
export const COUNTDOWN_MS = 10000;

export function racePhase(race: RaceRow, now = Date.now()): RacePhase {
  if (race.status === "finished") return "finished";
  if (!race.starts_at) return "waiting";
  const start = Date.parse(race.starts_at);
  if (now < start) return "countdown";
  if (now < start + race.duration_sec * 1000) return "running";
  return "finished";
}

export async function loadRace(raceId: string, classId: string): Promise<RaceRow | null> {
  const { data } = await db().from("races").select("*").eq("id", raceId).eq("class_id", classId).maybeSingle();
  return (data as RaceRow) ?? null;
}

export async function raceState(race: RaceRow, baremo: Baremo, meId: string | null): Promise<RaceState> {
  const penalty = baremo.penalty;
  const now = Date.now();
  const phase = racePhase(race, now);
  const startsAt = race.starts_at ? Date.parse(race.starts_at) : null;
  const endsAt = startsAt ? startsAt + race.duration_sec * 1000 : null;

  const { data: parts } = await db()
    .from("race_participants")
    .select("student_id,consumed,chars,errors,finished_at,updated_at,students(alias)")
    .eq("race_id", race.id);

  const lanes: Lane[] = (parts ?? []).map((p) => {
    const alias = (p.students as unknown as { alias: string } | null)?.alias ?? "Alumno";
    // Netas en vivo: hasta el momento de la ultima actualizacion o de la entrega.
    let net = 0;
    if (startsAt && p.chars > 0) {
      const until = p.finished_at ? Date.parse(p.finished_at) : Math.min(Date.parse(p.updated_at), endsAt ?? now);
      const minutes = Math.max(until - startsAt, 1000) / 60000;
      net = Math.max(0, Math.round((p.chars - p.errors * penalty) / minutes));
    }
    return {
      studentId: p.student_id,
      alias,
      pct: Math.min(100, Math.round((p.consumed / race.content.length) * 100)),
      net,
      errors: p.errors,
      finished: !!p.finished_at,
      me: p.student_id === meId,
    };
  });
  if (phase === "finished") {
    // Clasificacion final: las mismas cifras que el resultado guardado de cada alumno.
    const { data: att } = await db()
      .from("attempts")
      .select("student_id,chars,errors,duration_ms,flagged")
      .eq("race_id", race.id)
      .eq("mode", "carrera");
    const byStudent = new Map((att ?? []).map((a) => [a.student_id as string, a]));
    for (const l of lanes) {
      const a = byStudent.get(l.studentId);
      if (a) {
        const e = evaluate(a, baremo);
        l.net = a.flagged ? 0 : Math.round(e.netPpm);
        l.errors = a.errors;
        l.finished = true;
      } else {
        l.net = 0;
        l.finished = false;
      }
    }
    lanes.sort((a, b) => b.net - a.net || b.pct - a.pct);
  } else {
    lanes.sort((a, b) => b.pct - a.pct || b.net - a.net);
  }
  return { phase, serverNow: now, startsAt, endsAt, lanes, joined: lanes.some((l) => l.me) };
}
