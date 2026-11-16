"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { findForm, normalizeFieldValue, validateExact, validateFormat, type FormAnswers, type FormRejection } from "@/lib/forms";
import { normalizeTyped, sameText, type InputEvent } from "@/lib/scoring";
import type { SubmitResult } from "@/lib/attempts";
import { FormReview } from "./FormReview";
import { useNumpadSetting } from "./useNumpadSetting";
import { isNumpadDecimal, numpadKey } from "@/lib/keys";

export type FormPayload = { answers: FormAnswers; submitted: number; events: InputEvent[]; durationMs: number; rejections: FormRejection[] };
export type FormDraft = { answers: FormAnswers; current: number; events: InputEvent[]; rejections: FormRejection[] };

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
  elapsedOffsetMs?: number;
  allowEarlySubmit?: boolean;
  initialDraft?: FormDraft | null;
  onDraft?: (d: FormDraft) => void;
  allowNumpadToggle?: boolean;
};

function fmtTime(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function FormExercise({
  formId,
  recordLimit,
  mode,
  limitMs,
  onSubmit,
  backHref,
  reviewHref,
  retryHref,
  showGrade,
  elapsedOffsetMs = 0,
  allowEarlySubmit,
  initialDraft,
  onDraft,
  allowNumpadToggle,
}: Props) {
  const t = findForm(formId)!;
  const total = Math.min(recordLimit, t.records.length);
  const empty = () => Object.fromEntries(t.fields.map((f) => [f.key, ""]));
  const [answers, setAnswers] = useState<FormAnswers>(initialDraft?.answers?.length ? initialDraft.answers : [empty()]);
  const [current, setCurrent] = useState(initialDraft?.current ?? 0);
  // Los campos numericos se escriben con el bloque numerico
  const hasNumeric = t.fields.some((f) => f.numeric);
  const numpad = useNumpadSetting(hasNumeric, !!allowNumpadToggle);
  const [numpadMsg, setNumpadMsg] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(mode === "prueba" ? Date.now() - elapsedOffsetMs : null);
  const [now, setNow] = useState(Date.now());
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [sending, setSending] = useState(false);
  const events = useRef<InputEvent[]>(initialDraft?.events ?? []);
  const finishedRef = useRef(false);
  const firstInput = useRef<HTMLInputElement>(null);
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const rejections = useRef<FormRejection[]>(initialDraft?.rejections ?? []);
  // Mensajes de validacion por campo del registro en curso
  const [fieldMsgs, setFieldMsgs] = useState<Record<string, string>>({});

  useEffect(() => {
    if (result) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [result]);

  useEffect(() => {
    firstInput.current?.focus();
  }, [current]);

  // Borrador para recuperar la prueba si se recarga la pagina
  useEffect(() => {
    if (!onDraft || finishedRef.current) return;
    const id = setTimeout(() => onDraft({ answers, current, events: events.current, rejections: rejections.current }), 600);
    return () => clearTimeout(id);
  }, [answers, current, onDraft]);

  function onNumericKeyDown(key: string, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    // En los campos de cifras la tecla decimal del bloque numerico escribe siempre coma
    if (isNumpadDecimal(e.key, e.code)) {
      e.preventDefault();
      const el = e.currentTarget;
      const v = answers[current]?.[key] ?? "";
      const a = el.selectionStart ?? v.length;
      const b = el.selectionEnd ?? v.length;
      onField(key, v.slice(0, a) + "," + v.slice(b));
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
      const el = e.currentTarget;
      const v = answers[current]?.[key] ?? "";
      const a = el.selectionStart ?? v.length;
      const b = el.selectionEnd ?? v.length;
      onField(key, v.slice(0, a) + "," + v.slice(b));
    } else if (r === "numlock") {
      setNumpadMsg("Activa Bloq Num: el bloque numérico está escribiendo flechas en lugar de cifras.");
    } else {
      setNumpadMsg("En los campos de cifras usa el bloque numérico de la derecha. Las cifras de la fila de arriba no se escriben.");
    }
  }

  const elapsed = startedAt ? now - startedAt : 0;
  const remaining = limitMs ? limitMs - elapsed : null;
  const typedChars = answers.reduce((sum, a) => sum + Object.values(a).reduce((s, v) => s + v.length, 0), 0);

  async function finish(finalAnswers: FormAnswers, submitted: number) {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setSending(true);
    const durationMs = startedAt ? Date.now() - startedAt : 1000;
    try {
      setResult(
        await onSubmit({
          answers: finalAnswers,
          submitted,
          events: events.current,
          durationMs: limitMs ? Math.min(durationMs, limitMs) : durationMs,
          rejections: rejections.current,
        }),
      );
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
    if (fieldMsgs[key]) {
      const rest = { ...fieldMsgs };
      delete rest[key];
      setFieldMsgs(rest);
    }
    const next = answers.map((a, i) => (i === current ? { ...a, [key]: normalizeTyped(value).slice(0, 200) } : a));
    const n = next.reduce((sum, a) => sum + Object.values(a).reduce((s, v) => s + v.length, 0), 0);
    events.current.push({ t: Date.now() - start, n });
    setAnswers(next);
  }

  function saveRecord(e: React.FormEvent) {
    e.preventDefault();
    if (finishedRef.current) return;
    // Control de grabacion: practica exige el dato exacto; prueba, campos completos y con formato valido.
    const values = answers[current] ?? {};
    const expected = t.records[current];
    const msgs: Record<string, string> = {};
    let contentWrong = false;
    for (const f of t.fields) {
      const v = values[f.key] ?? "";
      const m = mode === "practica" ? validateExact(f, v, expected[f.key]) : validateFormat(f, v);
      if (m) {
        msgs[f.key] = m;
        const nv = normalizeFieldValue(f, v);
        if (nv && !sameText(nv, expected[f.key])) contentWrong = true;
      }
    }
    if (Object.keys(msgs).length > 0) {
      if (mode === "practica" && contentWrong) rejections.current.push({ record: current, values: { ...values } });
      setFieldMsgs(msgs);
      const first = t.fields.find((f) => msgs[f.key]);
      if (first) inputs.current[first.key]?.focus();
      return;
    }
    setFieldMsgs({});
    // Al grabar se quitan los espacios sobrantes y se completan los decimales, como haria el programa de la empresa
    const trimmed = Object.fromEntries(t.fields.map((f) => [f.key, normalizeFieldValue(f, values[f.key] ?? "")]));
    const saved = answers.map((a, i) => (i === current ? trimmed : a));
    setAnswers(saved);
    const submitted = current + 1;
    if (submitted >= total) {
      setCurrent(submitted);
      void finish(saved, submitted);
      return;
    }
    setAnswers([...saved, empty()]);
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
                    ref={(el) => {
                      inputs.current[f.key] = el;
                      if (i === 0) firstInput.current = el;
                    }}
                    aria-invalid={fieldMsgs[f.key] ? true : undefined}
                    aria-describedby={fieldMsgs[f.key] ? `m-${f.key}` : undefined}
                    value={answers[current]?.[f.key] ?? ""}
                    onChange={(e) => onField(f.key, e.target.value)}
                    onKeyDown={f.numeric ? (e) => onNumericKeyDown(f.key, e) : undefined}
                    onPaste={block}
                    onDrop={block}
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    inputMode={f.numeric ? "decimal" : "text"}
                    className={`h-11 w-full rounded-[10px] border px-3 font-mono text-[15px] text-ink ${
                      fieldMsgs[f.key] ? "border-2 border-error bg-error-soft/40" : "border-line-strong bg-[#FCFCFD]"
                    }`}
                  />
                  {fieldMsgs[f.key] && (
                    <span id={`m-${f.key}`} className="text-[12px] font-medium text-error-ink">
                      {fieldMsgs[f.key]}
                    </span>
                  )}
                </div>
              ))}
            </div>
            {numpad.required && (
              <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted">
                <span>
                  {numpad.active
                    ? "Campos de cifras: usa el bloque numérico (Bloq Num activado). La tecla decimal escribe la coma."
                    : "Bloque numérico desactivado para este ordenador."}
                </span>
                {numpad.allowToggle && (
                  <label className="flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={numpad.off} onChange={(e) => numpad.toggle(e.target.checked)} className="h-4 w-4 accent-[#4338CA]" />
                    Mi teclado no tiene bloque numérico
                  </label>
                )}
              </div>
            )}
            {numpadMsg && (
              <p role="alert" className="m-0 rounded-[10px] bg-error-soft px-3.5 py-2.5 text-sm font-medium text-error-ink">
                {numpadMsg}
              </p>
            )}
            {Object.keys(fieldMsgs).length > 0 && (
              <p role="alert" className="m-0 rounded-[10px] bg-error-soft px-3.5 py-2.5 text-sm text-error-ink">
                No se puede grabar: revisa {Object.keys(fieldMsgs).length === 1 ? "el campo marcado" : `los ${Object.keys(fieldMsgs).length} campos marcados`}.
                {mode === "practica" && " Cada intento con datos mal escritos suma errores."}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <button type="submit" className="btn btn-primary">
                {current + 1 >= total ? "Grabar y terminar" : "Grabar registro"}
              </button>
              {allowEarlySubmit && (
                <button type="button" onClick={() => void finish(answers, current)} disabled={typedChars === 0} className="btn btn-secondary">
                  Entregar ahora
                </button>
              )}
            </div>
            <span className="text-[13px] text-soft">
              Pulsa Intro para grabar el registro.{" "}
              {mode === "practica"
                ? "Solo se graba si todos los campos están completos y coinciden con el documento."
                : "Solo se graba si todos los campos están completos y con el formato correcto."}
            </span>
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
          <FormReview formId={formId} answers={answers} submitted={Math.min(current, total)} recordLimit={total} rejections={rejections.current} />
        </section>
      )}
    </div>
  );
}
