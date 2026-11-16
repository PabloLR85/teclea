import { KEY_ROWS } from "@/lib/keys";
import { MIN_KEY_SAMPLES, type Progress } from "@/lib/progress";

// Escala secuencial de un solo tono (naranja, el color de error de la app): claro = pocos fallos, oscuro = muchos.
const STEPS = [
  { max: 0.02, bg: "#FFF7ED", fg: "#344054", label: "menos del 2 %" },
  { max: 0.05, bg: "#FED7AA", fg: "#344054", label: "2-5 %" },
  { max: 0.1, bg: "#FB923C", fg: "#1F2937", label: "5-10 %" },
  { max: 0.2, bg: "#C2410C", fg: "#FFFFFF", label: "10-20 %" },
  { max: Infinity, bg: "#7C2D12", fg: "#FFFFFF", label: "20 % o más" },
];
const stepFor = (rate: number) => STEPS.find((s) => rate < s.max) ?? STEPS[STEPS.length - 1];
const pct = (r: number) => `${(r * 100).toFixed(r < 0.1 ? 1 : 0).replace(".", ",")} %`;

function KeyHeatmap({ progress }: { progress: Progress }) {
  const byKey = new Map(progress.keys.map((k) => [k.key, k]));
  const ranked = progress.keys.filter((k) => k.total >= MIN_KEY_SAMPLES && k.errors > 0).sort((a, b) => b.rate - a.rate).slice(0, 5);
  return (
    <section className="card flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <h2 className="h2 m-0">Mapa de teclas</h2>
        <p className="m-0 text-sm text-muted">
          Porcentaje de fallos en cada tecla en los últimos ejercicios ({progress.totals.analyzedChars.toLocaleString("es-ES")} pulsaciones analizadas). Las tildes y mayúsculas cuentan en su letra.
        </p>
      </div>
      {progress.totals.analyzedChars === 0 ? (
        <p className="m-0 text-[15px] text-muted">Todavía no hay ejercicios suficientes para el mapa.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <div className="flex min-w-[600px] flex-col items-center gap-1.5">
              {KEY_ROWS.map((row) => (
                <div key={row} className="flex gap-1.5">
                  {row.split("").map((k) => {
                    const s = byKey.get(k);
                    const enough = s && s.total >= MIN_KEY_SAMPLES;
                    const st = enough ? stepFor(s.rate) : null;
                    return (
                      <div
                        key={k}
                        title={s ? `${k}: ${s.errors} fallos de ${s.total} (${pct(s.rate)})${enough ? "" : ", pocos datos"}` : `${k}: sin datos`}
                        className={`flex h-12 w-12 flex-col items-center justify-center rounded-[10px] ${st ? "" : "border border-dashed border-line-strong bg-white text-soft"}`}
                        style={st ? { background: st.bg, color: st.fg } : undefined}
                      >
                        <span className="font-mono text-base font-semibold leading-none">{k}</span>
                        {enough && <span className="mt-0.5 text-[10px] leading-none">{pct(s.rate)}</span>}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[12px] text-muted" aria-label="Leyenda">
            {STEPS.map((s) => (
              <span key={s.label} className="flex items-center gap-1.5">
                <span className="h-3.5 w-5 rounded" style={{ background: s.bg, boxShadow: "inset 0 0 0 1px rgba(0,0,0,.08)" }} />
                {s.label}
              </span>
            ))}
            <span className="flex items-center gap-1.5">
              <span className="h-3.5 w-5 rounded border border-dashed border-line-strong bg-white" /> pocos datos
            </span>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-2">
              <h3 className="m-0 text-[15px] font-semibold">Teclas que más fallas</h3>
              {ranked.length === 0 ? (
                <p className="m-0 text-sm text-muted">Ninguna tecla destaca por fallos.</p>
              ) : (
                <ol className="m-0 flex flex-col gap-1.5 pl-5 text-sm text-body">
                  {ranked.map((k) => (
                    <li key={k.key}>
                      <strong className="font-mono text-ink">{k.key}</strong>: {pct(k.rate)} de fallos ({k.errors} de {k.total})
                    </li>
                  ))}
                </ol>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="m-0 text-[15px] font-semibold">Por dedo</h3>
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0 text-sm text-body">
                {progress.fingers.slice(0, 5).map((f) => (
                  <li key={f.finger} className="flex items-center gap-2">
                    <span className="w-36 shrink-0">{f.finger.charAt(0).toUpperCase() + f.finger.slice(1)}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-[#F2F4F7]">
                      <span className="block h-2 rounded-full" style={{ width: `${Math.min(100, f.rate * 400)}%`, background: stepFor(f.rate).bg === "#FFF7ED" ? "#FED7AA" : stepFor(f.rate).bg }} />
                    </span>
                    <span className="w-14 text-right font-mono">{pct(f.rate)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </section>
  );
}

// Grafica de linea de un solo indicador (un eje, sin leyenda: el titulo la nombra)
function LineChart({
  points,
  valueLabel,
  format,
  yMax,
  yMin = 0,
  step,
}: {
  points: { label: string; value: number | null; note: string }[];
  valueLabel: string;
  format: (v: number) => string;
  yMax: number;
  yMin?: number;
  step: number;
}) {
  const W = 640;
  const H = 200;
  const pad = { l: 44, r: 16, t: 14, b: 28 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const x = (i: number) => pad.l + (points.length === 1 ? iw / 2 : (i * iw) / (points.length - 1));
  const y = (v: number) => pad.t + ih - ((v - yMin) / (yMax - yMin || 1)) * ih;
  const ticks: number[] = [];
  for (let t = yMin; t <= yMax + 0.001; t += step) ticks.push(t);
  const segs: string[] = [];
  let cur = "";
  points.forEach((p, i) => {
    if (p.value === null) {
      if (cur) segs.push(cur);
      cur = "";
      return;
    }
    cur += `${cur ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`;
  });
  if (cur) segs.push(cur);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={valueLabel}>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#EAECF0" strokeWidth="1" />
          <text x={pad.l - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#667085">
            {format(t)}
          </text>
        </g>
      ))}
      {points.map((p, i) => (
        <text key={p.label} x={x(i)} y={H - 8} textAnchor="middle" fontSize="11" fill="#667085">
          {p.label}
        </text>
      ))}
      {segs.map((d) => (
        <path key={d} d={d} fill="none" stroke="#4338CA" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      ))}
      {points.map((p, i) =>
        p.value === null ? null : (
          <g key={`p${i}`}>
            <circle cx={x(i)} cy={y(p.value)} r="4.5" fill="#4338CA" stroke="#FFFFFF" strokeWidth="2" />
            {/* zona amplia para el aviso al pasar el raton */}
            <circle cx={x(i)} cy={y(p.value)} r="14" fill="transparent">
              <title>{`Semana del ${p.label}: ${format(p.value)} · ${p.note}`}</title>
            </circle>
          </g>
        ),
      )}
    </svg>
  );
}

function BarChart({ days }: { days: Progress["days"] }) {
  const W = 640;
  const H = 160;
  const pad = { l: 36, r: 8, t: 10, b: 26 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;
  const max = Math.max(30, ...days.map((d) => d.minutes));
  const top = Math.ceil(max / 15) * 15;
  const bw = iw / days.length;
  const y = (v: number) => pad.t + ih - (v / top) * ih;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Minutos de práctica por día">
      {[0, top / 2, top].map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke="#EAECF0" />
          <text x={pad.l - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#667085">
            {t}
          </text>
        </g>
      ))}
      {days.map((d, i) => {
        const h = (d.minutes / top) * ih;
        const bx = pad.l + i * bw + 3;
        return (
          <g key={d.day}>
            {d.minutes > 0 && <path d={roundedTop(bx, y(d.minutes), bw - 6, h)} fill="#4338CA" />}
            <rect x={pad.l + i * bw} y={pad.t} width={bw} height={ih} fill="transparent">
              <title>{`${d.label}: ${d.minutes} min`}</title>
            </rect>
            {(i % 2 === 1 || days.length <= 7) && (
              <text x={bx + (bw - 6) / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#667085">
                {d.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// Barra con las esquinas superiores redondeadas y la base recta sobre el eje
function roundedTop(x: number, y: number, w: number, h: number) {
  const r = Math.min(4, w / 2, h);
  return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
}

export function ProgressView({ progress }: { progress: Progress }) {
  const withData = progress.weeks.filter((w) => w.count > 0);
  const maxNet = Math.max(50, ...withData.map((w) => w.avgNet));
  const netStep = maxNet <= 100 ? 20 : maxNet <= 200 ? 25 : 50;
  const netTop = Math.ceil(maxNet / netStep) * netStep;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card flex flex-col gap-1 p-[18px]">
          <span className="text-[13px] text-muted">Práctica últimos 7 días</span>
          <span className="font-display text-[28px] font-bold">{progress.totals.minutes7} min</span>
        </div>
        <div className="card flex flex-col gap-1 p-[18px]">
          <span className="text-[13px] text-muted">Práctica total (4 meses)</span>
          <span className="font-display text-[28px] font-bold">
            {Math.floor(progress.totals.minutes / 60)} h {progress.totals.minutes % 60} min
          </span>
        </div>
        <div className="card flex flex-col gap-1 p-[18px]">
          <span className="text-[13px] text-muted">Ejercicios hechos</span>
          <span className="font-display text-[28px] font-bold">{progress.totals.attempts}</span>
        </div>
      </div>

      <section className="card flex flex-col gap-3 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="h2 m-0">Pulsaciones netas por minuto</h2>
          <p className="m-0 text-sm text-muted">Media semanal de los ejercicios de 50 caracteres o más. Pasa el ratón por un punto para ver el detalle.</p>
        </div>
        {withData.length === 0 ? (
          <p className="m-0 text-[15px] text-muted">Aún no hay datos suficientes.</p>
        ) : (
          <LineChart
            points={progress.weeks.map((w) => ({ label: w.label, value: w.count ? w.avgNet : null, note: `mejor ${Math.round(w.bestNet)}, ${w.count} ejercicios` }))}
            valueLabel="Pulsaciones netas por minuto, media semanal"
            format={(v) => String(Math.round(v))}
            yMax={netTop}
            step={netStep}
          />
        )}
      </section>

      <section className="card flex flex-col gap-3 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="h2 m-0">Precisión</h2>
          <p className="m-0 text-sm text-muted">Media semanal del porcentaje de pulsaciones sin error.</p>
        </div>
        {withData.length === 0 ? (
          <p className="m-0 text-[15px] text-muted">Aún no hay datos suficientes.</p>
        ) : (
          <LineChart
            points={progress.weeks.map((w) => ({ label: w.label, value: w.count ? w.avgAcc : null, note: `${w.count} ejercicios` }))}
            valueLabel="Precisión media semanal"
            format={(v) => `${Math.round(v)} %`}
            yMin={Math.max(0, Math.floor(Math.min(...withData.map((w) => w.avgAcc)) / 10) * 10 - 10)}
            yMax={100}
            step={5}
          />
        )}
        <details className="text-sm">
          <summary className="cursor-pointer font-semibold text-accent">Ver los datos en tabla</summary>
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr>
                <th className="th py-2">Semana del</th>
                <th className="th py-2 text-right">Ejercicios</th>
                <th className="th py-2 text-right">Netas/min (media)</th>
                <th className="th py-2 text-right">Mejor</th>
                <th className="th py-2 text-right">Precisión</th>
              </tr>
            </thead>
            <tbody>
              {progress.weeks.map((w) => (
                <tr key={w.week}>
                  <td className="td py-2">{w.label}</td>
                  <td className="td py-2 text-right font-mono">{w.count}</td>
                  <td className="td py-2 text-right font-mono">{w.count ? Math.round(w.avgNet) : "-"}</td>
                  <td className="td py-2 text-right font-mono">{w.count ? Math.round(w.bestNet) : "-"}</td>
                  <td className="td py-2 text-right font-mono">{w.count ? `${w.avgAcc} %` : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      <section className="card flex flex-col gap-3 p-6">
        <div className="flex flex-col gap-1">
          <h2 className="h2 m-0">Minutos de práctica</h2>
          <p className="m-0 text-sm text-muted">Tiempo escribiendo cada día en las dos últimas semanas (lecciones, formularios, pruebas y carreras).</p>
        </div>
        <BarChart days={progress.days} />
      </section>

      <KeyHeatmap progress={progress} />
    </div>
  );
}
