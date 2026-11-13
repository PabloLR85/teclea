import Link from "next/link";
import { db, type TestRow } from "@/lib/db";
import { requireStudent } from "@/lib/session";
import { evaluate, formatGrade, normalizeBaremo } from "@/lib/scoring";
import { formatDateTime } from "@/lib/utils";

export default async function PruebasPage() {
  const { student, klass } = await requireStudent();
  const [{ data: tests }, { data: attempts }] = await Promise.all([
    db().from("tests").select("*").eq("class_id", klass.id).order("opens_at", { ascending: false }),
    db().from("attempts").select("test_id,chars,errors,duration_ms,flagged").eq("student_id", student.id).eq("mode", "prueba"),
  ]);
  const baremo = normalizeBaremo(klass.baremo);
  const byTest = new Map((attempts ?? []).map((a) => [a.test_id as string, a]));
  const now = Date.now();

  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="kicker">Evaluación</span>
        <h1 className="h1 m-0">Pruebas</h1>
      </div>
      {(tests ?? []).length === 0 && (
        <div className="card p-8 text-muted">Tu profesor todavía no ha programado ninguna prueba.</div>
      )}
      <div className="flex flex-col gap-3">
        {((tests ?? []) as TestRow[]).map((t) => {
          const a = byTest.get(t.id);
          const open = now >= Date.parse(t.opens_at) && now <= Date.parse(t.closes_at);
          const upcoming = now < Date.parse(t.opens_at);
          let status: string;
          if (a) {
            const e = evaluate(a, baremo);
            status = a.flagged ? "Entregada (en revisión)" : `Entregada · nota ${formatGrade(e.grade)} · ${Math.round(e.netPpm)} netas/min`;
          }
          else if (open) status = `Abierta hasta el ${formatDateTime(t.closes_at)}`;
          else if (upcoming) status = `Se abre el ${formatDateTime(t.opens_at)}`;
          else status = "Cerrada sin entregar";
          return (
            <div key={t.id} className="card flex flex-wrap items-center justify-between gap-4 px-6 py-5">
              <div className="flex flex-col gap-1">
                <span className="text-base font-semibold">{t.title}</span>
                <span className="text-sm text-muted">
                  {Math.round(t.duration_sec / 60) >= 1 ? `${Math.round(t.duration_sec / 60)} min` : `${t.duration_sec} s`} · un solo intento
                </span>
                <span className={`text-[13px] font-semibold ${open && !a ? "text-accent" : "text-soft"}`}>{status}</span>
              </div>
              {open && !a && (
                <Link href={`/pruebas/${t.id}`} className="btn btn-primary">
                  Hacer la prueba
                </Link>
              )}
              {a && (
                <Link href={`/pruebas/${t.id}`} className="btn btn-secondary">
                  Ver resultado
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
