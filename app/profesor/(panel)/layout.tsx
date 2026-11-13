import { Logo } from "@/components/Logo";
import { requireTeacher } from "@/lib/session";
import { logoutTeacher } from "@/app/actions/profesor";

export const dynamic = "force-dynamic";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const teacher = await requireTeacher();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-5 py-3 sm:px-8">
        <div className="flex items-center gap-3">
          <Logo href="/profesor" dark />
          <span className="rounded-full bg-[#F2F4F7] px-2.5 py-1 text-xs font-semibold text-body">Profesor</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted">
          <span>{teacher.name}</span>
          <form action={logoutTeacher}>
            <button type="submit" className="btn btn-secondary h-10 px-3 text-[13px]">Salir</button>
          </form>
        </div>
      </header>
      <main className="mx-auto box-border flex w-full max-w-[1200px] flex-1 flex-col gap-6 px-5 pb-10 pt-7 sm:px-6">{children}</main>
    </div>
  );
}
