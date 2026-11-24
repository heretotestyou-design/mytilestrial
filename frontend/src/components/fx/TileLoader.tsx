"use client";

// Skeleton loader shaped like a tiled floor: tiles get "laid" front-to-back in a
// repeating wave on a floor seen in perspective, with a light sheen passing over.
// Pure CSS keyframes on transform/opacity, so it stays smooth even on slow devices.
import { motion } from "framer-motion";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/format";

type Props = {
  /** "lg" = full render panel with status text; "sm" = thumbnail/skeleton. */
  variant?: "lg" | "sm";
  /** Seconds since the render started (drives the status text + estimate). */
  elapsed?: number;
  /** Overrides the status line, e.g. while uploading. */
  status?: string;
  className?: string;
};

const STAGES: [number, string][] = [
  [0, "Reading your photos"],
  [6, "Laying your tiles"],
  [20, "Matching light & shadows"],
  [45, "Adding final details"],
];

export function TileLoader({ variant = "lg", elapsed = 0, status, className }: Props) {
  const cols = variant === "lg" ? 9 : 6;
  const rows = variant === "lg" ? 7 : 5;
  const mid = (cols - 1) / 2;
  const stage = status ?? [...STAGES].reverse().find(([t]) => elapsed >= t)![1];
  // Honest-looking estimate: approaches 95 % over ~90 s, never claims done.
  const pct = Math.min(95, Math.round((1 - Math.exp(-elapsed / 32)) * 100));
  const stageIndex = STAGES.findIndex(([, s]) => s === stage);

  return (
    <div
      role="status"
      aria-label={stage}
      className={cn("relative h-full w-full overflow-hidden bg-[linear-gradient(180deg,#FBF9F5_0%,#F1EADF_48%,#E9E0D2_100%)]", className)}
    >
      {/* Back wall + soft horizon light */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-[46%] bg-[radial-gradient(70%_120%_at_50%_100%,rgba(210,180,140,0.35),transparent_70%)]" />

      {/* Floor in perspective */}
      <div aria-hidden className="absolute inset-0 [perspective:620px] [perspective-origin:50%_8%]">
        <div
          className="absolute bottom-[-30%] left-1/2 grid w-[165%] gap-[3px] rounded-sm bg-[#CDBFA9]/70 p-[3px] [transform-style:preserve-3d]"
          style={{
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
            transform: "translateX(-50%) rotateX(64deg)",
            transformOrigin: "50% 100%",
          }}
        >
          {Array.from({ length: rows * cols }).map((_, i) => {
            const r = Math.floor(i / cols);
            const c = i % cols;
            const fromFront = rows - 1 - r; // lay the nearest row first
            const delay = fromFront * 0.16 + Math.abs(c - mid) * 0.07;
            const alt = (r + c) % 2 === 0;
            return (
              <span
                key={i}
                className={cn(
                  "tile-lay aspect-square rounded-[2px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.55),0_1px_0_rgba(18,16,14,0.08)]",
                  alt ? "bg-[linear-gradient(135deg,#FFFFFF,#EFE6D8)]" : "bg-[linear-gradient(135deg,#F4ECDF,#E3D4BE)]",
                )}
                style={{ animationDelay: `${delay}s` }}
              />
            );
          })}
        </div>
      </div>

      {/* Sheen sweeping across */}
      <div aria-hidden className="tile-sheen absolute inset-y-0 w-1/3 bg-[linear-gradient(100deg,transparent,rgba(255,255,255,0.55),transparent)]" />
      {/* Fade the far edge into the wall */}
      <div aria-hidden className="absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(180deg,#FBF9F5_35%,transparent)]" />

      {variant === "lg" && (
        <div className="absolute inset-x-0 top-0 flex flex-col items-center px-6 pt-[9%] text-center">
          <motion.span
            className="grid h-11 w-11 place-items-center rounded-2xl bg-white shadow-soft"
            animate={{ rotate: [0, 8, -8, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Icon name="sparkle" className="h-5 w-5 text-bronze-dark" />
          </motion.span>
          <motion.p key={stage} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-3 text-[15px] font-semibold text-ink">
            {stage}…
          </motion.p>
          {!status && (
            <>
              <div className="mt-3 flex items-center gap-1.5" aria-hidden>
                {STAGES.map(([, s], i) => (
                  <span
                    key={s}
                    className={cn("h-1.5 rounded-full transition-all duration-500", i < stageIndex ? "w-4 bg-bronze" : i === stageIndex ? "w-8 bg-bronze" : "w-4 bg-ink/10")}
                  />
                ))}
              </div>
              <p className="mt-2 text-[12px] tabular-nums text-stone-600">
                {elapsed}s · about {pct}% · usually 30–90 seconds
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
