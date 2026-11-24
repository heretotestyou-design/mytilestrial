import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

const isBrowser = typeof window !== "undefined";

afterEach(() => {
  if (!isBrowser) return;
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
});

// jsdom lacks these browser APIs used by the UI.
if (isBrowser) {
  if (!URL.createObjectURL) URL.createObjectURL = () => "blob:test";
  if (!URL.revokeObjectURL) URL.revokeObjectURL = () => {};
  if (!window.matchMedia) {
    window.matchMedia = (q: string) =>
      ({ matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent: () => false }) as MediaQueryList;
  }
}
