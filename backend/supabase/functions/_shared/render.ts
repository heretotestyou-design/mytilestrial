// Produces one render: photos (from the request) -> OpenAI image edit -> image bytes.
// Nothing is stored: the API streams the result straight back to the browser, which
// keeps it only for the session and asks the user to download it.
// Same call as trino-ai's worker; env: OPENAI_API_KEY, OPENAI_IMAGE_MODEL, OPENAI_IMAGE_QUALITY.
import { admin } from "./supabase.ts";
import type { SpaceId } from "./render-spaces.ts";
import { floorPreviewPrompt, type FloorLayout, type FloorTileFinish } from "./floor-layout.ts";
import { buildPrompt, isThemeTemplate, type Template } from "./templates.ts";

// Kept for renders created before images stopped being stored.
const OUTPUT_BUCKET = "renders";
const OUTPUT_PREFIX = `storage:${OUTPUT_BUCKET}/`;

const MODEL = Deno.env.get("OPENAI_IMAGE_MODEL") ?? "gpt-image-2.5-sunburst";
const QUALITY = Deno.env.get("OPENAI_IMAGE_QUALITY") ?? "medium";
const ULTRA_MODEL = Deno.env.get("OPENAI_IMAGE_MODEL_ULTRA") ?? MODEL;

type Tier = { model: string; quality: string; inputFidelity?: "high" };
export type WallEdit = { mask: File; size: string };

/** Render tier -> OpenAI settings. Standard is exactly trino-ai's configuration. */
const TIERS: Record<string, Tier> = {
  standard: { model: MODEL, quality: QUALITY },
  hd: { model: MODEL, quality: "high" },
  ultra: { model: ULTRA_MODEL, quality: "high", inputFidelity: "high" },
};

/** User-safe failure (shown in the app; never names the vendor). */
export class RenderError extends Error {}

export type RenderRequest = {
  template: Template;
  type: string;
  tileInRoom: boolean;
  floorLayout?: FloorLayout;
  space?: SpaceId;
  wallEdit?: WallEdit;
  /** images[0] = tile (or site photo), images[1] = room (or theme reference). */
  images: Blob[];
};

export async function renderImage({ template, type, tileInRoom, floorLayout, space, wallEdit, images }: RenderRequest): Promise<{ b64: string; mime: string }> {
  const tier = TIERS[type] ?? TIERS.standard;
  const keepAspect = isThemeTemplate(template) || images.length > 1;
  // The Image API applies the mask to the first image. The room is first for this edit.
  const editImages = wallEdit ? [images[1], images[0]] : images;
  return await callOpenAI(buildPrompt(template, tileInRoom, floorLayout, images.length === 1 ? space : undefined), editImages, tier, keepAspect, wallEdit);
}

export function renderFloorPreview(layout: FloorLayout, finish: FloorTileFinish) {
  return callOpenAI(floorPreviewPrompt(layout, finish), [], TIERS.standard, false);
}

async function callOpenAI(prompt: string, images: Blob[], tier: Tier, keepAspect: boolean, wallEdit?: WallEdit) {
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) {
    console.error("OPENAI_API_KEY is not set");
    throw new RenderError("The render engine isn't available right now. Please try again later.");
  }

  // Optional settings. Newer models may not accept all of them, so any that OpenAI
  // rejects as unsupported is dropped and the request retried, instead of failing.
  const optional: Record<string, string | number> = {
    size: wallEdit?.size ?? (keepAspect ? "auto" : "1536x1024"),
    quality: tier.quality,
    output_format: "jpeg",
    output_compression: 90,
    ...(images.length && tier.inputFidelity ? { input_fidelity: tier.inputFidelity } : {}),
  };

  let res: Response;
  // deno-lint-ignore no-explicit-any
  let payload: any;
  for (let attempt = 0; ; attempt++) {
    const settings = { model: tier.model, prompt, ...optional };
    const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
    let body: BodyInit;
    if (images.length) {
      const form = new FormData();
      for (const [name, value] of Object.entries(settings)) form.append(name, String(value));
      images.forEach((img, i) => form.append("image[]", img, `image-${i + 1}.${img.type.split("/")[1] ?? "png"}`));
      if (wallEdit) form.append("mask", wallEdit.mask, "wall-mask.png");
      body = form;
    } else {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(settings);
    }

    const endpoint = images.length ? "edits" : "generations";
    try {
      res = await fetch(`https://api.openai.com/v1/images/${endpoint}`, { method: "POST", headers, body });
    } catch (e) {
      console.error("Image engine unreachable", e);
      throw new RenderError("The render engine couldn't be reached. Please try again.");
    }
    payload = await res.json().catch(() => ({}));

    const param: string | undefined = payload?.error?.param ?? undefined;
    const rejected = param && param in optional ? param : Object.keys(optional).find((k) => payload?.error?.message?.includes(`'${k}'`));
    if (res.status === 400 && rejected && attempt < 5) {
      console.warn(`Model ${tier.model} rejected '${rejected}': retrying without it`, payload?.error?.message);
      delete optional[rejected];
      if (rejected === "output_format") delete optional.output_compression;
      continue;
    }
    break;
  }

  if (!res.ok) {
    console.error("Image engine error", res.status, tier.model, payload?.error?.message ?? "");
    if (payload?.error?.code === "moderation_blocked") {
      throw new RenderError(images.length ? "The image was rejected by the safety filter. Try a different photo." : "The preview was rejected by the safety filter.");
    }
    throw new RenderError("The render engine couldn't complete this render.");
  }
  const b64: string | undefined = payload?.data?.[0]?.b64_json;
  if (!b64) throw new RenderError("The render engine returned no image.");
  return { b64, mime: detectMime(b64) };
}

/** Real format of a base64 image (the model may ignore output_format). */
export function detectMime(b64: string): string {
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("iVBOR")) return "image/png";
  if (b64.startsWith("UklGR")) return "image/webp";
  return "image/png";
}

/** Old stored renders: swap storage paths for short-lived signed URLs. */
export async function withSignedUrls<T extends { output_url: string | null }>(rows: T[]): Promise<T[]> {
  const paths = rows
    .map((r) => r.output_url)
    .filter((u): u is string => Boolean(u?.startsWith(OUTPUT_PREFIX)))
    .map((u) => u.slice(OUTPUT_PREFIX.length));
  if (paths.length === 0) return rows;
  const { data } = await admin.storage.from(OUTPUT_BUCKET).createSignedUrls(paths, 3600);
  const signed = new Map((data ?? []).map((d) => [d.path, d.signedUrl]));
  return rows.map((r) =>
    r.output_url?.startsWith(OUTPUT_PREFIX) ? { ...r, output_url: signed.get(r.output_url.slice(OUTPUT_PREFIX.length)) ?? null } : r,
  );
}
