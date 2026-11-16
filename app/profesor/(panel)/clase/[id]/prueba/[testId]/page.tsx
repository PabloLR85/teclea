import Link from "next/link";
import { notFound } from "next/navigation";
import { db, type TestRow } from "@/lib/db";
import { requireTeacherClass } from "@/lib/session";
import { testHasActivity } from "@/lib/tests";
import { isoToMadridLocal } from "@/lib/utils";
import { ActionForm } from "@/components/ActionForm";
import { TestContentFields } from "@/components/TestContentFields";
import { deleteTest, updateTest } from "@/app/actions/profesor";

const UUID = /^[0-9a-f-]{36}$/i;

export default async function EditarPruebaPage({ params }: { params: Promise<{ id: string; testId: string }> }) {
  const { id, testId } = await params;
  if (!UUID.test(id) || !UUID.test(testId)) notFound();
  const { klass } = await requireTeacherClass(id);
  const { data } = await db().from("tests").select("*").eq("id", testId).eq("class_id", id).maybeSingle();
  if (!data) notFound();
  const test = data as TestRow;
  const locked = await testHasActivity(testId);

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={`/profesor/clase/${id}?tab=pruebas`} className="text-[13px] font-semibold text-accent">
          {klass.name} · Pruebas
        </Link>
        <h1 className="h1 m-0">Editar prueba</h1>
      </div>

      {locked && (
        <p className="m-0 rounded-xl bg-accent-soft px-5 py-4 text-[15px] leading-relaxed text-accent-ink">
          Ya hay alumnos que han empezado o entregado esta prueba, así que el texto y la duración están bloqueados: si cambiaran, unos se evaluarían con un texto y otros con otro. Puedes cambiar el título y la franja horaria. Si necesitas otro texto, crea una prueba nueva.
        </p>
      )}

      <section className="card p-7">
        <ActionForm action={updateTest.bind(null, id, testId)} submitLabel="Guardar cambios">
          <div className="flex flex-col gap-2">
            <label htmlFor="title" className="label">Título</label>
            <input id="title" name="title" required defaultValue={test.title} className="field" />
          </div>
          <TestContentFields defaultContent={test.content} locked={locked} />
          <div className="flex flex-col gap-2">
            <label htmlFor="duration" className="label">Duración (minutos)</label>
            <input
              id="duration"
              name="duration"
              type="number"
              min={0.5}
              max={30}
              step={0.5}
              defaultValue={test.duration_sec / 60}
              required
              disabled={locked}
              className="field disabled:bg-ground disabled:text-muted"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="opens" className="label">Se abre</label>
              <input id="opens" name="opens" type="datetime-local" defaultValue={isoToMadridLocal(test.opens_at)} required className="field text-sm" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="closes" className="label">Se cierra</label>
              <input id="closes" name="closes" type="datetime-local" defaultValue={isoToMadridLocal(test.closes_at)} required className="field text-sm" />
            </div>
          </div>
          <span className="text-[13px] text-soft">Hora peninsular.</span>
        </ActionForm>
      </section>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={`/profesor/clase/${id}?tab=pruebas`} className="btn btn-secondary">Volver a las pruebas</Link>
        <details className="relative">
          <summary className="btn btn-danger cursor-pointer list-none">Eliminar prueba</summary>
          <div className="absolute right-0 z-10 mt-2 flex w-64 flex-col gap-3 rounded-xl border border-line bg-white p-4 text-sm shadow-lg">
            <span>Se borrarán la prueba y todas sus entregas. No se puede deshacer.</span>
            <form action={deleteTest.bind(null, id, testId)}>
              <button type="submit" className="btn h-9 bg-error px-3 text-[13px] text-white">Sí, eliminar</button>
            </form>
          </div>
        </details>
      </div>
    </div>
  );
}
