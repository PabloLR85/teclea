import Link from "next/link";
import { notFound } from "next/navigation";
import { db, type AttemptRow, type StudentRow, type TestRow } from "@/lib/db";
import { requireTeacherClass } from "@/lib/session";
import { evaluate, normalizeBaremo } from "@/lib/scoring";
import { findLesson } from "@/lib/lessons";
import { findForm } from "@/lib/forms";
import { formatDateTime } from "@/lib/utils";
import { AttemptReview } from "@/components/AttemptReview";
import { allowRetake, validateAttempt } from "@/app/actions/profesor";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function IntentoPage({ params }: { params: Promise<{ id: string; attemptId: string }> }) {
  const { id, attemptId } = await params;
  if (!UUID.test(id) || !UUID.test(attemptId)) notFound();
  const { klass } = await requireTeacherClass(id);
  const { data } = await db().from("attempts").select("*").eq("id", attemptId).eq("class_id", id).maybeSingle();
  if (!data) notFound();
  const attempt = data as AttemptRow;

  const { data: st } = await db().from("students").select("*").eq("id", attempt.student_id).maybeSingle();
  const student = st as StudentRow | null;

  let title = "Práctica";
  let target = "";
  let backHref = `/profesor/clase/${id}?tab=alumnos`;
  if (attempt.test_id) {
    const { data: t } = await db().from("tests").select("*").eq("id", attempt.test_id).maybeSingle();
    const test = t as TestRow | null;
    title = test?.title ?? "Prueba";
    target = test?.content ?? "";
    backHref = `/profesor/clase/${id}?tab=resultados&prueba=${attempt.test_id}`;
  } else if (attempt.race_id) {
    const { data: r } = await db().from("races").select("title,content").eq("id", attempt.race_id).maybeSingle();
    title = r ? `Carrera: ${r.title}` : "Carrera";
    target = r?.content ?? "";
    backHref = `/profesor/clase/${id}/carrera/${attempt.race_id}`;
  } else if (attempt.lesson_id) {
    const found = findLesson(attempt.lesson_id);
    const f = attempt.lesson_id.startsWith("form:") ? findForm(attempt.lesson_id.slice(5)) : null;
    title = found ? `Lección ${found.lesson.id}: ${found.lesson.title}` : f ? `Formulario: ${f.title}` : "Práctica";
    target = found?.lesson.text ?? "";
  }

  const baremo = normalizeBaremo(klass.baremo);
  const result = evaluate(attempt, baremo);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link href={backHref} className="text-[13px] font-semibold text-accent">Volver a resultados</Link>
          <h1 className="h1 m-0">{student?.full_name ?? "Alumno eliminado"}</h1>
          <span className="text-sm text-muted">
            {title} · entregada el {formatDateTime(attempt.created_at)}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {attempt.flagged && (
            <form action={validateAttempt.bind(null, id, attempt.id)}>
              <button type="submit" className="btn btn-primary">Validar intento</button>
            </form>
          )}
          {attempt.test_id && student && (
            <form action={allowRetake.bind(null, id, attempt.test_id, student.id)}>
              <button type="submit" className="btn btn-secondary">Permitir repetir</button>
            </form>
          )}
        </div>
      </div>
      <AttemptReview
        target={target}
        typed={attempt.typed}
        chars={attempt.chars}
        errors={attempt.errors}
        durationMs={attempt.duration_ms}
        result={result}
        showGrade={attempt.mode === "prueba"}
        flagged={attempt.flagged ? attempt.flag_reason ?? "pendiente de revisar" : null}
      />
      <p className="m-0 text-[13px] text-soft">
        Es la misma ficha que ve el alumno. Cifras calculadas con el baremo actual: 5 desde {baremo.min5} netas/min, 10 desde {baremo.max10}, precisión mínima {baremo.minAcc} % y {baremo.penalty} de penalización por error.
      </p>
    </>
  );
}
