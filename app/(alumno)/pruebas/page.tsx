import Link from "next/link";
import { db, type AttemptRow, type TestRow } from "@/lib/db";
import { requireStudent } from "@/lib/session";
import { evaluate, formatGrade, normalizeBaremo } from "@/lib/scoring";
import { formatDateTime } from "@/lib/utils";
import { attemptsLabel, bestAttempt, durationLabel } from "@/lib/testRuns";

export default async function PruebasPage() {
  const { student, klass } = await requireStudent();
  const [{ data: tests }, { data: attempts }, { data: sessions }] = await Promise.all([
    db().from("tests").select("*").eq("class_id", klass.id).order("opens_at", { ascending: false }),
    db().from("attempts").select("id,test_id,chars,errors,duration_ms,flagged").eq("student_id", student.id).eq("mode", "prueba"),
    db().from("test_sessions").select("test_id").eq("student_id", student.id),
  ]);
  const baremo = normalizeBaremo(klass.baremo);
  const byTest = new Map<string, AttemptRow[]>();
  for (const a of (attempts ?? []) as AttemptRow[]) byTest.set(a.test_id!, [...(byTest.get(a.test_id!) ?? []), a]);
  const used = new Map<string, number>();
  for (const s of sessions ?? []) used.set(s.test_id, (used.get(s.test_id) ?? 0) + 1);
  const now = Date.now();

  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="kicker">Evaluación</span>
        <h1 className="h1 m-0">Pruebas</h1>
      </div>
      {(tests ?? []).length === 0 && <div className="card p-8 text-muted">Tu profesor todavía no ha programado ninguna prueba.</div>}
      <div className="flex flex-col gap-3">
        {((tests ?? []) as TestRow[]).map((raw) => {
          const t = { ...raw, max_attempts: raw.max_attempts ?? null };
          const list = byTest.get(t.id) ?? [];
          const best = bestAttempt(list, baremo);
          const e = best ? evaluate(best, baremo) : null;
          const u = used.get(t.id) ?? 0;
          const open = now >= Date.parse(t.opens_at) && now <= Date.parse(t.closes_at);
          const upcoming = now < Date.parse(t.opens_at);
          const exhausted = t.max_attempts !== null && u >= t.max_attempts;
          let status: string;
          if (upcoming) status = `Se abre el ${formatDateTime(t.opens_at)}`;
          else if (open) status = `Abierta hasta el ${formatDateTime(t.closes_at)}`;
          else status = "Cerrada";
          const attemptsText = t.max_attempts === null ? `${list.length} ${list.length === 1 ? "intento" : "intentos"}` : `${u} de ${t.max_attempts} intentos usados`;
          return (
            <div key={t.id} className="card flex flex-wrap items-center justify-between gap-4 px-6 py-5">
              <div className="flex flex-col gap-1">
                <span className="text-base font-semibold">{t.title}</span>
                <span className="text-sm text-muted">
                  {durationLabel(t.duration_sec)} · {attemptsLabel(t.max_attempts)}
                </span>
                <span className={`text-[13px] font-semibold ${open && !exhausted ? "text-accent" : "text-soft"}`}>
                  {status} · {attemptsText}
                  {e && ` · mejor nota ${formatGrade(e.grade)} (${Math.round(e.netPpm)} netas/min)`}
                  {best?.flagged && " · en revisión"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {open && !exhausted && (
                  <Link href={`/pruebas/${t.id}`} className="btn btn-primary">
                    {u === 0 ? "Hacer la prueba" : "Repetir"}
                  </Link>
                )}
                {list.length > 0 && (
                  <Link href={`/pruebas/${t.id}`} className="btn btn-secondary">
                    Ver resultados
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
