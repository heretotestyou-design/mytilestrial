import { timingSafeEqual } from "./http.ts";

/** Preserve signed service callbacks when browser API traffic is restricted to the gateway. */
export function gatewayAllows(req: Request, path: string, secret?: string): boolean {
  if (!secret) return true;
  if (req.method === "GET" && path === "/v1/health") return true;
  if (req.method === "POST" && (path === "/v1/billing/webhooks/razorpay" || path.startsWith("/v1/internal/"))) {
    return true;
  }
  const provided = req.headers.get("x-mytiles-gateway");
  return provided !== null && timingSafeEqual(provided, secret);
}
