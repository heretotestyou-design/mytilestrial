"use client";

// A spotlight walkthrough over the real UI: dims the page, cuts a window around the
// element of the current step, and shows "Step n of N" with a short message.
// Targets are found by [data-tour="<id>"], so the tour never reaches into components.
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { cn } from "@/lib/format";

export type TourStep = { target: string; title: string; body: string };

type Props = {
  steps: TourStep[];
  step: number;
  onStep: (n: number) => void;
  /** finished = reached the end, rather than skipped. */
  onClose: (finished: boolean) => void;
};

type Rect = { top: number; left: number; width: number; height: number };
const PAD = 8;

/** The visible element for a tour id (hidden screens are skipped). */
export function findTarget(id: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${id}"]`);
  return Array.from(all).find((el) => el.offsetParent !== null || el.getClientRects().length > 0) ?? null;
}

export function GuidedTour({ steps, step, onStep, onClose }: Readonly<Props>) {
  const current = steps[step];
  const [rect, setRect] = useState<Rect | null>(null);
  const [wide, setWide] = useState(true);
  const next = useRef<HTMLButtonElement>(null);
  const last = step === steps.length - 1;

  // Find the target (it may appear a moment later, e.g. after opening a template),
  // scroll it into view, then keep the spotlight on it while the page moves.
  useLayoutEffect(() => {
    if (!current) return;
    let el: HTMLElement | null = null;
    let frame = 0;
    let tries = 0;
    const measure = () => {
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
    };
    const locate = () => {
      el = findTarget(current.target);
      if (!el) {
        if (tries++ < 120) frame = requestAnimationFrame(locate);
        else setRect(null); // not on screen: show the card on its own
        return;
      }
      // Phones: the step card sits at the bottom, so bring the target to the top (below the
      // 56px header). Larger screens: centre it.
      const r = el.getBoundingClientRect();
      const narrow = !(window.matchMedia?.("(min-width: 640px)")?.matches ?? true);
      const offset = narrow ? 72 : Math.max(72, (window.innerHeight - r.height) / 2);
      window.scrollTo?.({ top: Math.max(0, r.top + window.scrollY - offset), behavior: "smooth" });
      measure();
      ro?.observe(el);
    };
    const ro = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    const onMove = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    setRect(null);
    locate();
    window.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      cancelAnimationFrame(frame);
      ro?.disconnect();
      window.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [current]);

  useEffect(() => {
    const mq = window.matchMedia?.("(min-width: 640px)");
    const update = () => setWide(mq?.matches ?? true);
    update();
    mq?.addEventListener?.("change", update);
    return () => mq?.removeEventListener?.("change", update);
  }, []);

  // Phones: room to scroll the last targets above the bottom step card.
  useEffect(() => {
    if (wide) return;
    const before = document.body.style.paddingBottom;
    document.body.style.paddingBottom = "280px";
    return () => {
      document.body.style.paddingBottom = before;
    };
  }, [wide]);

  useEffect(() => {
    next.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(false);
      if (e.key === "ArrowRight") (last ? onClose(true) : onStep(step + 1));
      if (e.key === "ArrowLeft" && step > 0) onStep(step - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step, last, onStep, onClose]);

  if (!current) return null;

  // Desktop: the card sits below the spotlight, or above it when there's no room.
  const CARD_W = 340;
  let cardStyle: React.CSSProperties | undefined;
  if (wide && rect && typeof window !== "undefined") {
    const below = rect.top + rect.height + 12;
    const fitsBelow = below + 220 < window.innerHeight;
    const left = Math.min(Math.max(16, rect.left), window.innerWidth - CARD_W - 16);
    cardStyle = fitsBelow ? { top: below, left, width: CARD_W } : { top: Math.max(16, rect.top - 12 - 220), left, width: CARD_W };
  }

  return (
    <div className="fixed inset-0 z-[110]" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-body">
      {/* Dim layer with a window around the target (blocks clicks on the page). */}
      {rect ? (
        <div
          aria-hidden
          className="pointer-events-none absolute rounded-[20px] ring-2 ring-bronze/80 transition-all duration-300 ease-out"
          style={{ ...rect, boxShadow: "0 0 0 9999px rgba(20, 17, 13, 0.58)" }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0 bg-[rgba(20,17,13,0.58)]" />
      )}
      {/* Catches clicks so the page underneath can't be used mid-tour. */}
      <div className="absolute inset-0" />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          style={cardStyle}
          className={cn(
            "absolute rounded-2xl bg-white p-5 shadow-lift ring-1 ring-ink/10",
            cardStyle ? "" : wide ? "left-1/2 top-1/2 w-[340px] -translate-x-1/2 -translate-y-1/2" : "inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))]",
          )}
        >
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-bronze/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-bronze-dark">
              Step {step + 1} of {steps.length}
            </span>
            <button type="button" onClick={() => onClose(false)} className="text-[12.5px] font-medium text-stone-500 hover:text-ink">
              Skip tour
            </button>
          </div>
          <h2 id="tour-title" className="mt-3 text-[17px] font-semibold tracking-tight text-ink">{current.title}</h2>
          <p id="tour-body" className="mt-1.5 text-[13.5px] leading-relaxed text-stone-600">{current.body}</p>

          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex gap-1.5" aria-hidden>
              {steps.map((_, i) => (
                <span key={i} className={cn("h-1.5 rounded-full transition-all", i === step ? "w-5 bg-bronze" : "w-1.5 bg-ink/15")} />
              ))}
            </div>
            <div className="flex gap-2">
              {step > 0 && (
                <Button variant="outline" size="sm" onClick={() => onStep(step - 1)}>
                  Back
                </Button>
              )}
              <Button ref={next} variant="bronze" size="sm" onClick={() => (last ? onClose(true) : onStep(step + 1))}>
                {last ? "Got it" : "Next"}
                {!last && <Icon name="chevronRight" className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
