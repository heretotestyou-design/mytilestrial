import assert from "node:assert/strict";
import { buildPrompt, findTemplate } from "./templates.ts";
import { generationFormSchema } from "./validation.ts";

const layout = {
  floorWidthFeet: 10,
  floorLengthFeet: 9,
  tileLongSideInches: 24,
  tileShortSideInches: 12,
  direction: "vertical",
} as const;

Deno.test("measured floor render describes the dimensions, direction and cut grid in the edit prompt", () => {
  const fields = generationFormSchema.parse({ template_id: "floor-full", floor_layout: JSON.stringify(layout) });
  const floor = findTemplate(fields.template_id)!;
  const prompt = buildPrompt(floor, true, fields.floor_layout);
  assert.match(prompt, /10 feet side to side and 9 feet front to back/);
  assert.match(prompt, /24 inches on the long side and 12 inches on the short side/);
  assert.match(prompt, /vertically, with the long edge running front to back/);
  assert.match(prompt, /10 tile positions across and 5 tile positions from front to back/);
  assert.match(buildPrompt(floor, false, { ...layout, direction: "horizontal" }), /5 tile positions across and 9 tile positions from front to back/);
  assert.equal(buildPrompt(floor, false), floor.prompt);
  const wall = findTemplate("walls-all")!;
  assert.equal(buildPrompt(wall, false, layout), wall.prompt);
});

Deno.test("floor layout metadata is optional and rejects invalid dimensions or direction", () => {
  const fields = { template_id: "floor-full" };
  assert.equal(generationFormSchema.parse(fields).floor_layout, undefined);
  for (const invalid of [{ ...layout, floorWidthFeet: 0 }, { ...layout, direction: "diagonal" }, { ...layout, tileLongSideInches: 2 }]) {
    assert.equal(generationFormSchema.safeParse({ ...fields, floor_layout: JSON.stringify(invalid) }).success, false);
  }
  assert.equal(generationFormSchema.safeParse({ ...fields, floor_layout: "invalid JSON" }).success, false);
});
