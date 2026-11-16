import Link from "next/link";
import { notFound } from "next/navigation";
import { db, type AttemptRow, type StudentRow } from "@/lib/db";
import { requireTeacherClass } from "@/lib/session";
import { evaluate, formatGrade, normalizeBaremo } from "@/lib/scoring";
import { loadProgress } from "@/lib/progress";
import { findLesson } from "@/lib/lessons";
import { findForm } from "@/lib/forms";
import { formatDateTime } from "@/lib/utils";
import { ProgressView } from "@/components/ProgressView";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function AlumnoPage({ params }: { params: Promise<{ id: string; studentId: string }> }) {
  const { id, studentId } = await params;
  if (!UUID.test(id) || !UUID.test(studentId)) notFound();
  const { klass } = await requireTeacherClass(id);
  const { data: st } = await db().from("students").select("*").eq("id", studentId).eq("class_id", id).maybeSingle();
  if (!st) notFound();
  const student = st as StudentRow;
  const baremo = normalizeBaremo(klass.baremo);

  const [progress, { data: recentData }] = await Promise.all([
    loadProgress(student.id, baremo),
    db()
      .from("attempts")
      .select("id,mode,lesson_id,test_id,race_id,chars,errors,duration_ms,flagged,created_at")
      .eq("student_id", student.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const recent = (recentData ?? []) as AttemptRow[];

  const title = (a: AttemptRow) => {
    if (a.mode === "prueba") return "Prueba";
    if (a.mode === "carrera") return "Carrera";
    if (a.lesson_id?.startsWith("form:")) return `Formulario: ${findForm(a.lesson_id.slice(5))?.title ?? ""}`;
    const l = a.lesson_id ? findLesson(a.lesson_id) : null;
    return l ? `Lección ${l.lesson.id}: ${l.lesson.title}` : "Práctica";
  };

  return (
    <>
      <div className="flex flex-col gap-1">
        <Link href={`/profesor/clase/${id}?tab=alumnos`} className="text-[13px] font-semibold text-accent">{klass.name} · Alumnos</Link>
        <h1 className="h1 m-0">{student.full_name}</h1>
        <span className="text-sm text-muted">
          Alias {student.alias} · usuario {student.username} · última conexión {student.last_seen_at ? formatDateTime(student.last_seen_at) : "nunca"}
        </span>
      </div>

      <ProgressView progress={progress} />

      <section className="card overflow-x-auto">
        <h2 className="h2 m-0 px-5 pt-5">Últimos ejercicios</h2>
        {recent.length === 0 ? (
          <p className="m-0 p-5 text-muted">Todavía no ha hecho ningún ejercicio.</p>
        ) : (
          <table className="mt-3 w-full min-w-[640px] border-collapse text-[15px]">
            <thead>
              <tr>
                <th className="th">Ejercicio</th>
                <th className="th">Fecha</th>
                <th className="th text-right">Netas/min</th>
                <th className="th text-right">Precisión</th>
                <th className="th text-right">Nota</th>
                <th className="th"><span className="sr-only">Ver</span></th>
              </tr>
            </thead>
            <tbody>
              {recent.map((a) => {
                const e = evaluate(a, baremo);
                return (
                  <tr key={a.id}>
                    <td className="td">
                      {title(a)}
                      {a.flagged && <span className="ml-2 text-xs font-semibold text-error-ink">en revisión</span>}
                    </td>
                    <td className="td text-muted">{formatDateTime(a.created_at)}</td>
                    <td className="td text-right font-mono">{Math.round(e.netPpm)}</td>
                    <td className="td text-right font-mono">{e.accuracy} %</td>
                    <td className="td text-right font-mono">{a.mode === "prueba" ? formatGrade(e.grade) : "-"}</td>
                    <td className="td text-right">
                      <Link href={`/profesor/clase/${id}/intento/${a.id}`} className="font-semibold text-accent">Ver</Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
