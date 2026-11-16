import "server-only";
import { db, type AttemptRow } from "./db";
import { align, evaluate, ST_OK, type Baremo } from "./scoring";
import { findLesson } from "./lessons";
import { findForm, parseStoredForm } from "./forms";
import { baseKey, FINGERS } from "./keys";

export type KeyStat = { key: string; total: number; errors: number; rate: number };
export type FingerStat = { finger: string; total: number; errors: number; rate: number };
export type WeekPoint = { week: string; label: string; avgNet: number; bestNet: number; avgAcc: number; count: number };
export type DayPoint = { day: string; label: string; minutes: number };

export type Progress = {
  keys: KeyStat[];
  fingers: FingerStat[];
  weeks: WeekPoint[];
  days: DayPoint[];
  totals: { attempts: number; minutes: number; minutes7: number; analyzedChars: number };
};

// Solo cuentan teclas con un minimo de apariciones, para no sacar conclusiones de dos pulsaciones
export const MIN_KEY_SAMPLES = 8;

const madridParts = (d: Date) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );

function dayKey(d: Date) {
  const p = madridParts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

function weekKey(d: Date) {
  const p = madridParts(d);
  const idx = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(p.weekday);
  const monday = new Date(`${p.year}-${p.month}-${p.day}T12:00:00Z`);
  monday.setUTCDate(monday.getUTCDate() - idx);
  return monday.toISOString().slice(0, 10);
}

const short = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const r1 = (x: number) => Math.round(x * 10) / 10;

export async function loadProgress(studentId: string, baremo: Baremo): Promise<Progress> {
  const since = new Date(Date.now() - 120 * 24 * 3600 * 1000).toISOString();
  const { data } = await db()
    .from("attempts")
    .select("id,mode,lesson_id,test_id,race_id,chars,errors,duration_ms,flagged,typed,created_at")
    .eq("student_id", studentId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(400);
  const attempts = (data ?? []) as AttemptRow[];

  // Textos originales de pruebas y carreras
  const testIds = [...new Set(attempts.map((a) => a.test_id).filter(Boolean))] as string[];
  const raceIds = [...new Set(attempts.map((a) => a.race_id).filter(Boolean))] as string[];
  const [{ data: tests }, { data: races }] = await Promise.all([
    testIds.length ? db().from("tests").select("id,content").in("id", testIds) : Promise.resolve({ data: [] as { id: string; content: string }[] }),
    raceIds.length ? db().from("races").select("id,content").in("id", raceIds) : Promise.resolve({ data: [] as { id: string; content: string }[] }),
  ]);
  const contents = new Map<string, string>();
  for (const t of tests ?? []) contents.set(t.id, t.content);
  for (const r of races ?? []) contents.set(r.id, r.content);

  // ---------- Fallos por tecla (ultimos 60 ejercicios con texto guardado) ----------
  const keyMap = new Map<string, { total: number; errors: number }>();
  let analyzedChars = 0;
  const count = (expected: string, typed: string) => {
    const a = align(expected, typed);
    for (let i = 0; i < a.consumed; i++) {
      const ch = expected[i];
      if (ch === " ") continue;
      const k = baseKey(ch);
      const s = keyMap.get(k) ?? { total: 0, errors: 0 };
      s.total++;
      if (a.status[i] !== ST_OK) s.errors++;
      keyMap.set(k, s);
      analyzedChars++;
    }
  };
  for (const a of attempts.filter((x) => x.typed && !x.flagged).slice(0, 60)) {
    const stored = parseStoredForm(a.typed);
    if (stored) {
      const f = findForm(stored.form);
      if (!f) continue;
      stored.answers.forEach((rec, r) => {
        const expected = f.records[r];
        if (!expected) return;
        for (const field of f.fields) {
          const typed = String(rec[field.key] ?? "").trim();
          if (typed) count(expected[field.key], typed);
        }
      });
      continue;
    }
    let target = "";
    if (a.lesson_id) target = findLesson(a.lesson_id)?.lesson.text ?? "";
    else if (a.test_id) target = contents.get(a.test_id) ?? "";
    else if (a.race_id) target = contents.get(a.race_id) ?? "";
    if (target && !target.startsWith("form:")) count(target.normalize("NFC"), a.typed!);
  }
  const keys: KeyStat[] = [...keyMap].map(([key, s]) => ({ key, ...s, rate: s.total ? s.errors / s.total : 0 }));

  const fingerMap = new Map<string, { total: number; errors: number }>();
  for (const k of keys) {
    const f = FINGERS[k.key];
    if (!f) continue;
    const s = fingerMap.get(f) ?? { total: 0, errors: 0 };
    s.total += k.total;
    s.errors += k.errors;
    fingerMap.set(f, s);
  }
  const fingers: FingerStat[] = [...fingerMap]
    .map(([finger, s]) => ({ finger, ...s, rate: s.total ? s.errors / s.total : 0 }))
    .sort((a, b) => b.rate - a.rate);

  // ---------- Evolucion semanal (ultimas 8 semanas) ----------
  const now = new Date();
  const weekList: string[] = [];
  for (let i = 7; i >= 0; i--) weekList.push(weekKey(new Date(now.getTime() - i * 7 * 24 * 3600 * 1000)));
  const byWeek = new Map<string, { nets: number[]; accs: number[] }>();
  for (const a of attempts) {
    if (a.flagged || a.chars < 50) continue;
    const w = weekKey(new Date(a.created_at));
    const e = evaluate(a, baremo);
    const s = byWeek.get(w) ?? { nets: [], accs: [] };
    s.nets.push(e.netPpm);
    s.accs.push(e.accuracy);
    byWeek.set(w, s);
  }
  const weeks: WeekPoint[] = [...new Set(weekList)].map((w) => {
    const s = byWeek.get(w);
    const n = s?.nets.length ?? 0;
    return {
      week: w,
      label: short(w),
      count: n,
      avgNet: n ? r1(s!.nets.reduce((x, y) => x + y, 0) / n) : 0,
      bestNet: n ? r1(Math.max(...s!.nets)) : 0,
      avgAcc: n ? r1(s!.accs.reduce((x, y) => x + y, 0) / n) : 0,
    };
  });

  // ---------- Tiempo de practica (ultimos 14 dias) ----------
  const dayMs = new Map<string, number>();
  for (const a of attempts) {
    const d = dayKey(new Date(a.created_at));
    dayMs.set(d, (dayMs.get(d) ?? 0) + Number(a.duration_ms));
  }
  const days: DayPoint[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = dayKey(new Date(now.getTime() - i * 24 * 3600 * 1000));
    days.push({ day: d, label: short(d), minutes: Math.round((dayMs.get(d) ?? 0) / 60000) });
  }
  const minutes = Math.round(attempts.reduce((s, a) => s + Number(a.duration_ms), 0) / 60000);
  const minutes7 = days.slice(-7).reduce((s, d) => s + d.minutes, 0);

  return { keys, fingers, weeks, days, totals: { attempts: attempts.length, minutes, minutes7, analyzedChars } };
}

// Minutos practicados en los ultimos 7 dias por alumno (para la tabla del profesor)
export async function practiceMinutes7(classId: string): Promise<Map<string, number>> {
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data } = await db().from("attempts").select("student_id,duration_ms").eq("class_id", classId).gte("created_at", since).limit(10000);
  const m = new Map<string, number>();
  for (const a of data ?? []) m.set(a.student_id, (m.get(a.student_id) ?? 0) + Number(a.duration_ms));
  return new Map([...m].map(([k, v]) => [k, Math.round(v / 60000)]));
}
