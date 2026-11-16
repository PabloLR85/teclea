"use client";

import { useEffect, useState } from "react";

const KEY = "teclea:sinBloqueNumerico";

// Teclado numerico obligatorio. En practica, el alumno puede desactivarlo si su teclado no tiene bloque numerico.
export function useNumpadSetting(required: boolean, allowToggle: boolean) {
  const [off, setOff] = useState(false);
  useEffect(() => {
    if (!allowToggle) return;
    try {
      setOff(localStorage.getItem(KEY) === "1");
    } catch {
      // sin almacenamiento: se queda activado
    }
  }, [allowToggle]);
  function toggle(v: boolean) {
    setOff(v);
    try {
      localStorage.setItem(KEY, v ? "1" : "0");
    } catch {
      // ignorar
    }
  }
  return { required, allowToggle, off, toggle, active: required && !(allowToggle && off) };
}
