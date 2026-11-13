import Link from "next/link";
import { notFound } from "next/navigation";
import { db, type AttemptRow, type TestRow } from "@/lib/db";
import { requireStudent } from "@/lib/session";
import { evaluate, normalizeBaremo } from "@/lib/scoring";
import { formatDateTime } from "@/lib/utils";
import { AttemptReview } from "@/components/AttemptReview";
import { TestRunner } from "./TestRunner";

export default async function PruebaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { student, klass } = await requireStudent();
  const { data } = await db().from("tests").select("*").eq("id", id).eq("class_id", klass.id).maybeSingle();
  if (!data) notFound();
  const test = data as TestRow;
  const baremo = normalizeBaremo(klass.baremo);

  const { data: doneData } = await db()
    .from("attempts")
    .select("*")
    .eq("student_id", student.id)
    .eq("test_id", id)
    .eq("mode", "prueba")
    .maybeSingle();
  const done = doneData as AttemptRow | null;

  const minutes = test.duration_sec / 60;
  const header = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <span className="kicker">Prueba · {Number.isInteger(minutes) ? `${minutes} min` : `${test.duration_sec} s`}</span>
        <h1 className="h1 m-0">{test.title}</h1>
        {done && <span className="text-sm text-muted">Entregada el {formatDateTime(done.created_at)}</span>}
      </div>
      <Link href="/pruebas" className="btn btn-secondary">Volver</Link>
    </div>
  );

  if (done) {
    return (
      <>
        {header}
        <AttemptReview
          target={test.content}
          typed={done.typed}
          chars={done.chars}
          errors={done.errors}
          durationMs={done.duration_ms}
          result={evaluate(done, baremo)}
          showGrade
          flagged={done.flagged ? done.flag_reason ?? "pendiente de revisar" : null}
        />
      </>
    );
  }

  const { data: session } = await db()
    .from("test_sessions")
    .select("started_at")
    .eq("student_id", student.id)
    .eq("test_id", id)
    .maybeSingle();

  const now = Date.now();
  let blocked: string | null = null;
  if (now < Date.parse(test.opens_at)) blocked = `La prueba se abre el ${formatDateTime(test.opens_at)}.`;
  else if (now > Date.parse(test.closes_at)) blocked = "La prueba ya está cerrada y no la entregaste.";
  else if (session && now - Date.parse(session.started_at) > test.duration_sec * 1000 + 15000)
    blocked = "El tiempo de esta prueba se agotó sin entrega. Habla con tu profesor.";

  return (
    <>
      {header}
      {blocked ? (
        <div className="card p-8 text-[15px] text-muted">{blocked}</div>
      ) : (
        <TestRunner testId={test.id} text={test.content} durationSec={test.duration_sec} resumed={!!session} penalty={baremo.penalty} />
      )}
    </>
  );
}
