import "server-only";
import { db } from "./db";
import { startOfWeekMadrid } from "./utils";

export type RankRow = {
  studentId: string;
  alias: string;
  score: number; // netas/min que puntuan en el ranking
  accuracy: number;
  attempts: number;
};

// Solo cuentan intentos validos con texto suficiente, para que una leccion muy corta no dispare la marca.
const MIN_CHARS = 50;

type Raw = { student_id: string; net_ppm: number; accuracy: number };

export async function getRanking(classId: string, period: "semana" | "general"): Promise<RankRow[]> {
  const { data: students } = await db().from("students").select("id,alias").eq("class_id", classId);
  let q = db()
    .from("attempts")
    .select("student_id,net_ppm,accuracy")
    .eq("class_id", classId)
    .eq("flagged", false)
    .gte("chars", MIN_CHARS);
  if (period === "semana") q = q.gte("created_at", startOfWeekMadrid());
  const { data: attempts } = await q.limit(10000);

  const byStudent = new Map<string, Raw[]>();
  for (const a of (attempts ?? []) as Raw[]) {
    const list = byStudent.get(a.student_id) ?? [];
    list.push({ ...a, net_ppm: Number(a.net_ppm), accuracy: Number(a.accuracy) });
    byStudent.set(a.student_id, list);
  }

  const rows: RankRow[] = [];
  for (const s of students ?? []) {
    const list = byStudent.get(s.id);
    if (!list || list.length === 0) continue;
    list.sort((a, b) => b.net_ppm - a.net_ppm);
    // Semana: mejor marca. General: media de las 5 mejores marcas, para premiar la regularidad.
    const top = period === "semana" ? list.slice(0, 1) : list.slice(0, 5);
    const score = top.reduce((sum, a) => sum + a.net_ppm, 0) / top.length;
    const accuracy = top.reduce((sum, a) => sum + a.accuracy, 0) / top.length;
    rows.push({
      studentId: s.id,
      alias: s.alias,
      score: Math.round(score * 10) / 10,
      accuracy: Math.round(accuracy * 10) / 10,
      attempts: list.length,
    });
  }
  rows.sort((a, b) => b.score - a.score);
  return rows;
}
