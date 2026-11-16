// Teclas fisicas del teclado espanol, dedos y utilidades de teclado numerico.

export const FINGERS: Record<string, string> = {
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
  if (stripped === "_") return "-";
  return stripped;
}

export const KEY_ROWS = ["1234567890", "qwertyuiop", "asdfghjklñ", "zxcvbnm,.-"];

// Un texto es numerico si casi todo lo que no es espacio son cifras o separadores.
export function isNumericText(s: string): boolean {
  const chars = s.replace(/\s/g, "");
  if (chars.length < 10) return false;
  const numeric = chars.replace(/[^0-9,./:-]/g, "").length;
  return numeric / chars.length >= 0.85;
}

// Clasifica una pulsacion en un ejercicio de teclado numerico.
export function numpadKey(key: string, code: string): "ok" | "decimal" | "numlock" | "blocked" {
  if (code.startsWith("Numpad")) {
    if (code === "NumpadDecimal" || code === "NumpadComma") return "decimal";
    if (/^Numpad\d$/.test(code) && !/^\d$/.test(key)) return "numlock";
    return "ok";
  }
  if (/^\d$/.test(key)) return "blocked";
  return "ok";
}
