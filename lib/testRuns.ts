import "server-only";
import { db, type AttemptRow, type TestRow } from "./db";
import { evaluate, type Baremo } from "./scoring";

// Margen para entregar despues de que acabe el tiempo (red lenta, envio automatico)
export const TEST_GRACE_MS = 15000;

type Session = { id: string; started_at: string; submitted: boolean };

export type RunState = {
  used: number; // intentos empezados (entregados o no)
  max: number | null; // null = ilimitados
  left: number | null;
  inProgress: { id: string; startedAt: number; remainingMs: number | null } | null;
  windowOpen: boolean;
  canStart: boolean; // puede empezar un intento nuevo (o seguir el que tiene a medias)
  reason: string | null; // por que no puede, si no puede
};

export function isExpired(test: TestRow, s: Session, now = Date.now()) {
  return test.duration_sec !== null && now - Date.parse(s.started_at) > test.duration_sec * 1000 + TEST_GRACE_MS;
}

export async function getRunState(studentId: string, test: TestRow): Promise<RunState> {
  const now = Date.now();
  const { data } = await db()
    .from("test_sessions")
    .select("id,started_at,submitted")
    .eq("student_id", studentId)
    .eq("test_id", test.id)
    .order("started_at", { ascending: true });
  const sessions = (data ?? []) as Session[];
  const used = sessions.length;
  const max = test.max_attempts;
  const open = [...sessions].reverse().find((s) => !s.submitted && !isExpired(test, s, now)) ?? null;
  const windowOpen = now >= Date.parse(test.opens_at) && now <= Date.parse(test.closes_at);

  let inProgress: RunState["inProgress"] = null;
  if (open) {
    const startedAt = Date.parse(open.started_at);
    inProgress = {
      id: open.id,
      startedAt,
      remainingMs: test.duration_sec === null ? null : Math.max(0, test.duration_sec * 1000 - (now - startedAt)),
    };
  }

  let reason: string | null = null;
  if (!inProgress) {
    if (now < Date.parse(test.opens_at)) reason = "La prueba todavía no está abierta.";
    else if (now > Date.parse(test.closes_at)) reason = "La prueba ya está cerrada.";
    else if (max !== null && used >= max) reason = `Has agotado los ${max} ${max === 1 ? "intento" : "intentos"} de este examen.`;
  }
  return {
    used,
    max,
    left: max === null ? null : Math.max(0, max - used),
    inProgress,
    windowOpen,
    canStart: !!inProgress || reason === null,
    reason,
  };
}

export type StartResult =
  | { ok: true; sessionId: string; limitMs: number | null; elapsedMs: number; resumed: boolean }
  | { ok: false; error: string };

export async function startRun(studentId: string, test: TestRow): Promise<StartResult> {
  const st = await getRunState(studentId, test);
  const limitMs = test.duration_sec === null ? null : test.duration_sec * 1000;
  if (st.inProgress) return { ok: true, sessionId: st.inProgress.id, limitMs, elapsedMs: Date.now() - st.inProgress.startedAt, resumed: true };
  if (!st.canStart) return { ok: false, error: st.reason ?? "No puedes empezar esta prueba." };
  const { data: created, error } = await db().from("test_sessions").insert({ student_id: studentId, test_id: test.id }).select("id").single();
  if (error || !created) {
    console.error("startRun", error);
    return { ok: false, error: "No se pudo iniciar la prueba. Vuelve a intentarlo." };
  }
  return { ok: true, sessionId: created.id as string, limitMs, elapsedMs: 0, resumed: false };
}

// Valida la entrega: busca el intento abierto, fija el tiempo que cuenta y lo marca como entregado.
export async function closeRun(
  studentId: string,
  test: TestRow,
  clientDurationMs: number,
): Promise<{ ok: true; durationMs: number; flagged: string | null; sessionId: string } | { ok: false; error: string }> {
  const { data } = await db()
    .from("test_sessions")
    .select("id,started_at,submitted")
    .eq("student_id", studentId)
    .eq("test_id", test.id)
    .eq("submitted", false)
    .order("started_at", { ascending: false })
    .limit(1);
  const s = (data?.[0] as Session | undefined) ?? null;
  if (!s) return { ok: false, error: "No hay ningún intento abierto de esta prueba. Puede que ya lo hayas entregado." };

  // Marca entregado antes de guardar, para que un doble envio no cree dos intentos
  const { data: marked } = await db().from("test_sessions").update({ submitted: true }).eq("id", s.id).eq("submitted", false).select("id");
  if (!marked || marked.length === 0) return { ok: false, error: "Este intento ya se había entregado." };

  const serverElapsed = Math.max(1000, Date.now() - Date.parse(s.started_at));
  let flagged: string | null = null;
  let durationMs = Math.min(Math.max(clientDurationMs, 1000), serverElapsed);
  if (test.duration_sec !== null) {
    const limitMs = test.duration_sec * 1000;
    if (serverElapsed > limitMs + TEST_GRACE_MS) flagged = "entregada fuera de tiempo";
    durationMs = Math.min(durationMs, limitMs);
  }
  return { ok: true, durationMs, flagged, sessionId: s.id };
}

// Si no se pudo guardar el resultado, el intento se reabre para no perderlo
export async function reopenRun(sessionId: string) {
  await db().from("test_sessions").update({ submitted: false }).eq("id", sessionId);
}

// Mejor intento: el de mas netas entre los validos; si todos estan en revision, el mejor de ellos.
export function bestAttempt<T extends Pick<AttemptRow, "chars" | "errors" | "duration_ms" | "flagged">>(list: T[], b: Baremo): T | null {
  if (list.length === 0) return null;
  const valid = list.filter((a) => !a.flagged);
  const pool = valid.length ? valid : list;
  return pool.reduce((best, a) => (evaluate(a, b).netPpm > evaluate(best, b).netPpm ? a : best));
}

export function durationLabel(sec: number | null): string {
  if (sec === null) return "Sin límite de tiempo";
  if (sec % 60 === 0) return `${sec / 60} min`;
  return sec > 60 ? `${Math.floor(sec / 60)} min ${sec % 60} s` : `${sec} s`;
}

export function attemptsLabel(max: number | null): string {
  return max === null ? "Intentos ilimitados" : `Examen · ${max} ${max === 1 ? "intento" : "intentos"}`;
}
