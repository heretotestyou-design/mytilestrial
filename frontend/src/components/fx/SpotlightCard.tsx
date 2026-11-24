"use client";

// Card with a soft light that follows the cursor (React Bits "SpotlightCard" style).
import { useRef } from "react";
import { cn } from "@/lib/format";

type Props = {
  children: React.ReactNode;
  className?: string;
  color?: string;
};

export function SpotlightCard({ children, className, color = "rgba(176,138,91,0.16)" }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--x", `${e.clientX - r.left}px`);
    el.style.setProperty("--y", `${e.clientY - r.top}px`);
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      className={cn("group relative overflow-hidden", className)}
      style={{ ["--spot" as string]: color }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{ background: "radial-gradient(420px circle at var(--x) var(--y), var(--spot), transparent 60%)" }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}
