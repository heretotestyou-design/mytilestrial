import { describe, expect, it } from "vitest";
import { safeNext } from "./safeRedirect";

describe("safeNext (open-redirect protection)", () => {
  it.each([
    ["/dashboard/billing", "/dashboard/billing"],
    ["/dashboard?tab=create#top", "/dashboard?tab=create#top"],
  ])("keeps same-site path %s", (input, expected) => {
    expect(safeNext(input)).toBe(expected);
  });

  it.each([
    [null],
    [undefined],
    [""],
    ["dashboard"],
    ["//evil.com"],
    ["//evil.com/dashboard"],
    ["/\\evil.com"],
    ["/\\/evil.com"],
    ["https://evil.com"],
    ["javascript:alert(1)"],
  ])("falls back to /dashboard for %s", (input) => {
    expect(safeNext(input)).toBe("/dashboard");
  });

  it("uses a custom fallback", () => {
    expect(safeNext("//evil.com", "/login")).toBe("/login");
  });
});
