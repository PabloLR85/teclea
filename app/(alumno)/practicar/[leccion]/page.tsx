import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStudent } from "@/lib/session";
import { ALL_LESSONS, findLesson, isUnlocked } from "@/lib/lessons";
import { PracticeRunner } from "./PracticeRunner";
import { normalizeBaremo } from "@/lib/scoring";

export default async function LeccionPage({ params }: { params: Promise<{ leccion: string }> }) {
  const { leccion } = await params;
  const found = findLesson(leccion);
  if (!found) notFound();
  const { student, klass } = await requireStudent();
  const { data: progress } = await db().from("lesson_progress").select("lesson_id,completed,best_net").eq("student_id", student.id);
  const completed = new Set((progress ?? []).filter((p) => p.completed).map((p) => p.lesson_id as string));

  if (!isUnlocked(leccion, completed)) {
    return (
      <div className="card flex flex-col items-start gap-4 p-8">
        <h1 className="h1 m-0">Lección bloqueada</h1>
        <p className="m-0 text-muted">Supera la lección anterior con al menos un 90 % de precisión para desbloquear esta.</p>
        <Link href="/practicar" className="btn btn-primary">Volver a las lecciones</Link>
      </div>
    );
  }

  const { lesson, level, index } = found;
  const next = ALL_LESSONS[index + 1];
  const best = (progress ?? []).find((p) => p.lesson_id === leccion)?.best_net;
  const levelPos = level.lessons.findIndex((l) => l.id === lesson.id);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="kicker">
            Nivel {level.id} · {level.title}
          </span>
          <h1 className="h1 m-0">
            Lección {levelPos + 1}: {lesson.title}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {best ? <span className="text-sm text-muted">Tu mejor marca: <strong className="text-ink">{Math.round(Number(best))} netas/min</strong></span> : null}
          <Link href="/practicar" className="btn btn-secondary">Todas las lecciones</Link>
        </div>
      </div>
      <PracticeRunner lessonId={lesson.id} text={lesson.text} nextHref={next ? `/practicar/${next.id}` : null} penalty={normalizeBaremo(klass.baremo).penalty} />
    </>
  );
}
