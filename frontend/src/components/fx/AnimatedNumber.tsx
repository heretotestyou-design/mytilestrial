"use client";

// Number that rolls from its previous value to the new one (React Bits "CountUp" style),
// so a balance change after a purchase animates 5 → 115 instead of restarting at 0.
import { animate, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  /** Shared memory key. Every AnimatedNumber with the same id continues from the last
   *  value any of them showed, so remounting (collapsing the sidebar, revisiting a page)
   *  doesn't re-count from 0. Only the very first appearance counts up. */
  id?: string;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
};

const defaultFormat = (n: number) => new Intl.NumberFormat("en-IN").format(n);
const lastShown = new Map<string, number>();

/** Test helper. */
export const resetAnimatedNumbers = () => lastShown.clear();

export function AnimatedNumber({ value, id, format = defaultFormat, duration = 1.1, className }: Readonly<Props>) {
  const reduce = useReducedMotion();
  const start = id === undefined ? 0 : (lastShown.get(id) ?? 0);
  const from = useRef(start);
  const [shown, setShown] = useState(reduce ? value : start);

  useEffect(() => {
    if (id !== undefined) lastShown.set(id, value);
    if (reduce || from.current === value) {
      setShown(value);
      from.current = value;
      return;
    }
    const controls = animate(from.current, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(v),
    });
    from.current = value;
    return () => controls.stop();
  }, [value, id, duration, reduce]);

  return (
    <span className={className} aria-label={format(value)}>
      <span aria-hidden>{format(Math.round(shown))}</span>
    </span>
  );
}
