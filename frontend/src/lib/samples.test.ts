import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { RENDER_TEMPLATES, TEMPLATE_CATEGORIES } from "./catalog";
import { RENDER_SPACES } from "./render-spaces";
import { SAMPLES_PER_FOLDER, sampleImages, studioSamples, templatePreview } from "./samples";

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

  it("ships room-specific studio examples for every space and category", () => {
    for (const category of TEMPLATE_CATEGORIES) {
      const tiles = new Set<string>();
      const rooms = new Set<string>();
      for (const space of RENDER_SPACES) {
        const [first, second] = category === "Theme"
          ? [studioSamples(category, "site", space), studioSamples(category, "reference", space)]
          : [studioSamples(category, "tile", space), studioSamples(category, "room", space)];
        const [options, roomPhotos] = category === "Theme" ? [second, first] : [first, second];
        expect(options).toHaveLength(6);
        expect(new Set(options.map(({ src }) => src)).size).toBe(6);
        expect(roomPhotos.length).toBeGreaterThanOrEqual(3);
        tiles.add(first.map(({ src }) => src).sort().join(","));
        rooms.add(second.map(({ src }) => src).sort().join(","));
        for (const { src } of [...first, ...second]) {
          expect(existsSync(resolve("public", src.slice(1))), src).toBe(true);
        }
      }
      expect(tiles.size).toBe(RENDER_SPACES.length);
      expect(rooms.size).toBe(RENDER_SPACES.length);
    }
  });

  it("ships a unique preview file for each space and template", () => {
    const paths = RENDER_SPACES.flatMap((space) =>
      RENDER_TEMPLATES.map((template) => templatePreview(space.id, template.id)),
    );
    expect(new Set(paths).size).toBe(RENDER_SPACES.length * RENDER_TEMPLATES.length);
    for (const src of paths) {
      expect(existsSync(resolve("public", src.slice(1))), src).toBe(true);
    }
  });
});
