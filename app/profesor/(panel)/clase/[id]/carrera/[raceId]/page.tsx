import Link from "next/link";
import { notFound } from "next/navigation";
import { db, type AttemptRow, type StudentRow } from "@/lib/db";
import { requireTeacherClass } from "@/lib/session";
import { loadRace, raceState } from "@/lib/races";
import { evaluate, normalizeBaremo } from "@/lib/scoring";
import { TeacherRaceRoom } from "@/components/TeacherRaceRoom";
import { deleteRace, finishRace, startRace } from "@/app/actions/carrera";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function ProfesorCarreraPage({ params }: { params: Promise<{ id: string; raceId: string }> }) {
  const { id, raceId } = await params;
  if (!UUID.test(id) || !UUID.test(raceId)) notFound();
  const { klass } = await requireTeacherClass(id);
  const race = await loadRace(raceId, id);
  if (!race) notFound();
  const baremo = normalizeBaremo(klass.baremo);
  const state = await raceState(race, baremo, null);

  let results: { attempt: AttemptRow; student: StudentRow | undefined }[] = [];
  if (state.phase === "finished") {
    const [{ data: att }, { data: st }] = await Promise.all([
      db().from("attempts").select("*").eq("race_id", raceId).eq("mode", "carrera"),
      db().from("students").select("*").eq("class_id", id),
    ]);
    const students = new Map(((st ?? []) as StudentRow[]).map((s) => [s.id, s]));
    results = ((att ?? []) as AttemptRow[])
      .map((a) => ({ attempt: a, student: students.get(a.student_id) }))
      .sort((x, y) => evaluate(y.attempt, baremo).netPpm - evaluate(x.attempt, baremo).netPpm);
  }

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link href={`/profesor/clase/${id}?tab=carreras`} className="text-[13px] font-semibold text-accent">{klass.name}</Link>
          <h1 className="h1 m-0">{race.title}</h1>
          <span className="text-sm text-muted">
            {Math.round(race.duration_sec / 60) || 1} min · {race.content.length} caracteres
          </span>
        </div>
        <details className="relative">
          <summary className="btn btn-danger cursor-pointer list-none">Eliminar carrera</summary>
          <div className="absolute right-0 z-10 mt-2 flex w-64 flex-col gap-3 rounded-xl border border-line bg-white p-4 text-sm shadow-lg">
            <span>Se borrarán la carrera y sus resultados, también del ranking. No se puede deshacer.</span>
            <form action={deleteRace.bind(null, id, raceId)}>
              <button type="submit" className="btn h-9 bg-error px-3 text-[13px] text-white">Sí, eliminar</button>
            </form>
          </div>
        </details>
      </div>

      <TeacherRaceRoom
        classId={id}
        raceId={raceId}
        initial={state}
        startAction={startRace.bind(null, id, raceId)}
        finishAction={finishRace.bind(null, id, raceId)}
      />

      {state.phase === "finished" && (
        <section className="card overflow-x-auto">
          <h2 className="h2 m-0 px-5 pt-5">Resultados guardados</h2>
          {results.length === 0 ? (
            <p className="m-0 p-5 text-muted">Nadie entregó resultado en esta carrera.</p>
          ) : (
            <table className="mt-3 w-full min-w-[720px] border-collapse text-[15px]">
              <thead>
                <tr>
                  <th className="th">#</th>
                  <th className="th">Alumno</th>
                  <th className="th text-right">Brutas/min</th>
                  <th className="th text-right">Errores</th>
                  <th className="th text-right">Precisión</th>
                  <th className="th text-right">Netas/min</th>
                  <th className="th"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {results.map(({ attempt: a, student: s }, i) => {
                  const e = evaluate(a, baremo);
                  return (
                    <tr key={a.id}>
                      <td className="td font-semibold text-soft">{i + 1}</td>
                      <td className="td font-medium">
                        {s?.full_name ?? "Alumno eliminado"}
                        {a.flagged && <span className="mt-0.5 block text-xs font-semibold text-error-ink">En revisión: {a.flag_reason}</span>}
                      </td>
                      <td className="td text-right font-mono">{Math.round(e.grossPpm)}</td>
                      <td className="td text-right font-mono">{a.errors}</td>
                      <td className="td text-right font-mono">{e.accuracy} %</td>
                      <td className="td text-right font-mono font-semibold">{Math.round(e.netPpm)}</td>
                      <td className="td text-right">
                        <Link href={`/profesor/clase/${id}/intento/${a.id}`} className="btn btn-secondary h-9 px-3 text-[13px]">Ver</Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
      )}
    </>
  );
}
