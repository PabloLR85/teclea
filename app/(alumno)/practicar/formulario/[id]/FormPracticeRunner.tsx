"use client";

import { FormExercise } from "@/components/FormExercise";
import { submitFormPractice } from "@/app/actions/formulario";
import { PRACTICE_RECORDS } from "@/lib/forms";

export function FormPracticeRunner({ formId }: { formId: string }) {
  return (
    <FormExercise
      formId={formId}
      recordLimit={PRACTICE_RECORDS}
      mode="practica"
      onSubmit={(p) => submitFormPractice(formId, p)}
      backHref="/practicar"
      retryHref={`/practicar/formulario/${formId}`}
    />
  );
}
