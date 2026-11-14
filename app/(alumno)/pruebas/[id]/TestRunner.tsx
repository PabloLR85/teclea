"use client";

import { useState } from "react";
import { TypingExercise } from "@/components/TypingExercise";
import { startTest, submitTest } from "@/app/actions/alumno";
import { submitFormTest } from "@/app/actions/formulario";
import { FormExercise } from "@/components/FormExercise";
import { findForm } from "@/lib/forms";

export function TestRunner({
  testId,
  text,
  durationSec,
  resumed,
  penalty,
}: {
  testId: string;
  text: string;
  durationSec: number;
  resumed: boolean;
  penalty: number;
}) {
  const [limitMs, setLimitMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function begin() {
    setLoading(true);
    setError(null);
    const r = await startTest(testId);
    setLoading(false);
    if (r.ok) setLimitMs(r.remainingMs);
    else setError(r.error);
  }

  const formId = text.startsWith("form:") ? text.slice(5) : null;
  const form = formId ? findForm(formId) : null;

  if (limitMs !== null && form) {
    return (
      <FormExercise
        formId={form.id}
        recordLimit={form.records.length}
        mode="prueba"
        limitMs={limitMs}
        onSubmit={(p) => submitFormTest(testId, p)}
        backHref="/pruebas"
        reviewHref={`/pruebas/${testId}`}
        showGrade
      />
    );
  }

  if (limitMs !== null) {
    return (
      <TypingExercise
        target={text}
        mode="prueba"
        limitMs={limitMs}
        onSubmit={(p) => submitTest(testId, p)}
        backHref="/pruebas"
        reviewHref={`/pruebas/${testId}`}
        penalty={penalty}
        showGrade
      />
    );
  }

  return (
    <div className="card flex flex-col items-start gap-5 p-8">
      <h2 className="h2 m-0">Antes de empezar</h2>
      <ul className="m-0 flex flex-col gap-2 pl-5 text-[15px] leading-relaxed text-body">
        <li>Tienes {durationSec >= 60 ? `${Math.round(durationSec / 60)} minutos` : `${durationSec} segundos`} y un solo intento.</li>
        <li>El tiempo empieza a contar al pulsar el botón, aunque no escribas.</li>
        <li>Si recargas la página, el reloj sigue corriendo.</li>
        {form && <li>Es un formulario: lee cada documento y graba sus datos. Pulsa Intro para pasar al siguiente registro.</li>}
        <li>Puntúan las pulsaciones netas: cada error resta. Respeta mayúsculas, tildes y signos.</li>
        <li>No se puede pegar texto.</li>
      </ul>
      {resumed && (
        <p className="m-0 rounded-[10px] bg-error-soft px-4 py-3 text-sm text-error-ink">
          Ya habías empezado esta prueba. Al continuar tendrás solo el tiempo que te queda.
        </p>
      )}
      {error && (
        <p role="alert" className="m-0 rounded-[10px] bg-error-soft px-4 py-3 text-sm text-error-ink">
          {error}
        </p>
      )}
      <button type="button" onClick={begin} disabled={loading} className="btn btn-primary h-12 px-6 text-base">
        {loading ? "Preparando..." : resumed ? "Continuar la prueba" : "Empezar la prueba"}
      </button>
    </div>
  );
}
