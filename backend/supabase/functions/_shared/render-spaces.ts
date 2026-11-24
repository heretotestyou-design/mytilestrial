export const SPACE_IDS = [
  "living-room", "kitchen", "bedroom", "dining-room", "bathroom", "office", "outdoor", "entryway",
] as const;

export type SpaceId = (typeof SPACE_IDS)[number];

export const SPACE_SCENES: Record<SpaceId, string> = {
  "living-room": "a bright modern living room with the selected tile surface clearly visible",
  kitchen: "a modern kitchen with fitted cabinets and a clear view of the selected tile surface",
  bedroom: "a modern bedroom with a bed and a clear view of the selected tile surface",
  "dining-room": "a modern dining room with a dining table and a clear view of the selected tile surface",
  bathroom: "a modern bathroom with fitted fixtures and a clear view of the selected tile surface",
  office: "a modern office with simple furniture and a clear view of the selected tile surface",
  outdoor: "a modern outdoor terrace with a paved floor and an exterior wall, framed to show the selected tile surface",
  entryway: "a modern entryway viewed from inside, showing the entrance and the selected tile surface",
};
