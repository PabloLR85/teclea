"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RaceLanes } from "./RaceLanes";
import { teacherRaceState } from "@/app/actions/carrera";
import type { RacePhase, RaceState } from "@/lib/races";

function fmt(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function TeacherRaceRoom({
  classId,
  raceId,
  initial,
  startAction,
  finishAction,
}: {
  classId: string;
  raceId: string;
  initial: RaceState;
  startAction: () => Promise<void>;
  finishAction: () => Promise<void>;
}) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [offset, setOffset] = useState(initial.serverNow - Date.now());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);
  const serverNow = now + offset;

  let phase: RacePhase = state.phase;
  if (phase !== "finished" && state.startsAt && state.endsAt) {
    if (serverNow < state.startsAt) phase = "countdown";
    else if (serverNow < state.endsAt) phase = "running";
    else phase = "finished";
  }
  const phaseRef = useRef(phase);
  phaseRef.current = phase;

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let finishedPolls = 0;
    const loop = async () => {
      try {
        const r = await teacherRaceState(classId, raceId);
        if (!("error" in r)) {
          setState(r);
          setOffset(r.serverNow - Date.now());
        }
      } catch {
        // se reintenta en la siguiente vuelta
      }
      if (!alive) return;
      if (phaseRef.current === "finished" && ++finishedPolls > 15) return;
      timer = setTimeout(loop, phaseRef.current === "running" ? 1000 : 2000);
    };
    timer = setTimeout(loop, 1000);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [classId, raceId]);

  // Al terminar, recarga la parte del servidor para mostrar los resultados guardados
  const wasFinished = useRef(initial.phase === "finished");
  useEffect(() => {
    if (phase === "finished" && !wasFinished.current) {
      wasFinished.current = true;
      const t = setTimeout(() => router.refresh(), 4000);
      return () => clearTimeout(t);
    }
  }, [phase, router]);

  const finishedCount = state.lanes.filter((l) => l.finished).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div className="flex flex-col gap-1">
          <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent">
            {phase === "waiting" && "Sala de espera"}
            {phase === "countdown" && "Cuenta atrás"}
            {phase === "running" && "En marcha"}
            {phase === "finished" && "Terminada"}
          </span>
          <span className="text-[15px] text-muted">
            {state.lanes.length} {state.lanes.length === 1 ? "participante" : "participantes"}
            {phase !== "waiting" && ` · ${finishedCount} han terminado`}
          </span>
        </div>
        <div className="flex items-center gap-4">
          {phase === "countdown" && state.startsAt && (
            <span className="font-display text-5xl font-bold text-accent tabular-nums">{Math.max(1, Math.ceil((state.startsAt - serverNow) / 1000))}</span>
          )}
          {phase === "running" && state.endsAt && (
            <span className="font-display text-5xl font-bold tabular-nums">{fmt(state.endsAt - serverNow)}</span>
          )}
          {phase === "waiting" && (
            <form action={startAction}>
              <button type="submit" disabled={state.lanes.length === 0} className="btn btn-primary h-12 px-6 text-base">
                Empezar carrera
              </button>
            </form>
          )}
          {(phase === "countdown" || phase === "running") && (
            <form action={finishAction}>
              <button type="submit" className="btn btn-secondary">Terminar ya</button>
            </form>
          )}
        </div>
      </div>
      {phase === "waiting" && (
        <p className="m-0 text-sm text-muted">
          Pide a los alumnos que entren en la pestaña <strong>Carrera</strong> y pulsen &laquo;Unirme&raquo;. Al empezar hay una cuenta atrás de 10 segundos.
        </p>
      )}
      <RaceLanes lanes={state.lanes} final={phase === "finished"} />
    </div>
  );
}
