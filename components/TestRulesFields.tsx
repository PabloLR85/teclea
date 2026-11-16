"use client";

import { useState } from "react";

// Tiempo e intentos de una prueba
export function TestRulesFields({
  defaultDurationSec = 300,
  defaultMaxAttempts = null,
  lockDuration,
}: {
  defaultDurationSec?: number | null;
  defaultMaxAttempts?: number | null;
  lockDuration?: boolean;
}) {
  const [timeMode, setTimeMode] = useState<"limit" | "free">(defaultDurationSec === null ? "free" : "limit");
  const [attemptsMode, setAttemptsMode] = useState<"free" | "exam">(defaultMaxAttempts === null ? "free" : "exam");
  const option = "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[10px] border border-line px-3.5 py-2.5 text-[15px] has-[:checked]:border-accent has-[:checked]:bg-accent-soft";

  return (
    <div className="flex flex-col gap-4">
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0" disabled={lockDuration}>
        <legend className="label mb-2">Tiempo</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className={option}>
            <input type="radio" name="time_mode" value="limit" checked={timeMode === "limit"} onChange={() => setTimeMode("limit")} className="h-4 w-4 accent-[#4338CA]" />
            Con límite de tiempo
          </label>
          <label className={option}>
            <input type="radio" name="time_mode" value="free" checked={timeMode === "free"} onChange={() => setTimeMode("free")} className="h-4 w-4 accent-[#4338CA]" />
            Sin límite de tiempo
          </label>
        </div>
        {timeMode === "limit" ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="duration" className="label">Duración (minutos)</label>
            <input
              id="duration"
              name="duration"
              type="number"
              min={0.5}
              max={180}
              step={0.5}
              defaultValue={defaultDurationSec ? defaultDurationSec / 60 : 5}
              required
              className="field disabled:bg-ground disabled:text-muted"
            />
            <span className="text-[13px] text-soft">Hasta 180 minutos. El alumno puede entregar antes si termina.</span>
          </div>
        ) : (
          <span className="text-[13px] text-soft">
            El alumno escribe a su ritmo y entrega cuando termina. La velocidad se calcula con el tiempo que haya tardado.
          </span>
        )}
      </fieldset>

      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="label mb-2">Intentos</legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <label className={option}>
            <input type="radio" name="attempts_mode" value="free" checked={attemptsMode === "free"} onChange={() => setAttemptsMode("free")} className="h-4 w-4 accent-[#4338CA]" />
            Ilimitados
          </label>
          <label className={option}>
            <input type="radio" name="attempts_mode" value="exam" checked={attemptsMode === "exam"} onChange={() => setAttemptsMode("exam")} className="h-4 w-4 accent-[#4338CA]" />
            Examen con intentos limitados
          </label>
        </div>
        {attemptsMode === "exam" ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="max_attempts" className="label">Número máximo de intentos</label>
            <input id="max_attempts" name="max_attempts" type="number" min={1} max={20} step={1} defaultValue={defaultMaxAttempts ?? 1} required className="field" />
          </div>
        ) : (
          <span className="text-[13px] text-soft">El alumno puede repetirla las veces que quiera mientras esté abierta.</span>
        )}
        <span className="text-[13px] text-soft">Para la nota cuenta el mejor intento de cada alumno.</span>
      </fieldset>
    </div>
  );
}
