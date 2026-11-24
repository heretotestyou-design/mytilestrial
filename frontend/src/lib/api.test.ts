import { beforeEach, describe, expect, it, vi } from "vitest";

const getSession = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession } }) }));

import { api, ApiError } from "./api";

const fetchMock = vi.fn();
const ok = (body: string, status = 200) => new Response(body, { status, headers: { "Content-Type": "application/json" } });

describe("API client", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    getSession.mockResolvedValue({ data: { session: { access_token: "user-token" } } });
  });

  it("sends the user's bearer token and the public key", async () => {
    fetchMock.mockResolvedValue(ok(JSON.stringify({ profile: {}, wallet: {} })));
    await api.me();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://test.supabase.co/functions/v1/api/v1/me");
    expect(init.headers.Authorization).toBe("Bearer user-token");
    expect(init.headers.apikey).toBe("test-anon-key");
  });

  it("refuses authenticated calls without a session, before any request", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    await expect(api.me()).rejects.toMatchObject({ status: 401, code: "UNAUTHORIZED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not send a token to public endpoints", async () => {
    fetchMock.mockResolvedValue(ok(JSON.stringify({ packs: [] })));
    await api.catalog();
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("maps API errors to ApiError with code and status", async () => {
    fetchMock.mockResolvedValue(ok(JSON.stringify({ error: { code: "INSUFFICIENT_CREDITS", message: "Not enough credits." } }), 402));
    const err = await api.me().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 402, code: "INSUFFICIENT_CREDITS", message: "Not enough credits." });
  });

  it("reports network failures clearly", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    await expect(api.me()).rejects.toMatchObject({ code: "NETWORK" });
  });

  describe("render (streamed, nothing stored)", () => {
    const photo = new File([new Uint8Array([1, 2, 3])], "tile.jpg", { type: "image/jpeg" });
    const floorLayout = {
      floorWidthFeet: 10,
      floorLengthFeet: 9,
      tileLongSideInches: 24,
      tileShortSideInches: 12,
      direction: "vertical",
    } as const;

    it("uploads photos as multipart form data, not JSON", async () => {
      fetchMock.mockResolvedValue(ok(JSON.stringify({ generation: { id: "g1" }, balance: 4, image: "data:image/jpeg;base64,AAA" })));
      await api.render({ templateId: "floor-full", photos: [photo], space: "kitchen", tileInRoom: true }, "key-1");
      const init = fetchMock.mock.calls[0][1];
      expect(init.body).toBeInstanceOf(FormData);
      expect(init.headers["Content-Type"]).toBeUndefined(); // browser sets the multipart boundary
      expect(init.headers["Idempotency-Key"]).toBe("key-1");
      const form = init.body as FormData;
      expect(form.get("template_id")).toBe("floor-full");
      expect(form.get("space")).toBe("kitchen");
      expect(form.get("tile_in_room")).toBe("true");
      expect(form.has("floor_layout")).toBe(false);
      expect(form.getAll("image")).toHaveLength(1);
    });

    it.each([404, 405])("sends measurements without falling back to a paid legacy render on status %i", async (status) => {
      fetchMock.mockResolvedValue(ok("{}", status));
      await expect(api.render({ templateId: "floor-full", photos: [photo], floorLayout }))
        .rejects.toMatchObject({ code: "FLOOR_LAYOUT_UNAVAILABLE" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://test.supabase.co/functions/v1/api/v1/generations/floor-layout");
      expect(JSON.parse(init.body.get("floor_layout"))).toEqual(floorLayout);
    });

    it("sends the selected wall mask and room photo to the masked render route", async () => {
      const wallMask = new File(["mask"], "wall-mask.png", { type: "image/png" });
      const room = new File(["room"], "room.png", { type: "image/png" });
      fetchMock.mockResolvedValue(ok("{}", 405));
      await expect(api.render({ templateId: "wall-select", photos: [photo, room], wallMask }))
        .rejects.toMatchObject({ code: "WALL_SELECTION_UNAVAILABLE" });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0];
      expect(url).toBe("https://test.supabase.co/functions/v1/api/v1/generations/selected-wall");
      expect(init.body.getAll("image")).toEqual([photo, room]);
      expect(init.body.get("wall_mask")).toMatchObject({ name: "wall-mask.png", type: "image/png" });
    });

    it("parses a response that starts with keep-alive spaces", async () => {
      fetchMock.mockResolvedValue(ok(`     ${JSON.stringify({ generation: { id: "g1" }, balance: 4, image: "data:image/jpeg;base64,AAA" })}`));
      const res = await api.render({ templateId: "floor-full", photos: [photo] });
      expect(res.image).toBe("data:image/jpeg;base64,AAA");
    });

    it("throws when the stream ends with an error (credits refunded)", async () => {
      fetchMock.mockResolvedValue(ok(`   ${JSON.stringify({ error: { code: "RENDER_FAILED", message: "Failed. Your credits were refunded." } })}`));
      await expect(api.render({ templateId: "floor-full", photos: [photo] })).rejects.toMatchObject({ code: "RENDER_FAILED" });
    });
  });
});
