import Link from "next/link";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { StudentLoginForm } from "@/components/StudentLoginForm";
import { getStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (await getStudent()) redirect("/practicar");
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 px-5 py-12">
      <Logo size="lg" />
      <div className="card flex w-full max-w-[440px] flex-col gap-6 p-9">
        <div className="flex flex-col gap-1.5">
          <h1 className="m-0 font-display text-[26px] font-bold">Entra en tu clase</h1>
          <p className="m-0 text-[15px] leading-normal text-muted">
            Usa el código de clase, el usuario y el PIN de la tarjeta que te ha dado tu profesor.
          </p>
        </div>
        <StudentLoginForm />
      </div>
      <div className="flex flex-col items-center gap-3.5">
        <div className="flex gap-1.5 font-mono text-[15px] text-muted" aria-hidden="true">
          {["a", "s", "d", "f"].map((k) => (
            <span key={k} className={`rounded-lg border px-2.5 py-1.5 ${k === "f" ? "border-accent-line bg-accent-soft font-bold text-accent" : "border-line bg-white"}`}>
              {k}
            </span>
          ))}
          <span className="w-4" />
          {["j", "k", "l", "ñ"].map((k) => (
            <span key={k} className={`rounded-lg border px-2.5 py-1.5 ${k === "j" ? "border-accent-line bg-accent-soft font-bold text-accent" : "border-line bg-white"}`}>
              {k}
            </span>
          ))}
        </div>
        <Link href="/profesor/acceso" className="p-3 text-sm font-medium text-accent hover:text-accent-dark">
          Acceso profesor
        </Link>
      </div>
    </main>
  );
}
