import Link from "next/link";
import { db } from "@/lib/db";
import { requireStudent } from "@/lib/session";
import { racePhase, type RaceRow } from "@/lib/races";
import { formatDateTime } from "@/lib/utils";

export default async function CarreraPage() {
  const { student, klass } = await requireStudent();
  const { data } = await db().from("races").select("*").eq("class_id", klass.id).order("created_at", { ascending: false }).limit(20);
  const races = (data ?? []) as RaceRow[];
  const active = races.filter((r) => racePhase(r) !== "finished");
  const past = races.filter((r) => racePhase(r) === "finished");

  const { data: mine } = past.length
    ? await db().from("race_participants").select("race_id").eq("student_id", student.id).in("race_id", past.map((r) => r.id))
    : { data: [] as { race_id: string }[] };
  const played = new Set((mine ?? []).map((m) => m.race_id as string));

  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="kicker">Competición</span>
        <h1 className="h1 m-0">Carrera en directo</h1>
      </div>

      {active.length === 0 ? (
        <div className="card flex flex-col gap-2 p-8">
          <span className="text-base font-semibold">No hay ninguna carrera abierta ahora mismo.</span>
          <span className="text-[15px] text-muted">Cuando el profesor abra una, aparecerá aquí. Mientras tanto, practica las lecciones.</span>
        </div>
      ) : (
        active.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-accent-soft px-6 py-5">
            <div className="flex flex-col gap-1">
              <span className="text-base font-semibold text-accent-ink">{r.title}</span>
              <span className="text-sm text-accent-ink">
                {racePhase(r) === "waiting" ? "Sala de espera abierta" : "En marcha"} · {Math.round(r.duration_sec / 60) || 1} min
              </span>
            </div>
            <Link href={`/carrera/${r.id}`} className="btn btn-primary h-12 px-6 text-base">
              Entrar en la sala
            </Link>
          </div>
        ))
      )}

      {past.length > 0 && (
        <section className="card overflow-x-auto">
          <h2 className="h2 m-0 px-5 pt-5">Carreras anteriores</h2>
          <table className="mt-3 w-full min-w-[480px] border-collapse text-[15px]">
            <thead>
              <tr>
                <th className="th">Carrera</th>
                <th className="th">Fecha</th>
                <th className="th">Participaste</th>
                <th className="th"><span className="sr-only">Acciones</span></th>
              </tr>
            </thead>
            <tbody>
              {past.map((r) => (
                <tr key={r.id}>
                  <td className="td font-medium">{r.title}</td>
                  <td className="td text-muted">{formatDateTime(r.starts_at ?? r.created_at)}</td>
                  <td className="td">{played.has(r.id) ? "Sí" : "No"}</td>
                  <td className="td text-right">
                    <Link href={`/carrera/${r.id}`} className="font-semibold text-accent">Ver clasificación</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}
