// Typed client for the MyTilesTrial API (Supabase Edge Function "api").
import type { RenderSpace } from "./render-spaces";
import { createClient } from "@/lib/supabase/client";
import type {
  Account,
  AdminOverview,
  AdminAnalytics,
  AdminPeriod,
  AdminSummary,
  AdminUser,
  Catalog,
  DeviceSession,
  Checkout,
  CheckoutContact,
  CheckoutDetails,
  CreditPack,
  CreditTransaction,
  FloorLayout,
  FloorPreviewLayout,
  Generation,
  Page,
  Payment,
} from "@/lib/types";

const BASE =
  process.env.NEXT_PUBLIC_API_URL ?? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/api`;

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

type Options = { method?: string; body?: unknown; auth?: boolean; headers?: Record<string, string> };

async function request<T>(path: string, { method = "GET", body, auth = true, headers = {} }: Options = {}): Promise<T> {
  const h: Record<string, string> = {
    apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    ...headers,
  };
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isForm) h["Content-Type"] = "application/json";

  if (auth) {
    const { data } = await createClient().auth.getSession();
    const token = data.session?.access_token;
    if (!token) throw new ApiError(401, "UNAUTHORIZED", "Please sign in again.");
    h.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: h,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
      cache: !auth && method === "GET" ? "default" : "no-store",
    });
  } catch {
    throw new ApiError(0, "NETWORK", "Can't reach the server. Check your connection.");
  }

  // Long responses (renders) may start with keep-alive spaces; JSON.parse ignores them.
  const text = await res.text();
  let data: unknown = {};
  try {
    data = text.trim() ? JSON.parse(text) : {};
  } catch {
    data = {};
  }
  // Errors can also arrive in the body of a 200 streamed response.
  const e = (data as { error?: { code?: string; message?: string; details?: unknown } }).error;
  if (!res.ok || e) {
    throw new ApiError(res.ok ? 422 : res.status, e?.code ?? "ERROR", e?.message ?? "Something went wrong.", e?.details);
  }
  return data as T;
}

const qs = (p: Record<string, string | number | undefined | null>) => {
  const s = new URLSearchParams();
  Object.entries(p).forEach(([k, v]) => v != null && s.set(k, String(v)));
  const str = s.toString();
  return str ? `?${str}` : "";
};

export const api = {
  health: () => request<{ status: string }>("/v1/health", { auth: false }),
  catalog: () => request<Catalog>("/v1/catalog", { auth: false }),

  me: () => request<Account>("/v1/me"),
  updateProfile: (body: { full_name?: string | null; company?: string | null; phone?: string | null }) =>
    request<Account>("/v1/me", { method: "PATCH", body }),
  setSpendLimit: (monthly_limit_inr: number) =>
    request<Account>("/v1/spend-limit", { method: "PUT", body: { monthly_limit_inr } }),
  transactions: (p: { limit?: number; before?: string | null } = {}) =>
    request<Page<CreditTransaction>>(`/v1/credits/transactions${qs(p)}`),

  /** ₹1 developer packs; [] unless this account is an allow-listed tester. */
  testPacks: () => request<{ packs: CreditPack[] }>("/v1/billing/test-packs"),
  checkoutContact: (mode?: "website") => request<CheckoutContact>(`/v1/billing/checkout-contact${qs({ mode })}`),
  checkout: (pack_id: string, options?: { expected_amount_paise: number; details?: CheckoutDetails }) =>
    request<Checkout>("/v1/billing/checkout", { method: "POST", body: { pack_id, ...options } }),
  guestCheckout: (details: { pack_id: string; expected_amount_paise: number; full_name: string; company: string; email: string; phone: string }) =>
    request<{ id: string; access: string; key_id: string; order_id: string; amount: number; currency: string; name: string }>(
      "/v1/billing/guest-checkout", { method: "POST", auth: false, body: details },
    ),
  confirmGuestCheckout: (id: string, access: string, evidence?: { provider_payment_id: string; provider_order_id: string; signature: string }) =>
    request<{ status: "paid"; activation: "sent" | "existing" | "pending" }>(`/v1/billing/guest-checkout/${encodeURIComponent(id)}/confirm`, {
      method: "POST", auth: false, body: { access, evidence },
    }),
  payment: (id: string) => request<{ payment: Payment }>(`/v1/billing/payments/${encodeURIComponent(id)}`),
  confirmPayment: (id: string, body: { provider_payment_id?: string; provider_order_id?: string; signature?: string } = {}) =>
    request<{ payment: Payment }>(`/v1/billing/payments/${id}/confirm`, { method: "POST", body }),
  cancelPayment: (id: string) =>
    request<{ payment: Payment }>(`/v1/billing/payments/${id}/cancel`, { method: "POST", body: {} }),
  payments: (p: { limit?: number; before?: string | null } = {}) =>
    request<Page<Payment>>(`/v1/billing/payments${qs(p)}`),
  adminAccess: () => request<{ allowed: true }>("/v1/admin/access"),
  adminOverview: () => request<AdminOverview>("/v1/admin/overview"),
  adminSummary: () => request<AdminSummary>("/v1/admin/overview?view=summary"),
  adminAnalytics: (days: AdminPeriod) => request<AdminAnalytics>(`/v1/admin/analytics${qs({ days })}`),
  adminUsers: (q: string, offset: number) =>
    request<{ users: AdminUser[]; next_offset: number | null }>(`/v1/admin/users${qs({ q, offset })}`),
  adminUpdateUser: (id: string, body: Pick<AdminUser, "full_name" | "company" | "phone">) =>
    request<{ id: string }>(`/v1/admin/users/${encodeURIComponent(id)}`, { method: "PATCH", body }),
  adminSyncSheet: () => request<{ synced: number }>("/v1/admin/sheets/sync", { method: "POST" }),

  /** Renders and returns the image as a data URL (nothing is stored server-side). */
  render: (input: { templateId: string; photos: File[]; space?: RenderSpace["id"]; tileInRoom?: boolean; floorLayout?: FloorLayout; wallMask?: File; type?: string }, idempotencyKey?: string) => {
    const form = new FormData();
    form.set("template_id", input.templateId);
    form.set("type", input.type ?? "standard");
    if (input.space) form.set("space", input.space);
    if (input.tileInRoom !== undefined) form.set("tile_in_room", String(input.tileInRoom));
    if (input.floorLayout) form.set("floor_layout", JSON.stringify(input.floorLayout));
    if (input.wallMask) form.set("wall_mask", input.wallMask, input.wallMask.name);
    input.photos.forEach((p) => form.append("image", p, p.name));
    // A separate endpoint prevents an older server from charging for a render
    // that would ignore the requested layout.
    const path = input.wallMask ? "/v1/generations/selected-wall"
      : input.floorLayout ? "/v1/generations/floor-layout" : "/v1/generations";
    return request<{ generation: Generation; balance: number; image: string | null }>(path, {
      method: "POST",
      body: form,
      headers: idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {},
    }).catch((error: unknown) => {
      if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
        if (input.wallMask) throw new ApiError(404, "WALL_SELECTION_UNAVAILABLE", "The render server doesn't support wall selection yet.");
        if (input.floorLayout) throw new ApiError(404, "FLOOR_LAYOUT_UNAVAILABLE", "The render server doesn't support measured floor layouts yet.");
      }
      throw error;
    });
  },
  floorPreview: (layout: FloorPreviewLayout, idempotencyKey: string) =>
    request<{ generation: Generation; balance: number; image: string | null }>("/v1/generations/floor-preview", {
      method: "POST",
      body: layout,
      headers: { "Idempotency-Key": idempotencyKey },
    }).catch((error: unknown) => {
      if (error instanceof ApiError && (error.status === 404 || error.status === 405)) {
        throw new ApiError(error.status, "FLOOR_PREVIEW_UNAVAILABLE", "This API needs an update before it can generate floor previews.");
      }
      throw error;
    }),
  claimFreePlan: () => request<Account>("/v1/billing/free-plan", { method: "POST", body: {} }),
  generations: (p: { limit?: number; before?: string | null } = {}) =>
    request<Page<Generation>>(`/v1/generations${qs(p)}`),
  sessions: () => request<{ sessions: DeviceSession[]; max_devices: number }>("/v1/sessions"),
  revokeSession: (id: string) => request<{ revoked: number }>(`/v1/sessions/${id}`, { method: "DELETE" }),
  revokeOtherSessions: () => request<{ revoked: number }>("/v1/sessions/revoke-others", { method: "POST", body: {} }),
  generation: (id: string) => request<{ generation: Generation }>(`/v1/generations/${id}`),
};
