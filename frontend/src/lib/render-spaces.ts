export const RENDER_SPACES = [
  { id: "living-room", name: "Living room", examples: ["floor/rooms/01", "walls/rooms/01"] },
  { id: "kitchen", name: "Kitchen", examples: ["floor-and-walls/rooms/03", "walls/rooms/04", "floor-and-walls/rooms/04"] },
  { id: "bedroom", name: "Bedroom", examples: ["floor/rooms/02", "walls/rooms/02"] },
  { id: "dining-room", name: "Dining room", examples: ["floor/rooms/03", "walls/rooms/08", "floor-and-walls/rooms/10"] },
  { id: "bathroom", name: "Bathroom", examples: ["floor-and-walls/rooms/01", "walls/rooms/05", "floor-and-walls/rooms/09"] },
  { id: "office", name: "Office", examples: ["walls/rooms/09"] },
  { id: "outdoor", name: "Outdoor", examples: ["floor/rooms/09", "walls/rooms/10", "floor/rooms/05"] },
  { id: "entryway", name: "Entryway", examples: ["floor/rooms/08", "walls/rooms/06"] },
] as const;

export type RenderSpace = (typeof RENDER_SPACES)[number];

export function findRenderSpace(id: string | null) {
  return RENDER_SPACES.find((space) => space.id === id);
}
