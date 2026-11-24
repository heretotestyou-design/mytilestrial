export type WallPoint = { x: number; y: number };
export type WallCorners = readonly [WallPoint, WallPoint, WallPoint, WallPoint];

export const wallPresets = {
  Left: [{ x: 0.04, y: 0.09 }, { x: 0.34, y: 0.24 }, { x: 0.34, y: 0.67 }, { x: 0.04, y: 0.85 }],
  Back: [{ x: 0.29, y: 0.23 }, { x: 0.71, y: 0.23 }, { x: 0.71, y: 0.68 }, { x: 0.29, y: 0.68 }],
  Right: [{ x: 0.66, y: 0.24 }, { x: 0.96, y: 0.09 }, { x: 0.96, y: 0.85 }, { x: 0.66, y: 0.67 }],
} as const satisfies Record<string, WallCorners>;

export function wallAt(x: number): WallCorners {
  return wallPresets[x < 1 / 3 ? "Left" : x > 2 / 3 ? "Right" : "Back"];
}

export function moveWallCorner(corners: WallCorners, index: number, x: number, y: number): WallCorners {
  const next: [WallPoint, WallPoint, WallPoint, WallPoint] = [...corners];
  next[index] = { x: Math.min(1, Math.max(0, x)), y: Math.min(1, Math.max(0, y)) };
  // Keep the four points clockwise and convex when a handle approaches the opposite side.
  const valid = next.every((a, i) => {
    const b = next[(i + 1) % 4];
    const c = next[(i + 2) % 4];
    return (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x) > 0.0002;
  });
  return valid ? next : corners;
}
