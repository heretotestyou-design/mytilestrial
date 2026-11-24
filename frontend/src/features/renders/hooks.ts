"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import type { RenderSpace } from "@/lib/render-spaces";
import { useRevalidate } from "@/lib/swr";
import type { FloorLayout } from "@/lib/types";
import { addSessionRender, blobToRenderUrl, dataUrlToBlobUrl, hasUndownloaded, type SessionRender } from "./sessionRenders";
import { prepareWallEdit } from "./wallEdit";
import type { WallCorners } from "./wallSelection";

export type RenderPhase = "idle" | "rendering";

type StartArgs = { photos: File[]; templateId: string; templateName: string; space?: RenderSpace["id"]; tileInRoom?: boolean; floorLayout?: FloorLayout; wallCorners?: WallCorners };
type JobState = { phase: RenderPhase; result: SessionRender | null; error: string | null };

// The job lives outside React, so leaving the page mid-render (or coming back later)
// keeps "Rendering…", the result and any error instead of resetting them.
let job: JobState = { phase: "idle", result: null, error: null };
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
export const resetRenderJob = () => setJob({ phase: "idle", result: null, error: null });

/** Runs one render: send photos -> wait for the image (credits charged, refunded on failure). */
export function useRenderJob() {
  const toast = useToast();
  const revalidate = useRevalidate();
  const state = useSyncExternalStore(subscribe, () => job, () => job);

  const start = useCallback(
    async ({ photos, templateId, templateName, space, tileInRoom, floorLayout, wallCorners }: StartArgs) => {
      if (job.phase === "rendering") return; // never start a second, paid render by accident
      setJob({ phase: "rendering", result: null, error: null });
      // Balance drops as soon as the render starts; show it.
      setTimeout(() => void revalidate("me"), 1500);
      try {
        const room = photos[1];
        if (wallCorners && !room) throw new Error("Add a room photo before selecting a wall.");
        const wall = wallCorners && room ? await prepareWallEdit(room, wallCorners) : undefined;
        const res = await api.render({
          templateId,
          photos: wall ? [photos[0], wall.room] : photos,
          tileInRoom,
          ...(space && { space }),
          ...(floorLayout && { floorLayout }),
          ...(wall && { wallMask: wall.mask }),
        }, crypto.randomUUID());
        if (!res.image) throw new Error("This render was already started. Please try again.");
        const src = wall ? blobToRenderUrl(await wall.compose(res.image)) : dataUrlToBlobUrl(res.image);
        const render = { id: res.generation.id, src, title: templateName };
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

  return { phase: state.phase, busy: state.phase !== "idle", result: state.result, error: state.error, start };
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
