"use client";

import { useState } from "react";
import { FORMS } from "@/lib/forms";
import { TextPicker } from "./TextPicker";

// Tipo de prueba: copiar un texto o rellenar formularios
export function TestContentFields() {
  const [kind, setKind] = useState<"texto" | "formulario">("texto");
  return (
    <div className="flex flex-col gap-4">
      <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
        <legend className="label mb-2">Tipo de prueba</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["texto", "formulario"] as const).map((k) => (
            <label
              key={k}
              className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[10px] border border-line px-3.5 py-2.5 text-[15px] has-[:checked]:border-accent has-[:checked]:bg-accent-soft"
            >
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="h-4 w-4 accent-[#4338CA]" />
              {k === "texto" ? "Copiar texto" : "Formularios"}
            </label>
          ))}
        </div>
      </fieldset>
      {kind === "texto" ? (
        <TextPicker idPrefix="test" defaultTextId="texto-grabacion" />
      ) : (
        <div className="flex flex-col gap-2">
          <label htmlFor="form_id" className="label">Formulario</label>
          <select id="form_id" name="form_id" defaultValue={FORMS[0].id} className="field text-[15px]">
            {FORMS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.title} · {f.records.length} registros
              </option>
            ))}
          </select>
          <span className="text-[13px] text-soft">
            El alumno ve cada documento a la izquierda y el formulario a la derecha. Cuentan las pulsaciones y los errores de cada campo; un campo vacío cuenta todos sus caracteres como error.
          </span>
        </div>
      )}
    </div>
  );
}
