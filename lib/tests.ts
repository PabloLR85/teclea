import "server-only";
import { db } from "./db";

// Una prueba con alumnos que la han empezado o entregado tiene el texto y la duracion bloqueados:
// cambiarlos haria que unos alumnos se evaluaran con un texto y otros con otro.
export async function testHasActivity(testId: string): Promise<boolean> {
  const [{ count: a }, { count: s }] = await Promise.all([
    db().from("attempts").select("id", { count: "exact", head: true }).eq("test_id", testId),
    db().from("test_sessions").select("test_id", { count: "exact", head: true }).eq("test_id", testId),
  ]);
  return (a ?? 0) + (s ?? 0) > 0;
}
