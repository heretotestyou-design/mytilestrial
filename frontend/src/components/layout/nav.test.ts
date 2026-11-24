import { describe, expect, it } from "vitest";
import { DASHBOARD_NAV, isActive } from "./nav";

describe("dashboard navigation", () => {
  it("matches Overview only on the exact path", () => {
    expect(isActive("/dashboard", "/dashboard")).toBe(true);
    expect(isActive("/dashboard", "/dashboard/billing")).toBe(false);
  });

  it("matches sections by prefix", () => {
    expect(isActive("/dashboard/billing", "/dashboard/billing")).toBe(true);
    expect(isActive("/dashboard/settings", "/dashboard/billing")).toBe(false);
  });

  it("only links inside the dashboard", () => {
    for (const item of DASHBOARD_NAV) expect(item.href.startsWith("/dashboard")).toBe(true);
  });
});
