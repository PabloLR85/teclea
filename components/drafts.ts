"use client";

// Borradores de pruebas en el navegador: si se recarga la pagina o se cuelga, el alumno recupera lo escrito.
const PREFIX = "teclea:borrador:";

export function loadDraft<T>(sessionId: string): T | null {
  try {
    const raw = localStorage.getItem(PREFIX + sessionId);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function saveDraft(sessionId: string, data: unknown) {
  try {
    localStorage.setItem(PREFIX + sessionId, JSON.stringify(data));
  } catch {
    // almacenamiento lleno o bloqueado: se sigue sin borrador
  }
}

export function clearDraft(sessionId: string) {
  try {
    localStorage.removeItem(PREFIX + sessionId);
    // limpia borradores viejos de otros intentos
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k?.startsWith(PREFIX)) {
        const v = localStorage.getItem(k);
        if (v && Date.now() - (JSON.parse(v).savedAt ?? 0) > 3 * 24 * 3600 * 1000) localStorage.removeItem(k);
      }
    }
  } catch {
    // ignorar
  }
}
