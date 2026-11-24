// Animated room diagram for a layout template: the tiles for that layout are "laid"
// one by one into a simple 3D room, so it's obvious which surfaces get tiled.
// Geometry adapted from trino-ai's TemplatePreview. Animation: .tile-lay in globals.css.
import type { CSSProperties, ReactNode } from "react";
import { WALL_SELECTION_TEMPLATE_ID } from "@/lib/catalog";

const TILE = "#E3C9A0";
const TILE_LINE = "#A9824F";
const PLAIN = "#ECE7E0";
const PLAIN_LINE = "#D9D2C7";
const WALL = "#F7F3EE";
const CEILING = "#FFFDFA";
const EDGE = "#B8B0A4";

/** One full lay-and-clear cycle; tiles are spread over the first ~55% of it. */
const CYCLE_S = 5.5;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
type Pt = [number, number];
const poly = (pts: Pt[]) => pts.map((p) => p.join(",")).join(" ");

// Floor point: u runs left to right, v runs front (0) to back (1).
const floorPt = (u: number, v: number): Pt => [lerp(lerp(0, 40, v), lerp(160, 120, v), u), lerp(120, 75, v)];
// Back wall point: u left to right, f top (0) to bottom (1).
const backPt = (u: number, f: number): Pt => [lerp(40, 120, u), lerp(25, 75, f)];
// Side wall point: s from the room edge (0) to the back wall (1); f top to bottom.
const sidePt = (side: "left" | "right", s: number, f: number): Pt => [
  side === "left" ? 40 * s : 160 - 40 * s,
  lerp(lerp(0, 25, s), lerp(120, 75, s), f),
];

type Cell = { pts: Pt[]; tiled: boolean };
type Grid = { at: (a: number, b: number) => Pt; a0: number; a1: number; b0: number; b1: number; na: number; nb: number; tiled: boolean };

/** Split an area into cells; `at` maps (a, b) fractions to SVG points. */
function cells({ at, a0, a1, b0, b1, na, nb, tiled }: Grid): Cell[] {
  const out: Cell[] = [];
  for (let j = 0; j < nb; j++) {
    for (let i = 0; i < na; i++) {
      const x0 = lerp(a0, a1, i / na);
      const x1 = lerp(a0, a1, (i + 1) / na);
      const y0 = lerp(b0, b1, j / nb);
      const y1 = lerp(b0, b1, (j + 1) / nb);
      out.push({ pts: [at(x0, y0), at(x1, y0), at(x1, y1), at(x0, y1)], tiled });
    }
  }
  return out;
}

const floor = (u0: number, u1: number, v0: number, v1: number, nu: number, nv: number, tiled = true): Cell[] =>
  cells({ at: floorPt, a0: u0, a1: u1, b0: v0, b1: v1, na: nu, nb: nv, tiled });
const back = (u0: number, u1: number, f0: number, f1: number): Cell[] =>
  cells({ at: backPt, a0: u0, a1: u1, b0: f0, b1: f1, na: Math.max(1, Math.round(8 * (u1 - u0))), nb: Math.max(1, Math.round(5 * (f1 - f0))), tiled: true });
const side = (s: "left" | "right", f0: number, f1: number): Cell[] =>
  cells({ at: (a, b) => sidePt(s, a, b), a0: 0, a1: 1, b0: f0, b1: f1, na: 4, nb: Math.max(1, Math.round(6 * (f1 - f0))), tiled: true });

const FULL = floor(0, 1, 0, 1, 8, 6);

/** Tiled cells for each template, in laying order (front to back, floor before walls). */
function layout(id: string): Cell[] {
  switch (id) {
    case "floor-full":
      return FULL;
    case "floor-corners":
      return [...floor(0, 0.24, 0, 0.3, 2, 2), ...floor(0.76, 1, 0, 0.3, 2, 2), ...floor(0, 0.24, 0.7, 1, 2, 2), ...floor(0.76, 1, 0.7, 1, 2, 2)];
    case "floor-center":
      return floor(0.25, 0.75, 0.2, 0.8, 4, 4);
    case "floor-border":
      // FULL is 8 columns × 6 rows: keep the outer ring around a plain centre.
      return FULL.filter((_, k) => {
        const i = k % 8;
        const j = Math.floor(k / 8);
        return i === 0 || i === 7 || j === 0 || j === 5;
      });
    case "floor-checker":
      return floor(0, 1, 0, 1, 6, 4).filter((_, k) => (Math.floor(k / 6) + (k % 6)) % 2 === 0);
    case "walls-all":
      return [...side("left", 0, 1), ...back(0, 1, 0, 1), ...side("right", 0, 1)];
    case WALL_SELECTION_TEMPLATE_ID:
    case "wall-back":
      return back(0, 1, 0, 1);
    case "wall-left":
      return side("left", 0, 1);
    case "wall-right":
      return side("right", 0, 1);
    case "wall-feature":
      return back(0.35, 0.65, 0, 1);
    case "wall-half":
      return [...side("left", 0.5, 1), ...back(0, 1, 0.5, 1), ...side("right", 0.5, 1)];
    case "mixed":
      return [...floor(0.25, 0.75, 0.2, 0.8, 4, 4), ...back(0, 1, 0, 1)];
    case "theme-transfer":
      return [...FULL, ...back(0.35, 0.65, 0, 1)];
    default:
      return [];
  }
}

export function TemplatePreview({ id, animate = true }: Readonly<{ id: string; animate?: boolean }>) {
  const tiled = layout(id);
  const step = Math.min(0.09, (CYCLE_S * 0.55) / Math.max(1, tiled.length));
  // Plain floor grid underneath, so un-tiled areas read as a normal floor.
  const plain = floor(0, 1, 0, 1, 8, 6, false);

  return (
    <svg viewBox="0 0 160 120" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" role="img" aria-label={`${id} layout preview`} className="block">
      <polygon points="0,0 160,0 120,25 40,25" fill={CEILING} />
      <polygon points={poly([sidePt("left", 0, 0), sidePt("left", 1, 0), sidePt("left", 1, 1), sidePt("left", 0, 1)])} fill={WALL} />
      <polygon points={poly([sidePt("right", 0, 0), sidePt("right", 1, 0), sidePt("right", 1, 1), sidePt("right", 0, 1)])} fill={WALL} />
      <rect x={40} y={25} width={80} height={50} fill={WALL} />
      <g fill={PLAIN} stroke={PLAIN_LINE} strokeWidth={0.5}>
        {plain.map((c, k) => (
          <polygon key={k} points={poly(c.pts)} />
        ))}
      </g>
      <g fill={TILE} stroke={TILE_LINE} strokeWidth={0.6} strokeLinejoin="round">
        {tiled.map((c, k): ReactNode => (
          <polygon
            key={k}
            points={poly(c.pts)}
            className={animate ? "tile-lay" : undefined}
            style={animate ? ({ animationDelay: `${(k * step).toFixed(3)}s`, "--cycle": `${CYCLE_S}s` } as CSSProperties) : undefined}
          />
        ))}
      </g>
      <g fill="none" stroke={EDGE} strokeWidth={0.5}>
        <line x1={0} y1={0} x2={40} y2={25} />
        <line x1={160} y1={0} x2={120} y2={25} />
        <line x1={0} y1={120} x2={40} y2={75} />
        <line x1={160} y1={120} x2={120} y2={75} />
        <rect x={40} y={25} width={80} height={50} />
      </g>
    </svg>
  );
}
