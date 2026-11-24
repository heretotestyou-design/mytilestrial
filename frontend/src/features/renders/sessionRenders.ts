"use client";

// Renders made in this browser tab. Images are never stored on the server, and here
// they live only in memory (as blob URLs): a refresh or closing the tab clears them,
// so the UI asks people to download each one, and warns before leaving.
import { useSyncExternalStore } from "react";

export type SessionRender = {
  id: string;
  /** blob: URL of the image (valid until the tab is closed or refreshed). */
  src: string;
  title: string;
  createdAt: number;
  downloaded: boolean;
};

let renders: SessionRender[] = [];
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Image type of each blob: URL we made, so downloads can name the file without
// re-fetching it (the CSP's connect-src doesn't allow fetch() of blob: URLs).
const blobTypes = new Map<string, string>();

export function blobToRenderUrl(blob: Blob) {
  const url = URL.createObjectURL(blob);
  blobTypes.set(url, blob.type);
  return url;
}

/** data:image/...;base64,... -> blob: URL (far less memory than keeping the string). */
export function dataUrlToBlobUrl(dataUrl: string) {
  const [head, b64] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? "image/png";
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  return blobToRenderUrl(new Blob([bytes], { type: mime }));
}

export function addSessionRender(r: Omit<SessionRender, "downloaded" | "createdAt"> & { createdAt?: number }) {
  renders = [{ ...r, createdAt: r.createdAt ?? Date.now(), downloaded: false }, ...renders];
  emit();
}

export function markDownloaded(id: string) {
  renders = renders.map((r) => (r.id === id ? { ...r, downloaded: true } : r));
  emit();
}

export const hasUndownloaded = () => renders.some((r) => !r.downloaded);

/** Test helper / sign-out: forget everything and free the blob memory. */
export function clearSessionRenders() {
  renders.forEach((r) => {
    if (r.src.startsWith("blob:")) URL.revokeObjectURL(r.src);
    blobTypes.delete(r.src);
  });
  renders = [];
  emit();
}

export function useSessionRenders() {
  return useSyncExternalStore(subscribe, () => renders, () => renders);
}

/** Saves the image to the user's device and remembers that it was saved. */
export async function downloadRender(r: Pick<SessionRender, "id" | "src" | "title">) {
  // Our own blob: URLs already hold the image: link to them directly. fetch() is only
  // used for anything else (and must be allowed by the CSP).
  let href = r.src;
  let type = blobTypes.get(r.src);
  let temporary = false;
  if (type === undefined) {
    const blob = await fetch(r.src).then((res) => res.blob());
    href = URL.createObjectURL(blob);
    type = blob.type;
    temporary = true;
  }
  const ext = { "image/png": "png", "image/webp": "webp" }[type] ?? "jpg";
  const a = document.createElement("a");
  a.href = href;
  const slug = r.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "render";
  a.download = `mytilestrial-${slug}-${r.id.slice(0, 6)}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Never revoke the render's own URL: it's still on screen.
  if (temporary) setTimeout(() => URL.revokeObjectURL(href), 1000);
  markDownloaded(r.id);
}
