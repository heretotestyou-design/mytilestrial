// /v1/catalog, /v1/billing/*
import type { Router } from "../../_shared/router.ts";
import { FREE_PLAN_CREDITS } from "../../_shared/config.ts";
import { loadAccount } from "./account.ts";
import { admin, isTestPaymentUser, requireUser, type AuthUser } from "../../_shared/supabase.ts";
import { ApiError, Errors, fromDbError, json, readJson } from "../../_shared/http.ts";
import { checkoutSchema, confirmPaymentSchema, pagination, parse, uuid } from "../../_shared/validation.ts";
import { paymentReceiptHtml } from "../../_shared/payment-receipt.ts";
import { getPaymentProvider, isTestProvider, isValidWebhookSignature } from "../../_shared/payments.ts";
import { syncNewCheckout } from "../../_shared/checkout-sheet.ts";
import { settleGuestWebhook } from "./guest-checkout.ts";

const PAYMENT_COLUMNS =
  "id, pack_id, amount_paise, base_amount_paise, credits, currency, provider, provider_order_id, status, failure_reason, created_at, paid_at, validity_months, credits_expire_at";

async function getOwnPayment(userId: string, id: string) {
  parse(uuid, id);
  const { data, error } = await admin
    .from("payments")
    .select(PAYMENT_COLUMNS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw fromDbError(error);
  if (!data) throw Errors.notFound("Payment");
  return data;
}

async function verifiedCheckoutEmail(userId: string) {
  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error) throw new ApiError(503, "EMAIL_CHECK_UNAVAILABLE", "We could not verify your account email. Try again.");
  if (!data.user?.email_confirmed_at || !data.user.email) {
    throw new ApiError(403, "EMAIL_UNVERIFIED", "Verify your account email before paying.");
  }
  return data.user.email;
}

/** While only the test provider exists, purchases are limited to the team (free credits otherwise). */
function assertCanPay(user: AuthUser) {
  if (isTestProvider(getPaymentProvider()) && !isTestPaymentUser(user.email)) {
    throw new ApiError(403, "PAYMENTS_UNAVAILABLE", "Online payments are coming soon. Use the free plan for now.");
  }
}

export function billingRoutes(r: Router) {
  // Public: what can be bought and what each render costs.
  r.get("/v1/catalog", async ({ req }) => {
    const provider = getPaymentProvider();
    const [packs, costs] = await Promise.all([
      admin
        .from("credit_packs")
        .select("id, name, description, credits, bonus_credits, price_paise, is_featured, validity_months")
        .eq("is_active", true)
        .eq("is_test", false)
        .order("sort_order"),
      admin
        .from("generation_costs")
        .select("type, label, description, credits")
        .eq("is_active", true)
        .order("sort_order"),
    ]);
    if (packs.error) throw fromDbError(packs.error);
    if (costs.error) throw fromDbError(costs.error);
    return json(req, {
      currency: "INR",
      packs: packs.data,
      generation_costs: costs.data,
      // Temporary ₹0 plan: one-time grant per account (null when switched off).
      free_plan: FREE_PLAN_CREDITS > 0 ? { credits: FREE_PLAN_CREDITS, price_paise: 0 } : null,
      // Lets the UI hide the "test mode" notice once real payments are live.
      payments: { provider: provider.name, test_mode: isTestProvider(provider) },
    }, 200, "public, max-age=0, s-maxage=60");
  });

  // Developer test packs (₹1 for 10 images). Only for TEST_PAYMENT_EMAILS; everyone else gets [].
  r.get("/v1/billing/test-packs", async ({ req }) => {
    const user = await requireUser(req);
    if (!isTestPaymentUser(user.email)) return json(req, { packs: [] });
    const { data, error } = await admin
      .from("credit_packs")
      .select("id, name, description, credits, bonus_credits, price_paise, is_featured, is_test")
      .eq("is_active", true)
      .eq("is_test", true)
      .order("sort_order");
    if (error) throw fromDbError(error);
    return json(req, { packs: data });
  });

  r.post("/v1/billing/free-plan", async ({ req }) => {
    const user = await requireUser(req);
    if (FREE_PLAN_CREDITS <= 0) throw new ApiError(404, "FREE_PLAN_UNAVAILABLE", "The free plan isn't available right now.");
    const { error } = await admin.rpc("claim_free_plan", { p_user_id: user.id, p_credits: FREE_PLAN_CREDITS });
    if (error) throw fromDbError(error);
    return json(req, await loadAccount(user.id), 201);
  });

  r.get("/v1/billing/checkout-contact", async ({ req, url }) => {
    const user = await requireUser(req);
    const [profile, email, last] = await Promise.all([
      admin.from("profiles").select("full_name, phone, company").eq("id", user.id).single(),
      verifiedCheckoutEmail(user.id),
      url.searchParams.get("mode") === "website" ? null :
        admin.from("checkout_contacts").select("full_name, phone, company, gstin").eq("user_id", user.id)
          .order("id", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (last?.error || profile.error) throw fromDbError(last?.error ?? profile.error!);
    return json(req, { ...profile.data, ...last?.data, email });
  });

  // Step 1: create a pending payment + provider order.
  r.post("/v1/billing/checkout", async ({ req }) => {
    const user = await requireUser(req);
    assertCanPay(user);
    const { pack_id, expected_amount_paise, details } = parse(checkoutSchema, await readJson(req));
    const provider = getPaymentProvider();
    const email = details ? await verifiedCheckoutEmail(user.id) : null;

    const { data: payment, error } = await admin.rpc("create_taxed_payment", {
      p_user_id: user.id,
      p_pack_id: pack_id,
      p_provider: provider.name,
      // Test packs only exist for allow-listed testers (enforced again in SQL).
      p_allow_test: isTestPaymentUser(user.email),
      p_expected_base: expected_amount_paise ?? null,
    });
    if (error) throw fromDbError(error);

    try {
      if (details) {
        const saved = await admin.from("checkout_contacts").insert({
          ...details, company: details.company || null, user_id: user.id, payment_id: payment.id, email,
        });
        if (saved.error) throw fromDbError(saved.error);
        await syncNewCheckout(payment.id);
      }
      const order = await provider.createOrder({
        paymentId: payment.id,
        amountPaise: Number(payment.amount_paise),
        currency: payment.currency,
      });
      const { error: updErr } = await admin.from("payments")
        .update({ provider_order_id: order.providerOrderId }).eq("id", payment.id);
      if (updErr) throw fromDbError(updErr);
      return json(req, {
        payment: { ...payment, provider_order_id: order.providerOrderId },
        checkout: { provider: provider.name, order_id: order.providerOrderId, ...order.clientData },
      }, 201);
    } catch (error) {
      await admin.rpc("fail_payment", { p_payment_id: payment.id, p_status: "failed", p_reason: "Checkout setup failed" });
      throw error;
    }
  });

  r.get("/v1/billing/payments/:id", async ({ req, params }) => {
    const user = await requireUser(req);
    return json(req, { payment: await getOwnPayment(user.id, params.id) });
  });

  r.get("/v1/billing/payments/:id/receipt", async ({ req, params }) => {
    const user = await requireUser(req);
    parse(uuid, params.id);
    const { data: payment, error } = await admin.from("payments")
      .select(`${PAYMENT_COLUMNS}, provider_payment_id`)
      .eq("id", params.id)
      .eq("user_id", user.id)
      .eq("status", "paid")
      .maybeSingle();
    if (error) throw fromDbError(error);
    if (!payment?.paid_at) throw Errors.notFound("Receipt");

    const { data: contact, error: contactError } = await admin.from("checkout_contacts")
      .select("full_name, company, email, gstin")
      .eq("payment_id", payment.id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (contactError) throw fromDbError(contactError);

    const test = payment.provider !== "razorpay" || Deno.env.get("RAZORPAY_KEY_ID")?.startsWith("rzp_test_");
    return json(req, { html: paymentReceiptHtml(payment, contact, test ? "test" : "paid") });
  });

  // Step 2: verify with the provider, then credit the wallet (idempotent).
  // With no body this re-checks the order with the provider (e.g. after the page was closed).
  r.post("/v1/billing/payments/:id/confirm", async ({ req, params }) => {
    const user = await requireUser(req);
    assertCanPay(user);
    const body = parse(confirmPaymentSchema, await readJson(req));
    const payment = await getOwnPayment(user.id, params.id);

    if (payment.status === "paid") return json(req, { payment });

    // Only the provider that is live now may confirm (an old test-mode order can't be redeemed later).
    const provider = getPaymentProvider();
    if (provider.name !== payment.provider) throw Errors.badRequest("Payment provider mismatch.");
    // Test mode can't resurrect a cancelled order; a real provider may, because it proves money was captured.
    if (payment.status !== "created" && isTestProvider(provider)) {
      throw new ApiError(409, "PAYMENT_NOT_PENDING", "This payment is no longer pending.");
    }
    // The order id always comes from our database; a mismatching one from the browser is refused.
    if (body.provider_order_id && body.provider_order_id !== payment.provider_order_id) {
      throw Errors.badRequest("This payment belongs to a different order.");
    }

    const verified = await provider.verifyPayment({
      providerOrderId: payment.provider_order_id,
      providerPaymentId: body.provider_payment_id,
      signature: body.signature,
      amountPaise: Number(payment.amount_paise),
      currency: payment.currency,
    });

    const { error } = await admin.rpc("confirm_payment", {
      p_payment_id: payment.id,
      p_provider_payment_id: verified.providerPaymentId,
      p_provider_order_id: null,
    });
    if (error) throw fromDbError(error);

    return json(req, { payment: await getOwnPayment(user.id, payment.id) });
  });

  // Razorpay → us, server to server. Credits payments even if the buyer closed the tab.
  // Authenticated by HMAC of the raw body; the event is then re-verified with Razorpay's API.
  r.post("/v1/billing/webhooks/razorpay", async ({ req }) => {
    const raw = await req.text();
    if (raw.length > 256 * 1024) throw Errors.badRequest("Payload too large.");
    const secret = Deno.env.get("RAZORPAY_WEBHOOK_SECRET") ?? "";
    if (!(await isValidWebhookSignature(secret, raw, req.headers.get("x-razorpay-signature")))) {
      throw new ApiError(401, "INVALID_SIGNATURE", "Invalid webhook signature.");
    }

    let event: { event?: string; payload?: { payment?: { entity?: { order_id?: string } }; order?: { entity?: { id?: string } } } };
    try {
      event = JSON.parse(raw);
    } catch {
      throw Errors.badRequest("Request body must be valid JSON.");
    }

    const handled = ["payment.captured", "payment.authorized", "order.paid"];
    const orderId = event.payload?.payment?.entity?.order_id ?? event.payload?.order?.entity?.id;
    if (!event.event || !handled.includes(event.event) || !orderId) return json(req, { ok: true, ignored: true });

    const { data: payment, error } = await admin
      .from("payments")
      .select("id, status, amount_paise, currency, provider, provider_order_id")
      .eq("provider", "razorpay")
      .eq("provider_order_id", orderId)
      .maybeSingle();
    if (error) throw fromDbError(error); // 500 → Razorpay retries
    if (!payment) {
      try {
        return json(req, { ok: true, ignored: !await settleGuestWebhook(orderId) });
      } catch (e) {
        if (e instanceof ApiError && e.code === "PAYMENT_NOT_VERIFIED") return json(req, { ok: true, pending: true });
        throw e;
      }
    }
    if (payment.status === "paid") return json(req, { ok: true });

    let verified: { providerPaymentId: string };
    try {
      verified = await getPaymentProvider("razorpay").verifyPayment({
        providerOrderId: payment.provider_order_id,
        amountPaise: Number(payment.amount_paise),
        currency: payment.currency,
      });
    } catch (e) {
      // Not (yet) a completed payment: acknowledge, a later event will settle it. Provider outages → retry.
      if (e instanceof ApiError && e.code === "PAYMENT_NOT_VERIFIED") return json(req, { ok: true, pending: true });
      throw e;
    }

    const { error: confirmErr } = await admin.rpc("confirm_payment", {
      p_payment_id: payment.id,
      p_provider_payment_id: verified.providerPaymentId,
      p_provider_order_id: null,
    });
    if (confirmErr) throw fromDbError(confirmErr);
    return json(req, { ok: true });
  });

  r.post("/v1/billing/payments/:id/cancel", async ({ req, params }) => {
    const user = await requireUser(req);
    const payment = await getOwnPayment(user.id, params.id);

    const { error } = await admin.rpc("fail_payment", {
      p_payment_id: payment.id,
      p_status: "cancelled",
      p_reason: "Cancelled by user",
    });
    if (error) throw fromDbError(error);
    return json(req, { payment: await getOwnPayment(user.id, payment.id) });
  });

  r.get("/v1/billing/payments", async ({ req, url }) => {
    const user = await requireUser(req);
    const { limit, before } = parse(pagination, Object.fromEntries(url.searchParams));

    let q = admin
      .from("payments")
      .select(PAYMENT_COLUMNS)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit + 1);
    if (before) q = q.lt("created_at", before);

    const { data, error } = await q;
    if (error) throw fromDbError(error);

    const items = data.slice(0, limit);
    const next = data.length > limit ? items[items.length - 1].created_at : null;
    return json(req, { items, next_cursor: next });
  });
}
