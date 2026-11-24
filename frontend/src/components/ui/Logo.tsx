import Link from "next/link";
import { cn } from "@/lib/format";

/** Brand mark + wordmark. `compact` shows the mark only (collapsed sidebar). */
export function Logo({ className, tone = "dark", compact, href = "/" }: { className?: string; tone?: "dark" | "light"; compact?: boolean; href?: string }) {
  const text = tone === "light" ? "text-ivory" : "text-ink";
  return (
    <Link href={href} className={cn("group inline-flex items-center gap-2.5", className)} aria-label="MyTilesTrial home">
      <span className="grid h-8 w-8 grid-cols-2 gap-[2px] rounded-lg bg-bronze/20 p-[5px] transition group-hover:rotate-45">
        <span className="rounded-[2px] bg-bronze" />
        <span className="rounded-[2px] bg-bronze-light" />
        <span className="rounded-[2px] bg-bronze-light" />
        <span className="rounded-[2px] bg-bronze" />
      </span>
      <span className={cn("whitespace-nowrap font-display text-[22px] leading-none tracking-tight", text, compact && "sr-only")}>
        MyTiles<span className="italic text-bronze">Trial</span>
      </span>
    </Link>
  );
}
