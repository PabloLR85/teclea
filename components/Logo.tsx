import Link from "next/link";

export function Logo({ href = "/", dark = false, size = "sm" }: { href?: string; dark?: boolean; size?: "sm" | "lg" }) {
  const box = size === "lg" ? "h-11 w-11 rounded-xl text-lg" : "h-8 w-8 rounded-[9px] text-sm";
  const word = size === "lg" ? "text-3xl" : "text-xl";
  return (
    <Link href={href} className="flex min-h-11 items-center gap-2.5 text-ink no-underline">
      <span className={`flex items-center justify-center font-mono font-bold text-white ${box} ${dark ? "bg-ink" : "bg-accent"}`}>
        T_
      </span>
      <span className={`font-display font-bold tracking-tight ${word}`}>Teclea</span>
    </Link>
  );
}
