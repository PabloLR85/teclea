"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { findForm, type FormAnswers } from "@/lib/forms";
import type { InputEvent } from "@/lib/scoring";
import type { SubmitResult } from "@/lib/attempts";
import { FormReview } from "./FormReview";

export type FormPayload = { answers: FormAnswers; submitted: number; events: InputEvent[]; durationMs: number };

type Props = {
  formId: string;
  recordLimit: number;
  mode: "practica" | "prueba";
  limitMs?: number;
  onSubmit: (p: FormPayload) => Promise<SubmitResult>;
  backHref: string;
  reviewHref?: string;
  retryHref?: string;
  showGrade?: boolean;
};

function fmtTime(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function FormExercise({ formId, recordLimit, mode, limitMs, onSubmit, backHref, reviewHref, retryHref, showGrade }: Props) {
  const t = findForm(formId)!;
  const total = Math.min(recordLimit, t.records.length);
  const empty = () => Object.fromEntries(t.fields.map((f) => [f.key, ""]));
  const [answers, setAnswers] = useState<FormAnswers>([empty()]);
  const [current, setCurrent] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(mode === "prueba" ? Date.now() : null);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [sending, setSending] = useState(false);
  const events = useRef<InputEvent[]>([]);
  const finishedRef = useRef(false);
  const firstInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (result) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [result]);

  useEffect(() => {
    firstInput.current?.focus();
  }, [current]);

  const elapsed = startedAt ? now - startedAt : 0;
  const remaining = limitMs ? limitMs - elapsed : null;
  const typedChars = answers.reduce((sum, a) => sum + Object.values(a).reduce((s, v) => s + v.length, 0), 0);

  async function finish(finalAnswers: FormAnswers, submitted: number) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setSending(true);
    const durationMs = startedAt ? Date.now() - startedAt : 1000;
    try {
      setResult(await onSubmit({ answers: finalAnswers, submitted, events: events.current, durationMs: limitMs ? Math.min(durationMs, limitMs) : durationMs }));
    } catch {
      setResult({ ok: false, error: "No se pudo guardar el resultado. Revisa la conexión y avisa al profesor." });
    } finally {
      setSending(false);
    }
  }

  useEffect(() => {
    if (remaining !== null && remaining <= 0 && !finishedRef.current) void finish(answers, current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining]);

  function onField(key: string, value: string) {
    if (finishedRef.current) return;
    let start = startedAt;
    if (!start) {
      start = Date.now();
      setStartedAt(start);
    }
    const next = answers.map((a, i) => (i === current ? { ...a, [key]: value.slice(0, 200) } : a));
    const n = next.reduce((sum, a) => sum + Object.values(a).reduce((s, v) => s + v.length, 0), 0);
    events.current.push({ t: Date.now() - start, n });
    setAnswers(next);
  }

  function saveRecord(e: React.FormEvent) {
    e.preventDefault();
    if (finishedRef.current) return;
    const submitted = current + 1;
    if (submitted >= total) {
      setCurrent(submitted);
      void finish(answers, submitted);
      return;
    }
    setAnswers([...answers, empty()]);
    setCurrent(submitted);
  }

  function block(e: React.SyntheticEvent) {
    e.preventDefault();
  }

  const done = finishedRef.current || !!result;
  const rec = t.records[Math.min(current, total - 1)];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-full bg-accent-soft px-3.5 py-1.5 text-sm font-semibold text-accent">
          Registro {Math.min(current + 1, total)} de {total}
        </span>
        <div className="flex gap-1" aria-hidden="true">
          {Array.from({ length: total }, (_, i) => (
            <span key={i} className={`h-1.5 w-6 rounded-full ${i < current ? "bg-accent" : i === current ? "bg-accent-mid" : "bg-line"}`} />
          ))}
        </div>
        <span className="ml-auto flex items-center gap-4 text-sm text-muted">
          {remaining !== null ? (
            <span>
              Tiempo restante:{" "}
              <strong className={`font-display text-2xl tabular-nums ${remaining < 30000 ? "text-error" : "text-ink"}`}>{fmtTime(remaining)}</strong>
            </span>
          ) : (
            <span>
              Tiempo: <strong className="font-display text-2xl tabular-nums text-ink">{fmtTime(elapsed)}</strong>
            </span>
          )}
          <span>
            Pulsaciones: <strong className="text-ink">{typedChars}</strong>
          </span>
        </span>
      </div>

      {!done && (
        <div className="grid gap-5 lg:grid-cols-2">
          <section aria-label="Documento original" className="card flex flex-col gap-4 p-7" onCopy={block}>
            <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-soft">{t.docTitle}</span>
            <div className="flex select-none flex-col gap-2.5 rounded-xl border border-dashed border-line-strong bg-[#FFFDF7] p-6 text-[17px] leading-relaxed text-ink">
              {t.doc(rec).map((line, i) => (
                <p key={i} className="m-0">
                  {line}
                </p>
              ))}
            </div>
            <span className="text-[13px] text-soft">Lee el documento y graba cada dato en su campo. Tab pasa al siguiente campo.</span>
          </section>

          <form onSubmit={saveRecord} aria-label="Formulario de grabación" className="card flex flex-col gap-4 p-7">
            <span className="text-[13px] font-semibold uppercase tracking-[0.08em] text-accent">{t.title}</span>
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              {t.fields.map((f, i) => (
                <div key={f.key} className={`flex flex-col gap-1.5 ${f.wide ? "sm:col-span-2" : ""}`}>
                  <label htmlFor={`f-${f.key}`} className="text-[13px] font-semibold text-body">
                    {f.label}
                  </label>
                  <input
                    id={`f-${f.key}`}
                    ref={i === 0 ? firstInput : undefined}
                    value={answers[current]?.[f.key] ?? ""}
                    onChange={(e) => onField(f.key, e.target.value)}
                    onPaste={block}
                    onDrop={block}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    inputMode={f.numeric ? "decimal" : "text"}
                    className="h-11 w-full rounded-[10px] border border-line-strong bg-[#FCFCFD] px-3 font-mono text-[15px] text-ink"
                  />
                </div>
              ))}
            </div>
            <button type="submit" className="btn btn-primary self-start">
              {current + 1 >= total ? "Grabar y terminar" : "Grabar registro"}
            </button>
            <span className="text-[13px] text-soft">Pulsa Intro en cualquier campo para grabar el registro y pasar al siguiente.</span>
          </form>
        </div>
      )}

      {sending && <p className="m-0 text-sm text-muted">Guardando resultado...</p>}
      {result && !result.ok && (
        <div role="alert" className="rounded-xl bg-error-soft px-4 py-3 text-[15px] text-error-ink">
          {result.error}
        </div>
      )}
      {result && result.ok && (
        <div className="flex flex-col gap-3 rounded-2xl bg-accent-soft px-6 py-5">
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
          {result.flagged && <p className="m-0 text-sm text-error-ink">Este intento no cuenta para el ranking ({result.flagged}).</p>}
          <div className="flex flex-wrap gap-2">
            {retryHref && (
              <a href={retryHref} className="btn btn-secondary">
                Repetir
              </a>
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
      {result && result.ok && mode === "practica" && (
        <section className="card flex flex-col gap-4 p-6">
          <h2 className="h2 m-0">Corrección</h2>
          <FormReview formId={formId} answers={answers} submitted={Math.min(current, total)} recordLimit={total} />
        </section>
      )}
    </div>
  );
}
