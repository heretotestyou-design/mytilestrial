"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/format";
import { springSnappy } from "@/lib/motion";

type Option<T extends string> = { value: T; label: React.ReactNode; hint?: React.ReactNode };

type Props<T extends string> = {
  /** Unique per page: drives the sliding highlight animation. */
  id: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
};

/** Pill-style tabs with a highlight that slides to the selected option. */
export function SegmentedControl<T extends string>({ id, value, options, onChange, disabled, size = "sm", className }: Readonly<Props<T>>) {
  return (
    <div role="tablist" className={cn("flex gap-1 rounded-full bg-ink/[0.05] p-1", size === "md" && "grid rounded-xl", className)} style={size === "md" ? { gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` } : undefined}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative font-medium transition-colors disabled:opacity-60",
              size === "sm" ? "rounded-full px-3.5 py-1 text-[13px]" : "rounded-lg px-2 py-2 text-center",
              active ? "text-ink" : "text-stone-600 hover:text-ink",
            )}
          >
            {active && <motion.span layoutId={`seg-${id}`} className={cn("absolute inset-0 bg-white shadow-soft", size === "sm" ? "rounded-full" : "rounded-lg")} transition={springSnappy} />}
            <span className={cn("relative block", size === "md" && "text-[13px] font-semibold")}>{o.label}</span>
            {o.hint && <span className="relative block text-[11.5px] font-normal tabular-nums">{o.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}
