"use client";

import { useState } from "react";
import { BANK_CATEGORIES, TEXT_BANK } from "@/lib/textBank";

// Selector del banco de textos: al elegir uno, rellena el cuadro de texto, que se puede retocar.
export function TextPicker({ name = "content", idPrefix, defaultTextId }: { name?: string; idPrefix: string; defaultTextId?: string }) {
  const initial = TEXT_BANK.find((t) => t.id === defaultTextId);
  const [selected, setSelected] = useState(initial?.id ?? "");
  const [text, setText] = useState(initial?.text ?? "");

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-bank`} className="label">Banco de textos</label>
        <select
          id={`${idPrefix}-bank`}
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            const t = TEXT_BANK.find((x) => x.id === e.target.value);
            if (t) setText(t.text);
          }}
          className="field text-[15px]"
        >
          <option value="">Escribir o pegar mi propio texto</option>
          {BANK_CATEGORIES.map((c) => (
            <optgroup key={c} label={c}>
              {TEXT_BANK.filter((t) => t.category === c).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} · {t.text.length} car.
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor={`${idPrefix}-content`} className="label">Texto a copiar</label>
        <textarea
          id={`${idPrefix}-content`}
          name={name}
          rows={6}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setSelected("");
          }}
          className="w-full rounded-[10px] border border-line-strong bg-white px-3.5 py-3 font-mono text-sm"
        />
        <span className="text-[13px] text-soft">{text.length} caracteres. Puedes retocarlo antes de crear.</span>
      </div>
    </div>
  );
}
