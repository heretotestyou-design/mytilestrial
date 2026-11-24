// Ambient backdrop for the dashboard: soft colour fields over a faint tile grid.
// Deliberately static and filter-free: radial gradients are already soft, and a
// still background keeps scrolling smooth (no full-screen blur repainting per frame).
import { cn } from "@/lib/format";

export function Aurora({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 bg-ivory-100",
        "bg-[radial-gradient(60vw_55vh_at_10%_-5%,rgba(210,180,140,0.45),transparent_70%),radial-gradient(50vw_50vh_at_100%_15%,rgba(142,156,136,0.28),transparent_70%),radial-gradient(55vw_55vh_at_45%_110%,rgba(232,196,170,0.38),transparent_70%)]",
        className,
      )}
    >
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,14,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(18,16,14,0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,#000_30%,transparent_80%)]" />
    </div>
  );
}
