import assert from "node:assert/strict";
import { buildPrompt, findTemplate } from "./templates.ts";
import { generationFormSchema } from "./validation.ts";

Deno.test("selecting a space changes the tile-only scene while preserving template restrictions", () => {
  const { space } = generationFormSchema.parse({ template_id: "walls-all", space: "kitchen" });
  const walls = findTemplate("walls-all")!;
  const prompt = buildPrompt(walls, false, undefined, space);
  assert.match(prompt, /create a modern kitchen with fitted cabinets/);
  assert.match(prompt, /keep this exact room unchanged/);
  assert.match(prompt, /Cover every visible wall/);
  assert.equal(buildPrompt(walls, false), walls.prompt);

  for (const id of ["theme-transfer", "wall-select"]) {
    const template = findTemplate(id)!;
    assert.equal(buildPrompt(template, false, undefined, space), template.prompt);
  }
  assert.equal(generationFormSchema.safeParse({ template_id: walls.id, space: "unknown" }).success, false);
});
