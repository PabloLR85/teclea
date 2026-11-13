import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { ActionForm } from "@/components/ActionForm";
import { db } from "@/lib/db";
import { getTeacher } from "@/lib/session";
import { loginTeacher, setupTeacher } from "@/app/actions/profesor";

export const dynamic = "force-dynamic";

export default async function AccesoProfesor() {
  if (await getTeacher()) redirect("/profesor");
  const { count } = await db().from("teachers").select("id", { count: "exact", head: true });
  const firstRun = (count ?? 0) === 0;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-5 py-12">
      <Logo size="lg" dark />
      <div className="card flex w-full max-w-[440px] flex-col gap-6 p-9">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 font-display text-[26px] font-bold">{firstRun ? "Crea la cuenta de profesor" : "Acceso profesor"}</h1>
          <p className="m-0 text-[15px] leading-normal text-muted">
            {firstRun
              ? "Primera puesta en marcha. Necesitas el código de alta configurado en Vercel."
              : "Gestiona clases, alumnos, pruebas y notas."}
          </p>
        </div>
        {firstRun ? (
          <ActionForm action={setupTeacher} submitLabel="Crear cuenta" pendingLabel="Creando...">
            <div className="flex flex-col gap-2">
              <label htmlFor="setup" className="label">Código de alta</label>
              <input id="setup" name="setup" type="password" required className="field" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="name" className="label">Nombre</label>
              <input id="name" name="name" required autoComplete="name" className="field" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="label">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" className="field" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="label">Contraseña</label>
              <input id="password" name="password" type="password" required minLength={10} autoComplete="new-password" className="field" />
              <span className="text-[13px] text-soft">Mínimo 10 caracteres.</span>
            </div>
          </ActionForm>
        ) : (
          <ActionForm action={loginTeacher} submitLabel="Entrar" pendingLabel="Entrando...">
            <div className="flex flex-col gap-2">
              <label htmlFor="email" className="label">Email</label>
              <input id="email" name="email" type="email" required autoComplete="email" className="field" />
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor="password" className="label">Contraseña</label>
              <input id="password" name="password" type="password" required autoComplete="current-password" className="field" />
            </div>
          </ActionForm>
        )}
      </div>
      <Link href="/" className="p-3 text-sm font-medium text-accent hover:text-accent-dark">
        Acceso alumnos
      </Link>
    </main>
  );
}
