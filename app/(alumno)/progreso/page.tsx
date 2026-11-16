import { requireStudent } from "@/lib/session";
import { normalizeBaremo } from "@/lib/scoring";
import { loadProgress } from "@/lib/progress";
import { ProgressView } from "@/components/ProgressView";

export default async function ProgresoPage() {
  const { student, klass } = await requireStudent();
  const progress = await loadProgress(student.id, normalizeBaremo(klass.baremo));
  return (
    <>
      <div className="flex flex-col gap-1">
        <span className="kicker">{student.alias}</span>
        <h1 className="h1 m-0">Mi progreso</h1>
      </div>
      <ProgressView progress={progress} />
    </>
  );
}
