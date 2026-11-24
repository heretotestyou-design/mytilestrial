import { beforeEach, describe, expect, it, vi } from "vitest";
import { addSessionRender, clearSessionRenders, dataUrlToBlobUrl, downloadRender, hasUndownloaded, markDownloaded } from "./sessionRenders";

describe("session-only render store (images are never stored server-side)", () => {
  beforeEach(() => clearSessionRenders());

  it("tracks renders that still need downloading", () => {
    expect(hasUndownloaded()).toBe(false);
    addSessionRender({ id: "r1", src: "blob:1", title: "Full floor" });
    expect(hasUndownloaded()).toBe(true);
    markDownloaded("r1");
    expect(hasUndownloaded()).toBe(false);
  });

  it("forgets everything when cleared (e.g. on refresh / sign-out)", () => {
    addSessionRender({ id: "r1", src: "blob:1", title: "Full floor" });
    clearSessionRenders();
    expect(hasUndownloaded()).toBe(false);
  });

  it("turns the returned data URL into a blob URL", () => {
    expect(dataUrlToBlobUrl("data:image/jpeg;base64,/9j/4AAQ")).toMatch(/^blob:/);
  });

  it("downloads a render without fetch() (the CSP blocks fetching blob: URLs)", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const revoke = vi.spyOn(URL, "revokeObjectURL");
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });
    const src = dataUrlToBlobUrl("data:image/png;base64,iVBORw0KGgo=");
    addSessionRender({ id: "abcdef123", src, title: "Full floor" });

    await downloadRender({ id: "abcdef123", src, title: "Full floor" });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(clicked[0].href).toBe(src);
    expect(clicked[0].download).toBe("mytilestrial-full-floor-abcdef.png");
    expect(revoke).not.toHaveBeenCalledWith(src); // still shown on screen
    expect(hasUndownloaded()).toBe(false);
  });
});
