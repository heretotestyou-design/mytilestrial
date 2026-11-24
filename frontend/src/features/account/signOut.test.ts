import { afterEach, describe, expect, it, vi } from "vitest";
import { mockSupabaseAuth, stubLocation } from "@/test/mocks";

const auth = vi.hoisted(() => ({ current: null as ReturnType<typeof import("@/test/mocks").mockSupabaseAuth> | null }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: auth.current }) }));

import { signOut } from "./signOut";

describe("Logout", () => {
  let restore = () => {};
  afterEach(() => restore());

  it("ends the session, wipes cached account data and returns to login", async () => {
    auth.current = mockSupabaseAuth();
    const loc = stubLocation("/dashboard/settings");
    restore = loc.restore;
    sessionStorage.setItem("mtt.swr.me", JSON.stringify({ wallet: { balance: 9 } }));
    sessionStorage.setItem("mtt.swr.transactions:5", "[]");
    sessionStorage.setItem("unrelated", "keep");

    await signOut();

    expect(auth.current.signOut).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem("mtt.swr.me")).toBeNull();
    expect(sessionStorage.getItem("mtt.swr.transactions:5")).toBeNull();
    expect(sessionStorage.getItem("unrelated")).toBe("keep");
    expect(loc.loc.href).toBe("/login");
  });

  it("still signs out locally and goes to login when the network call fails", async () => {
    auth.current = mockSupabaseAuth();
    auth.current.signOut.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ error: null });
    const loc = stubLocation("/dashboard");
    restore = loc.restore;

    await signOut();

    expect(auth.current.signOut).toHaveBeenLastCalledWith({ scope: "local" });
    expect(loc.loc.href).toBe("/login");
  });
});
