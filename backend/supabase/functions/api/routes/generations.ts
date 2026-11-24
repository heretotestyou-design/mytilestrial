// /v1/generations/* — AI tile renders, paid for in credits.
//
// POST /v1/generations takes the photos as multipart form data, charges the credits,
// renders, and streams the finished image straight back. Nothing is stored: the
// browser keeps the image for the session and asks the user to download it.
// Failures (and dropped connections) are refunded automatically.
import type { Router } from "../../_shared/router.ts";
import { ACCEPTED_IMAGE_TYPES, MAX_UPLOAD_BYTES } from "../../_shared/config.ts";
import { isRealImage, pngInfo } from "../../_shared/images.ts";
import { RenderError, renderImage, withSignedUrls, type WallEdit } from "../../_shared/render.ts";
import { PUBLIC_TEMPLATES, WALL_SELECTION_TEMPLATE_ID, findTemplate, isThemeTemplate } from "../../_shared/templates.ts";
import { admin, requireInternal, requireUser } from "../../_shared/supabase.ts";
import { ApiError, corsHeaders, Errors, fromDbError, json, readJson } from "../../_shared/http.ts";
import {
  completeGenerationSchema,
  failGenerationSchema,
  generationFormSchema,
  pagination,
  parse,
  uuid,
} from "../../_shared/validation.ts";

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

/** Renders still running after this long were cut off by the runtime: fail and refund them. */
const STALE_AFTER_MS = 10 * 60 * 1000;
/** Bytes sent while waiting, so proxies don't drop a long, silent response. */
const KEEPALIVE_MS = 10_000;

type Row = { id: string; status: string; created_at: string; output_url: string | null };

async function sweepStale<T extends Row>(rows: T[]): Promise<T[]> {
  const now = Date.now();
  return await Promise.all(
    rows.map(async (r) => {
      if ((r.status !== "queued" && r.status !== "processing") || now - Date.parse(r.created_at) < STALE_AFTER_MS) return r;
      const { data } = await admin.rpc("fail_generation", { p_generation_id: r.id, p_error: "The render timed out." });
      return data ? ({ ...r, ...data } as T) : r;
    }),
  );
}

/** Reads and checks the multipart request before anything is charged. */
/** Two photos plus form overhead. Bigger bodies are refused before being read. */
const MAX_BODY_BYTES = 2 * MAX_UPLOAD_BYTES + 512 * 1024;
const MAX_WALL_MASK_BYTES = 512 * 1024;
const WALL_EDIT_SIZES = new Set(["1024x1024", "1536x1024", "1024x1536"]);
type RenderMode = "regular" | "floor" | "wall";

async function readRenderRequest(req: Request, mode: RenderMode) {
  const length = Number(req.headers.get("content-length") ?? "0");
  if (!length || length > MAX_BODY_BYTES + (mode === "wall" ? MAX_WALL_MASK_BYTES : 0)) {
    throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Photos must be 10 MB or smaller.");
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw Errors.badRequest("Send the photos as multipart form data.");
  }
  const fields = parse(generationFormSchema, {
    type: form.get("type") ?? undefined,
    template_id: form.get("template_id") ?? undefined,
    space: form.get("space") ?? undefined,
    tile_in_room: form.get("tile_in_room") ?? undefined,
    floor_layout: form.get("floor_layout") ?? undefined,
  });
  const template = findTemplate(fields.template_id);
  if (!template) throw Errors.badRequest("Unknown template.");
  if ((template.id === WALL_SELECTION_TEMPLATE_ID) !== (mode === "wall")) {
    throw Errors.badRequest("Use the Select a wall template for a masked wall render.");
  }
  if (fields.floor_layout && template.id !== "floor-full") {
    throw Errors.badRequest("Floor layout settings are available in the Full floor template.");
  }

  const images = form.getAll("image").filter((f): f is File => f instanceof File);
  if (images.length < 1 || images.length > 2) throw Errors.badRequest("Add one or two photos.");
  if (isThemeTemplate(template) && images.length !== 2) {
    throw Errors.badRequest("Theme transfer needs your site photo and a theme reference photo.");
  }
  for (const img of images) {
    if (!ACCEPTED_IMAGE_TYPES.includes(img.type)) throw Errors.badRequest("Photos must be JPG, PNG or WebP.");
    if (img.size === 0 || img.size > MAX_UPLOAD_BYTES) throw Errors.badRequest("Photos must be 10 MB or smaller.");
    if (!(await isRealImage(img))) throw Errors.badRequest("That file isn't a valid JPG, PNG or WebP image.");
  }
  let wallEdit: WallEdit | undefined;
  if (mode === "wall") {
    if (images.length !== 2) throw Errors.badRequest("Add a tile photo and a room photo.");
    const masks = form.getAll("wall_mask");
    const mask = masks[0];
    if (masks.length !== 1 || !(mask instanceof File) || mask.size > MAX_WALL_MASK_BYTES) {
      throw Errors.badRequest("Select one wall on the room photo.");
    }
    const room = await pngInfo(images[1]);
    const region = await pngInfo(mask);
    const size = room ? `${room.width}x${room.height}` : "";
    if (!room || !region?.hasAlpha || !WALL_EDIT_SIZES.has(size) ||
        room.width !== region.width || room.height !== region.height) {
      throw Errors.badRequest("The wall selection doesn't match the room photo. Select the wall again.");
    }
    wallEdit = { mask, size };
  }
  return { ...fields, template, images, wallEdit };
}

const GENERATION_COLUMNS =
  "id, type, status, credits_charged, refunded, room_type, input, output_url, error, created_at, completed_at";

export function generationRoutes(r: Router) {
  r.get("/v1/templates", ({ req }) => json(req, { templates: PUBLIC_TEMPLATES }, 200, "public, max-age=0, s-maxage=300"));

  const createRender = async (req: Request, mode: RenderMode = "regular") => {
    const user = await requireUser(req);
    const { type, template, space, tile_in_room, floor_layout, images, wallEdit } = await readRenderRequest(req, mode);
    if (mode === "floor" && !floor_layout) throw Errors.badRequest("Complete the floor and tile measurements.");

    const idempotencyKey = req.headers.get("idempotency-key")?.slice(0, 100) || null;
    const { data, error } = await admin.rpc("start_generation", {
      p_user_id: user.id,
      p_type: type,
      p_room_type: template.name,
      p_input: { template_id: template.id, tile_in_room, photos: images.length, ...(space && { space }), ...(floor_layout && { floor_layout }) },
      p_idempotency_key: idempotencyKey,
    });
    if (error) throw fromDbError(error);
    // A retried request can't get the image again (it isn't stored).
    if (data.replayed) return json(req, { generation: data.generation, balance: data.balance, image: null }, 200);

    const id: string = data.generation.id;
    const enc = new TextEncoder();
    let clientGone = false;
    let finished!: () => void;
    const done = new Promise<void>((r) => (finished = r));

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (s: string) => {
          if (clientGone) return false;
          try {
            controller.enqueue(enc.encode(s));
            return true;
          } catch {
            clientGone = true;
            return false;
          }
        };
        const ping = setInterval(() => send(" "), KEEPALIVE_MS);
        try {
          await admin.rpc("start_processing_generation", { p_generation_id: id });
          const { b64, mime } = await renderImage({ template, type, tileInRoom: tile_in_room, floorLayout: floor_layout, space, wallEdit, images });
          const delivered = send(JSON.stringify({ generation: { ...data.generation, status: "completed" }, balance: data.balance, image: `data:${mime};base64,${b64}` }));
          if (delivered) {
            await admin.rpc("complete_generation", { p_generation_id: id, p_output_url: null });
          } else {
            await admin.rpc("fail_generation", { p_generation_id: id, p_error: "The connection closed before the image was delivered." });
          }
        } catch (err) {
          console.error("Render failed", id, err);
          const message = err instanceof RenderError ? err.message : "The render couldn't be completed.";
          await admin.rpc("fail_generation", { p_generation_id: id, p_error: message });
          send(JSON.stringify({ error: { code: "RENDER_FAILED", message: `${message} The image was added back to your balance.`, details: { refunded: true } } }));
        } finally {
          clearInterval(ping);
          try {
            controller.close();
          } catch {
            /* already closed */
          }
          finished();
        }
      },
      cancel() {
        clientGone = true;
      },
    });

    // Keep the worker alive until the render is settled, even if the client leaves.
    if (typeof EdgeRuntime !== "undefined") EdgeRuntime.waitUntil(done);
    return new Response(stream, {
      status: 200,
      headers: { ...corsHeaders(req), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
    });
  };
  r.post("/v1/generations", ({ req }) => createRender(req));
  r.post("/v1/generations/floor-layout", ({ req }) => createRender(req, "floor"));
  r.post("/v1/generations/selected-wall", ({ req }) => createRender(req, "wall"));

  r.get("/v1/generations", async ({ req, url }) => {
    const user = await requireUser(req);
    const { limit, before } = parse(pagination, Object.fromEntries(url.searchParams));

    let q = admin
      .from("generations")
      .select(GENERATION_COLUMNS)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit + 1);
    if (before) q = q.lt("created_at", before);

    const { data, error } = await q;
    if (error) throw fromDbError(error);
    const page = data.slice(0, limit);
    const next = data.length > limit ? page[page.length - 1].created_at : null;
    const items = await withSignedUrls(await sweepStale(page));
    return json(req, { items, next_cursor: next });
  });

  r.get("/v1/generations/:id", async ({ req, params }) => {
    const user = await requireUser(req);
    parse(uuid, params.id);
    const { data, error } = await admin
      .from("generations")
      .select(GENERATION_COLUMNS)
      .eq("id", params.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw fromDbError(error);
    if (!data) throw Errors.notFound("Render");
    const [generation] = await withSignedUrls(await sweepStale([data]));
    return json(req, { generation });
  });

  // ---- Internal: called by the image engine with x-internal-secret ----------

  r.post("/v1/internal/generations/:id/complete", async ({ req, params }) => {
    requireInternal(req);
    parse(uuid, params.id);
    const { output_url } = parse(completeGenerationSchema, await readJson(req));
    const { data, error } = await admin.rpc("complete_generation", {
      p_generation_id: params.id,
      p_output_url: output_url,
    });
    if (error) throw fromDbError(error);
    return json(req, { generation: data });
  });

  r.post("/v1/internal/generations/:id/fail", async ({ req, params }) => {
    requireInternal(req);
    parse(uuid, params.id);
    const { error: reason } = parse(failGenerationSchema, await readJson(req));
    const { data, error } = await admin.rpc("fail_generation", {
      p_generation_id: params.id,
      p_error: reason ?? null,
    });
    if (error) throw fromDbError(error);
    return json(req, { generation: data });
  });
}
