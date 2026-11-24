// HTTP helpers: CORS, JSON responses, typed API errors.

const ALLOWED_ORIGINS = (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:3000")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allow = ALLOWED_ORIGINS.includes("*") || ALLOWED_ORIGINS.includes(origin)
    ? origin || "*"
    : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, idempotency-key, x-internal-secret",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const Errors = {
  unauthorized: () => new ApiError(401, "UNAUTHORIZED", "Sign in to continue."),
  forbidden: () => new ApiError(403, "FORBIDDEN", "You don't have access to this resource."),
  notFound: (what = "Resource") => new ApiError(404, "NOT_FOUND", `${what} not found.`),
  badRequest: (message: string, details?: unknown) =>
    new ApiError(400, "BAD_REQUEST", message, details),
};

/** Postgres error codes raised by our SQL functions → HTTP errors. */
const DB_ERRORS: Record<string, [number, string]> = {
  INSUFFICIENT_CREDITS: [402, "You don't have enough images left for this render."],
  SPEND_LIMIT_EXCEEDED: [409, "This purchase would exceed your monthly spend limit."],
  INVALID_SPEND_LIMIT: [400, "Spend limit must be between ₹0 and ₹10,00,000."],
  PACK_NOT_FOUND: [404, "Image pack not found."],
  PRICE_CHANGED: [409, "The price has changed. Review the current price before paying."],
  CHECKOUT_RATE_LIMIT: [429, "Too many checkout attempts. Wait a few minutes before trying again."],
  PAYMENT_NOT_FOUND: [404, "Payment not found."],
  PAYMENT_NOT_PENDING: [409, "This payment is no longer pending."],
  WALLET_NOT_FOUND: [404, "Wallet not found."],
  INVALID_GENERATION_TYPE: [400, "Unknown render type."],
  GENERATION_NOT_FOUND: [404, "Render not found."],
  GENERATION_NOT_ACTIVE: [409, "This render has already finished."],
  INVALID_STATUS: [400, "Invalid status."],
  FREE_PLAN_ALREADY_CLAIMED: [409, "You've already claimed the free plan."],
  FREE_PLAN_UNAVAILABLE: [404, "The free plan isn't available right now."],
};

export function fromDbError(error: { message?: string; code?: string }): ApiError {
  const key = (error.message ?? "").trim();
  const mapped = DB_ERRORS[key];
  if (mapped) return new ApiError(mapped[0], key, mapped[1]);
  console.error("Unhandled database error", error);
  return new ApiError(500, "INTERNAL", "Something went wrong. Please try again.");
}

export function json(req: Request, data: unknown, status = 200, cacheControl = "no-store"): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders(req),
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": cacheControl,
    },
  });
}

export function errorResponse(req: Request, err: unknown): Response {
  if (err instanceof ApiError) {
    return json(req, { error: { code: err.code, message: err.message, details: err.details } }, err.status);
  }
  console.error("Unhandled error", err);
  return json(req, { error: { code: "INTERNAL", message: "Something went wrong. Please try again." } }, 500);
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    const text = await req.text();
    return text ? JSON.parse(text) : {};
  } catch {
    throw Errors.badRequest("Request body must be valid JSON.");
  }
}

/** Constant-time string comparison (no early exit that leaks how much matched). */
export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
