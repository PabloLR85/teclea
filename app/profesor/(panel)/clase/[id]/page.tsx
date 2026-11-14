import Link from "next/link";
import { notFound } from "next/navigation";
import { db, type AttemptRow, type StudentRow, type TestRow } from "@/lib/db";
import { requireTeacherClass } from "@/lib/session";
import { ActionForm } from "@/components/ActionForm";
import { ALL_LESSONS } from "@/lib/lessons";
import { computeGrade, evaluate, formatGrade, normalizeBaremo, type Baremo } from "@/lib/scoring";
import { getRanking } from "@/lib/ranking";
import { formatDateTime, isoToMadridLocal } from "@/lib/utils";
import {
  addStudents,
  allowRetake,
  closeTestNow,
  createTest,
  deleteStudent,
  deleteTest,
  resetPin,
  updateBaremo,
  validateAttempt,
} from "@/app/actions/profesor";
import { createRace } from "@/app/actions/carrera";
import { racePhase, type RaceRow } from "@/lib/races";
import { TextPicker } from "@/components/TextPicker";
import { TestContentFields } from "@/components/TestContentFields";
import { findForm } from "@/lib/forms";

type Tab = "alumnos" | "pruebas" | "resultados" | "carreras" | "baremo";
const TABS: { id: Tab; label: string }[] = [
  { id: "alumnos", label: "Alumnos" },
  { id: "pruebas", label: "Pruebas" },
  { id: "resultados", label: "Resultados" },
  { id: "carreras", label: "Carreras" },
  { id: "baremo", label: "Baremo" },
];

export default async function ClasePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; prueba?: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const sp = await searchParams;
  const tab: Tab = (TABS.find((t) => t.id === sp.tab)?.id ?? "alumnos") as Tab;
  const { klass } = await requireTeacherClass(id);
  const baremo = normalizeBaremo(klass.baremo);

  const { data: studentsData } = await db().from("students").select("*").eq("class_id", id).order("full_name");
  const students = (studentsData ?? []) as StudentRow[];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <Link href="/profesor" className="text-[13px] font-semibold text-accent">Tus clases</Link>
          <h1 className="h1 m-0">{klass.name}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted">
          Código de clase
          <span className="rounded-[10px] border border-line-strong bg-white px-3.5 py-2 font-mono text-base font-semibold text-ink">{klass.code}</span>
        </div>
      </div>

      <nav aria-label="Secciones de la clase" className="flex flex-wrap gap-1 self-start rounded-xl bg-[#EAECF0] p-1">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/profesor/clase/${id}?tab=${t.id}`}
            aria-current={tab === t.id ? "page" : undefined}
            className={
              tab === t.id
                ? "flex h-11 items-center rounded-[9px] bg-white px-[18px] text-sm font-semibold text-ink"
                : "flex h-11 items-center rounded-[9px] px-[18px] text-sm font-medium text-muted hover:text-ink"
            }
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {tab === "alumnos" && <AlumnosTab classId={id} students={students} />}
      {tab === "pruebas" && <PruebasTab classId={id} studentCount={students.length} />}
      {tab === "resultados" && <ResultadosTab classId={id} students={students} baremo={baremo} selected={sp.prueba} />}
      {tab === "carreras" && <CarrerasTab classId={id} />}
      {tab === "baremo" && <BaremoTab classId={id} baremo={baremo} />}
    </>
  );
}

// ---------------- Alumnos ----------------

async function AlumnosTab({ classId, students }: { classId: string; students: StudentRow[] }) {
  const ids = students.map((s) => s.id);
  const [{ data: progress }, weekly] = await Promise.all([
    ids.length ? db().from("lesson_progress").select("student_id").eq("completed", true).in("student_id", ids) : Promise.resolve({ data: [] as { student_id: string }[] }),
    getRanking(classId, "semana"),
  ]);
  const doneCount = new Map<string, number>();
  for (const p of progress ?? []) doneCount.set(p.student_id, (doneCount.get(p.student_id) ?? 0) + 1);
  const weekBest = new Map(weekly.map((r) => [r.studentId, r.score]));

  return (
    <div className="flex flex-wrap items-start gap-6">
      <section className="flex min-w-0 flex-[999_1_620px] flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="h2 m-0">{students.length} {students.length === 1 ? "alumno" : "alumnos"}</h2>
          <div className="flex flex-wrap gap-2">
            <a href={`/profesor/clase/${classId}/csv?tipo=resumen`} className="btn btn-secondary">Exportar resumen CSV</a>
            {students.length > 0 && <Link href={`/profesor/clase/${classId}/tarjetas`} className="btn btn-secondary">Imprimir tarjetas</Link>}
          </div>
        </div>
        {students.length === 0 ? (
          <div className="card p-8 text-muted">Da de alta a los alumnos con el formulario de la derecha.</div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[15px]">
              <thead>
                <tr>
                  <th className="th">Nombre</th>
                  <th className="th">Usuario</th>
                  <th className="th">PIN</th>
                  <th className="th">Alias</th>
                  <th className="th text-right">Lecciones</th>
                  <th className="th text-right">Mejor semana</th>
                  <th className="th">Última conexión</th>
                  <th className="th"><span className="sr-only">Acciones</span></th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className="td font-medium">{s.full_name}</td>
                    <td className="td font-mono text-sm">{s.username}</td>
                    <td className="td font-mono text-sm">
                      {s.pin}
                      {s.failed_logins >= 10 && <span className="ml-2 font-sans text-xs font-semibold text-error-ink">bloqueado</span>}
                    </td>
                    <td className="td">{s.alias}</td>
                    <td className="td text-right font-mono">{doneCount.get(s.id) ?? 0}/{ALL_LESSONS.length}</td>
                    <td className="td text-right font-mono">{weekBest.has(s.id) ? Math.round(weekBest.get(s.id)!) : "-"}</td>
                    <td className="td text-sm text-muted">{s.last_seen_at ? formatDateTime(s.last_seen_at) : "Nunca"}</td>
                    <td className="td">
                      <div className="flex items-center justify-end gap-1.5">
                        <form action={resetPin.bind(null, classId, s.id)}>
                          <button type="submit" className="btn btn-secondary h-9 px-3 text-[13px]">Nuevo PIN</button>
                        </form>
                        <details className="relative">
                          <summary className="btn btn-danger h-9 cursor-pointer list-none px-3 text-[13px]">Eliminar</summary>
                          <div className="absolute right-0 z-10 mt-2 flex w-64 flex-col gap-3 rounded-xl border border-line bg-white p-4 text-sm shadow-lg">
                            <span>Se borrarán {s.full_name} y todos sus resultados. No se puede deshacer.</span>
                            <form action={deleteStudent.bind(null, classId, s.id)}>
                              <button type="submit" className="btn h-9 bg-error px-3 text-[13px] text-white">Sí, eliminar</button>
                            </form>
                          </div>
                        </details>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <aside className="card flex flex-[1_1_300px] flex-col gap-4 p-6">
        <h2 className="h2 m-0">Dar de alta</h2>
        <ActionForm action={addStudents.bind(null, classId)} submitLabel="Dar de alta" pendingLabel="Creando accesos..." resetOnSuccess>
          <div className="flex flex-col gap-2">
            <label htmlFor="names" className="label">Nombres completos, uno por línea</label>
            <textarea id="names" name="names" rows={8} required placeholder={"Lucía Martínez Souto\nMarcos Rey Pazos"} className="w-full rounded-[10px] border border-line-strong bg-white px-3.5 py-3 text-[15px]" />
          </div>
          <span className="text-[13px] leading-relaxed text-soft">
            Se crea un usuario y un PIN para cada alumno. El nombre completo solo lo ves tú; en el ranking aparece su alias.
          </span>
        </ActionForm>
      </aside>
    </div>
  );
}

// ---------------- Pruebas ----------------

async function PruebasTab({ classId, studentCount }: { classId: string; studentCount: number }) {
  const { data } = await db().from("tests").select("*").eq("class_id", classId).order("opens_at", { ascending: false });
  const tests = (data ?? []) as TestRow[];
  const { data: att } = tests.length
    ? await db().from("attempts").select("test_id").eq("mode", "prueba").in("test_id", tests.map((t) => t.id))
    : { data: [] as { test_id: string }[] };
  const delivered = new Map<string, number>();
  for (const a of att ?? []) delivered.set(a.test_id, (delivered.get(a.test_id) ?? 0) + 1);
  const now = Date.now();
  const defaultOpen = isoToMadridLocal(new Date(Math.ceil(now / 900000) * 900000).toISOString());
  const defaultClose = isoToMadridLocal(new Date(Math.ceil(now / 900000) * 900000 + 2 * 3600000).toISOString());

  return (
    <div className="flex flex-wrap items-start gap-6">
      <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-3">
        {tests.length === 0 && <div className="card p-8 text-muted">Todavía no hay pruebas. Crea la primera con el formulario.</div>}
        {tests.map((t) => {
          const open = now >= Date.parse(t.opens_at) && now <= Date.parse(t.closes_at);
          const upcoming = now < Date.parse(t.opens_at);
          return (
            <div key={t.id} className="card flex flex-col gap-3 px-6 py-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <span className="text-base font-semibold">{t.title}</span>
                  <span className="text-sm text-muted">
                    {t.duration_sec % 60 === 0 ? `${t.duration_sec / 60} min` : `${t.duration_sec} s`} ·{" "}
                    {t.content.startsWith("form:") ? `Formulario: ${findForm(t.content.slice(5))?.title ?? ""}` : `${t.content.length} caracteres`} · de{" "}
                    {formatDateTime(t.opens_at)} a {formatDateTime(t.closes_at)}
                  </span>
                  <span className={`text-[13px] font-semibold ${open ? "text-accent" : "text-soft"}`}>
                    {open ? "Abierta" : upcoming ? "Programada" : "Cerrada"} · {delivered.get(t.id) ?? 0} de {studentCount} entregadas
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={`/profesor/clase/${classId}?tab=resultados&prueba=${t.id}`} className="btn btn-primary h-10">Ver resultados</Link>
                  {open && (
                    <form action={closeTestNow.bind(null, classId, t.id)}>
                      <button type="submit" className="btn btn-secondary h-10">Cerrar ahora</button>
                    </form>
                  )}
                  <details className="relative">
                    <summary className="btn btn-danger h-10 cursor-pointer list-none">Eliminar</summary>
                    <div className="absolute right-0 z-10 mt-2 flex w-64 flex-col gap-3 rounded-xl border border-line bg-white p-4 text-sm shadow-lg">
                      <span>Se borrarán la prueba y todas sus entregas. No se puede deshacer.</span>
                      <form action={deleteTest.bind(null, classId, t.id)}>
                        <button type="submit" className="btn h-9 bg-error px-3 text-[13px] text-white">Sí, eliminar</button>
                      </form>
                    </div>
                  </details>
                </div>
              </div>
              {!t.content.startsWith("form:") && <p className="m-0 line-clamp-2 font-mono text-sm text-muted">{t.content}</p>}
            </div>
          );
        })}
      </section>
      <aside className="card flex flex-[1_1_340px] flex-col gap-4 p-6">
        <h2 className="h2 m-0">Nueva prueba</h2>
        <ActionForm action={createTest.bind(null, classId)} submitLabel="Crear prueba" pendingLabel="Creando..." resetOnSuccess>
          <div className="flex flex-col gap-2">
            <label htmlFor="title" className="label">Título</label>
            <input id="title" name="title" required placeholder="Prueba 1 · Fila guía" className="field" />
          </div>
          <TestContentFields />
          <div className="flex flex-col gap-2">
            <label htmlFor="duration" className="label">Duración (minutos)</label>
            <input id="duration" name="duration" type="number" min={0.5} max={30} step={0.5} defaultValue={3} required className="field" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="opens" className="label">Se abre</label>
              <input id="opens" name="opens" type="datetime-local" defaultValue={defaultOpen} required className="field text-sm" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="closes" className="label">Se cierra</label>
              <input id="closes" name="closes" type="datetime-local" defaultValue={defaultClose} required className="field text-sm" />
            </div>
          </div>
          <span className="text-[13px] text-soft">Hora peninsular. Cada alumno tiene un solo intento dentro de esa franja.</span>
        </ActionForm>
      </aside>
    </div>
  );
}

// ---------------- Resultados ----------------

async function ResultadosTab({
  classId,
  students,
  baremo,
  selected,
}: {
  classId: string;
  students: StudentRow[];
  baremo: Baremo;
  selected?: string;
}) {
  const { data } = await db().from("tests").select("id,title,opens_at,duration_sec").eq("class_id", classId).order("opens_at", { ascending: false });
  const tests = (data ?? []) as Pick<TestRow, "id" | "title" | "opens_at" | "duration_sec">[];
  if (tests.length === 0) return <div className="card p-8 text-muted">Cuando crees una prueba, aquí verás las entregas y las notas.</div>;
  const test = tests.find((t) => t.id === selected) ?? tests[0];

  const [{ data: att }, { data: sessions }] = await Promise.all([
    db().from("attempts").select("*").eq("test_id", test.id).eq("mode", "prueba"),
    db().from("test_sessions").select("student_id").eq("test_id", test.id),
  ]);
  const byStudent = new Map(((att ?? []) as AttemptRow[]).map((a) => [a.student_id, a]));
  const started = new Set((sessions ?? []).map((s) => s.student_id as string));

  const graded = [...byStudent.values()].filter((a) => !a.flagged).map((a) => evaluate(a, baremo).grade);
  const avg = graded.length ? graded.reduce((x, y) => x + y, 0) / graded.length : null;
  const passed = graded.filter((g) => g >= 5).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="prueba-select" className="label">Prueba</label>
          <div id="prueba-select" className="flex flex-wrap gap-1.5">
            {tests.map((t) => (
              <Link
                key={t.id}
                href={`/profesor/clase/${classId}?tab=resultados&prueba=${t.id}`}
                aria-current={t.id === test.id ? "true" : undefined}
                className={
                  t.id === test.id
                    ? "rounded-[10px] border-2 border-accent bg-white px-3.5 py-2 text-sm font-semibold text-ink"
                    : "rounded-[10px] border border-line bg-white px-3.5 py-2 text-sm text-muted hover:text-ink"
                }
              >
                {t.title}
              </Link>
            ))}
          </div>
        </div>
        <a href={`/profesor/clase/${classId}/csv?prueba=${test.id}`} className="btn btn-secondary">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v12" />
            <path d="M7 10l5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
          Exportar CSV
        </a>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="card flex flex-col gap-1 p-[18px]">
          <span className="text-[13px] text-muted">Entregadas</span>
          <span className="font-display text-[28px] font-bold">{byStudent.size} / {students.length}</span>
        </div>
        <div className="card flex flex-col gap-1 p-[18px]">
          <span className="text-[13px] text-muted">Nota media</span>
          <span className="font-display text-[28px] font-bold">{avg === null ? "-" : formatGrade(avg)}</span>
        </div>
        <div className="card flex flex-col gap-1 p-[18px]">
          <span className="text-[13px] text-muted">Aprobados</span>
          <span className="font-display text-[28px] font-bold">{passed}</span>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-[15px]">
          <thead>
            <tr>
              <th className="th">Alumno</th>
              <th className="th text-right">Brutas/min</th>
              <th className="th text-right">Errores</th>
              <th className="th text-right">Precisión</th>
              <th className="th text-right">Netas/min</th>
              <th className="th text-right">Nota</th>
              <th className="th"><span className="sr-only">Acciones</span></th>
            </tr>
          </thead>
          <tbody>
            {students.map((s) => {
              const a = byStudent.get(s.id);
              const ev = a ? evaluate(a, baremo) : null;
              const grade = ev ? ev.grade : null;
              return (
                <tr key={s.id}>
                  <td className="td font-medium">
                    {s.full_name}
                    {a?.flagged && <span className="mt-0.5 block text-xs font-semibold text-error-ink">En revisión: {a.flag_reason}</span>}
                  </td>
                  <td className="td text-right font-mono">{ev ? Math.round(ev.grossPpm) : "-"}</td>
                  <td className="td text-right font-mono">{a ? a.errors : "-"}</td>
                  <td className="td text-right font-mono">{ev ? `${ev.accuracy} %` : "-"}</td>
                  <td className="td text-right font-mono font-semibold">{ev ? Math.round(ev.netPpm) : "-"}</td>
                  <td className="td text-right">
                    {a && grade !== null ? (
                      <span
                        className={`inline-block min-w-11 rounded-lg px-2.5 py-1 text-center font-bold ${
                          a.flagged ? "bg-[#F2F4F7] text-muted" : grade >= 5 ? "bg-accent-soft text-accent-dark" : "bg-error-soft text-error-ink"
                        }`}
                      >
                        {formatGrade(grade)}
                      </span>
                    ) : (
                      <span className="text-[13px] text-soft">{started.has(s.id) ? "Empezada sin entregar" : "Sin entregar"}</span>
                    )}
                  </td>
                  <td className="td">
                    <div className="flex justify-end gap-1.5">
                      {a && (
                        <Link href={`/profesor/clase/${classId}/intento/${a.id}`} className="btn btn-secondary h-9 px-3 text-[13px]">
                          Ver
                        </Link>
                      )}
                      {a?.flagged && (
                        <form action={validateAttempt.bind(null, classId, a.id)}>
                          <button type="submit" className="btn btn-secondary h-9 px-3 text-[13px]">Validar</button>
                        </form>
                      )}
                      {(a || started.has(s.id)) && (
                        <form action={allowRetake.bind(null, classId, test.id, s.id)}>
                          <button type="submit" className="btn btn-secondary h-9 px-3 text-[13px]">Permitir repetir</button>
                        </form>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="m-0 text-[13px] text-soft">
        Notas calculadas con el baremo actual: 5 desde {baremo.min5} netas/min, 10 desde {baremo.max10}, precisión mínima {baremo.minAcc} % y {baremo.penalty} pulsaciones de penalización por error. &laquo;Permitir repetir&raquo; borra la entrega de ese alumno.
      </p>
    </div>
  );
}

// ---------------- Baremo ----------------

function BaremoTab({ classId, baremo }: { classId: string; baremo: Baremo }) {
  const exChars = 450;
  const exErrors = 9;
  const exMin = 3;
  const exNet = Math.max(0, (exChars - exErrors * baremo.penalty) / exMin);
  const exAcc = ((exChars - exErrors) / exChars) * 100;
  const exGrade = computeGrade(exNet, exAcc, baremo);

  return (
    <div className="flex flex-wrap items-start gap-6">
      <section className="card flex flex-[1_1_380px] flex-col gap-4 p-6">
        <h2 className="h2 m-0">Baremo de la clase</h2>
        <ActionForm action={updateBaremo.bind(null, classId)} submitLabel="Guardar baremo">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="min5" className="label">Netas/min para el 5</label>
              <input id="min5" name="min5" type="number" min={1} step={1} defaultValue={baremo.min5} required className="field" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="max10" className="label">Netas/min para el 10</label>
              <input id="max10" name="max10" type="number" min={2} step={1} defaultValue={baremo.max10} required className="field" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="minAcc" className="label">Precisión mínima (%)</label>
              <input id="minAcc" name="minAcc" type="number" min={0} max={100} step={0.5} defaultValue={baremo.minAcc} required className="field" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="penalty" className="label">Penalización por error</label>
              <input id="penalty" name="penalty" type="number" min={0} step={1} defaultValue={baremo.penalty} required className="field" />
            </div>
          </div>
        </ActionForm>
      </section>
      <aside className="flex flex-[1_1_340px] flex-col gap-4">
        <div className="card flex flex-col gap-3 p-6 text-[15px] leading-relaxed text-body">
          <h2 className="h2 m-0">Cómo se calcula</h2>
          <p className="m-0 font-mono text-sm">netas/min = (pulsaciones − errores × penalización) / minutos</p>
          <p className="m-0">
            Hasta las netas del 5 la nota sube de forma proporcional de 0 a 5. Entre el 5 y el 10, también proporcional. Si la precisión queda por debajo del mínimo, la nota no pasa de 4.
          </p>
        </div>
        <div className="rounded-2xl bg-accent-soft p-6 text-[15px] leading-relaxed text-accent-ink">
          <strong>Ejemplo con el baremo actual.</strong> Prueba de {exMin} minutos, {exChars} pulsaciones y {exErrors} errores: {Math.round(exNet)} netas/min, {Math.round(exAcc)} % de precisión, nota{" "}
          <strong>{formatGrade(exGrade)}</strong>.
        </div>
      </aside>
    </div>
  );
}

// ---------------- Carreras ----------------

async function CarrerasTab({ classId }: { classId: string }) {
  const { data, error } = await db().from("races").select("*").eq("class_id", classId).order("created_at", { ascending: false }).limit(30);
  const races = (data ?? []) as RaceRow[];
  const { data: parts } = races.length
    ? await db().from("race_participants").select("race_id").in("race_id", races.map((r) => r.id))
    : { data: [] as { race_id: string }[] };
  const count = new Map<string, number>();
  for (const p of parts ?? []) count.set(p.race_id, (count.get(p.race_id) ?? 0) + 1);
  const phaseLabel = { waiting: "Sala de espera", countdown: "Cuenta atrás", running: "En marcha", finished: "Terminada" } as const;

  return (
    <div className="flex flex-wrap items-start gap-6">
      <section className="flex min-w-0 flex-[999_1_560px] flex-col gap-3">
        {error && (
          <div className="rounded-2xl bg-error-soft p-6 text-[15px] text-error-ink">
            Falta ejecutar la actualización de la base de datos para las carreras (archivo supabase/migracion-3.sql).
          </div>
        )}
        {!error && races.length === 0 && <div className="card p-8 text-muted">Todavía no hay carreras. Crea la primera con el formulario.</div>}
        {races.map((r) => {
          const ph = racePhase(r);
          return (
            <div key={r.id} className="card flex flex-wrap items-center justify-between gap-4 px-6 py-5">
              <div className="flex flex-col gap-1">
                <span className="text-base font-semibold">{r.title}</span>
                <span className="text-sm text-muted">
                  {Math.round(r.duration_sec / 60) || 1} min · {r.content.length} caracteres · {count.get(r.id) ?? 0} participantes
                </span>
                <span className={`text-[13px] font-semibold ${ph === "finished" ? "text-soft" : "text-accent"}`}>
                  {phaseLabel[ph]} · {formatDateTime(r.starts_at ?? r.created_at)}
                </span>
              </div>
              <Link href={`/profesor/clase/${classId}/carrera/${r.id}`} className={ph === "finished" ? "btn btn-secondary" : "btn btn-primary"}>
                {ph === "finished" ? "Ver resultados" : "Abrir sala"}
              </Link>
            </div>
          );
        })}
      </section>
      <aside className="card flex flex-[1_1_340px] flex-col gap-4 p-6">
        <h2 className="h2 m-0">Nueva carrera</h2>
        <ActionForm action={createRace.bind(null, classId)} submitLabel="Crear y abrir sala" pendingLabel="Creando...">
          <div className="flex flex-col gap-2">
            <label htmlFor="race-title" className="label">Título</label>
            <input id="race-title" name="title" placeholder="Carrera del viernes" className="field" />
          </div>
          <TextPicker idPrefix="race" defaultTextId="texto-grabacion" />
          <div className="flex flex-col gap-2">
            <label htmlFor="race-duration" className="label">Duración (minutos)</label>
            <input id="race-duration" name="duration" type="number" min={0.5} max={15} step={0.5} defaultValue={2} required className="field" />
          </div>
        </ActionForm>
      </aside>
    </div>
  );
}
