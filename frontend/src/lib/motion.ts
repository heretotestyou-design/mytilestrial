// Shared motion presets so every page animates the same way.
export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** Staggered fade-up for page sections: <motion.div {...rise(i)} />. */
export const rise = (i = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5, delay: 0.05 * i, ease: EASE_OUT },
});

export const springSnappy = { type: "spring", stiffness: 420, damping: 34 } as const;
