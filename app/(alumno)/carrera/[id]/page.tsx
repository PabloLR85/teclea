import Link from "next/link";
import { notFound } from "next/navigation";
import { db, type AttemptRow } from "@/lib/db";
import { requireStudent } from "@/lib/session";
import { loadRace, raceState } from "@/lib/races";
import { evaluate, normalizeBaremo } from "@/lib/scoring";
import { RaceRoom } from "@/components/RaceRoom";
import { RaceLanes } from "@/components/RaceLanes";
import { AttemptReview } from "@/components/AttemptReview";

export default async function CarreraSalaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { student, klass } = await requireStudent();
  const race = await loadRace(id, klass.id);
  if (!race) notFound();
  const baremo = normalizeBaremo(klass.baremo);
  const state = await raceState(race, baremo, student.id);

  // Carrera terminada y ya entregada: clasificacion y correccion propia
  const { data: mine } = await db()
    .from("attempts")
    .select("*")
    .eq("race_id", id)
    .eq("student_id", student.id)
    .eq("mode", "carrera")
    .maybeSingle();
  const attempt = mine as AttemptRow | null;

  if (state.phase === "finished" && attempt) {
    return (
      <>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="kicker">Carrera terminada</span>
            <h1 className="h1 m-0">{race.title}</h1>
          </div>
          <Link href="/carrera" className="btn btn-secondary">Volver</Link>
        </div>
        <h2 className="h2 m-0">Clasificación final</h2>
        <RaceLanes lanes={state.lanes} final />
        <h2 className="h2 m-0">Tu resultado</h2>
        <AttemptReview
          target={race.content}
          typed={attempt.typed}
          chars={attempt.chars}
          errors={attempt.errors}
          durationMs={attempt.duration_ms}
          result={evaluate(attempt, baremo)}
          showGrade={false}
          flagged={attempt.flagged ? attempt.flag_reason ?? "pendiente de revisar" : null}
        />
      </>
    );
  }

  return <RaceRoom raceId={race.id} title={race.title} content={race.content} penalty={baremo.penalty} initial={state} />;
}
