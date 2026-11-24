// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

async function headersFor(env: string) {
  vi.resetModules();
  vi.stubEnv("NODE_ENV", env);
  const config = (await import("../../next.config.mjs")).default;
  const [rule] = await config.headers();
  vi.unstubAllEnvs();
  return Object.fromEntries(rule.headers.map((h: { key: string; value: string }) => [h.key, h.value])) as Record<string, string>;
}

describe("security headers", () => {
  it("apply to every route", async () => {
    vi.resetModules();
    const config = (await import("../../next.config.mjs")).default;
    const [rule] = await config.headers();
    expect(rule.source).toBe("/:path*");
  });

  it("block framing, sniffing and unneeded browser features", async () => {
    const h = await headersFor("production");
    expect(h["X-Frame-Options"]).toBe("DENY");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    // Camera only for our own pages (tile/room photos); never for embedded third parties.
    expect(h["Permissions-Policy"]).toContain("camera=(self)");
    expect(h["Permissions-Policy"]).toContain("microphone=()");
    expect(h["Strict-Transport-Security"]).toContain("max-age=63072000");
  });

  it("CSP forbids framing, plugins, foreign forms and eval in production", async () => {
    const csp = (await headersFor("production"))["Content-Security-Policy"];
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).toContain("connect-src 'self' https://test.supabase.co");
  });

  it("allows Razorpay Checkout and nothing broader", async () => {
    const h = await headersFor("production");
    const csp = h["Content-Security-Policy"];
    expect(csp).toMatch(/script-src [^;]*https:\/\/checkout\.razorpay\.com/);
    expect(csp).toContain("frame-src 'self' https://api.razorpay.com https://checkout.razorpay.com");
    expect(csp).toMatch(/connect-src [^;]*https:\/\/api\.razorpay\.com/);
    expect(csp).not.toMatch(/\*\.razorpay\.com/);
    expect(h["Permissions-Policy"]).toContain('payment=(self "https://api.razorpay.com")');
    expect(h["Cross-Origin-Opener-Policy"]).toBe("same-origin-allow-popups");
  });

  it("does not force HTTPS on localhost during development", async () => {
    const h = await headersFor("development");
    expect(h["Strict-Transport-Security"]).toBeUndefined();
  });
});
