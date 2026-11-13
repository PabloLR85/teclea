"use client";

import { useActionState } from "react";
import { updateAlias, type LoginState } from "@/app/actions/alumno";

export function AliasForm({ current }: { current: string }) {
  const [state, action, pending] = useActionState<LoginState & { saved?: boolean }, FormData>(
    async (prev, form) => {
      const r = await updateAlias(prev, form);
      return r.error ? r : { saved: true };
    },
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="alias" className="label">Alias en el ranking</label>
      <input id="alias" name="alias" defaultValue={current} maxLength={20} required className="field" />
      <span className="text-[13px] text-soft">Lo verán tus compañeros. Tu nombre completo solo lo ve el profesor.</span>
      {state.error && <p role="alert" className="m-0 text-sm text-error-ink">{state.error}</p>}
      {state.saved && <p className="m-0 text-sm text-accent">Alias guardado.</p>}
      <button type="submit" disabled={pending} className="btn btn-primary self-start">
        {pending ? "Guardando..." : "Guardar"}
      </button>
    </form>
  );
}
