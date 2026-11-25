export type FloorLayout = {
  floorWidthFeet: number;
  floorLengthFeet: number;
  tileLongSideInches: number;
  tileShortSideInches: number;
  direction: "horizontal" | "vertical";
};

export const FLOOR_TILE_FINISHES = [
  "warm-grey-concrete", "white-marble", "beige-travertine", "ivory-terrazzo", "charcoal-slate", "green-marble",
] as const;
export type FloorTileFinish = (typeof FLOOR_TILE_FINISHES)[number];
export const DEFAULT_FLOOR_TILE_FINISH: FloorTileFinish = "warm-grey-concrete";

const FLOOR_TILE_MATERIALS: Record<FloorTileFinish, string> = {
  "warm-grey-concrete": "matte warm-grey concrete-look porcelain with soft mottling",
  "white-marble": "white marble-look porcelain with fine cool-grey veins",
  "beige-travertine": "honed beige travertine with subtle horizontal bands",
  "ivory-terrazzo": "ivory terrazzo with fine multicolored stone chips",
  "charcoal-slate": "matte charcoal slate-look tile with a subtle cleft texture",
  "green-marble": "deep green marble-look porcelain with pale branching veins",
};

function tilePositions(floorFeet: number, tileInches: number) {
  const ratio = floorFeet * 12 / tileInches;
  const nearest = Math.round(ratio);
  if (nearest > 0 && Math.abs(ratio - nearest) <= 4 * Number.EPSILON * ratio) return nearest;
  return Math.ceil(ratio);
}

export function floorGrid(layout: FloorLayout) {
  const { floorWidthFeet, floorLengthFeet, tileLongSideInches, tileShortSideInches, direction } = layout;
  const horizontal = direction === "horizontal";
  const across = horizontal ? tileLongSideInches : tileShortSideInches;
  const down = horizontal ? tileShortSideInches : tileLongSideInches;
  const columns = tilePositions(floorWidthFeet, across);
  const rows = tilePositions(floorLengthFeet, down);
  const total = columns * rows;
  return Number.isSafeInteger(total) && total > 0 ? { columns, rows, across, down, total } : null;
}

function measuredGridPrompt(layout: FloorLayout, grid = floorGrid(layout)) {
  if (!grid) throw new Error("Invalid floor layout.");

  const { floorWidthFeet, floorLengthFeet, tileLongSideInches, tileShortSideInches, direction } = layout;
  const longEdge = direction === "horizontal" ? "side to side across the floor width" : "front to back along the floor length";
  return [
    `The measured floor spans ${floorWidthFeet} feet side to side and ${floorLengthFeet} feet front to back.`,
    `Each full tile is ${tileLongSideInches} inches on the long side and ${tileShortSideInches} inches on the short side.`,
    `Lay the tiles ${direction}ly, with the long edge running ${longEdge}. Each full tile spans ${grid.across} inches across the floor width and ${grid.down} inches along its length.`,
    `Use one continuous straight grid. Across the full measured floor, use ${grid.columns} tile positions across and ${grid.rows} tile positions from front to back, including any cut pieces at the perimeter.`,
  ];
}

export function floorLayoutPrompt(layout: FloorLayout) {
  return [
    "Apply the customer's measured layout to the floor only.",
    ...measuredGridPrompt(layout),
    "Use the tile photo for color, pattern, and finish. The measured tile proportions, scale, and direction above override the reference photo's tile size, orientation, and grout layout.",
    "Align the grout with the room's floor-plane perspective. Show only the portion of the measured grid visible from the existing camera angle, with natural occlusion by furnishings and walls. Preserve the room and its objects. Keep measurements, labels, and diagrams out of the image.",
  ].join(" ");
}

export function floorPreviewPrompt(layout: FloorLayout, finish: FloorTileFinish = DEFAULT_FLOOR_TILE_FINISH) {
  const grid = floorGrid(layout);
  if (!grid) throw new Error("Invalid floor layout.");

  return [
    "Generate one photorealistic architectural visualization of a newly designed rectangular room from scratch.",
    "Show the entire tiled floor, including all four edges, from a high three-quarter view looking into an open-front cutaway. Show the back and side walls, with light plaster finishes. Keep the room empty and the floor unobstructed.",
    ...measuredGridPrompt(layout, grid),
    `Show ${grid.total} total floor tile positions.`,
    "Keep full tiles their specified proportions and make the last row or column narrower where a cut is required.",
    `Use ${FLOOR_TILE_MATERIALS[finish]} for every floor tile, with thin visible grout lines.`,
    "Use natural lighting and realistic perspective. No people, furniture, rugs, labels, overlaid measurements, or inset diagrams.",
  ].join(" ");
}
