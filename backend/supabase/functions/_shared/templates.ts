// Render templates based on trino-ai
// (frontend/src/components/tiles/studio.tsx: IMAGE_TEMPLATES, KEEP_ROOM, ...).
// Prompts stay server-side.
//
// Image order sent to GPT image:
//   tile templates:  photo 1 = tile (required), photo 2 = customer's room (optional)
//   theme transfer:  image 1 = construction site, image 2 = theme reference (both required)

import { floorLayoutPrompt, type FloorLayout } from "./floor-layout.ts";
import { SPACE_SCENES, type SpaceId } from "./render-spaces.ts";

const DEFAULT_SCENE = "a clean, bright, modern empty room";

export const KEEP_ROOM = `Photo 1 is the tile. Photo 2 is the customer's room: keep this exact room unchanged (same room type, layout, camera angle, lighting). Do not change, move, add or remove any object: every door, window, furniture piece, designer or decor item, fixture, plant, curtain and lamp must stay exactly as in photo 2, same position, shape, size and color. Change only the wall or floor surface named below, nothing else. The one exception: remove loose debris and construction leftovers lying on the floor, such as broken wood pieces, offcuts, planks, rubble, dust, stains and scraps, so the floor is clean and empty. If there is no room photo, create ${DEFAULT_SCENE} instead. Use the tile from photo 1 exactly as it is: same color, pattern, finish and proportions, with straight even grout lines, correct perspective, and realistic scale, lighting and shadows. No people, text or logos.`;

export const KEEP_REST = 'Leave everything else, including all objects, doors and decor, exactly as it is.';

const TILE_PHOTO = 'Photo 1 is the tile.';
export const TILE_IN_ROOM = 'Photo 1 is a real photo of a space where the tile is already installed: copy only the tile from it (color, pattern, finish, tile size and grout lines) and ignore its room, objects and layout.';
export const withTileSource = (prompt: string, tileInRoom: boolean) => (tileInRoom ? prompt.replace(TILE_PHOTO, TILE_IN_ROOM) : prompt);

// The image prompt for the current form: the typed or template prompt, or a default when only the room photo and tile-in-room are set.

export const THEME_TEMPLATE_ID = 'theme-transfer';
export const WALL_SELECTION_TEMPLATE_ID = 'wall-select';

const THEME_PROMPT = `The first image is INPUT A (CONSTRUCTION_SITE_IMAGE). The second image is INPUT B (THEME_REFERENCE_IMAGE).

ROLE: Architectural reconstruction and material-transfer engine.

INPUT A: CONSTRUCTION_SITE_IMAGE. This is the authoritative source for all physical geometry, perspective, permanent structures, openings and layout.
INPUT B: THEME_REFERENCE_IMAGE. This is the authoritative source for finish materials, textures, tile patterns, colors, reflectance, wall treatments, paint and ceiling colors. Furniture and decor in B are not transferable.

OBJECTIVE:
Produce one photorealistic image of the identical construction site after completion, applying the finishing design language of B accurately to the existing architecture in A.

STEP 1 — SCENE UNDERSTANDING:
Independently inspect both images before editing. Identify the floor plane, back and side walls, staircases, beams, columns, slabs, ceiling, doors, windows, structural gaps, partitions, wall protrusions, recesses and permanent openings. Distinguish construction debris, temporary wood, props, tools, scaffolding, wet areas and rubble from permanent architecture. Do not mistake temporary objects for doorways or built-in structures.
Estimate depth, horizon, vanishing points, surface normals and occlusions. Segment each visible architectural plane separately. Do not assume a surface is a wall solely because it has a tile pattern. Identify whether a divider seen in the theme is a structural partition, surface cladding, decorative panel, sticker, tile border, or movable object using edges, occlusion, depth and context. When uncertain, do not create a new structure.

STEP 2 — MATERIAL EXTRACTION:
Analyze the reference for exact floor tile base tone, color undertone, tile format, scale, grout color and width, texture and reflectance. Distinguish matte, satin, semi-gloss and polished: never turn matte into mirror-like gloss.
Independently identify plain wall tiles, feature-wall pattern tiles, paint, trim, skirting, ceiling finish and stair finish. Never apply feature-wall tiles across every wall just because they appear on a large area of the reference. Distinguish finish material from architecture and furniture.
Preserve the reference's pattern motif, relative scale, spacing, grout and muted accent colors; do not recolor to a generic monochrome palette.

STEP 3 — APPLY FINISHES:
Retain all permanent geometry and existing openings from A exactly. Apply floor finishes only to existing floors with perspective-correct tile orientation and grout. Apply standard wall finishes to ordinary existing wall surfaces, and feature-wall finishes to appropriate existing wall regions, without constructing partitions from the reference. Preserve the theme's contrast between feature areas and plain areas. Use original lighting direction in A, adjusting exposure as if the completed surfaces were clean and painted, without adding unrequested light fixtures.
Apply plausible skirting, stair cladding, wall-to-ceiling transitions and clean edge terminations that match the reference material palette.

STEP 4 — CLEANUP:
Remove standing water, mud, rubbish, unused wood, temporary props, tools, loose bricks, ladders, scaffolding and construction materials. Finish plaster and paint. Keep the site's permanent openings and structural components unchanged. Do not add furniture, people, art, plants, decor, lamps, appliances, railings or doors that are not already physically present or explicitly requested. Do not replace existing windows or change their size, location or shape.

STEP 5 — GEOMETRY AND MATERIAL VALIDATION:
Compare output to A for camera angle, perspective, stairs, columns, openings, wall boundaries and room proportions. Compare output to B for texture, pattern, tile scale, overall color, wall hierarchy, ceiling tone, grout and precise surface reflectance. Check that decorative dividers have not become structural walls, shadows have not become openings and temporary timber has not become a doorway.
If layout preservation conflicts with the appearance of the reference, preserve A's layout. If a material cannot be determined confidently, use the closest neutral finish already present in B, without inventing an architectural element.

OUTPUT:
A single high-resolution, photorealistic, empty, completed interior from A's exact camera position, with B's materials faithfully mapped to the existing surfaces. No collage, split-screen, captions or added objects.`;

const SELECTED_WALL_PROMPT = `Image 1 is the original room photo and the image to edit. Image 2 is the tile material reference. The mask selects one wall surface in image 1. Apply the tile's color, pattern and finish to that wall, aligning straight grout lines and tile size with the wall's perspective. Keep doors, windows, trim, fixtures, artwork, and furniture visible in front of the wall. Preserve the original room's framing, camera angle, architecture, light and shadows, including outside the selection. Keep any padding around the room photo in place. Output a single photorealistic edit of image 1 with the same composition, no labels or diagram.`;

export const IMAGE_TEMPLATES = [
  {
    id: THEME_TEMPLATE_ID,
    category: 'Theme',
    name: 'Theme transfer',
    description: 'Finish your site in the style of a reference photo',
    prompt: THEME_PROMPT,
  },
  {
    id: 'floor-full',
    category: 'Floor',
    name: 'Full floor',
    description: 'Whole floor in your tile, plain and even',
    prompt: `${KEEP_ROOM}\n\nCover the entire floor with the tile from photo 1 as one continuous plain surface, laid in a straight even grid. Leave the walls, ceiling, furniture and fixtures exactly as they are.`,
  },
  {
    id: 'floor-corners',
    category: 'Floor',
    name: 'Corners',
    description: 'A group of four tiles in each corner',
    prompt: `${KEEP_ROOM}\n\nCover the floor with a plain neutral tile that matches the room. In each of the four corners of the floor, lay a group of four tiles from photo 1 as a 2 by 2 square, with straight grout lines between the four tiles, so every corner shows four tiles together and never a single tile. ${KEEP_REST}`,
  },
  {
    id: 'floor-center',
    category: 'Floor',
    name: 'Center panel',
    description: 'Tile feature in the middle of the floor',
    prompt: `${KEEP_ROOM}\n\nCover the floor with a plain neutral tile that matches the room, and place the tile from photo 1 as a centered rectangular feature panel in the middle of the floor with a clean border. ${KEEP_REST}`,
  },
  {
    id: 'floor-border',
    category: 'Floor',
    name: 'Border frame',
    description: 'Tile border around a plain center',
    prompt: `${KEEP_ROOM}\n\nCover the center of the floor with a plain neutral tile that matches the room, and frame it with a continuous border of the tile from photo 1 running along all four edges of the floor. ${KEEP_REST}`,
  },
  {
    id: 'floor-checker',
    category: 'Floor',
    name: 'Checkerboard',
    description: 'Alternating tile and plain squares',
    prompt: `${KEEP_ROOM}\n\nLay the floor as a checkerboard of equal square blocks, alternating the tile from photo 1 with a plain neutral tile that matches the room. ${KEEP_REST}`,
  },
  {
    id: WALL_SELECTION_TEMPLATE_ID,
    category: 'Walls',
    name: 'Select a wall',
    description: 'Choose one wall in your room photo',
    prompt: SELECTED_WALL_PROMPT,
  },
  {
    id: 'walls-all',
    category: 'Walls',
    name: 'All walls',
    description: 'Every visible wall covered',
    prompt: `${KEEP_ROOM}\n\nCover every visible wall with the tile from photo 1, floor to ceiling. Leave the floor, ceiling, furniture and fixtures as they are.`,
  },
  {
    id: 'wall-back',
    category: 'Walls',
    name: 'Back wall',
    description: 'Only the wall facing the camera',
    prompt: `${KEEP_ROOM}\n\nCover only the wall facing the camera with the tile from photo 1, floor to ceiling. Leave the other walls, the floor, ceiling, furniture and fixtures exactly as they are.`,
  },
  {
    id: 'wall-left',
    category: 'Walls',
    name: 'Left wall',
    description: 'Only the wall on the left',
    prompt: `${KEEP_ROOM}\n\nCover only the wall on the left side of the view with the tile from photo 1, floor to ceiling. Leave the other walls, the floor, ceiling, furniture and fixtures exactly as they are.`,
  },
  {
    id: 'wall-right',
    category: 'Walls',
    name: 'Right wall',
    description: 'Only the wall on the right',
    prompt: `${KEEP_ROOM}\n\nCover only the wall on the right side of the view with the tile from photo 1, floor to ceiling. Leave the other walls, the floor, ceiling, furniture and fixtures exactly as they are.`,
  },
  {
    id: 'wall-feature',
    category: 'Walls',
    name: 'Feature strip',
    description: 'Vertical tile strip on the main wall',
    prompt: `${KEEP_ROOM}\n\nPlace the tile from photo 1 as a vertical feature strip in the center of the wall facing the camera, floor to ceiling, about one third of the wall width, with clean straight edges. ${KEEP_REST}`,
  },
  {
    id: 'wall-half',
    category: 'Walls',
    name: 'Half height',
    description: 'Lower half of the walls tiled',
    prompt: `${KEEP_ROOM}\n\nCover the lower half of every visible wall, from the floor up to the middle of the wall, with the tile from photo 1, ending in a clean straight horizontal top edge. Leave the upper half of the walls, the floor, ceiling, furniture and fixtures as they are.`,
  },
  {
    id: 'mixed',
    category: 'Floor and walls',
    name: 'Mixed',
    description: 'Center of the floor plus a main wall',
    prompt: `${KEEP_ROOM}\n\nUse the tile from photo 1 for the center of the floor and to cover the wall facing the camera, and combine it with a plain neutral tile that matches the room for the rest of the floor, in a balanced mixed layout. ${KEEP_REST}`,
  },
] satisfies { id: string; category: string; name: string; description: string; prompt: string }[];

export type Template = (typeof IMAGE_TEMPLATES)[number];

export function findTemplate(id: string): Template | null {
  return IMAGE_TEMPLATES.find((t) => t.id === id) ?? null;
}

export const isThemeTemplate = (t: Template) => t.id === THEME_TEMPLATE_ID;

/** Final prompt for the selected template and its render inputs. */
export function buildPrompt(template: Template, tileInRoom: boolean, floorLayout?: FloorLayout, space?: SpaceId) {
  if (template.id === WALL_SELECTION_TEMPLATE_ID) {
    return tileInRoom ? `${template.prompt} Image 2 shows the tile installed. Use its tile material only and ignore its room and objects.` : template.prompt;
  }
  if (isThemeTemplate(template)) return template.prompt;
  const tilePrompt = withTileSource(template.prompt, tileInRoom);
  const prompt = space ? tilePrompt.replace(DEFAULT_SCENE, SPACE_SCENES[space]) : tilePrompt;
  return template.id === "floor-full" && floorLayout ? `${prompt}\n\n${floorLayoutPrompt(floorLayout)}` : prompt;
}

/** What the browser needs for the picker (prompts stay on the server). */
export const PUBLIC_TEMPLATES = IMAGE_TEMPLATES.map(({ id, category, name, description }) => ({ id, category, name, description }));
