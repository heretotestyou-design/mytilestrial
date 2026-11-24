// Tile layout geometry. Each layout returns the tiles inside one repeating
// cell, in tile units. The SVG <pattern> repeats that cell seamlessly.

export type PatternId = "grid" | "brick" | "herringbone" | "checker";

export type TileRect = { x: number; y: number; w: number; h: number; alt?: boolean; seed: number };

export type Layout = { label: string; cell: { w: number; h: number }; tiles: TileRect[] };

function herringbone(): TileRect[] {
  // Staircases of (horizontal 2×1, vertical 1×2) tiles along (1,1),
  // repeated along (3,-1). Both (4,0) and (0,4) lie on that lattice,
  // so a 4×4 cell tiles the plane.
  const out: TileRect[] = [];
  let seed = 0;
  for (let j = -4; j <= 4; j++) {
    const ox = 3 * j;
    const oy = -j;
    for (let k = -8; k <= 8; k++) {
      const candidates = [
        { x: k + ox, y: k + oy, w: 2, h: 1 },
        { x: k + ox, y: k + 1 + oy, w: 1, h: 2, alt: true },
      ];
      for (const t of candidates) {
        if (t.x < 4 && t.x + t.w > 0 && t.y < 4 && t.y + t.h > 0) out.push({ ...t, seed: seed++ });
      }
    }
  }
  return out;
}

export const LAYOUTS: Record<PatternId, Layout> = {
  grid: {
    label: "Grid",
    cell: { w: 1, h: 1 },
    tiles: [{ x: 0, y: 0, w: 1, h: 1, seed: 1 }],
  },
  brick: {
    label: "Brick",
    cell: { w: 2, h: 1 },
    tiles: [
      { x: 0, y: 0, w: 2, h: 0.5, seed: 1 },
      { x: -1, y: 0.5, w: 2, h: 0.5, seed: 2 },
      { x: 1, y: 0.5, w: 2, h: 0.5, seed: 3 },
    ],
  },
  herringbone: {
    label: "Herringbone",
    cell: { w: 4, h: 4 },
    tiles: herringbone(),
  },
  checker: {
    label: "Checker",
    cell: { w: 2, h: 2 },
    tiles: [
      { x: 0, y: 0, w: 1, h: 1, seed: 1 },
      { x: 1, y: 0, w: 1, h: 1, alt: true, seed: 2 },
      { x: 0, y: 1, w: 1, h: 1, alt: true, seed: 3 },
      { x: 1, y: 1, w: 1, h: 1, seed: 4 },
    ],
  },
};

export type Finish = { id: string; label: string; base: string; light: string; alt: string };

export const FINISHES: Finish[] = [
  { id: "carrara", label: "Carrara", base: "#E9E5DE", light: "#F8F6F2", alt: "#C9C2B7" },
  { id: "travertine", label: "Travertine", base: "#D9C6A8", light: "#EADBC3", alt: "#B79D7A" },
  { id: "nero", label: "Nero", base: "#2A2724", light: "#45403A", alt: "#B5A58E" },
  { id: "sage", label: "Sage", base: "#A3AE9B", light: "#C1CAB9", alt: "#E4E0D6" },
  { id: "terracotta", label: "Terracotta", base: "#B8714F", light: "#CF8D6B", alt: "#8E5038" },
];

export const GROUTS = [
  { id: "ivory", label: "Ivory", color: "#F2EEE6" },
  { id: "silver", label: "Silver", color: "#A9A6A0" },
  { id: "sand", label: "Sand", color: "#C8B48F" },
  { id: "charcoal", label: "Charcoal", color: "#2E2B28" },
];

/** Deterministic 0..1 noise so tiles vary subtly but render identically on server and client. */
export function rand(seed: number) {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}
