import type { Lane } from "@/lib/races";

export function RaceLanes({ lanes, final = false, emptyText }: { lanes: Lane[]; final?: boolean; emptyText?: string }) {
  if (lanes.length === 0) {
    return <div className="card p-6 text-[15px] text-muted">{emptyText ?? "Todavía no se ha unido nadie."}</div>;
  }
  return (
    <div className="card flex flex-col gap-4 px-5 py-5 sm:px-7">
      {lanes.map((l, i) => (
        <div key={l.studentId} className="flex items-center gap-3 sm:gap-4">
          <span className="w-7 text-right font-display text-lg font-bold text-soft">{i + 1}</span>
          <span className={`w-28 truncate text-[15px] sm:w-36 ${l.me ? "font-bold text-accent-ink" : "font-semibold"}`}>
            {l.alias}
            {l.me ? " (tú)" : ""}
          </span>
          <div className="h-3.5 min-w-0 flex-1 overflow-hidden rounded-full bg-[#F2F4F7]">
            <div
              className={`h-3.5 rounded-full transition-[width] duration-700 ease-out ${l.me ? "bg-accent" : "bg-accent-mid"}`}
              style={{ width: `${final ? 100 : l.pct}%` }}
            />
          </div>
          <span className="w-24 text-right font-mono text-[15px] text-body">
            {final && !l.finished ? "sin entregar" : `${l.net} netas`}
          </span>
          {!final && l.finished && (
            <span className="hidden rounded-full bg-accent-soft px-2 py-0.5 text-xs font-semibold text-accent sm:inline">Meta</span>
          )}
        </div>
      ))}
    </div>
  );
}
