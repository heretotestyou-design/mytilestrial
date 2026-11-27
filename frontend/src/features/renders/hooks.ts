"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import type { RenderSpace } from "@/lib/render-spaces";
import { useRevalidate } from "@/lib/swr";
import type { FloorPreviewLayout } from "@/lib/types";
import { addSessionRender, blobToRenderUrl, dataUrlToBlobUrl, hasUndownloaded, type SessionRender } from "./sessionRenders";
import { prepareWallEdit } from "./wallEdit";
import type { WallCorners } from "./wallSelection";

export type RenderPhase = "idle" | "rendering";

type PhotoRender = { photos: File[]; templateId: string; space?: RenderSpace["id"]; tileInRoom?: boolean; wallCorners?: WallCorners };
type StartArgs = { templateName: string } & (PhotoRender | { floorPreview: FloorPreviewLayout });
type JobState = { phase: RenderPhase; result: SessionRender | null; error: string | null; floorPreview: FloorPreviewLayout | null; previewVisible: boolean };

// The job lives outside React, so leaving the page mid-render (or coming back later)
// keeps "Rendering…", the result and any error instead of resetting them.
const IDLE: JobState = { phase: "idle", result: null, error: null, floorPreview: null, previewVisible: false };
let job = IDLE;
const listeners = new Set<() => void>();
const setJob = (next: Partial<JobState>) => {
  job = { ...job, ...next };
  listeners.forEach((l) => l());
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

/** Test helper / sign-out. */
export const resetRenderJob = () => setJob(IDLE);

/** A different Studio workspace should start without the previous job's preview. */
export function clearStudioPreview() {
  if (!job.floorPreview && job.previewVisible) setJob({ previewVisible: false });
}

/** Runs one render: send photos -> wait for the image (credits charged, refunded on failure). */
export function useRenderJob(mode: "studio" | "floor-preview" = "studio") {
  const toast = useToast();
  const revalidate = useRevalidate();
  const state = useSyncExternalStore(subscribe, () => job, () => job);

  const start = useCallback(
    async (input: StartArgs) => {
      if (job.phase === "rendering") return; // never start a second, paid render by accident
      const floorPreview = "floorPreview" in input ? input.floorPreview : null;
      setJob({ phase: "rendering", result: null, error: null, floorPreview, previewVisible: true });
      // Balance drops as soon as the render starts; show it.
      setTimeout(() => void revalidate("me"), 1500);
      try {
        const key = crypto.randomUUID();
        const image = "floorPreview" in input
          ? await previewResult(await api.floorPreview(input.floorPreview, key))
          : await renderPhotos(input, key);
        const { templateName } = input;
        const render = { ...image, title: templateName };
        addSessionRender(render);
        setJob({ phase: "idle", result: { ...render, createdAt: Date.now(), downloaded: false } });
        toast("Your render is ready. Download it to keep it.");
      } catch (e) {
        const message = e instanceof Error ? e.message : "Couldn't create the render.";
        setJob({ phase: "idle", error: message });
        toast(message, "error");
      } finally {
        void revalidate("me", "transactions");
      }
    },
    [revalidate, toast],
  );

  const showPreview = state.previewVisible && (mode === "floor-preview") === Boolean(state.floorPreview);
  return {
    phase: state.phase,
    busy: state.phase !== "idle",
    rendering: showPreview && state.phase === "rendering",
    result: showPreview ? state.result : null,
    error: showPreview ? state.error : null,
    floorPreview: showPreview ? state.floorPreview : null,
    start,
  };
}

async function previewResult(response: Awaited<ReturnType<typeof api.render>>, compose?: (image: string) => Promise<Blob>) {
  if (!response.image) throw new Error("This render was already started. Please try again.");
  const src = compose ? blobToRenderUrl(await compose(response.image)) : dataUrlToBlobUrl(response.image);
  return { id: response.generation.id, src };
}

async function renderPhotos({ photos, templateId, space, tileInRoom, wallCorners }: PhotoRender, key: string) {
  const room = photos[1];
  if (wallCorners && !room) throw new Error("Add a room photo before selecting a wall.");
  const wall = wallCorners && room ? await prepareWallEdit(room, wallCorners) : undefined;
  const response = await api.render({
    templateId,
    photos: wall ? [photos[0], wall.room] : photos,
    tileInRoom,
    ...(space && { space }),
    ...(wall && { wallMask: wall.mask }),
  }, key);
  return await previewResult(response, wall?.compose);
}

// Studio choices (photos, toggles) also survive leaving the page; a refresh clears them.
const remembered = new Map<string, unknown>();

/** useState that keeps its value across unmounts for the rest of this tab's session. */
export function useRememberedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => (remembered.has(key) ? (remembered.get(key) as T) : initial));
  useEffect(() => {
    remembered.set(key, value);
  }, [key, value]);
  return [value, setValue] as const;
}

/** Browser "Leave site?" prompt while some renders haven't been downloaded. */
export function useLeaveWarning() {
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUndownloaded()) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);
}
