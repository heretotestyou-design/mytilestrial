import { cn } from "@/lib/format";

/** A shimmering placeholder block. Size it with className. */
export function Skeleton({ className, dark }: Readonly<{ className?: string; dark?: boolean }>) {
  return (
    <div
      aria-hidden
      className={cn(
        "relative overflow-hidden rounded-lg",
        dark ? "bg-white/[0.06]" : "bg-ink/[0.06]",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[skeleton_1.6s_ease-in-out_infinite] after:bg-[linear-gradient(90deg,transparent,rgba(255,255,255,0.55),transparent)]",
        className,
      )}
    />
  );
}

/** List placeholder: avatar circle, two text lines and a trailing value. */
export function SkeletonRows({ rows = 3 }: Readonly<{ rows?: number }>) {
  return (
    <div className="divide-y divide-ink/[0.06]" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3.5 px-6 py-3.5">
          <Skeleton className="h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-4 w-10" />
        </div>
      ))}
    </div>
  );
}
