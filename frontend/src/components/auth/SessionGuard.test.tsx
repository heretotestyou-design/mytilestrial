import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";

const getSession = vi.fn();
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession } }) }));
const { SessionGuard } = await import("./SessionGuard");

const replace = vi.fn();
const realLocation = window.location;
beforeEach(() => {
  replace.mockReset();
  getSession.mockReset();
  Object.defineProperty(window, "location", { configurable: true, value: { ...realLocation, replace } });
});
afterEach(() => Object.defineProperty(window, "location", { configurable: true, value: realLocation }));

const signedIn = () => getSession.mockResolvedValue({ data: { session: { access_token: "t" } } });
const signedOut = () => getSession.mockResolvedValue({ data: { session: null } });

describe("SessionGuard", () => {
  it("sends a signed-in visitor from the website to the dashboard", async () => {
    signedIn();
    render(<SessionGuard when="signed-in" to="/dashboard" />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("leaves signed-out visitors on the website", async () => {
    signedOut();
    render(<SessionGuard when="signed-in" to="/dashboard" />);
    await waitFor(() => expect(getSession).toHaveBeenCalled());
    expect(replace).not.toHaveBeenCalled();
  });

  it("re-checks when Chrome restores the page from the back/forward cache", async () => {
    signedOut();
    render(<SessionGuard when="signed-out" to="/login" />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/login"));
    replace.mockReset();
    signedIn();
    render(<SessionGuard when="signed-in" to="/dashboard" />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
    replace.mockReset();
    const ev = new Event("pageshow") as PageTransitionEvent;
    Object.defineProperty(ev, "persisted", { value: true });
    window.dispatchEvent(ev);
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/dashboard"));
  });
});
