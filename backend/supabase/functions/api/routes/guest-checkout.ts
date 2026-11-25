import type { Router } from "../../_shared/router.ts";
import { admin } from "../../_shared/supabase.ts";
import { timingSafeEqual, ApiError, Errors, fromDbError, json, readJson } from "../../_shared/http.ts";
import { confirmPaymentSchema, gstinSchema, parse, uuid, z } from "../../_shared/validation.ts";
import { getPaymentProvider } from "../../_shared/payments.ts";
import { syncNewCheckout } from "../../_shared/checkout-sheet.ts";

const signup = z.object({
  pack_id: z.string().min(1).max(40),
  expected_amount_paise: z.number().int().positive(),
  email: z.string().trim().email().max(254).toLowerCase(),
  full_name: z.string().trim().min(1).max(120),
  company: z.string().trim().min(1).max(120),
  phone: z.string().trim().regex(/^\+?[0-9 ()-]{7,19}$/).refine((phone) => /^\d{7,15}$/.test(phone.replace(/\D/g, ""))),
  gstin: gstinSchema.optional(),
}).strict();
const proof = z.object({ access: z.string().uuid(), evidence: confirmPaymentSchema.optional() }).strict();
const columns = "id,access_hash,pack_id,email,full_name,company,phone,amount_paise,credits,provider_order_id,provider_payment_id,payment_id,activation_status";
type GuestOrder = {
  id: string; access_hash: string; pack_id: string; email: string; full_name: string; company: string; phone: string;
  amount_paise: number; credits: number; provider_order_id: string | null; provider_payment_id: string | null;
  payment_id: string | null; activation_status: "sent" | "existing" | null;
};

async function accessHash(value: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function fetchOrder(field: "id" | "provider_order_id", value: string): Promise<GuestOrder | null> {
  const { data, error } = await admin.from("guest_orders").select(columns).eq(field, value).maybeSingle();
  if (error) throw fromDbError(error);
  return data;
}

async function activate(order: GuestOrder) {
  const existing = await admin.rpc("guest_order_account", { p_id: order.id });
  if (existing.error) throw fromDbError(existing.error);
  let userId = existing.data as string | null;
  let activation: "sent" | "existing" = "existing";

  if (!userId) {
    const claim = await admin.from("guest_orders").update({ activation_attempted_at: new Date().toISOString() })
      .eq("id", order.id).is("payment_id", null)
      .or(`activation_attempted_at.is.null,activation_attempted_at.lt.${new Date(Date.now() - 60_000).toISOString()}`)
      .select("id").maybeSingle();
    if (claim.error) throw fromDbError(claim.error);
    if (!claim.data) return;

    const site = Deno.env.get("MYTILESTRIAL_SITE_URL") ?? "https://mytilestrial.com";
    const invite = await admin.auth.admin.inviteUserByEmail(order.email, {
      redirectTo: new URL("/reset-password", site).href,
      data: { full_name: order.full_name, company: order.company, phone: order.phone },
    });
    if (invite.error || !invite.data.user) {
      // A buyer may verify an existing registration while the payment is in progress.
      const matched = await admin.rpc("guest_order_account", { p_id: order.id });
      if (matched.error) throw fromDbError(matched.error);
      if (!matched.data) {
        console.error("Guest activation could not be sent", invite.error?.code);
        return;
      }
      userId = matched.data;
    } else {
      userId = invite.data.user.id;
      activation = "sent";
    }
  }
  const settled = await admin.rpc("finish_guest_order", { p_id: order.id, p_user_id: userId, p_activation: activation });
  if (settled.error) throw fromDbError(settled.error);
}

async function settle(order: GuestOrder, evidence?: z.infer<typeof confirmPaymentSchema>) {
  if (!order.provider_payment_id) {
    if (!order.provider_order_id) throw new ApiError(409, "PAYMENT_NOT_PENDING", "Checkout is not ready.");
    if (evidence?.provider_order_id && evidence.provider_order_id !== order.provider_order_id) {
      throw Errors.badRequest("This payment belongs to a different order.");
    }
    const verified = await getPaymentProvider("razorpay").verifyPayment({
      providerOrderId: order.provider_order_id, providerPaymentId: evidence?.provider_payment_id,
      signature: evidence?.signature, amountPaise: Number(order.amount_paise), currency: "INR",
    });
    const saved = await admin.from("guest_orders").update({ provider_payment_id: verified.providerPaymentId })
      .eq("id", order.id).is("provider_payment_id", null);
    if (saved.error) throw fromDbError(saved.error);
  }
  if (!order.payment_id) await activate(order);
  const current = await fetchOrder("id", order.id);
  if (!current) throw Errors.notFound("Checkout");
  return { status: "paid", activation: current.activation_status ?? "pending" };
}

export async function settleGuestWebhook(orderId: string): Promise<boolean> {
  const order = await fetchOrder("provider_order_id", orderId);
  if (!order) return false;
  const { activation } = await settle(order);
  if (activation === "pending") throw new ApiError(503, "ACTIVATION_PENDING", "The payment is confirmed. Account activation will be retried.");
  return true;
}

export function guestCheckoutRoutes(r: Router) {
  r.post("/v1/billing/guest-checkout", async ({ req }) => {
    if (getPaymentProvider().name !== "razorpay") throw new ApiError(503, "PAYMENTS_UNAVAILABLE", "Online payments are temporarily unavailable.");
    const data = parse(signup, await readJson(req));
    const access = crypto.randomUUID();
    const created = await admin.rpc("create_guest_order", {
      p_pack_id: data.pack_id, p_expected_base: data.expected_amount_paise,
      p_email: data.email, p_full_name: data.full_name, p_company: data.company, p_phone: data.phone, p_access_hash: await accessHash(access),
      p_gstin: data.gstin ?? null,
    });
    if (created.error) throw fromDbError(created.error);
    const row = created.data as GuestOrder;
    await syncNewCheckout(undefined, row.id);
    const order = await getPaymentProvider("razorpay").createOrder({ paymentId: row.id, amountPaise: Number(row.amount_paise), currency: "INR" });
    const saved = await admin.from("guest_orders").update({ provider_order_id: order.providerOrderId }).eq("id", row.id);
    if (saved.error) throw fromDbError(saved.error);
    return json(req, { id: row.id, access, order_id: order.providerOrderId, ...order.clientData }, 201);
  });

  r.post("/v1/billing/guest-checkout/:id/confirm", async ({ req, params }) => {
    const id = parse(uuid, params.id);
    const { access, evidence } = parse(proof, await readJson(req));
    const order = await fetchOrder("id", id);
    if (!order || !timingSafeEqual(order.access_hash, await accessHash(access))) throw Errors.notFound("Checkout");
    return json(req, await settle(order, evidence));
  });
}
