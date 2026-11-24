import { vi } from "vitest";

/** A Supabase browser client whose auth methods are all spies. */
export function mockSupabaseAuth() {
  return {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    resend: vi.fn().mockResolvedValue({ error: null }),
    verifyOtp: vi.fn(),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: "t" } } }),
  };
}

/** Replace window.location with a writable stub (jsdom can't navigate). */
export function stubLocation(pathname = "/dashboard") {
  const original = window.location;
  const loc = { href: `http://localhost${pathname}`, pathname, origin: "http://localhost", search: "" };
  Object.defineProperty(window, "location", { value: loc, writable: true, configurable: true });
  return {
    loc,
    restore: () => Object.defineProperty(window, "location", { value: original, writable: true, configurable: true }),
  };
}
