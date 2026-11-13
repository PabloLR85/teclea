import { randomInt } from "crypto";

export function slugifyName(fullName: string): string {
  const parts = fullName
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "alumno";
  return parts.length > 1 ? `${parts[0]}.${parts[1]}` : parts[0];
}

export function defaultAlias(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Alumno";
  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1).toLowerCase();
  return parts.length > 1 ? `${first} ${parts[1].charAt(0).toUpperCase()}.` : first;
}

export function newPin(): string {
  return String(randomInt(0, 10000)).padStart(4, "0");
}

export function newClassCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += chars[randomInt(0, chars.length)];
  return `GD-${s}`;
}

export function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: "Europe/Madrid",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("es-ES", { maximumFractionDigits: 1 }).format(n);
}

// Lunes 00:00 de la semana actual en hora de Madrid, devuelto en ISO (UTC).
export function startOfWeekMadrid(now = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(now).map((p) => [p.type, p.value]));
  const dayIdx = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(parts.weekday);
  const madridMidnight = new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00Z`);
  madridMidnight.setUTCDate(madridMidnight.getUTCDate() - dayIdx);
  // Ajuste del desfase de Madrid respecto a UTC en ese momento
  const offsetMin = madridOffsetMinutes(madridMidnight);
  return new Date(madridMidnight.getTime() - offsetMin * 60000).toISOString();
}

function madridOffsetMinutes(d: Date): number {
  const tz = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Madrid", timeZoneName: "shortOffset" })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = tz?.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!m) return 60;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (parseInt(m[2], 10) * 60 + (m[3] ? parseInt(m[3], 10) : 0));
}

// Convierte "2026-11-20T10:00" (hora de Madrid, de un input datetime-local) a ISO UTC.
export function madridLocalToIso(local: string): string {
  const naive = new Date(`${local}:00Z`);
  const offset = madridOffsetMinutes(naive);
  return new Date(naive.getTime() - offset * 60000).toISOString();
}

export function isoToMadridLocal(iso: string): string {
  const d = new Date(iso);
  const offset = madridOffsetMinutes(d);
  return new Date(d.getTime() + offset * 60000).toISOString().slice(0, 16);
}
