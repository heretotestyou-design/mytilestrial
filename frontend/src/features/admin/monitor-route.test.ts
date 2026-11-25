import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/admin/(workspace)/monitor/status/route";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getSession } }),
}));

const fetchMock = vi.fn();

describe("admin health monitor status", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    getSession.mockResolvedValue({ data: { session: { access_token: "test-account-token" } } });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("rejects signed-out visitors before fetching monitor information", async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const response = await GET();
    expect(response.status).toBe(401);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not retrieve history when the existing API denies admin access", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ error: { code: "FORBIDDEN" } }, { status: 403 }));
    const response = await GET();
    expect(response.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://test.supabase.co/functions/v1/api/v1/admin/access");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer test-account-token");
  });

  it("serves filtered monitor runs to authorized administrators", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ allowed: true }));
    fetchMock.mockResolvedValueOnce(Response.json({ workflow_runs: [
      { id: 10, status: "completed", conclusion: "success", created_at: "2026-11-24T03:37:00Z" },
      { id: 9, status: "completed", conclusion: "failure", created_at: "2026-11-24T02:17:00Z" },
      { id: 8, status: "completed", created_at: "bad date" },
    ] }));
    const response = await GET();
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.runs.map((run: { status: string }) => run.status)).toEqual(["passed", "issues"]);
    expect(data.runs[0].url).toBe("https://github.com/heretotestyou-design/mytilestrial/actions/runs/10");
    expect(fetchMock.mock.calls[1][1].headers.Authorization).toBeUndefined();
  });
});
