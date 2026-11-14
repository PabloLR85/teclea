import { findForm, scoreForm, type FormAnswers } from "@/lib/forms";
import { align, ST_OK } from "@/lib/scoring";

// Correccion de un ejercicio de formulario: dato esperado frente a lo grabado, campo a campo.
export function FormReview({ formId, answers, submitted, recordLimit }: { formId: string; answers: FormAnswers; submitted: number; recordLimit?: number }) {
  const t = findForm(formId);
  if (!t) return <p className="m-0 text-sm text-muted">Formulario no disponible.</p>;
  const { detail } = scoreForm(t, answers, submitted, recordLimit);
  const records = [...new Set(detail.map((d) => d.record))];
  const label = (k: string) => t.fields.find((f) => f.key === k)?.label ?? k;

  if (records.length === 0) return <p className="m-0 text-sm text-muted">No se grabó ningún dato.</p>;

  return (
    <div className="flex flex-col gap-4">
      {records.map((r) => (
        <div key={r} className="overflow-x-auto rounded-xl border border-line">
          <div className="border-b border-line bg-ground px-4 py-2 text-[13px] font-semibold text-body">
            Registro {r + 1}
            {r >= submitted && " (sin terminar: solo cuentan los campos escritos)"}
          </div>
          <table className="w-full min-w-[560px] border-collapse text-[14px]">
            <thead>
              <tr>
                <th className="th py-2">Campo</th>
                <th className="th py-2">Dato correcto</th>
                <th className="th py-2">Grabado</th>
                <th className="th py-2 text-right">Errores</th>
              </tr>
            </thead>
            <tbody>
              {detail
                .filter((d) => d.record === r)
                .map((d) => {
                  const a = align(d.expected, d.typed);
                  return (
                    <tr key={d.key}>
                      <td className="td py-2 text-muted">{label(d.key)}</td>
                      <td className="td py-2 font-mono">{d.expected}</td>
                      <td className="td py-2 font-mono">
                        {d.typed === "" ? (
                          <span className="rounded bg-error-soft px-1.5 text-error-ink">vacío</span>
                        ) : d.errors === 0 ? (
                          <span className="text-ink">{d.typed}</span>
                        ) : (
                          <span>
                            {d.expected.split("").map((ch, i) =>
                              i < a.consumed && a.status[i] === ST_OK ? (
                                <span key={i}>{ch}</span>
                              ) : (
                                <span key={i} className="rounded bg-error-soft text-error">
                                  {ch === " " ? "_" : ch}
                                </span>
                              ),
                            )}
                            <span className="ml-2 text-xs text-soft">(escrito: {d.typed})</span>
                          </span>
                        )}
                      </td>
                      <td className={`td py-2 text-right font-mono ${d.errors ? "font-semibold text-error" : "text-soft"}`}>{d.errors}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
