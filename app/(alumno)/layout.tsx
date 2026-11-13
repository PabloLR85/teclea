import { Logo } from "@/components/Logo";
import { NavLinks } from "@/components/NavLinks";
import { requireStudent } from "@/lib/session";
import { logoutStudent } from "@/app/actions/alumno";

export const dynamic = "force-dynamic";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { student, klass } = await requireStudent();
  const initials = student.alias
    .split(/\s+/)
    .map((w) => w.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-5 py-3 sm:px-8">
        <Logo href="/practicar" />
        <NavLinks
          links={[
            { href: "/practicar", label: "Practicar" },
            { href: "/pruebas", label: "Pruebas" },
            { href: "/ranking", label: "Ranking" },
          ]}
        />
        <div className="flex items-center gap-3 text-sm text-muted">
          <a href="/perfil" className="flex items-center gap-2.5 text-muted no-underline hover:text-ink">
            <span className="flex h-[34px] w-[34px] items-center justify-center rounded-full bg-[#FFF1E6] text-[13px] font-bold text-error-ink">
              {initials}
            </span>
            <span>
              <strong className="font-semibold text-ink">{student.alias}</strong> · {klass.code}
            </span>
          </a>
          <form action={logoutStudent}>
            <button type="submit" className="btn btn-secondary h-10 px-3 text-[13px]">
              Salir
            </button>
          </form>
        </div>
      </header>
      <main className="mx-auto box-border flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-5 pb-10 pt-7 sm:px-6">
        {children}
      </main>
    </div>
  );
}
