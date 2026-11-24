"use client";

import { AnimatePresence, motion } from "framer-motion";

/** Slim top bar shown between a nav click and the new page arriving. */
export function NavProgress({ active }: Readonly<{ active: boolean }>) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-gradient-to-r from-bronze to-bronze-light"
          initial={{ scaleX: 0, opacity: 1 }}
          animate={{ scaleX: 0.85, transition: { duration: 1.6, ease: [0.1, 0.8, 0.2, 1] } }}
          exit={{ scaleX: 1, opacity: 0, transition: { duration: 0.25 } }}
        />
      )}
    </AnimatePresence>
  );
}
