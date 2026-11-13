import Link from "next/link";
import { db } from "@/lib/db";
import { requireStudent } from "@/lib/session";
import { LEVELS, isUnlocked, ALL_LESSONS } from "@/lib/lessons";
import { formatDateTime } from "@/lib/utils";

type Progress = { lesson_id: string; best_net: number; best_acc: number; completed: boolean };

export default async function PracticarPage() {
  const { student, klass } = await requireStudent();
  const [{ data: progress }, { data: openTests }, { data: recent }] = await Promise.all([
    db().from("lesson_progress").select("lesson_id,best_net,best_acc,completed").eq("student_id", student.id),
    db()
      .from("tests")
      .select("id,title,closes_at")
      .eq("class_id", klass.id)
      .lte("opens_at", new Date().toISOString())
      .gte("closes_at", new Date().toISOString()),
    db()
      .from("attempts")
      .select("id,mode,lesson_id,net_ppm,accuracy,created_at,flagged")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);

  const byLesson = new Map((progress as Progress[] | null ?? []).map((p) => [p.lesson_id, p]));
  const completed = new Set([...byLesson.values()].filter((p) => p.completed).map((p) => p.lesson_id));
  const nextLesson = ALL_LESSONS.find((l) => !completed.has(l.id) && isUnlocked(l.id, completed));

  const { data: delivered } = await db()
    .from("attempts")
    .select("test_id")
    .eq("student_id", student.id)
    .eq("mode", "prueba");
  const deliveredIds = new Set((delivered ?? []).map((d) => d.test_id));
  const pendingTests = (openTests ?? []).filter((t) => !deliveredIds.has(t.id));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="kicker">
            {completed.size} de {ALL_LESSONS.length} lecciones superadas
          </span>
          <h1 className="h1 m-0">Practicar</h1>
        </div>
        {nextLesson && (
          <Link href={`/practicar/${nextLesson.id}`} className="btn btn-primary">
            Continuar: {nextLesson.title}
          </Link>
        )}
      </div>

      {pendingTests.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-accent-soft px-6 py-4">
          <span className="text-[15px] text-accent-ink">
            <strong>Tienes {pendingTests.length === 1 ? "una prueba abierta" : `${pendingTests.length} pruebas abiertas`}.</strong>{" "}
            {pendingTests[0].title}, hasta el {formatDateTime(pendingTests[0].closes_at)}.
          </span>
          <Link href={`/pruebas/${pendingTests[0].id}`} className="btn btn-primary">
            Ir a la prueba
          </Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {LEVELS.map((level) => {
          const done = level.lessons.filter((l) => completed.has(l.id)).length;
          return (
            <section key={level.id} className="card flex flex-col gap-4 p-6">
              <div className="flex flex-col gap-1">
                <span className="text-[13px] font-semibold text-accent">Nivel {level.id}</span>
                <h2 className="h2 m-0">{level.title}</h2>
                <p className="m-0 text-sm leading-relaxed text-muted">{level.description}</p>
              </div>
              <div className="flex gap-1.5" aria-label={`${done} de ${level.lessons.length} superadas`}>
                {level.lessons.map((l) => (
                  <span key={l.id} className={`h-1.5 flex-1 rounded-full ${completed.has(l.id) ? "bg-accent" : "bg-line"}`} />
                ))}
              </div>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {level.lessons.map((l) => {
                  const p = byLesson.get(l.id);
                  const unlocked = isUnlocked(l.id, completed);
                  return (
                    <li key={l.id}>
                      {unlocked ? (
                        <Link
                          href={`/practicar/${l.id}`}
                          className="flex min-h-11 items-center justify-between gap-3 rounded-[10px] px-3 py-2 text-[15px] text-ink no-underline hover:bg-ground"
                        >
                          <span className="flex items-center gap-2.5">
                            <span
                              className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                                p?.completed ? "bg-accent text-white" : "border border-line-strong text-muted"
                              }`}
                              aria-hidden="true"
                            >
                              {p?.completed ? (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M5 12l5 5L20 7" />
                                </svg>
                              ) : (
                                l.id.split("-")[1]
                              )}
                            </span>
                            {l.title}
                          </span>
                          {p && p.best_net > 0 && <span className="font-mono text-[13px] text-muted">{Math.round(Number(p.best_net))} netas</span>}
                        </Link>
                      ) : (
                        <span className="flex min-h-11 items-center gap-2.5 px-3 py-2 text-[15px] text-soft">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <rect x="5" y="11" width="14" height="10" rx="2" />
                            <path d="M8 11V7a4 4 0 0 1 8 0v4" />
                          </svg>
                          {l.title}
                          <span className="sr-only">(bloqueada)</span>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {recent && recent.length > 0 && (
        <section className="card overflow-x-auto">
          <h2 className="h2 m-0 px-5 pt-5">Últimos ejercicios</h2>
          <table className="mt-3 w-full min-w-[520px] border-collapse text-[15px]">
            <thead>
              <tr>
                <th className="th">Ejercicio</th>
                <th className="th">Fecha</th>
                <th className="th text-right">Netas/min</th>
                <th className="th text-right">Precisión</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((a) => (
                <tr key={a.id}>
                  <td className="td">
                    {a.mode === "prueba" ? "Prueba" : ALL_LESSONS.find((l) => l.id === a.lesson_id)?.title ?? "Práctica"}
                    {a.flagged && <span className="ml-2 text-xs text-error-ink">(no cuenta)</span>}
                  </td>
                  <td className="td text-muted">{formatDateTime(a.created_at)}</td>
                  <td className="td text-right font-mono">{Math.round(Number(a.net_ppm))}</td>
                  <td className="td text-right font-mono">{Number(a.accuracy)} %</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
