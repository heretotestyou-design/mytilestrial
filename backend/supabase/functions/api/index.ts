// MyTilesTrial API — a single Supabase Edge Function with versioned routes.
// Base URL: {SUPABASE_URL}/functions/v1/api
//
// See backend/README.md for the full endpoint reference.
import { gatewayAllows } from "../_shared/gateway.ts";
import { Router } from "../_shared/router.ts";
import { corsHeaders, errorResponse, json, ApiError } from "../_shared/http.ts";
import { accountRoutes } from "./routes/account.ts";
import { billingRoutes } from "./routes/billing.ts";
import { generationRoutes } from "./routes/generations.ts";
import { sessionRoutes } from "./routes/sessions.ts";
import { adminRoutes } from "./routes/admin.ts";
import { guestCheckoutRoutes } from "./routes/guest-checkout.ts";

const router = new Router();
const gatewaySecret = Deno.env.get("API_GATEWAY_SHARED_SECRET");

router.get("/v1/health", ({ req }) => json(req, { status: "ok", time: new Date().toISOString() }));
accountRoutes(router);
billingRoutes(router);
generationRoutes(router);
sessionRoutes(router);
adminRoutes(router);
guestCheckoutRoutes(router);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders(req) });
  }

  try {
    const url = new URL(req.url);
    // Works both locally and hosted: strip "/functions/v1" and the function name.
    const path = url.pathname.replace(/^\/functions\/v1/, "").replace(/^\/api/, "") || "/";

    if (!gatewayAllows(req, path, gatewaySecret)) {
      throw new ApiError(403, "GATEWAY_REQUIRED", "Use the MyTilesTrial API gateway.");
    }

    const match = router.match(req.method, path);
    if ("error" in match) {
      throw match.error === 405
        ? new ApiError(405, "METHOD_NOT_ALLOWED", `${req.method} is not allowed on ${path}.`)
        : new ApiError(404, "NOT_FOUND", `No route for ${req.method} ${path}.`);
    }

    return await match.handler({ req, url, params: match.params });
  } catch (err) {
    return errorResponse(req, err);
  }
});
