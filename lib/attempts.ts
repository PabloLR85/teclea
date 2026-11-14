import "server-only";
import { db } from "./db";
import type { InputEvent } from "./scoring";

// Inserta un intento. Si la base aun no tiene la columna "typed" (falta la migracion 2), lo guarda sin ella.
export async function insertAttempt(row: Record<string, unknown>) {
  let { error } = await db().from("attempts").insert(row);
  if (error && /typed/i.test(error.message)) {
    const { typed: _omit, ...rest } = row;
    void _omit;
    ({ error } = await db().from("attempts").insert(rest));
  }
  return error;
}


export type SubmitPayload = { typed: string; events: InputEvent[]; durationMs: number };

export type SubmitResult =
  | {
      ok: true;
      chars: number;
      errors: number;
      netPpm: number;
      grossPpm: number;
      accuracy: number;
      flagged: string | null;
      completed?: boolean;
      grade?: number;
    }
  | { ok: false; error: string };

export function sanitize(p: SubmitPayload, maxLen: number): SubmitPayload | null {
  if (typeof p?.typed !== "string" || !Array.isArray(p.events) || typeof p.durationMs !== "number") return null;
  if (!Number.isFinite(p.durationMs) || p.durationMs <= 0 || p.durationMs > 60 * 60 * 1000) return null;
  return { typed: p.typed.slice(0, maxLen), events: p.events.slice(0, 20000), durationMs: Math.round(p.durationMs) };
}
