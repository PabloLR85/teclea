import Link from "next/link";
import { db } from "@/lib/db";
import { requireTeacher } from "@/lib/session";
import { ActionForm } from "@/components/ActionForm";
import { createClass } from "@/app/actions/profesor";

export default async function ProfesorHome() {
  const teacher = await requireTeacher();
  const { data: classes } = await db()
    .from("classes")
    .select("id,name,code,created_at,students(count)")
    .eq("teacher_id", teacher.id)
    .order("created_at", { ascending: false });

  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="kicker">Panel del profesor</span>
        <h1 className="h1 m-0">Tus clases</h1>
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-3">
          {(classes ?? []).length === 0 && <div className="card p-8 text-muted">Crea tu primera clase para dar de alta a los alumnos.</div>}
          {(classes ?? []).map((c) => {
            const count = (c.students as unknown as { count: number }[])?.[0]?.count ?? 0;
            return (
              <Link
                key={c.id}
                href={`/profesor/clase/${c.id}`}
                className="card flex flex-wrap items-center justify-between gap-4 px-6 py-5 text-ink no-underline hover:border-accent-line"
              >
                <span className="flex flex-col gap-1">
                  <span className="text-base font-semibold">{c.name}</span>
                  <span className="text-sm text-muted">
                    {count} {count === 1 ? "alumno" : "alumnos"}
                  </span>
                </span>
                <span className="rounded-[10px] border border-line-strong px-3.5 py-2 font-mono text-[15px] font-semibold">{c.code}</span>
              </Link>
            );
          })}
        </section>
        <aside className="card flex flex-[1_1_300px] flex-col gap-4 p-6">
          <h2 className="h2 m-0">Nueva clase</h2>
          <ActionForm action={createClass} submitLabel="Crear clase" pendingLabel="Creando...">
            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="label">Nombre</label>
              <input id="name" name="name" required placeholder="Grabación de datos · Noviembre 2026" className="field" />
            </div>
            <span className="text-[13px] text-soft">El código de clase se genera solo.</span>
          </ActionForm>
        </aside>
      </div>
    </>
  );
}
