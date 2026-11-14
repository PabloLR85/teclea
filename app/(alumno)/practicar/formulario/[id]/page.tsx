import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStudent } from "@/lib/session";
import { findForm, PRACTICE_RECORDS } from "@/lib/forms";
import { FormPracticeRunner } from "./FormPracticeRunner";

export default async function FormularioPracticaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const t = findForm(id);
  if (!t) notFound();
  await requireStudent();
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="kicker">Formularios · {PRACTICE_RECORDS} registros</span>
          <h1 className="h1 m-0">{t.title}</h1>
          <p className="m-0 text-[15px] text-muted">{t.description}</p>
        </div>
        <Link href="/practicar" className="btn btn-secondary">Todas las lecciones</Link>
      </div>
      <FormPracticeRunner formId={t.id} />
    </>
  );
}
