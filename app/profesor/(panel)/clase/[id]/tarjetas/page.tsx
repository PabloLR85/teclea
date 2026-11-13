import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { db, type StudentRow } from "@/lib/db";
import { requireTeacherClass } from "@/lib/session";
import { PrintButton } from "./PrintButton";

export default async function TarjetasPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { klass } = await requireTeacherClass(id);
  const { data } = await db().from("students").select("*").eq("class_id", id).order("full_name");
  const students = (data ?? []) as StudentRow[];
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";

  return (
    <>
      <div className="no-print flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link href={`/profesor/clase/${id}?tab=alumnos`} className="text-[13px] font-semibold text-accent">{klass.name}</Link>
          <h1 className="h1 m-0">Tarjetas de acceso</h1>
        </div>
        <PrintButton />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-3">
        {students.map((s) => (
          <div key={s.id} className="card flex break-inside-avoid flex-col gap-3 p-6 print:rounded-lg print:border-dashed">
            <div className="flex items-center justify-between">
              <span className="font-display text-lg font-bold">Teclea</span>
              <span className="text-[13px] text-muted">{host}</span>
            </div>
            <span className="text-[15px] font-semibold">{s.full_name}</span>
            <dl className="m-0 grid grid-cols-3 gap-2">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted">Código de clase</dt>
                <dd className="m-0 font-mono text-base font-bold">{klass.code}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted">Usuario</dt>
                <dd className="m-0 font-mono text-base font-bold">{s.username}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted">PIN</dt>
                <dd className="m-0 font-mono text-base font-bold">{s.pin}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </>
  );
}
