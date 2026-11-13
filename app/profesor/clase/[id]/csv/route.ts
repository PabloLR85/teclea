import { NextResponse } from "next/server";
import { db, type AttemptRow, type StudentRow, type TestRow } from "@/lib/db";
import { getTeacher } from "@/lib/session";
import { computeGrade, normalizeBaremo } from "@/lib/scoring";
import { getRanking } from "@/lib/ranking";
import { ALL_LESSONS } from "@/lib/lessons";

export const dynamic = "force-dynamic";

const num = (n: number | string) => String(n).replace(".", ",");

function toCsv(rows: (string | number)[][]): string {
  const esc = (v: string | number) => {
    const s = String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM y punto y coma para que Excel en espanol lo abra bien.
  return "﻿" + rows.map((r) => r.map(esc).join(";")).join("\r\n");
}

function fileName(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const teacher = await getTeacher();
  if (!teacher) return new NextResponse("No autorizado", { status: 401 });
  const { data: klass } = await db().from("classes").select("*").eq("id", id).eq("teacher_id", teacher.id).maybeSingle();
  if (!klass) return new NextResponse("No encontrado", { status: 404 });
  const baremo = normalizeBaremo(klass.baremo);
  const url = new URL(req.url);

  const { data: studentsData } = await db().from("students").select("*").eq("class_id", id).order("full_name");
  const students = (studentsData ?? []) as StudentRow[];

  let rows: (string | number)[][];
  let name: string;

  const testId = url.searchParams.get("prueba");
  if (testId) {
    const { data: t } = await db().from("tests").select("*").eq("id", testId).eq("class_id", id).maybeSingle();
    if (!t) return new NextResponse("Prueba no encontrada", { status: 404 });
    const test = t as TestRow;
    const { data: att } = await db().from("attempts").select("*").eq("test_id", testId).eq("mode", "prueba");
    const byStudent = new Map(((att ?? []) as AttemptRow[]).map((a) => [a.student_id, a]));
    rows = [["Alumno", "Usuario", "Pulsaciones", "Errores", "Brutas/min", "Netas/min", "Precisión %", "Nota", "Estado"]];
    for (const s of students) {
      const a = byStudent.get(s.id);
      if (!a) {
        rows.push([s.full_name, s.username, "", "", "", "", "", "", "Sin entregar"]);
        continue;
      }
      const grade = computeGrade(Number(a.net_ppm), Number(a.accuracy), baremo);
      rows.push([
        s.full_name,
        s.username,
        a.chars,
        a.errors,
        num(a.gross_ppm),
        num(a.net_ppm),
        num(a.accuracy),
        num(grade.toFixed(1)),
        a.flagged ? `En revisión: ${a.flag_reason ?? ""}` : "Entregada",
      ]);
    }
    rows.push([]);
    rows.push([`Baremo: 5 desde ${baremo.min5} netas/min; 10 desde ${baremo.max10}; precisión mínima ${baremo.minAcc} %; penalización ${baremo.penalty} por error`]);
    name = `${fileName(klass.name)}-${fileName(test.title)}.csv`;
  } else {
    const [weekly, general, { data: progress }] = await Promise.all([
      getRanking(id, "semana"),
      getRanking(id, "general"),
      students.length
        ? db().from("lesson_progress").select("student_id").eq("completed", true).in("student_id", students.map((s) => s.id))
        : Promise.resolve({ data: [] as { student_id: string }[] }),
    ]);
    const w = new Map(weekly.map((r) => [r.studentId, r]));
    const g = new Map(general.map((r) => [r.studentId, r]));
    const done = new Map<string, number>();
    for (const p of progress ?? []) done.set(p.student_id, (done.get(p.student_id) ?? 0) + 1);
    rows = [["Alumno", "Usuario", "Alias", "Lecciones superadas", "Mejor netas/min esta semana", "Media 5 mejores netas/min", "Ejercicios válidos"]];
    for (const s of students) {
      rows.push([
        s.full_name,
        s.username,
        s.alias,
        `${done.get(s.id) ?? 0}/${ALL_LESSONS.length}`,
        w.has(s.id) ? num(w.get(s.id)!.score) : "",
        g.has(s.id) ? num(g.get(s.id)!.score) : "",
        g.get(s.id)?.attempts ?? 0,
      ]);
    }
    name = `${fileName(klass.name)}-resumen.csv`;
  }

  return new NextResponse(toCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
