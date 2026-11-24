"use client";

// Letter-by-letter reveal on scroll (React Bits "SplitText" style).
import { motion, useReducedMotion } from "framer-motion";
import type { ElementType } from "react";

type Props = {
  text: string;
  as?: ElementType;
  className?: string;
  delay?: number;
  stagger?: number;
  /** Words to render in italic bronze, e.g. ["before"] */
  accentWords?: string[];
};

export function SplitText({ text, as: Tag = "span", className, delay = 0, stagger = 0.025, accentWords = [] }: Props) {
  const reduce = useReducedMotion();
  const words = text.split(" ");
  const clean = (w: string) => w.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();
  const accents = new Set(accentWords.map(clean));
  let index = 0;

  // The whole line triggers once. Per-letter viewport triggers left letters near the
  // screen edges (e.g. the first "S" on phones) stuck invisible.
  return (
    <Tag className={className} aria-label={text}>
      <motion.span
        initial={reduce ? false : "hidden"}
        whileInView="shown"
        viewport={{ once: true, amount: 0.1 }}
      >
      {words.map((word, wi) => {
        const accent = accents.has(clean(word));
        return (
          <span
            key={wi}
            aria-hidden
            className={`inline-block whitespace-nowrap ${accent ? "italic text-bronze-light" : ""}`}
          >
            {Array.from(word).map((ch) => {
              const i = index++;
              return (
                <motion.span
                  key={i}
                  className="inline-block will-change-transform"
                  variants={{
                    hidden: { opacity: 0, y: "0.45em", filter: "blur(8px)" },
                    shown: {
                      opacity: 1,
                      y: 0,
                      filter: "blur(0px)",
                      transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: delay + i * stagger },
                    },
                  }}
                >
                  {ch}
                </motion.span>
              );
            })}
            {wi < words.length - 1 && <span className="inline-block">&nbsp;</span>}
          </span>
        );
      })}
      </motion.span>
    </Tag>
  );
}
