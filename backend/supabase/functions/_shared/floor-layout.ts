export type FloorLayout = {
  floorWidthFeet: number;
  floorLengthFeet: number;
  tileLongSideInches: number;
  tileShortSideInches: number;
  direction: "horizontal" | "vertical";
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
  return Number.isSafeInteger(total) && total > 0 ? { columns, rows, across, down } : null;
}

export function floorLayoutPrompt(layout: FloorLayout) {
  const grid = floorGrid(layout);
  if (!grid) throw new Error("Invalid floor layout.");

  const { floorWidthFeet, floorLengthFeet, tileLongSideInches, tileShortSideInches, direction } = layout;
  const longEdge = direction === "horizontal" ? "side to side across the floor width" : "front to back along the floor length";
  return [
    "Apply the customer's measured layout to the floor only.",
    `The measured floor spans ${floorWidthFeet} feet side to side and ${floorLengthFeet} feet front to back.`,
    `Each full tile is ${tileLongSideInches} inches on the long side and ${tileShortSideInches} inches on the short side.`,
    `Lay the tiles ${direction}ly, with the long edge running ${longEdge}. Each full tile spans ${grid.across} inches across the floor width and ${grid.down} inches along its length.`,
    `Use one continuous straight grid. Across the full measured floor, use ${grid.columns} tile positions across and ${grid.rows} tile positions from front to back, including any cut pieces at the perimeter.`,
    "Use the tile photo for color, pattern, and finish. The measured tile proportions, scale, and direction above override the reference photo's tile size, orientation, and grout layout.",
    "Align the grout with the room's floor-plane perspective. Show only the portion of the measured grid visible from the existing camera angle, with natural occlusion by furnishings and walls. Preserve the room and its objects. Keep measurements, labels, and diagrams out of the image.",
  ].join(" ");
}
