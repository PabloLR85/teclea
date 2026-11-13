"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Keyboard } from "./Keyboard";
import type { SubmitResult } from "@/app/actions/alumno";
import { align, MAX_EXTRA, ST_MISSING, ST_OK, ST_WRONG, type InputEvent } from "@/lib/scoring";

type Props = {
  target: string;
  // Practica: termina al completar el texto. Prueba: cuenta atras y entrega automatica.
  mode: "practica" | "prueba";
  limitMs?: number;
  onSubmit: (payload: { typed: string; events: InputEvent[]; durationMs: number }) => Promise<SubmitResult>;
  nextHref?: string | null;
  backHref: string;
  showGrade?: boolean;
};

function fmtTime(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function TypingExercise({ target, mode, limitMs, onSubmit, nextHref, backHref, showGrade }: Props) {
  const [typed, setTyped] = useState("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [sending, setSending] = useState(false);
  const events = useRef<InputEvent[]>([]);
  const finishedRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const textBoxRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const clockStart = useRef<number | null>(mode === "prueba" ? Date.now() : null);

  // En prueba el reloj corre desde que se pulsa Empezar, no desde la primera tecla.
  useEffect(() => {
    if (mode === "prueba") setStartedAt(clockStart.current);
    inputRef.current?.focus();
  }, [mode]);

  useEffect(() => {
    if (result) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [result]);

  const elapsed = startedAt ? now - startedAt : 0;
  const remaining = limitMs ? limitMs - elapsed : null;

  async function finish(finalTyped: string) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setSending(true);
    const durationMs = startedAt ? Date.now() - startedAt : 1000;
    try {
      const r = await onSubmit({ typed: finalTyped, events: events.current, durationMs: limitMs ? Math.min(durationMs, limitMs) : durationMs });
      setResult(r);
    } catch {
      setResult({ ok: false, error: "No se pudo guardar el resultado. Revisa la conexión y avisa al profesor." });
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !finishedRef.current) void finish(typed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    if (finishedRef.current) return;
    const value = e.target.value.replace(/\n/g, "").slice(0, target.length + MAX_EXTRA);
    let start = startedAt;
    if (!start) {
      start = Date.now();
      setStartedAt(start);
    }
    events.current.push({ t: Date.now() - start, n: value.length });
    setTyped(value);
    // Termina cuando lo escrito llega al final del original (aunque se haya saltado o anadido algo).
    const a = align(target, value);
    if (a.consumed === target.length || value.length >= target.length + MAX_EXTRA) {
      void finish(value);
    }
  }

  function block(e: React.SyntheticEvent) {
    e.preventDefault();
  }

  function reset() {
    setTyped("");
    setStartedAt(null);
    setResult(null);
    events.current = [];
    finishedRef.current = false;
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  const alignment = useMemo(() => align(target, typed), [target, typed]);

  const stats = useMemo(() => {
    const errors = alignment.errors;
    const minutes = Math.max(elapsed, 1000) / 60000;
    return {
      errors,
      ppm: startedAt && elapsed > 1500 ? Math.round(typed.length / minutes) : 0,
      precision: typed.length ? Math.max(0, Math.round(((typed.length - errors) / typed.length) * 100)) : 100,
      progress: Math.min(100, Math.round((alignment.consumed / target.length) * 100)),
    };
  }, [alignment, typed.length, target.length, elapsed, startedAt]);

  const cursor = alignment.consumed;
  const next = cursor < target.length ? target[cursor] : "";
  const done = finishedRef.current || !!result;

  // Mantiene la linea que se esta escribiendo a la vista: el cursor queda en la segunda linea visible.
  useEffect(() => {
    const box = textBoxRef.current;
    const cur = cursorRef.current;
    if (!box || !cur) return;
    const lineHeight = cur.offsetHeight || 40;
    const targetTop = Math.max(0, cur.offsetTop - lineHeight);
    if (Math.abs(box.scrollTop - targetTop) > lineHeight / 2) {
      box.scrollTo({ top: targetTop, behavior: "smooth" });
    }
  }, [cursor]);

  return (
    <div className="flex flex-wrap items-start gap-6">
      <section className="flex min-w-0 flex-[999_1_600px] flex-col gap-5">
        <div className="card flex flex-col gap-5 p-7">
          <div
            ref={textBoxRef}
            className="relative max-h-[320px] overflow-y-auto whitespace-pre-wrap font-mono text-[22px] leading-[1.75] sm:text-[24px]"
            onClick={() => inputRef.current?.focus()}
          >
            {target.split("").map((ch, i) => {
              if (i < cursor) {
                const st = alignment.status[i];
                if (st === ST_OK) return <span key={i} className="text-ink">{ch}</span>;
                if (st === ST_MISSING)
                  return (
                    <span key={i} className="rounded bg-error-soft text-error underline decoration-dotted" title="Te lo has saltado">
                      {ch === " " ? "_" : ch}
                    </span>
                  );
                if (st === ST_WRONG)
                  return (
                    <span key={i} className="rounded bg-error-soft text-error">
                      {ch === " " ? "_" : ch}
                    </span>
                  );
                return <span key={i} className="text-ink">{ch}</span>;
              }
              if (i === cursor && !done) {
                return (
                  <span key={i} ref={cursorRef} className="border-b-[3px] border-accent bg-cursor text-ink">
                    {ch}
                  </span>
                );
              }
              return <span key={i} className="text-faint">{ch}</span>;
            })}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="escribe" className="label">
              {mode === "prueba" ? "Escribe aquí. La prueba se entrega sola al acabar el tiempo." : "Escribe aquí el texto de arriba"}
            </label>
            <textarea
              id="escribe"
              ref={inputRef}
              value={typed}
              onChange={onChange}
              onPaste={block}
              onDrop={block}
              onContextMenu={block}
              disabled={done}
              rows={2}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder={mode === "practica" ? "Empieza a escribir y el cronómetro arranca solo" : ""}
              className="w-full resize-none rounded-xl border border-line-strong bg-[#FCFCFD] px-4 py-3 font-mono text-lg text-ink disabled:bg-ground"
            />
          </div>

          {sending && <p className="text-sm text-muted">Guardando resultado...</p>}

          {result && !result.ok && (
            <div role="alert" className="rounded-xl bg-error-soft px-4 py-3 text-[15px] text-error-ink">
              {result.error}
            </div>
          )}

          {result && result.ok && (
            <div className="flex flex-col gap-3 rounded-xl bg-accent-soft px-5 py-4">
              <p className="m-0 text-[15px] text-accent-ink">
                <strong>{mode === "prueba" ? "Prueba entregada." : "Ejercicio terminado."}</strong> {result.netPpm} pulsaciones netas por minuto,{" "}
                {result.accuracy} % de precisión y {result.errors} {result.errors === 1 ? "error" : "errores"}.
                {showGrade && result.grade !== undefined && (
                  <>
                    {" "}
                    Nota: <strong>{result.grade.toFixed(1).replace(".", ",")}</strong>.
                  </>
                )}
              </p>
              {result.flagged && (
                <p className="m-0 text-sm text-error-ink">
                  Este intento no cuenta para el ranking ({result.flagged}).
                </p>
              )}
              {mode === "practica" && result.completed === false && !result.flagged && (
                <p className="m-0 text-sm text-accent-ink">
                  Para superar la lección necesitas completar el texto con al menos un 90 % de precisión.
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {mode === "practica" && (
                  <button type="button" onClick={reset} className="btn btn-secondary">
                    Repetir
                  </button>
                )}
                {mode === "practica" && result.completed && nextHref && (
                  <Link href={nextHref} className="btn btn-primary">
                    Siguiente lección
                  </Link>
                )}
                <Link href={backHref} className="btn btn-secondary">
                  Volver
                </Link>
              </div>
            </div>
          )}
        </div>

        {!done && <Keyboard next={next} />}
      </section>

      <aside className="flex flex-[1_1_260px] flex-col gap-4">
        {remaining !== null && (
          <div className="card flex flex-col gap-1 p-6">
            <span className="text-sm text-muted">Tiempo restante</span>
            <span className={`font-display text-5xl font-bold tabular-nums ${remaining < 30000 ? "text-error" : "text-ink"}`}>
              {fmtTime(remaining)}
            </span>
          </div>
        )}
        <div className="card flex flex-col gap-1 p-6">
          <span className="text-sm text-muted">Pulsaciones por minuto</span>
          <span className="font-display text-[56px] font-bold leading-none tabular-nums">{stats.ppm}</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="card flex flex-col gap-1 p-[18px]">
            <span className="text-[13px] text-muted">Precisión</span>
            <span className="font-display text-[28px] font-bold">{stats.precision} %</span>
          </div>
          <div className="card flex flex-col gap-1 p-[18px]">
            <span className="text-[13px] text-muted">Errores</span>
            <span className="font-display text-[28px] font-bold text-error">{stats.errors}</span>
          </div>
          {remaining === null && (
            <div className="card flex flex-col gap-1 p-[18px]">
              <span className="text-[13px] text-muted">Tiempo</span>
              <span className="font-display text-[28px] font-bold tabular-nums">{fmtTime(elapsed)}</span>
            </div>
          )}
          <div className="card flex flex-col gap-1 p-[18px]">
            <span className="text-[13px] text-muted">Avance</span>
            <span className="font-display text-[28px] font-bold">{stats.progress} %</span>
          </div>
        </div>
        <div className="card flex flex-col gap-2.5 p-[18px]">
          <span className="text-[13px] text-muted">Progreso del texto</span>
          <div className="h-2 overflow-hidden rounded bg-accent-soft">
            <div className="h-2 rounded bg-accent transition-[width]" style={{ width: `${stats.progress}%` }} />
          </div>
        </div>
        <p className="m-0 rounded-2xl border border-dashed border-line-strong px-[18px] py-4 text-sm leading-relaxed text-muted">
          Espalda recta, muñecas sin apoyar y los índices sobre las marcas de la <strong className="text-ink">f</strong> y la{" "}
          <strong className="text-ink">j</strong>.
        </p>
      </aside>
    </div>
  );
}
