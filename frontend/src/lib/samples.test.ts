import { describe, expect, it } from "vitest";
import { RENDER_TEMPLATES } from "./catalog";
import { SAMPLES_PER_FOLDER, sampleImages, templatePreview } from "./samples";

describe("example image manifest", () => {
  it("lists 10 numbered images per folder", () => {
    const tiles = sampleImages("Floor", "tile");
    expect(tiles).toHaveLength(SAMPLES_PER_FOLDER);
    expect(tiles[0].src).toBe("/samples/floor/tiles/01.jpg");
    expect(tiles[9].src).toBe("/samples/floor/tiles/10.jpg");
  });

  it("maps categories and slots to folders", () => {
    expect(sampleImages("Floor and walls", "room")[0].src).toBe("/samples/floor-and-walls/rooms/01.jpg");
    expect(sampleImages("Theme", "site")[0].src).toBe("/samples/theme/sites/01.jpg");
    expect(sampleImages("Theme", "reference")[0].src).toBe("/samples/theme/references/01.jpg");
  });

  it("has a preview path for every template", () => {
    for (const t of RENDER_TEMPLATES) {
      const previewId = t.id === "wall-select" ? "wall-back" : t.id;
      expect(templatePreview(t.id)).toBe(`/samples/templates/${previewId}.jpg`);
    }
  });
});
