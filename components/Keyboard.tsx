const ROWS = ["1234567890", "qwertyuiop", "asdfghjklñ", "zxcvbnm,.-"];

const FINGERS: Record<string, string> = {
  "1": "meñique izquierdo", q: "meñique izquierdo", a: "meñique izquierdo", z: "meñique izquierdo",
  "2": "anular izquierdo", w: "anular izquierdo", s: "anular izquierdo", x: "anular izquierdo",
  "3": "corazón izquierdo", e: "corazón izquierdo", d: "corazón izquierdo", c: "corazón izquierdo",
  "4": "índice izquierdo", "5": "índice izquierdo", r: "índice izquierdo", t: "índice izquierdo",
  f: "índice izquierdo", g: "índice izquierdo", v: "índice izquierdo", b: "índice izquierdo",
  "6": "índice derecho", "7": "índice derecho", y: "índice derecho", u: "índice derecho",
  h: "índice derecho", j: "índice derecho", n: "índice derecho", m: "índice derecho",
  "8": "corazón derecho", i: "corazón derecho", k: "corazón derecho", ",": "corazón derecho",
  "9": "anular derecho", o: "anular derecho", l: "anular derecho", ".": "anular derecho",
  "0": "meñique derecho", p: "meñique derecho", ñ: "meñique derecho", "-": "meñique derecho",
  " ": "pulgar",
};

// Tecla fisica de un caracter: quita tildes y mayusculas, pero conserva la ñ.
export function baseKey(ch: string): string {
  if (!ch) return "";
  const lower = ch.toLowerCase();
  if (lower === "ñ") return "ñ";
  const stripped = lower.normalize("NFD").replace(/[̀-ͯ]/g, "");
  if (stripped === ":") return ".";
  if (stripped === ";") return ",";
  if (stripped === "/") return "7";
  return stripped;
}

export function Keyboard({ next }: { next: string }) {
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
