// Numeros con formato espanol: coma decimal y como mucho un decimal (97,3; 100; 1.250).
export function n1(v: number | string): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(Number(v));
}

export function pct(v: number | string): string {
  return `${n1(v)} %`;
}

export function minutesLabel(ms: number): string {
  if (ms <= 0) return "0 min";
  if (ms < 60000) return "menos de 1 min";
  return `${Math.round(ms / 60000)} min`;
}
