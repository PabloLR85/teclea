"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLinks({ links }: { links: { href: string; label: string }[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Principal" className="flex flex-wrap gap-1">
      {links.map((l) => {
        const active = path === l.href || path.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "rounded-[10px] bg-accent-soft px-4 py-3 text-[15px] font-semibold text-accent"
                : "rounded-[10px] px-4 py-3 text-[15px] font-medium text-muted hover:bg-ground hover:text-ink"
            }
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
