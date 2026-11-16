import { pct } from "@/lib/format";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db, type AttemptRow, type TestRow } from "@/lib/db";
import { requireStudent } from "@/lib/session";
import { evaluate, formatGrade, normalizeBaremo } from "@/lib/scoring";
import { formatDateTime } from "@/lib/utils";
import { attemptsLabel, bestAttempt, durationLabel, getRunState } from "@/lib/testRuns";
import { AttemptReview } from "@/components/AttemptReview";
import { TestRunner } from "./TestRunner";

export default async function PruebaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ intento?: string }>;
}) {
  const { id } = await params;
  const { intento } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { student, klass } = await requireStudent();
  const { data } = await db().from("tests").select("*").eq("id", id).eq("class_id", klass.id).maybeSingle();
  if (!data) notFound();
  const test = { max_attempts: null, ...data } as TestRow;
  const baremo = normalizeBaremo(klass.baremo);

  const [{ data: attData }, run] = await Promise.all([
    db().from("attempts").select("*").eq("student_id", student.id).eq("test_id", id).eq("mode", "prueba").order("created_at", { ascending: true }),
    getRunState(student.id, test),
  ]);
  const attempts = (attData ?? []) as AttemptRow[];
  const best = bestAttempt(attempts, baremo);
  // Correccion que se muestra: la elegida, o la del ultimo intento
  const shown = attempts.find((a) => a.id === intento) ?? (run.inProgress ? null : attempts[attempts.length - 1] ?? null);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="kicker">
            {durationLabel(test.duration_sec)} · {attemptsLabel(test.max_attempts)}
          </span>
          <h1 className="h1 m-0">{test.title}</h1>
          <span className="text-sm text-muted">Abierta hasta el {formatDateTime(test.closes_at)}</span>
        </div>
        <Link href="/pruebas" className="btn btn-secondary">Volver</Link>
      </div>

      {run.canStart ? (
        <TestRunner
          testId={test.id}
          text={test.content}
          durationSec={test.duration_sec}
          resumed={!!run.inProgress}
          penalty={baremo.penalty}
          attemptNumber={run.used + (run.inProgress ? 0 : 1)}
          attemptsLeft={run.left}
        />
      ) : (
        <div className="card p-6 text-[15px] text-muted">{run.reason}</div>
      )}

      {attempts.length > 0 && (
        <section className="card overflow-x-auto">
          <div className="flex flex-wrap items-baseline justify-between gap-3 px-5 pt-5">
            <h2 className="h2 m-0">Tus intentos</h2>
            {best && (
              <span className="text-[15px] text-muted">
                Nota que cuenta: <strong className="font-display text-xl text-ink">{formatGrade(evaluate(best, baremo).grade)}</strong> (mejor intento)
              </span>
            )}
          </div>
          <table className="mt-3 w-full min-w-[560px] border-collapse text-[15px]">
            <thead>
              <tr>
                <th className="th">Intento</th>
                <th className="th">Fecha</th>
                <th className="th text-right">Netas/min</th>
                <th className="th text-right">Precisión</th>
                <th className="th text-right">Nota</th>
                <th className="th"><span className="sr-only">Corrección</span></th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((a, i) => {
                const e = evaluate(a, baremo);
                const isShown = shown?.id === a.id;
                return (
                  <tr key={a.id} className={isShown ? "bg-accent-soft" : ""}>
                    <td className="td font-medium">
                      {i + 1}
                      {best?.id === a.id && attempts.length > 1 && (
                        <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-white">Mejor</span>
                      )}
                      {a.flagged && <span className="ml-2 text-xs font-semibold text-error-ink">en revisión</span>}
                    </td>
                    <td className="td text-muted">{formatDateTime(a.created_at)}</td>
                    <td className="td text-right font-mono">{Math.round(e.netPpm)}</td>
                    <td className="td text-right font-mono">{pct(e.accuracy)}</td>
                    <td className="td text-right font-mono font-semibold">{formatGrade(e.grade)}</td>
                    <td className="td text-right">
                      {isShown ? (
                        <span className="text-[13px] text-soft">Abajo</span>
                      ) : (
                        <Link href={`/pruebas/${id}?intento=${a.id}`} className="font-semibold text-accent">Ver corrección</Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}

      {shown && (
        <section className="flex flex-col gap-3">
          <h2 className="h2 m-0">
            Corrección del intento {attempts.findIndex((a) => a.id === shown.id) + 1}
            <span className="ml-2 text-sm font-normal text-muted">{formatDateTime(shown.created_at)}</span>
          </h2>
          <AttemptReview
            target={test.content}
            typed={shown.typed}
            chars={shown.chars}
            errors={shown.errors}
            durationMs={shown.duration_ms}
            result={evaluate(shown, baremo)}
            showGrade
            flagged={shown.flagged ? shown.flag_reason ?? "pendiente de revisar" : null}
          />
        </section>
      )}
    </>
  );
}
