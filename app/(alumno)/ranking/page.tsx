import Link from "next/link";
import { requireStudent } from "@/lib/session";
import { getRanking } from "@/lib/ranking";

export default async function RankingPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const { periodo } = await searchParams;
  const period = periodo === "general" ? "general" : "semana";
  const { student, klass } = await requireStudent();
  const rows = await getRanking(klass.id, period);
  const podium = rows.slice(0, 3);
  const rest = rows.slice(3);
  const myPos = rows.findIndex((r) => r.studentId === student.id);

  const tab = (value: "semana" | "general", label: string) => (
    <Link
      href={`/ranking?periodo=${value}`}
      role="tab"
      aria-selected={period === value}
      className={
        period === value
          ? "flex h-11 items-center rounded-[9px] bg-white px-[18px] text-sm font-semibold text-ink"
          : "flex h-11 items-center rounded-[9px] px-[18px] text-sm font-medium text-muted hover:text-ink"
      }
    >
      {label}
    </Link>
  );

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="kicker">Grupo {klass.code}</span>
          <h1 className="h1 m-0">Ranking de clase</h1>
        </div>
        <div role="tablist" aria-label="Periodo" className="flex gap-1 rounded-xl bg-[#EAECF0] p-1">
          {tab("semana", "Esta semana")}
          {tab("general", "General")}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="card p-8 text-muted">
          Todavía no hay marcas {period === "semana" ? "esta semana" : ""}. Completa ejercicios de al menos 50 caracteres para entrar en el ranking.
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            {podium.map((r, i) => (
              <div key={r.studentId} className={`card flex flex-col gap-2.5 p-[22px] ${r.studentId === student.id ? "border-2 border-accent" : ""}`}>
                <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-accent-soft font-display text-lg font-bold text-accent">
                  {i + 1}
                </span>
                <span className="text-[17px] font-semibold">
                  {r.alias}
                  {r.studentId === student.id ? " (tú)" : ""}
                </span>
                <span className="font-display text-[34px] font-bold leading-none">{Math.round(r.score)}</span>
                <span className="text-[13px] text-soft">netas/min · {r.accuracy} % precisión</span>
              </div>
            ))}
          </div>

          {rest.length > 0 && (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[520px] border-collapse text-[15px]">
                <thead>
                  <tr>
                    <th className="th">#</th>
                    <th className="th">Alumno</th>
                    <th className="th text-right">Netas/min</th>
                    <th className="th text-right">Precisión</th>
                    <th className="th text-right">Ejercicios</th>
                  </tr>
                </thead>
                <tbody>
                  {rest.map((r, i) => {
                    const me = r.studentId === student.id;
                    return (
                      <tr key={r.studentId} className={me ? "bg-accent-soft" : ""}>
                        <td className={`td font-semibold ${me ? "text-accent" : "text-soft"}`}>{i + 4}</td>
                        <td className={`td ${me ? "font-bold text-accent-ink" : "font-medium"}`}>
                          {r.alias}
                          {me ? " (tú)" : ""}
                        </td>
                        <td className="td text-right font-mono font-semibold">{Math.round(r.score)}</td>
                        <td className="td text-right font-mono">{r.accuracy} %</td>
                        <td className="td text-right font-mono">{r.attempts}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {myPos < 0 && <p className="m-0 text-sm text-muted">Aún no apareces en este ranking. Completa un ejercicio para entrar.</p>}
        </>
      )}
      <p className="m-0 text-[13px] text-soft">
        {period === "semana"
          ? "Semana: tu mejor marca de pulsaciones netas desde el lunes."
          : "General: media de tus 5 mejores marcas, para premiar la regularidad."}{" "}
        Cada error resta pulsaciones. Solo cuentan ejercicios de 50 caracteres o más.
      </p>
    </div>
  );
}
