import { align, formatGrade, ST_MISSING, ST_OK, ST_WRONG, type Evaluated } from "@/lib/scoring";
import { parseStoredForm } from "@/lib/forms";
import { FormReview } from "./FormReview";

type Props = {
  target: string;
  typed: string | null;
  chars: number;
  errors: number;
  durationMs: number;
  result: Evaluated;
  showGrade: boolean;
  flagged?: string | null;
};

function fmtDuration(ms: number) {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

const fmt = (n: number) => String(n).replace(".", ",");

// Ficha de resultado de un intento. La usan igual el alumno y el profesor,
// para que los dos vean exactamente las mismas cifras y la misma correccion.
export function AttemptReview({ target, typed, chars, errors, durationMs, result, showGrade, flagged }: Props) {
  const stored = parseStoredForm(typed);
  const a = typed !== null && !stored ? align(target, typed) : null;
  const tiles = [
    { label: "Netas/min", value: fmt(result.netPpm), strong: true },
    { label: "Brutas/min", value: fmt(result.grossPpm) },
    { label: "Pulsaciones", value: String(chars) },
    { label: "Errores", value: String(errors), error: true },
    { label: "Precisión", value: `${fmt(result.accuracy)} %` },
    { label: "Tiempo", value: fmtDuration(durationMs) },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-stretch gap-4">
        {showGrade && (
          <div
            className={`flex min-w-[150px] flex-col justify-center gap-1 rounded-2xl p-6 ${
              flagged ? "bg-[#F2F4F7] text-muted" : result.grade >= 5 ? "bg-accent-soft text-accent-ink" : "bg-error-soft text-error-ink"
            }`}
          >
            <span className="text-sm">Nota</span>
            <span className="font-display text-[56px] font-bold leading-none">{formatGrade(result.grade)}</span>
          </div>
        )}
        <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-3">
          {tiles.map((t) => (
            <div key={t.label} className="card flex flex-col gap-1 p-[18px]">
              <span className="text-[13px] text-muted">{t.label}</span>
              <span className={`font-display text-[26px] font-bold ${t.error ? "text-error" : ""}`}>{t.value}</span>
            </div>
          ))}
        </div>
      </div>

      {flagged && (
        <p className="m-0 rounded-xl bg-error-soft px-4 py-3 text-sm text-error-ink">
          Intento en revisión ({flagged}). No puntúa hasta que el profesor lo valide.
        </p>
      )}

      <div className="card flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="h2 m-0">Corrección</h2>
          <div className={`flex flex-wrap gap-4 text-[13px] text-muted ${stored ? "hidden" : ""}`}>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-error-soft ring-1 ring-error" /> Tecla equivocada</span>
            <span className="flex items-center gap-1.5"><span className="rounded bg-error-soft px-1 font-mono text-error underline decoration-dotted">a</span> Carácter saltado</span>
            <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-line" /> Sin llegar a escribir</span>
          </div>
        </div>
        {stored ? (
          <FormReview formId={stored.form} answers={stored.answers} submitted={stored.submitted} />
        ) : a ? (
          <div className="whitespace-pre-wrap font-mono text-[17px] leading-[1.8]">
            {target.split("").map((ch, i) => {
              if (i >= a.consumed) return <span key={i} className="text-faint">{ch}</span>;
              const st = a.status[i];
              if (st === ST_OK) return <span key={i} className="text-ink">{ch}</span>;
              if (st === ST_MISSING)
                return (
                  <span key={i} className="rounded bg-error-soft text-error underline decoration-dotted">
                    {ch === " " ? "_" : ch}
                  </span>
                );
              if (st === ST_WRONG)
                return (
                  <span key={i} className="rounded bg-error-soft text-error">
                    {ch === " " ? "_" : ch}
                  </span>
                );
              return <span key={i}>{ch}</span>;
            })}
          </div>
        ) : (
          <p className="m-0 text-sm text-muted">Este intento se hizo antes de que la app guardara el texto escrito, así que no se puede mostrar la corrección.</p>
        )}
        {typed && !stored && (
          <details className="text-sm">
            <summary className="cursor-pointer font-semibold text-accent">Ver el texto tal como se escribió</summary>
            <p className="m-0 mt-3 whitespace-pre-wrap rounded-xl bg-ground p-4 font-mono text-[15px] leading-relaxed">{typed}</p>
          </details>
        )}
      </div>
    </div>
  );
}
