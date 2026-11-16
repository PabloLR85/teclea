import { baseKey, FINGERS, KEY_ROWS as ROWS } from "@/lib/keys";

export { baseKey };

const NUMPAD: { k: string; label: string; finger: string; wide?: boolean }[][] = [
  [{ k: "7", label: "7", finger: "índice" }, { k: "8", label: "8", finger: "corazón" }, { k: "9", label: "9", finger: "anular" }],
  [{ k: "4", label: "4", finger: "índice" }, { k: "5", label: "5", finger: "corazón" }, { k: "6", label: "6", finger: "anular" }],
  [{ k: "1", label: "1", finger: "índice" }, { k: "2", label: "2", finger: "corazón" }, { k: "3", label: "3", finger: "anular" }],
  [{ k: "0", label: "0", finger: "pulgar", wide: true }, { k: ",", label: ",", finger: "anular" }],
];
const NUMPAD_SIDE: Record<string, string> = { "/": "corazón", "-": "meñique" };

// Bloque numerico: la mano derecha descansa con el indice en el 4, el corazon en el 5 (con marca) y el anular en el 6.
function Numpad({ next }: { next: string }) {
  const key = next === "." ? "," : next;
  const all = NUMPAD.flat();
  const finger = all.find((x) => x.k === key)?.finger ?? NUMPAD_SIDE[key] ?? (key === " " ? "pulgar izquierdo (barra espaciadora)" : undefined);
  return (
    <div className="card flex flex-col gap-3.5 px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <span>
          Siguiente tecla: <strong className="font-mono text-base text-accent">{next === " " ? "espacio" : next || "-"}</strong>
        </span>
        <span>
          Dedo: <strong className="text-ink">{finger ? `${finger}${finger.includes("pulgar izquierdo") ? "" : " derecho"}` : "-"}</strong>
        </span>
      </div>
      <div className="flex justify-center gap-1.5" aria-hidden="true">
        <div className="flex flex-col gap-1.5">
          {NUMPAD.map((row, i) => (
            <div key={i} className="flex gap-1.5">
              {row.map((c) => (
                <span
                  key={c.k}
                  className={`flex h-12 items-center justify-center rounded-[10px] font-mono text-base ${c.wide ? "w-[102px]" : "w-12"} ${
                    c.k === key ? "bg-accent font-bold text-white" : `border border-line bg-white text-body ${c.k === "5" ? "border-b-[3px] border-b-accent-mid" : ""}`
                  }`}
                >
                  {c.label}
                </span>
              ))}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-1.5">
          {["/", "-"].map((k) => (
            <span key={k} className={`flex h-12 w-12 items-center justify-center rounded-[10px] font-mono text-base ${k === key ? "bg-accent font-bold text-white" : "border border-line bg-white text-body"}`}>
              {k}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Keyboard({ next, numpad = false }: { next: string; numpad?: boolean }) {
  if (numpad) return <Numpad next={next} />;
  const key = baseKey(next);
  const needsShift = next !== "" && next !== next.toLowerCase() || next === ":" || next === ";" || next === "/";
  const finger = FINGERS[key];
  return (
    <div className="card flex flex-col gap-3.5 overflow-x-auto px-5 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
        <span>
          Siguiente tecla:{" "}
          <strong className="font-mono text-base text-accent">
            {next === " " ? "espacio" : next || "-"}
            {needsShift ? " (con mayúsculas)" : ""}
          </strong>
        </span>
        <span>
          Dedo: <strong className="text-ink">{finger ?? "-"}</strong>
        </span>
      </div>
      <div className="flex min-w-[600px] flex-col items-center gap-1.5" aria-hidden="true">
        {ROWS.map((row) => (
          <div key={row} className="flex gap-1.5">
            {row.split("").map((k) => {
              const active = k === key;
              const home = k === "f" || k === "j";
              return (
                <span
                  key={k}
                  className={`flex h-11 w-11 items-center justify-center rounded-[10px] font-mono text-base ${
                    active
                      ? "bg-accent font-bold text-white"
                      : `border border-line bg-white text-body ${home ? "border-b-[3px] border-b-accent-mid" : ""}`
                  }`}
                >
                  {k}
                </span>
              );
            })}
          </div>
        ))}
        <span className={`mt-0.5 h-10 w-72 rounded-[10px] ${key === " " ? "bg-accent" : "border border-line bg-white"}`} />
      </div>
    </div>
  );
}
