"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Keyboard } from "./Keyboard";
import { useNumpadSetting } from "./useNumpadSetting";
import { isNumpadDecimal, numpadKey } from "@/lib/keys";
import type { SubmitResult } from "@/app/actions/alumno";
import { align, MAX_EXTRA, normalizeTyped, ST_MISSING, ST_OK, ST_WRONG, type InputEvent } from "@/lib/scoring";

type Props = {
  target: string;
  // Practica: termina al completar el texto. Prueba: cuenta atras y entrega automatica.
  mode: "practica" | "prueba";
  limitMs?: number;
  onSubmit: (payload: { typed: string; events: InputEvent[]; durationMs: number }) => Promise<SubmitResult>;
  nextHref?: string | null;
  backHref: string;
  reviewHref?: string;
  penalty: number;
  showGrade?: boolean;
  // Carreras: avance en vivo y fin forzado cuando el profesor termina la carrera.
  onProgress?: (p: { consumed: number; chars: number; errors: number }) => void;
  forceFinish?: boolean;
  hideKeyboard?: boolean;
  elapsedOffsetMs?: number; // prueba retomada: tiempo que ya habia pasado
  allowEarlySubmit?: boolean; // boton para entregar antes de terminar
  // Recuperacion tras recargar: texto y registro guardados, y aviso para guardarlos de nuevo
  initialTyped?: string;
  initialEvents?: InputEvent[];
  onDraft?: (typed: string, events: InputEvent[]) => void;
  // Ejercicios numericos: las cifras solo valen desde el bloque numerico
  numpadOnly?: boolean;
  allowNumpadToggle?: boolean; // en practica, el alumno puede desactivarlo si su teclado no tiene bloque numerico
};

function fmtTime(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function TypingExercise({
  target: targetRaw,
  mode,
  limitMs,
  onSubmit,
  nextHref,
  backHref,
  reviewHref,
  penalty,
  showGrade,
  onProgress,
  forceFinish,
  hideKeyboard,
  elapsedOffsetMs = 0,
  allowEarlySubmit,
  initialTyped,
  initialEvents,
  onDraft,
  numpadOnly,
  allowNumpadToggle,
}: Props) {
  const target = useMemo(() => targetRaw.normalize("NFC"), [targetRaw]);
  const [typed, setTyped] = useState(initialTyped ?? "");
  const numpad = useNumpadSetting(!!numpadOnly, !!allowNumpadToggle);
  const [numpadMsg, setNumpadMsg] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [sending, setSending] = useState(false);
  const events = useRef<InputEvent[]>(initialEvents ?? []);
  const finishedRef = useRef(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const textBoxRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const clockStart = useRef<number | null>(mode === "prueba" ? Date.now() - elapsedOffsetMs : null);

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
    if (forceFinish && !finishedRef.current) void finish(typed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceFinish]);

  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !finishedRef.current) void finish(typed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  // Guarda un borrador cada poco (solo si se pide), para recuperarlo si se recarga la pagina
  useEffect(() => {
    if (!onDraft || finishedRef.current) return;
    const id = setTimeout(() => onDraft(typed, events.current), 600);
    return () => clearTimeout(id);
  }, [typed, onDraft]);

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    processValue(e.target.value);
  }

  function processValue(raw: string) {
    if (finishedRef.current) return;
    const value = normalizeTyped(raw.replace(/\n/g, "")).slice(0, target.length + MAX_EXTRA);
    let start = startedAt;
    if (!start) {
      start = Date.now();
      setStartedAt(start);
    }
    events.current.push({ t: Date.now() - start, n: value.length });
    setTyped(value);
    // Termina cuando lo escrito llega al final del original (aunque se haya saltado o anadido algo).
    const a = align(target, value);
    onProgress?.({ consumed: a.consumed, chars: value.length, errors: a.errors });
    if (a.consumed === target.length || value.length >= target.length + MAX_EXTRA) {
      void finish(value);
    }
  }

  function block(e: React.SyntheticEvent) {
    e.preventDefault();
  }

  // Inserta un caracter donde esta el cursor, como si se hubiera tecleado
  function insertAtCaret(ch: string) {
    const el = inputRef.current;
    const start = el?.selectionStart ?? typed.length;
    const end = el?.selectionEnd ?? typed.length;
    processValue(typed.slice(0, start) + ch + typed.slice(end));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // La tecla decimal del bloque numerico escribe siempre el separador que toca en el texto:
    // coma (lo normal en importes), o punto solo si el texto pide punto en ese sitio.
    if (isNumpadDecimal(e.key, e.code)) {
      e.preventDefault();
      const expected = target[alignment.consumed];
      insertAtCaret(expected === "." ? "." : ",");
      return;
    }
    if (!numpad.active) return;
    const r = numpadKey(e.key, e.code);
    if (r === "ok") {
      if (numpadMsg) setNumpadMsg(null);
      return;
    }
    e.preventDefault();
    if (r === "decimal") {
      // La tecla decimal del bloque numerico escribe el separador que toca: coma, salvo que el texto pida punto
      const expected = target[alignment.consumed];
      insertAtCaret(expected === "." ? "." : ",");
    } else if (r === "numlock") {
      setNumpadMsg("Activa Bloq Num: el bloque numérico está escribiendo flechas en lugar de cifras.");
    } else {
      setNumpadMsg("Usa el bloque numérico de la derecha para las cifras. Las de la fila de arriba no cuentan en este ejercicio.");
    }
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
    const ready = !!startedAt && elapsed > 1500;
    return {
      errors,
      ppm: ready ? Math.round(typed.length / minutes) : 0,
      net: ready ? Math.max(0, Math.round((typed.length - errors * penalty) / minutes)) : 0,
      precision: typed.length ? Math.max(0, Math.round(((typed.length - errors) / typed.length) * 100)) : 100,
      progress: Math.min(100, Math.round((alignment.consumed / target.length) * 100)),
    };
  }, [alignment, typed.length, target.length, elapsed, startedAt, penalty]);

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
                const extra = alignment.extraBefore[i] > 0 && (
                  <span
                    key={`x${i}`}
                    className="mx-px inline-block h-[1.1em] w-[3px] translate-y-[3px] rounded bg-error"
                    title="Has escrito un carácter de más aquí"
                  />
                );
                if (extra) {
                  return (
                    <span key={i}>
                      {extra}
                      {st === ST_OK ? <span className="text-ink">{ch}</span> : <span className="rounded bg-error-soft text-error">{ch === " " ? "_" : ch}</span>}
                    </span>
                  );
                }
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
              onKeyDown={onKeyDown}
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

          {numpad.required && !done && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 text-sm text-body">
              <span>
                {numpad.active
                  ? "Ejercicio de teclado numérico: escribe las cifras con el bloque numérico de la derecha, con Bloq Num activado. La tecla decimal escribe la coma."
                  : "Bloque numérico desactivado: puedes usar las cifras de la fila de arriba."}
              </span>
              {numpad.allowToggle && (
                <label className="flex cursor-pointer items-center gap-2 text-[13px] text-muted">
                  <input type="checkbox" checked={numpad.off} onChange={(e) => numpad.toggle(e.target.checked)} className="h-4 w-4 accent-[#4338CA]" />
                  Mi teclado no tiene bloque numérico
                </label>
              )}
            </div>
          )}
          {numpadMsg && !done && (
            <p role="alert" className="m-0 rounded-xl bg-error-soft px-4 py-3 text-sm font-medium text-error-ink">
              {numpadMsg}
            </p>
          )}
          {allowEarlySubmit && !done && (
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => void finish(typed)} disabled={typed.length === 0} className="btn btn-secondary">
                Entregar ahora
              </button>
              <span className="text-[13px] text-soft">Si terminas de copiar el texto, se entrega solo.</span>
            </div>
          )}
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
                {reviewHref && (
                  <Link href={reviewHref} className="btn btn-primary">
                    Ver corrección
                  </Link>
                )}
                <Link href={backHref} className="btn btn-secondary">
                  Volver
                </Link>
              </div>
            </div>
          )}
        </div>

        {!done && !hideKeyboard && <Keyboard next={next} numpad={numpad.active} />}
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
          <span className="text-sm text-muted">Pulsaciones netas por minuto</span>
          <span className="font-display text-[56px] font-bold leading-none tabular-nums">{stats.net}</span>
          <span className="text-[13px] text-soft">Brutas: {stats.ppm}/min · cada error resta {penalty}</span>
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
