"use client";

import { useActionState } from "react";
import { loginStudent, type LoginState } from "@/app/actions/alumno";

export function StudentLoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginStudent, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="code" className="label">Código de clase</label>
        <input id="code" name="code" required autoComplete="off" placeholder="GD-XXXX" className="field font-mono uppercase tracking-wider" />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="username" className="label">Usuario</label>
        <input id="username" name="username" required autoComplete="username" autoCapitalize="off" placeholder="nombre.apellido" className="field" />
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="pin" className="label">PIN</label>
        <input
          id="pin"
          name="pin"
          required
          type="password"
          inputMode="numeric"
          pattern="[0-9]{4}"
          maxLength={4}
          autoComplete="current-password"
          placeholder="4 cifras"
          className="field font-mono tracking-[0.3em]"
        />
      </div>
      {state.error && (
        <p role="alert" className="m-0 rounded-[10px] bg-error-soft px-3.5 py-2.5 text-sm text-error-ink">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className="btn btn-primary h-[50px] text-base">
        {pending ? "Entrando..." : "Entrar"}
      </button>
    </form>
  );
}
