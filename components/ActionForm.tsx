"use client";

import { useActionState, useEffect, useRef } from "react";
import type { FormState } from "@/app/actions/profesor";

type Props = {
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  resetOnSuccess?: boolean;
  children: React.ReactNode;
};

export function ActionForm({ action, submitLabel, pendingLabel = "Guardando...", className = "", resetOnSuccess, children }: Props) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
  }, [state, resetOnSuccess]);
  return (
    <form ref={ref} action={formAction} className={`flex flex-col gap-4 ${className}`}>
      {children}
      {state.error && (
        <p role="alert" className="m-0 rounded-[10px] bg-error-soft px-3.5 py-2.5 text-sm text-error-ink">
          {state.error}
        </p>
      )}
      {state.ok && <p className="m-0 rounded-[10px] bg-accent-soft px-3.5 py-2.5 text-sm text-accent-ink">{state.ok}</p>}
      <button type="submit" disabled={pending} className="btn btn-primary self-start">
        {pending ? pendingLabel : submitLabel}
      </button>
    </form>
  );
}
