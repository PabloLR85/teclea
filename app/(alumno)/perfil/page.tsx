import { requireStudent } from "@/lib/session";
import { AliasForm } from "./AliasForm";

export default async function PerfilPage() {
  const { student, klass } = await requireStudent();
  return (
    <div className="mx-auto flex w-full max-w-[520px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <span className="kicker">Grupo {klass.code}</span>
        <h1 className="h1 m-0">Tu perfil</h1>
      </div>
      <div className="card flex flex-col gap-5 p-8">
        <div className="flex flex-col gap-1 text-[15px]">
          <span className="text-muted">Usuario</span>
          <strong className="font-mono">{student.username}</strong>
        </div>
        <AliasForm current={student.alias} />
      </div>
    </div>
  );
}
