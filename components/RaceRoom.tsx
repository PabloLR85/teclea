"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { TypingExercise } from "./TypingExercise";
import { RaceLanes } from "./RaceLanes";
import { joinRace, raceTick, submitRace, type RaceProgress } from "@/app/actions/carrera";
import type { RacePhase, RaceState } from "@/lib/races";

type Props = {
  raceId: string;
  title: string;
  content: string;
  penalty: number;
  initial: RaceState;
};

function fmt(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function RaceRoom({ raceId, title, content, penalty, initial }: Props) {
  const [state, setState] = useState<RaceState>(initial);
  const [offset, setOffset] = useState(initial.serverNow - Date.now());
  const [now, setNow] = useState(Date.now());
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [typingMounted, setTypingMounted] = useState(false);
  // Tiempo disponible, fijado al empezar a escribir (no debe cambiar despues)
  const [limitMs, setLimitMs] = useState<number | null>(null);
  const progress = useRef<RaceProgress | null>(null);

  const apply = useCallback((r: RaceState | { error: string }) => {
    if ("error" in r) {
      setError(r.error);
      return;
    }
    setState(r);
    setOffset(r.serverNow - Date.now());
  }, []);

  // Reloj local sincronizado con el servidor
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

  // Sondeo: envia el avance y recibe el de los demas. Cada segundo en carrera, cada 2 en espera.
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let finishedPolls = 0;
    const loop = async () => {
      try {
        const p = phaseRef.current === "running" ? progress.current : null;
        apply(await raceTick(raceId, p));
      } catch {
        // red caida: se reintenta en la siguiente vuelta
      }
      if (!alive) return;
      if (phaseRef.current === "finished" && ++finishedPolls > 15) return; // deja de sondear al rato de acabar
      timer = setTimeout(loop, phaseRef.current === "running" ? 1000 : 2000);
    };
    timer = setTimeout(loop, 500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [raceId, apply]);

  const alreadyDone = state.lanes.some((l) => l.me && l.finished);
  useEffect(() => {
    if (phase === "running" && state.joined && !alreadyDone && !typingMounted && state.endsAt) {
      setLimitMs(Math.max(1000, state.endsAt - (Date.now() + offset)));
      setTypingMounted(true);
    }
  }, [phase, state.joined, state.endsAt, typingMounted, offset, alreadyDone]);

  async function join() {
    setJoining(true);
    setError(null);
    apply(await joinRace(raceId));
    setJoining(false);
  }

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <span className="kicker">Carrera en directo</span>
        <h1 className="h1 m-0">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {phase === "running" && (
          <span className="flex items-center gap-2 rounded-full border border-line bg-white px-3.5 py-2 text-sm font-semibold text-body">
            <span className="h-2 w-2 rounded-full bg-error" />
            En directo
          </span>
        )}
        {phase === "running" && state.endsAt && (
          <span className="font-display text-4xl font-bold tabular-nums">{fmt(state.endsAt - serverNow)}</span>
        )}
      </div>
    </div>
  );

  return (
    <>
      {header}
      {error && (
        <p role="alert" className="m-0 rounded-xl bg-error-soft px-4 py-3 text-sm text-error-ink">
          {error}
        </p>
      )}

      {phase === "waiting" && (
        <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
          <div className="flex flex-col gap-1">
            <span className="text-base font-semibold">{state.joined ? "Estás dentro. Esperando a que el profesor dé la salida." : "Sala de espera abierta"}</span>
            <span className="text-sm text-muted">
              {state.lanes.length} {state.lanes.length === 1 ? "participante" : "participantes"} · {content.length} caracteres
            </span>
          </div>
          {!state.joined && (
            <button type="button" onClick={join} disabled={joining} className="btn btn-primary h-12 px-6 text-base">
              {joining ? "Uniéndote..." : "Unirme a la carrera"}
            </button>
          )}
        </div>
      )}

      {phase === "countdown" && state.startsAt && (
        <div className="card flex flex-col items-center gap-2 p-10">
          <span className="text-sm text-muted">{state.joined ? "Coloca los dedos en la fila guía" : "La carrera va a empezar"}</span>
          <span className="font-display text-[96px] font-bold leading-none text-accent tabular-nums">
            {Math.max(1, Math.ceil((state.startsAt - serverNow) / 1000))}
          </span>
          {!state.joined && <span className="text-sm text-muted">Has llegado tarde para esta carrera.</span>}
        </div>
      )}

      {(phase === "waiting" || phase === "countdown") && <RaceLanes lanes={state.lanes} />}

      {typingMounted && limitMs !== null && (
        <>
          <RaceLanes lanes={state.lanes} final={phase === "finished"} />
          <TypingExercise
            target={content}
            mode="prueba"
            limitMs={limitMs}
            penalty={penalty}
            onSubmit={(p) => submitRace(raceId, p)}
            onProgress={(p) => {
              progress.current = p;
            }}
            forceFinish={phase === "finished"}
            backHref="/carrera"
            reviewHref={`/carrera/${raceId}`}
            hideKeyboard
          />
        </>
      )}

      {phase === "running" && !typingMounted && (
        <>
          <div className="card p-6 text-[15px] text-muted">
            {alreadyDone
              ? "Ya has entregado tu resultado. Espera a que terminen los demás para ver la clasificación final."
              : "La carrera está en marcha. Puedes seguirla, pero ya no puedes unirte."}
          </div>
          <RaceLanes lanes={state.lanes} />
        </>
      )}

      {phase === "finished" && !typingMounted && (
        <>
          <h2 className="h2 m-0">Clasificación final</h2>
          {alreadyDone && (
            <a href={`/carrera/${raceId}`} className="btn btn-primary self-start">Ver mi corrección</a>
          )}
          <RaceLanes lanes={state.lanes} final emptyText="Nadie participó en esta carrera." />
          <Link href="/carrera" className="btn btn-secondary self-start">Volver</Link>
        </>
      )}
    </>
  );
}
