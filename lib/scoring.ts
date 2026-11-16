export type Baremo = {
  min5: number; // netas/min para el 5
  max10: number; // netas/min para el 10
  minAcc: number; // % de precision minima; por debajo la nota maxima es 4
  penalty: number; // pulsaciones que resta cada error
};

export const DEFAULT_BAREMO: Baremo = { min5: 120, max10: 250, minAcc: 95, penalty: 5 };

export function normalizeBaremo(b: Partial<Baremo> | null | undefined): Baremo {
  return { ...DEFAULT_BAREMO, ...(b ?? {}) };
}

export type InputEvent = { t: number; n: number }; // ms desde el inicio, longitud del texto tras el evento

export type Score = {
  chars: number;
  errors: number;
  grossPpm: number;
  netPpm: number;
  accuracy: number;
  consumed: number; // caracteres del texto original cubiertos por lo escrito
};

const r1 = (x: number) => Math.round(x * 10) / 10;

// Margen de desajuste que se tolera entre lo escrito y el original: permite que el alumno
// se salte una linea entera (o la repita) sin que el resto del texto se cuente como error.
export const ALIGN_BAND = 120;
// Lo escrito puede superar al original en este margen (caracteres de mas).
export const MAX_EXTRA = 20;

export const ST_PENDING = 0;
export const ST_OK = 1;
export const ST_WRONG = 2; // tecla equivocada
export const ST_MISSING = 3; // caracter que el alumno se salto

export type Alignment = {
  errors: number;
  consumed: number;
  status: Uint8Array; // un estado por caracter del original
  extraBefore: Uint8Array; // caracteres de mas escritos justo antes de cada posicion del original (T + 1)
};

// Variantes que se consideran la misma tecla. Todas cambian un caracter por otro,
// asi las posiciones del texto no se mueven.
const EQUIV: Record<string, string> = {
  "\u00ab": '"', "\u00bb": '"', "\u201c": '"', "\u201d": '"', "\u201e": '"', "\u201f": '"',
  "\u2018": "'", "\u2019": "'", "\u201a": "'", "\u201b": "'", "\u00b4": "'", "`": "'",
  "\u00b0": "\u00ba", // grado y ordinal masculino: 2.º
  "\u2013": "-", "\u2014": "-", "\u2212": "-", "\u2010": "-", "\u2011": "-",
  "\u00a0": " ", "\u202f": " ", "\u2007": " ", "\t": " ",
};

// Normaliza lo escrito al llegar: composicion Unicode unica (una "a" con tilde es siempre
// un solo caracter, venga del teclado que venga) y espacios especiales como espacio normal.
export function normalizeTyped(s: string): string {
  return s.normalize("NFC").replace(/[\u00a0\u202f\u2007\t]/g, " ");
}

function canon(s: string): string {
  const n = s.normalize("NFC");
  let out = "";
  for (const ch of n) out += EQUIV[ch] ?? ch;
  return out;
}

export function sameText(a: string, b: string): boolean {
  return canon(a) === canon(b);
}

// Memoria reutilizada entre llamadas (se llama en cada pulsacion)
let buffer = new Int32Array(0);

// Alinea lo escrito con el original (distancia de edicion con banda).
// Un caracter saltado o de mas cuenta como un solo error, sin arrastrar al resto del texto.
export function align(targetRaw: string, typedRaw: string, band = ALIGN_BAND): Alignment {
  const target = canon(targetRaw);
  const typed = canon(typedRaw);
  const T = target.length;
  const n = typed.length;
  const W = 2 * band + 1;
  const INF = 1 << 29;
  const size = (n + 1) * W;
  if (buffer.length < size) buffer = new Int32Array(Math.max(size, buffer.length * 2));
  const D = buffer;
  D.fill(INF, 0, size);
  const at = (i: number, j: number) => i * W + (j - i + band);
  const inBand = (i: number, j: number) => j >= 0 && j <= T && Math.abs(j - i) <= band;

  for (let j = 0; j <= Math.min(band, T); j++) D[at(0, j)] = j;
  for (let i = 1; i <= n; i++) {
    const jFrom = Math.max(0, i - band);
    const jTo = Math.min(T, i + band);
    const c = typed.charCodeAt(i - 1);
    for (let j = jFrom; j <= jTo; j++) {
      let best = INF;
      if (j === 0) best = i;
      else {
        if (inBand(i - 1, j - 1)) best = D[at(i - 1, j - 1)] + (c === target.charCodeAt(j - 1) ? 0 : 1);
        if (inBand(i, j - 1)) best = Math.min(best, D[at(i, j - 1)] + 1);
      }
      if (inBand(i - 1, j)) best = Math.min(best, D[at(i - 1, j)] + 1);
      D[at(i, j)] = best;
    }
  }

  // Final: el punto del original con menos errores, y a igualdad el mas cercano a lo escrito.
  let endJ = Math.min(n, T);
  let endCost = inBand(n, endJ) ? D[at(n, endJ)] : INF;
  for (let j = Math.max(0, n - band); j <= Math.min(T, n + band); j++) {
    const cst = D[at(n, j)];
    if (cst < endCost || (cst === endCost && Math.abs(j - n) < Math.abs(endJ - n))) {
      endCost = cst;
      endJ = j;
    }
  }

  // Reconstruccion: aciertos primero, luego tecla equivocada, salto y caracter de mas.
  // Cada marca es exactamente un error: nunca se pinta de rojo una letra bien escrita.
  const status = new Uint8Array(T);
  const extraBefore = new Uint8Array(T + 1);
  let i = n;
  let j = endJ;
  while (i > 0 || j > 0) {
    const cur = D[at(i, j)];
    if (i > 0 && j > 0 && inBand(i - 1, j - 1)) {
      const cost = typed.charCodeAt(i - 1) === target.charCodeAt(j - 1) ? 0 : 1;
      if (cost === 0 && cur === D[at(i - 1, j - 1)]) {
        status[j - 1] = ST_OK;
        i--;
        j--;
        continue;
      }
    }
    if (i > 0 && j > 0 && inBand(i - 1, j - 1) && cur === D[at(i - 1, j - 1)] + 1) {
      status[j - 1] = ST_WRONG;
      i--;
      j--;
      continue;
    }
    if (j > 0 && inBand(i, j - 1) && cur === D[at(i, j - 1)] + 1) {
      status[j - 1] = ST_MISSING;
      j--;
      continue;
    }
    if (i > 0 && inBand(i - 1, j) && cur === D[at(i - 1, j)] + 1) {
      extraBefore[j] = Math.min(255, extraBefore[j] + 1);
      i--;
      continue;
    }
    // Bordes de la matriz
    if (j === 0) {
      extraBefore[0] = Math.min(255, extraBefore[0] + 1);
      i--;
    } else {
      status[j - 1] = ST_MISSING;
      j--;
    }
  }
  return { errors: n === 0 ? 0 : endCost, consumed: endJ, status, extraBefore };
}

export function computeScore(target: string, typed: string, durationMs: number, penalty: number): Score {
  const chars = typed.length;
  const { errors, consumed } = align(target, typed);
  const minutes = Math.max(durationMs, 1000) / 60000;
  const grossPpm = chars / minutes;
  const netPpm = Math.max(0, (chars - errors * penalty) / minutes);
  const accuracy = chars ? Math.max(0, ((chars - errors) / chars) * 100) : 0;
  return { chars, errors, grossPpm: r1(grossPpm), netPpm: r1(netPpm), accuracy: r1(accuracy), consumed };
}

export function computeGrade(netPpm: number, accuracy: number, b: Baremo): number {
  let g: number;
  if (netPpm <= 0) g = 0;
  else if (netPpm < b.min5) g = (5 * netPpm) / b.min5;
  else if (b.max10 <= b.min5) g = 10;
  else g = 5 + (5 * (netPpm - b.min5)) / (b.max10 - b.min5);
  g = Math.min(10, Math.max(0, g));
  if (accuracy < b.minAcc) g = Math.min(g, 4);
  return Math.round(g * 10) / 10;
}

// Resultado de un intento guardado, siempre con el baremo actual de la clase.
// Es la unica fuente de cifras para alumno, profesor, CSV y ranking: asi todos ven lo mismo.
export type Evaluated = { grossPpm: number; netPpm: number; accuracy: number; grade: number };

export function evaluate(a: { chars: number; errors: number; duration_ms: number }, b: Baremo): Evaluated {
  const chars = Number(a.chars);
  const errors = Number(a.errors);
  const minutes = Math.max(Number(a.duration_ms), 1000) / 60000;
  const grossPpm = r1(chars / minutes);
  const netPpm = r1(Math.max(0, (chars - errors * b.penalty) / minutes));
  const accuracy = r1(chars ? Math.max(0, ((chars - errors) / chars) * 100) : 0);
  return { grossPpm, netPpm, accuracy, grade: computeGrade(netPpm, accuracy, b) };
}

export function formatGrade(g: number): string {
  return g.toFixed(1).replace(".", ",");
}

// Comprobaciones antitrampas sobre el registro de escritura.
// Devuelve el motivo si el intento es sospechoso, o null si es valido.
export function checkEvents(events: InputEvent[], typedLength: number, durationMs: number): string | null {
  if (typedLength === 0) return null;
  if (!Array.isArray(events) || events.length === 0) return "sin registro de pulsaciones";
  if (events.length > 20000) return "registro anormal";
  let prevN = 0;
  let prevT = -1;
  for (const e of events) {
    if (typeof e?.t !== "number" || typeof e?.n !== "number") return "registro anormal";
    if (e.t < prevT) return "tiempos desordenados";
    if (e.n - prevN > 2) return "texto pegado o autocompletado";
    prevN = e.n;
    prevT = e.t;
  }
  if (prevN !== typedLength) return "registro incompleto";
  if (prevT > durationMs + 3000) return "duracion inconsistente";
  if (durationMs / typedLength < 30) return "velocidad imposible";
  return null;
}
