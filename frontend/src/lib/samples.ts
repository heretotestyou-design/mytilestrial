// Example images shipped in /public/samples (see public/samples/README.md).
// Files are referenced by fixed names, so adding an image is just dropping it in the folder.
import { WALL_SELECTION_TEMPLATE_ID, type TEMPLATE_CATEGORIES } from "@/lib/catalog";

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

/** Preview image for a layout card. */
export const templatePreview = (templateId: string) => `/samples/templates/${templateId === WALL_SELECTION_TEMPLATE_ID ? "wall-back" : templateId}.${EXT}`;

/** Loads an example as a File so it goes through the same upload path as the user's own photos. */
export async function sampleToFile(sample: SampleImage): Promise<File> {
  const res = await fetch(sample.src);
  if (!res.ok) throw new Error(`${sample.label} isn't available yet.`);
  const blob = await res.blob();
  return new File([blob], sample.src.split("/").pop() ?? "example.jpg", { type: blob.type || "image/jpeg" });
}
