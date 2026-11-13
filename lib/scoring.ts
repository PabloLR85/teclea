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
};

const r1 = (x: number) => Math.round(x * 10) / 10;

export function computeScore(target: string, typed: string, durationMs: number, penalty: number): Score {
  const chars = typed.length;
  let errors = 0;
  for (let i = 0; i < chars; i++) {
    if (typed[i] !== target[i]) errors++;
  }
  const minutes = Math.max(durationMs, 1000) / 60000;
  const grossPpm = chars / minutes;
  const netPpm = Math.max(0, (chars - errors * penalty) / minutes);
  const accuracy = chars ? ((chars - errors) / chars) * 100 : 0;
  return { chars, errors, grossPpm: r1(grossPpm), netPpm: r1(netPpm), accuracy: r1(accuracy) };
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
