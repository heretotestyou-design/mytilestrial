import { afterEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import useSWR from "swr";
import { mockSupabaseAuth, stubLocation } from "@/test/mocks";

const auth = vi.hoisted(() => ({ current: null as ReturnType<typeof import("@/test/mocks").mockSupabaseAuth> | null }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: auth.current }) }));

type ApiErrorCtor = typeof import("./api").ApiError;

async function renderWithFailingFetch(makeError: (E: ApiErrorCtor) => unknown) {
  // Fresh modules per test: the "already ending" guard is module state. The error must be
  // built from the same fresh copy of ApiError that swr.tsx checks with instanceof.
  vi.resetModules();
  const { DataProvider } = await import("./swr");
  const { ApiError } = await import("./api");
  const error = makeError(ApiError);
  function Probe() {
    useSWR("probe", () => Promise.reject(error), { shouldRetryOnError: false });
    return null;
  }
  render(
    <DataProvider>
      <Probe />
    </DataProvider>,
  );
}

describe("Forced sign-out when the server rejects the session", () => {
  let restore = () => {};
  afterEach(() => restore());

  it("signs out locally and explains a revoked device", async () => {
    auth.current = mockSupabaseAuth();
    const loc = stubLocation("/dashboard/billing");
    restore = loc.restore;
    sessionStorage.setItem("mtt.swr.me", "{}");
    await renderWithFailingFetch((E) => new E(401, "SESSION_REVOKED", "Signed out"));

    await waitFor(() => expect(loc.loc.href).toBe("/login?next=%2Fdashboard%2Fbilling&reason=signed_out"));
    expect(auth.current.signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(sessionStorage.getItem("mtt.swr.me")).toBeNull();
  });

  it("sends an expired session to login without a reason", async () => {
    auth.current = mockSupabaseAuth();
    const loc = stubLocation("/dashboard");
    restore = loc.restore;
    await renderWithFailingFetch((E) => new E(401, "UNAUTHORIZED", "Sign in"));

    await waitFor(() => expect(loc.loc.href).toBe("/login?next=%2Fdashboard"));
  });

  it("does not sign out on other errors", async () => {
    auth.current = mockSupabaseAuth();
    const loc = stubLocation("/dashboard");
    restore = loc.restore;
    await renderWithFailingFetch((E) => new E(500, "INTERNAL", "Oops"));

    await new Promise((r) => setTimeout(r, 50));
    expect(auth.current.signOut).not.toHaveBeenCalled();
    expect(loc.loc.href).toBe("http://localhost/dashboard");
  });
});
