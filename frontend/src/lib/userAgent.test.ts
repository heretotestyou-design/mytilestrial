import { describe, expect, it } from "vitest";
import { parseUserAgent, timeAgo } from "./userAgent";

const UA = {
  macChrome: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36",
  iphoneSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  winEdge: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36 Edg/130.0.0.0",
  androidFirefox: "Mozilla/5.0 (Android 14; Mobile; rv:131.0) Gecko/131.0 Firefox/131.0",
  ipad: "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
};

describe("parseUserAgent", () => {
  it("recognises common browsers and systems", () => {
    expect(parseUserAgent(UA.macChrome)).toEqual({ browser: "Chrome", os: "Mac", mobile: false });
    expect(parseUserAgent(UA.iphoneSafari)).toEqual({ browser: "Safari", os: "iPhone", mobile: true });
    expect(parseUserAgent(UA.winEdge)).toEqual({ browser: "Edge", os: "Windows", mobile: false });
    expect(parseUserAgent(UA.androidFirefox)).toEqual({ browser: "Firefox", os: "Android", mobile: true });
  });

  it("treats tablets as non-mobile", () => {
    expect(parseUserAgent(UA.ipad).mobile).toBe(false);
  });

  it("handles a missing user agent", () => {
    expect(parseUserAgent(null)).toEqual({ browser: "Unknown browser", os: "Unknown device", mobile: false });
  });
});

describe("timeAgo", () => {
  const now = Date.parse("2026-11-16T12:00:00Z");
  it.each([
    ["2026-11-16T11:59:30Z", "Just now"],
    ["2026-11-16T11:45:00Z", "15 min ago"],
    ["2026-11-16T09:00:00Z", "3 h ago"],
    ["2026-11-15T10:00:00Z", "Yesterday"],
  ])("%s -> %s", (iso, expected) => {
    expect(timeAgo(iso, now)).toBe(expected);
  });
});
