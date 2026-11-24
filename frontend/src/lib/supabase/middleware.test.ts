// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.hoisted(() => vi.fn());
vi.mock("@supabase/ssr", () => ({ createServerClient: () => ({ auth: { getUser } }) }));

import { updateSession } from "./middleware";

const SESSION_COOKIE = "sb-hqmn-auth-token=base64-session";

function req(path: string, { cookie, headers }: { cookie?: string; headers?: Record<string, string> } = {}) {
  return new NextRequest(`http://localhost:3000${path}`, { headers: { ...(cookie ? { cookie } : {}), ...headers } });
}
const location = (res: Response) => res.headers.get("location");

describe("route protection middleware", () => {
  beforeEach(() => getUser.mockReset());

  it("redirects signed-out visitors from the dashboard to login, keeping the destination", async () => {
    const res = await updateSession(req("/dashboard/billing"));
    expect(res.status).toBe(307);
    expect(location(res)).toBe("http://localhost:3000/login?next=%2Fdashboard%2Fbilling");
    expect(getUser).not.toHaveBeenCalled(); // decided without a network call
  });

  it("also blocks in-app (RSC) navigations to the dashboard without a session", async () => {
    const res = await updateSession(req("/dashboard", { headers: { rsc: "1" } }));
    expect(location(res)).toContain("/login?next=%2Fdashboard");
  });

  it("keeps the image pack selection through the login redirect", async () => {
    const res = await updateSession(req("/dashboard/billing?buy=studio"));
    expect(new URL(location(res)!).searchParams.get("next")).toBe("/dashboard/billing?buy=studio");
  });

  it("opens legacy checkout links in the landing page pricing dialog", async () => {
    const response = await updateSession(req("/checkout?buy=studio&price=499900"));
    expect(location(response)).toBe("http://localhost:3000/landing?buy=studio#pricing");
  });

  it("restores the website pricing dialog after authentication", async () => {
    const next = "/?buy=studio#pricing";
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const signedIn = await updateSession(req(`/login?next=${encodeURIComponent(next)}`, { cookie: SESSION_COOKIE }));
    expect(location(signedIn)).toBe(`http://localhost:3000${next}`);
    expect(location(await updateSession(req("/?buy=studio", { cookie: SESSION_COOKIE })))).toBeNull();
  });

  it("uses the dedicated administrator sign-in page", async () => {
    expect(location(await updateSession(req("/admin")))).toBe("http://localhost:3000/admin/login?next=%2Fadmin");
    expect(location(await updateSession(req("/admin/login")))).toBeNull();
  });

  it("serves login instantly to signed-out visitors (no Auth call)", async () => {
    const res = await updateSession(req("/login"));
    expect(location(res)).toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("rejects a session cookie that Supabase no longer accepts", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await updateSession(req("/dashboard", { cookie: SESSION_COOKIE }));
    expect(location(res)).toContain("/login?next=%2Fdashboard");
    expect(getUser).toHaveBeenCalledOnce();
  });

  it("lets a signed-in user into the dashboard", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    const res = await updateSession(req("/dashboard", { cookie: SESSION_COOKIE }));
    expect(location(res)).toBeNull();
  });

  it("sends a signed-in user away from the website home, login and signup", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    for (const path of ["/", "/login", "/signup"]) {
      const res = await updateSession(req(path, { cookie: SESSION_COOKIE }));
      expect(location(res)).toBe("http://localhost:3000/dashboard");
    }
  });

  it("ignores look-alike cookies that aren't a Supabase session", async () => {
    const res = await updateSession(req("/dashboard", { cookie: "auth-token=fake; sb-other=1" }));
    expect(location(res)).toContain("/login");
  });

  it("shows the website to signed-out visitors (no Auth call)", async () => {
    const res = await updateSession(req("/"));
    expect(location(res)).toBeNull();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("shows the website when the session cookie has expired", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await updateSession(req("/", { cookie: SESSION_COOKIE }));
    expect(location(res)).toBeNull();
  });
});
