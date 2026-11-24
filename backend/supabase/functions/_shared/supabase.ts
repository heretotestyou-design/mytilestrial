// Supabase clients and authentication.
import { createClient, type SupabaseClient } from "jsr:@supabase/supabase-js@2";
import { createLocalJWKSet, createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "npm:jose@5.9.6";
import { ApiError, Errors, timingSafeEqual } from "./http.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Service-role client. Bypasses RLS — only use after authorising the caller. */
export const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export type AuthUser = { id: string; email?: string; /** Supabase Auth session = one signed-in device. */ sessionId?: string };

/** Maximum signed-in devices per account. */
export const MAX_DEVICES = Number(Deno.env.get("MAX_DEVICES") ?? 3);

// Revoked devices: their access token is still cryptographically valid until it
// expires, so check the session still exists. Cached per instance for 60 s, so a
// revoked device is locked out within about a minute at almost no cost per request.
const SESSION_TTL_MS = 60_000;
const sessionCache = new Map<string, { active: boolean; at: number }>();

export function forgetSession(sessionId: string) {
  sessionCache.delete(sessionId);
}

async function assertSessionActive(userId: string, sessionId: string) {
  const hit = sessionCache.get(sessionId);
  let active = hit && Date.now() - hit.at < SESSION_TTL_MS ? hit.active : undefined;
  if (active === undefined) {
    // Also trims the account to MAX_DEVICES, so the limit holds even for clients
    // that never open the dashboard.
    const { data, error } = await admin.rpc("touch_session", { p_user_id: userId, p_session_id: sessionId, p_max: MAX_DEVICES });
    if (error) {
      console.error("touch_session failed", error);
      // Fail closed: never let a possibly revoked device through.
      throw new ApiError(503, "SERVICE_UNAVAILABLE", "We couldn't verify your session. Please try again.");
    }
    active = Boolean(data);
    if (sessionCache.size > 5000) sessionCache.clear();
    sessionCache.set(sessionId, { active, at: Date.now() });
  }
  if (!active) throw new ApiError(401, "SESSION_REVOKED", "You've been signed out on this device.");
}

// Verify access tokens locally with the project's signing keys instead of a network
// round trip to Supabase Auth on every request (~300 ms saved per API call).
// SUPABASE_JWKS is provided to hosted functions; otherwise the public JWKS is fetched once.
let jwks: JWTVerifyGetKey | null = null;
function getJwks(): JWTVerifyGetKey {
  if (jwks) return jwks;
  try {
    const raw = Deno.env.get("SUPABASE_JWKS");
    if (raw) {
      const parsed = JSON.parse(raw);
      const set = Array.isArray(parsed) ? { keys: parsed } : parsed.keys ? parsed : { keys: [parsed] };
      if (set.keys.length > 0) return (jwks = createLocalJWKSet(set));
    }
  } catch (e) {
    console.warn("Couldn't parse SUPABASE_JWKS; using the remote key set", e);
  }
  return (jwks = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`)));
}

/** Verifies the bearer token and returns the signed-in user, or throws 401. */
export async function requireUser(req: Request): Promise<AuthUser> {
  const header = req.headers.get("authorization") ?? "";
  const token = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  if (!token) throw Errors.unauthorized();

  try {
    const { payload } = await jwtVerify(token, getJwks(), {
      issuer: `${SUPABASE_URL}/auth/v1`,
      audience: "authenticated",
    });
    if (typeof payload.sub === "string" && payload.role === "authenticated") {
      const sessionId = typeof payload.session_id === "string" ? payload.session_id : undefined;
      if (sessionId) await assertSessionActive(payload.sub, sessionId);
      return { id: payload.sub, email: typeof payload.email === "string" ? payload.email : undefined, sessionId };
    }
  } catch (e) {
    if (e instanceof ApiError) throw e;
    // Legacy (HS256) or otherwise unverifiable here: ask Supabase Auth below.
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw Errors.unauthorized();
  return { id: data.user.id, email: data.user.email };
}

/** Guards internal routes (e.g. called by the image engine) with a shared secret. */
export function requireInternal(req: Request): void {
  const secret = Deno.env.get("INTERNAL_API_SECRET");
  const given = req.headers.get("x-internal-secret");
  if (!secret || !given || !timingSafeEqual(given, secret)) throw Errors.forbidden();
}

/** Test-mode purchases are limited to these emails (TEST_PAYMENT_EMAILS, comma separated). */
export function isTestPaymentUser(email: string | undefined): boolean {
  if (!email) return false;
  const allowed = (Deno.env.get("TEST_PAYMENT_EMAILS") ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return allowed.includes(email.toLowerCase());
}
