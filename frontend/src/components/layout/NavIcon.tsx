"use client";

// Animated sidebar icons. Each one plays a small motion when its link is hovered
// (the parent sets the "hover" variant) and once when it becomes the current page.
import { motion, useReducedMotion, type Transition, type Variants } from "framer-motion";

export type NavIconName = "overview" | "floor-planner" | "renders" | "billing" | "settings";

const spring: Transition = { type: "spring", stiffness: 380, damping: 16 };
const draw: Transition = { duration: 0.45, ease: [0.22, 1, 0.36, 1] };

const REST = { x: 0, y: 0, rotate: 0, scale: 1 } as const;
type Pose = Partial<Record<keyof typeof REST, number>>;

/** Variants for one animated part: rest; hover holds the pose; becoming the current page
 *  plays it once and settles back (or holds it, for poses that look like rest, e.g. a cog turn). */
const pose = (to: Pose, transition: Transition = spring, holdWhenActive = false): Variants => ({
  rest: { ...REST, transition },
  hover: { ...to, transition },
  active: holdWhenActive
    ? { ...to, transition }
    : {
        ...Object.fromEntries(Object.entries(to).map(([k, val]) => [k, [REST[k as keyof typeof REST], val, REST[k as keyof typeof REST]]])),
        transition: { duration: 0.6, ease: "easeInOut" },
      },
});

const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export function NavIcon({ name, className }: Readonly<{ name: NavIconName; className?: string }>) {
  const reduce = useReducedMotion();
  // With reduced motion, parts ignore the parent's hover/active variants.
  const v = (variants: Variants) => (reduce ? undefined : variants);

  switch (name) {
    case "overview":
      return (
        <motion.svg {...svgProps} className={className}>
          <motion.path d="M3.5 11.5 12 4l8.5 7.5" variants={v(pose({ y: -1.6 }))} />
          <path d="M5.5 10v10h13V10" />
          <motion.path d="M10 20v-5h4v5" variants={v({ rest: { pathLength: 1, opacity: 1 }, hover: { pathLength: [0, 1], transition: draw }, active: { pathLength: [0, 1], transition: draw } })} />
        </motion.svg>
      );
    case "floor-planner":
      return (
        <motion.svg {...svgProps} className={className}>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <motion.path d="M12 4v16M4 12h16" variants={v({ rest: { pathLength: 1 }, hover: { pathLength: [0, 1], transition: draw }, active: { pathLength: [0, 1], transition: draw } })} />
        </motion.svg>
      );
    case "renders":
      return (
        <motion.svg {...svgProps} className={className}>
          <rect x="3.5" y="5" width="17" height="14" rx="2" />
          <motion.circle cx="15.5" cy="9.5" r="1.4" variants={v(pose({ y: -1.4, scale: 1.25 }))} style={{ originX: "15.5px", originY: "9.5px" }} />
          <motion.path d="m3.5 16 4.5-4.5 4 4 2.5-2.5 6 5.5" variants={v({ rest: { pathLength: 1 }, hover: { pathLength: [0, 1], transition: draw }, active: { pathLength: [0, 1], transition: draw } })} />
        </motion.svg>
      );
    case "billing":
      return (
        <motion.svg {...svgProps} className={className}>
          <motion.circle cx="12" cy="7" r="2.2" variants={v({ rest: { y: 3, opacity: 0, transition: spring }, hover: { y: -1.5, opacity: 1, transition: spring }, active: { y: [3, -1.5, 0], opacity: [0, 1, 0], transition: { duration: 0.8 } } })} initial={reduce ? false : { y: 3, opacity: 0 }} />
          <path d="M4 9h15a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9Z" />
          <motion.path d="M4 9V8a2 2 0 0 1 2-2h4" variants={v(pose({ rotate: -12 }))} style={{ originX: "4px", originY: "9px" }} />
          <path d="M16 14h.01" strokeWidth={2.2} />
        </motion.svg>
      );
    case "settings":
      return (
        <motion.svg {...svgProps} className={className} variants={v(pose({ rotate: 60 }, { type: "spring", stiffness: 160, damping: 14 }, true))}>
          <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2Z" />
          <circle cx="12" cy="12" r="3" />
        </motion.svg>
      );
  }
}
