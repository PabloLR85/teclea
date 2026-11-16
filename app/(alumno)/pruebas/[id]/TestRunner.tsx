"use client";

import { useState } from "react";
import { TypingExercise } from "@/components/TypingExercise";
import { FormExercise } from "@/components/FormExercise";
import { startTest, submitTest } from "@/app/actions/alumno";
import { submitFormTest } from "@/app/actions/formulario";
import { findForm } from "@/lib/forms";
import { isNumericText } from "@/lib/keys";
import { clearDraft, loadDraft, saveDraft } from "@/components/drafts";
import type { FormDraft } from "@/components/FormExercise";
import type { InputEvent } from "@/lib/scoring";
import type { SubmitResult } from "@/lib/attempts";

type TextDraft = { typed: string; events: InputEvent[]; savedAt: number };

type Props = {
  testId: string;
  text: string;
  durationSec: number | null;
  resumed: boolean;
  penalty: number;
  attemptNumber: number; // numero del intento que va a hacer
  attemptsLeft: number | null; // null = ilimitados
};

export function TestRunner({ testId, text, durationSec, resumed, penalty, attemptNumber, attemptsLeft }: Props) {
  const [run, setRun] = useState<{
    sessionId: string;
    limitMs: number | null;
    elapsedMs: number;
    textDraft: TextDraft | null;
    formDraft: (FormDraft & { savedAt: number }) | null;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const formId = text.startsWith("form:") ? text.slice(5) : null;
  const form = formId ? findForm(formId) : null;

  async function begin() {
    setLoading(true);
    setError(null);
    const r = await startTest(testId);
    setLoading(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    // Si el intento estaba a medias en este navegador, se recupera lo escrito
    const draft = r.resumed ? loadDraft<Record<string, unknown>>(r.sessionId) : null;
    setRun({
      sessionId: r.sessionId,
      limitMs: r.limitMs,
      elapsedMs: r.elapsedMs,
      textDraft: draft && typeof draft.typed === "string" ? (draft as unknown as TextDraft) : null,
      formDraft: draft && Array.isArray(draft.answers) ? (draft as unknown as FormDraft & { savedAt: number }) : null,
    });
  }

  // Al entregar con exito se borra el borrador
  function withCleanup(p: Promise<SubmitResult>, sessionId: string) {
    return p.then((res) => {
      if (res.ok) clearDraft(sessionId);
      return res;
    });
  }

  if (run && form) {
    return (
      <FormExercise
        formId={form.id}
        recordLimit={form.records.length}
        mode="prueba"
        limitMs={run.limitMs ?? undefined}
        elapsedOffsetMs={run.elapsedMs}
        onSubmit={(p) => withCleanup(submitFormTest(testId, p), run.sessionId)}
        initialDraft={run.formDraft}
        onDraft={(d) => saveDraft(run.sessionId, { ...d, savedAt: Date.now() })}
        backHref="/pruebas"
        reviewHref={`/pruebas/${testId}?t=${Date.now()}`}
        allowEarlySubmit
        showGrade
      />
    );
  }

  if (run) {
    return (
      <TypingExercise
        target={text}
        mode="prueba"
        limitMs={run.limitMs ?? undefined}
        elapsedOffsetMs={run.elapsedMs}
        onSubmit={(p) => withCleanup(submitTest(testId, p), run.sessionId)}
        initialTyped={run.textDraft?.typed}
        initialEvents={run.textDraft?.events}
        onDraft={(typed, events) => saveDraft(run.sessionId, { typed, events, savedAt: Date.now() })}
        numpadOnly={isNumericText(text)}
        backHref="/pruebas"
        reviewHref={`/pruebas/${testId}?t=${Date.now()}`}
        penalty={penalty}
        allowEarlySubmit
        showGrade
      />
    );
  }

  const timeText =
    durationSec === null
      ? "No hay límite de tiempo: escribe a tu ritmo y entrega cuando termines. La velocidad se calcula con lo que tardes."
      : `Tienes ${durationSec >= 60 ? `${Math.round(durationSec / 60)} minutos` : `${durationSec} segundos`}. El tiempo empieza al pulsar el botón y sigue corriendo aunque recargues la página.`;

  return (
    <div className="card flex flex-col items-start gap-5 p-8">
      <h2 className="h2 m-0">{resumed ? "Tienes un intento a medias" : attemptNumber > 1 ? `Intento ${attemptNumber}` : "Antes de empezar"}</h2>
      <ul className="m-0 flex flex-col gap-2 pl-5 text-[15px] leading-relaxed text-body">
        <li>{timeText}</li>
        <li>
          {attemptsLeft === null
            ? "Puedes repetir esta prueba las veces que quieras. Para la nota cuenta tu mejor intento."
            : `Es un examen: ${resumed ? "este intento ya cuenta" : `te quedan ${attemptsLeft} ${attemptsLeft === 1 ? "intento" : "intentos"} y este cuenta en cuanto pulses empezar`}. Para la nota cuenta el mejor.`}
        </li>
        {form && <li>Es un formulario: lee cada documento y graba sus datos. Pulsa Intro para pasar al siguiente registro.</li>}
        <li>Puntúan las pulsaciones netas: cada error resta. Respeta mayúsculas, tildes y signos.</li>
        <li>Puedes entregar antes de terminar con el botón &laquo;Entregar ahora&raquo;. No se puede pegar texto.</li>
      </ul>
      {resumed && durationSec !== null && (
        <p className="m-0 rounded-[10px] bg-error-soft px-4 py-3 text-sm text-error-ink">
          El reloj de este intento sigue corriendo: al continuar tendrás solo el tiempo que te queda. Si es el mismo ordenador, recuperas lo que llevabas escrito.
        </p>
      )}
      {error && (
        <p role="alert" className="m-0 rounded-[10px] bg-error-soft px-4 py-3 text-sm text-error-ink">
          {error}
        </p>
      )}
      <button type="button" onClick={begin} disabled={loading} className="btn btn-primary h-12 px-6 text-base">
        {loading ? "Preparando..." : resumed ? "Continuar el intento" : attemptNumber > 1 ? "Repetir la prueba" : "Empezar la prueba"}
      </button>
    </div>
  );
}
