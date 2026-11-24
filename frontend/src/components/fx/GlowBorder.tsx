// A 1px border with light travelling around it (React Bits "StarBorder" style).
// Wrap a card's content; the card's own background sits on top of the moving gradient.
import { cn } from "@/lib/format";

export function GlowBorder({ children, className, innerClassName }: { children: React.ReactNode; className?: string; innerClassName?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-[18px] p-px", className)}>
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 aspect-square w-[200%] -translate-x-1/2 -translate-y-1/2 animate-spin-slow bg-[conic-gradient(from_0deg,transparent_0deg,rgba(210,180,140,0.95)_60deg,transparent_120deg,transparent_180deg,rgba(176,138,91,0.8)_240deg,transparent_300deg)]"
      />
      <div className={cn("relative h-full rounded-[17px]", innerClassName)}>{children}</div>
    </div>
  );
}
