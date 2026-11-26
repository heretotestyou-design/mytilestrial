// Example images shipped in /public/samples (see public/samples/README.md).
// Files are referenced by fixed names, so adding an image is just dropping it in the folder.
import type { TEMPLATE_CATEGORIES } from "@/lib/catalog";
import type { RenderSpace } from "./render-spaces";

type Category = (typeof TEMPLATE_CATEGORIES)[number];

export const SAMPLES_PER_FOLDER = 10;
const EXT = "jpg";

const CATEGORY_DIR: Record<Category, string> = {
  Floor: "floor",
  Walls: "walls",
  "Floor and walls": "floor-and-walls",
  Theme: "theme",
};

/** Which photo slot an example fills. */
export type SampleSlot = "tile" | "room" | "site" | "reference";

const SLOT_DIR: Record<SampleSlot, string> = { tile: "tiles", room: "rooms", site: "sites", reference: "references" };
const SLOT_LABEL: Record<SampleSlot, string> = { tile: "Tile", room: "Room", site: "Site", reference: "Theme" };

export type SampleImage = { src: string; label: string; file: string };

export function sampleImages(category: Category, slot: SampleSlot): SampleImage[] {
  const dir = `/samples/${CATEGORY_DIR[category]}/${SLOT_DIR[slot]}`;
  return Array.from({ length: SAMPLES_PER_FOLDER }, (_, i) => {
    const n = String(i + 1).padStart(2, "0");
    return { src: `${dir}/${n}.${EXT}`, label: `${SLOT_LABEL[slot]} ${i + 1}`, file: `${dir.slice(1)}/${n}.${EXT}` };
  });
}

/** Photographic preview for a layout in the selected space. */
export const templatePreview = (spaceId: RenderSpace["id"], templateId: string) =>
  `/samples/space-templates/${spaceId}/${templateId}.webp`;

type TileCategory = Exclude<Category, "Theme">;

const TILE_NAMES: Record<TileCategory, readonly string[]> = {
  Floor: ["White marble", "Gold-veined marble", "Beige travertine", "Warm grey concrete", "Ivory terrazzo", "Black marble", "Charcoal slate", "Silver concrete", "Green marble", "Sandstone"],
  Walls: ["White subway", "Sage square", "Navy hexagon", "Blue patterned", "Terracotta vertical", "White herringbone", "Blush scallop", "Black floral", "Forest green", "Mist blue"],
  "Floor and walls": ["Soft grey stone", "White stone", "Terracotta pattern", "Marble", "Charcoal stone", "Ivory linear", "Warm limestone", "Grey checkerboard", "Olive square", "Stone terrazzo"],
};

const SPACE_TILES: Record<RenderSpace["id"], Record<TileCategory, readonly number[]>> = {
  "living-room": { Floor: [1, 3, 10, 2, 5, 8], Walls: [2, 6, 9, 10, 7, 8], "Floor and walls": [4, 7, 2, 6, 9, 10] },
  kitchen: { Floor: [5, 8, 2, 4, 1, 10], Walls: [1, 4, 5, 6, 2, 3], "Floor and walls": [6, 8, 10, 1, 2, 4] },
  bedroom: { Floor: [10, 3, 8, 1, 4, 5], Walls: [7, 10, 6, 2, 1, 3], "Floor and walls": [7, 2, 6, 4, 1, 9] },
  "dining-room": { Floor: [2, 9, 4, 3, 5, 6], Walls: [8, 9, 2, 4, 5, 6], "Floor and walls": [9, 3, 4, 7, 8, 10] },
  bathroom: { Floor: [8, 5, 7, 1, 4, 10], Walls: [10, 3, 7, 1, 4, 6], "Floor and walls": [2, 1, 10, 6, 5, 4] },
  office: { Floor: [4, 6, 8, 7, 5, 3], Walls: [3, 6, 10, 1, 2, 9], "Floor and walls": [1, 5, 8, 4, 2, 10] },
  outdoor: { Floor: [7, 10, 4, 3, 8, 5], Walls: [5, 2, 4, 9, 3, 8], "Floor and walls": [3, 7, 9, 1, 5, 10] },
  entryway: { Floor: [6, 9, 5, 2, 7, 10], Walls: [9, 8, 1, 5, 2, 7], "Floor and walls": [10, 8, 5, 4, 3, 7] },
};

function example(src: string, label: string): SampleImage {
  return { src, label, file: src.slice(1) };
}

function namedTileSample(category: TileCategory, number: number) {
  const id = String(number).padStart(2, "0");
  return example(`/samples/${CATEGORY_DIR[category]}/tiles/${id}.jpg`, TILE_NAMES[category][number - 1]);
}

export const FLOOR_PLANNER_TILES = [
  { id: "warm-grey-concrete", ...namedTileSample("Floor", 4) },
  { id: "white-marble", ...namedTileSample("Floor", 1) },
  { id: "beige-travertine", ...namedTileSample("Floor", 3) },
  { id: "ivory-terrazzo", ...namedTileSample("Floor", 5) },
  { id: "charcoal-slate", ...namedTileSample("Floor", 7) },
  { id: "green-marble", ...namedTileSample("Floor", 9) },
] as const;

export type FloorTileFinish = (typeof FLOOR_PLANNER_TILES)[number]["id"];

export function studioSamples(category: Category, slot: SampleSlot, space?: RenderSpace): SampleImage[] {
  if (!space) return sampleImages(category, slot);
  if (slot === "tile" && category !== "Theme") {
    return SPACE_TILES[space.id][category].map((number) => namedTileSample(category, number));
  }
  if (slot === "reference") {
    return ["theme-transfer", "mixed", "wall-feature", "floor-full", "walls-all", "wall-half"].map((id, index) =>
      example(templatePreview(space.id, id), `${space.name} theme ${index + 1}`),
    );
  }

  const folder = CATEGORY_DIR[category];
  const originals = [...space.examples].sort((a, b) =>
    Number(b.startsWith(folder + "/")) - Number(a.startsWith(folder + "/"))
  );
  const photos = [
    ...originals.map((source) => `/samples/${source}.jpg`),
    `/samples/space-rooms/${space.id}/01.webp`,
    `/samples/space-rooms/${space.id}/02.webp`,
  ];
  const label = slot === "site" ? `${space.name} site` : space.name;
  return photos.map((src, index) => example(src, `${label} ${index + 1}`));
}

/** Loads an example as a File so it goes through the same upload path as the user's own photos. */
export async function sampleToFile(sample: SampleImage, signal?: AbortSignal): Promise<File> {
  const res = await fetch(sample.src, { signal });
  if (!res.ok) throw new Error(`${sample.label} isn't available yet.`);
  const blob = await res.blob();
  return new File([blob], sample.src.split("/").pop() ?? "example.jpg", { type: blob.type || "image/jpeg" });
}
