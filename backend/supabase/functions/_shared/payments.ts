// Payment providers.
//
//   dummy     — test mode: every payment succeeds instantly and no money moves.
//               Only TEST_PAYMENT_EMAILS may use it (see billing routes).
//   razorpay  — live payments. Needs RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET and
//               RAZORPAY_WEBHOOK_SECRET. Switch with PAYMENT_PROVIDER=razorpay.
//
// Security model (Razorpay):
//   * The order (amount, currency) is created server-side from the pack price in
//     the database. The browser never chooses the amount.
//   * A payment is only credited after the server asks Razorpay's API, with the
//     secret key, for the payment and checks it belongs to this order, is for the
//     exact amount and currency, and is captured. The checkout signature is
//     verified too (constant time), but never trusted on its own.
//   * Webhooks are authenticated with an HMAC of the raw body.
import { ApiError, timingSafeEqual } from "./http.ts";

export type CreatedOrder = {
  providerOrderId: string;
  /** Data the frontend needs to open the provider's checkout (never secrets). */
  clientData: Record<string, unknown>;
};

export type VerifyInput = {
  /** The order id stored on our payment row (never the one the browser sends). */
  providerOrderId?: string | null;
  providerPaymentId?: string;
  signature?: string;
  /** What we expect to have been paid, from our payment row. */
  amountPaise: number;
  currency: string;
};

export interface PaymentProvider {
  readonly name: string;
  createOrder(p: { paymentId: string; amountPaise: number; currency: string }): Promise<CreatedOrder>;
  /** Returns the provider's payment id if the payment is genuine and fully paid, otherwise throws. */
  verifyPayment(input: VerifyInput): Promise<{ providerPaymentId: string }>;
}

export const notVerified = (message = "We couldn't verify this payment. If money was deducted, it will be added automatically within a few minutes or refunded by Razorpay.") =>
  new ApiError(402, "PAYMENT_NOT_VERIFIED", message);

const unavailable = () => new ApiError(503, "PAYMENTS_UNAVAILABLE", "Payments are temporarily unavailable. Please try again shortly.");

// -----------------------------------------------------------------------------
// Dummy (test mode)
// -----------------------------------------------------------------------------
const dummyProvider: PaymentProvider = {
  name: "dummy",
  createOrder({ paymentId, amountPaise, currency }) {
    return Promise.resolve({
      providerOrderId: `dummy_order_${paymentId.slice(0, 8)}`,
      clientData: { mode: "test", amount: amountPaise, currency },
    });
  },
  verifyPayment(input) {
    return Promise.resolve({
      providerPaymentId: input.providerPaymentId ?? `dummy_pay_${crypto.randomUUID().slice(0, 12)}`,
    });
  },
};

// -----------------------------------------------------------------------------
// Razorpay
// -----------------------------------------------------------------------------
const RAZORPAY_API = "https://api.razorpay.com/v1";
const ORDER_ID = /^order_[A-Za-z0-9]{6,40}$/;
const PAYMENT_ID = /^pay_[A-Za-z0-9]{6,40}$/;
const HEX_SIGNATURE = /^[a-f0-9]{64}$/;

type RazorpayPayment = {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: "created" | "authorized" | "captured" | "refunded" | "failed";
  captured?: boolean;
};

function razorpayKeys() {
  const keyId = Deno.env.get("RAZORPAY_KEY_ID")?.trim();
  const keySecret = Deno.env.get("RAZORPAY_KEY_SECRET")?.trim();
  if (!keyId || !keySecret) {
    console.error("Razorpay is selected but RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are not set");
    throw unavailable();
  }
  return { keyId, keySecret };
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Razorpay Checkout signature: HMAC-SHA256(order_id + "|" + payment_id, key_secret). */
export async function isValidCheckoutSignature(secret: string, orderId: string, paymentId: string, signature: string) {
  if (!HEX_SIGNATURE.test(signature)) return false;
  return timingSafeEqual(await hmacSha256Hex(secret, `${orderId}|${paymentId}`), signature);
}

/** Webhook signature: HMAC-SHA256(raw request body, webhook secret). */
export async function isValidWebhookSignature(secret: string, rawBody: string, signature: string | null) {
  if (!secret || !signature || !HEX_SIGNATURE.test(signature)) return false;
  return timingSafeEqual(await hmacSha256Hex(secret, rawBody), signature);
}

async function razorpayFetch<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { keyId, keySecret } = razorpayKeys();
  let res: Response;
  try {
    res = await fetch(`${RAZORPAY_API}${path}`, {
      method: init.method ?? "GET",
      headers: {
        Authorization: `Basic ${btoa(`${keyId}:${keySecret}`)}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(15_000),
    });
  } catch (e) {
    console.error("Razorpay unreachable", path, e);
    throw unavailable();
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Log Razorpay's reason for us; never echo it (or the key) to the browser.
    console.error("Razorpay API error", res.status, path, data?.error?.code, data?.error?.description);
    throw new ApiError(res.status >= 500 ? 503 : 502, "PAYMENT_PROVIDER_ERROR", "The payment provider rejected the request. Please try again.");
  }
  return data as T;
}

/** Make sure a genuine payment for this order is captured, for exactly the expected amount. */
async function settle(payment: RazorpayPayment, orderId: string, amountPaise: number, currency: string) {
  if (payment.order_id !== orderId) throw notVerified("This payment belongs to a different order.");
  if (payment.amount !== amountPaise || payment.currency !== currency) {
    console.error("Razorpay amount mismatch", payment.id, payment.amount, payment.currency, amountPaise, currency);
    throw notVerified("The amount paid doesn't match this pack.");
  }
  if (payment.status === "captured") return payment.id;
  if (payment.status === "authorized") {
    // Auto-capture is off (or slow) on the account: capture it ourselves.
    try {
      const captured = await razorpayFetch<RazorpayPayment>(`/payments/${payment.id}/capture`, {
        method: "POST",
        body: { amount: amountPaise, currency },
      });
      if (captured.status === "captured" && captured.id === payment.id && captured.order_id === orderId &&
          captured.amount === amountPaise && captured.currency === currency) return captured.id;
    } catch (e) {
      // A concurrent capture (webhook vs browser) makes Razorpay answer 400 "already captured".
      const again = await razorpayFetch<RazorpayPayment>(`/payments/${payment.id}`);
      if (again.status === "captured" && again.id === payment.id && again.order_id === orderId &&
          again.amount === amountPaise && again.currency === currency) return again.id;
      throw e;
    }
  }
  throw notVerified(payment.status === "failed" ? "This payment failed. No money was taken." : "This payment isn't complete yet.");
}

const razorpayProvider: PaymentProvider = {
  name: "razorpay",

  async createOrder({ paymentId, amountPaise, currency }) {
    const { keyId } = razorpayKeys();
    const order = await razorpayFetch<{ id: string; amount: number; currency: string }>("/orders", {
      method: "POST",
      body: {
        amount: amountPaise,
        currency,
        receipt: paymentId, // our payment uuid (36 chars, Razorpay allows 40)
        notes: { payment_id: paymentId },
      },
    });
    if (!ORDER_ID.test(order.id) || order.amount !== amountPaise || order.currency !== currency) {
      console.error("Unexpected Razorpay order", order);
      throw unavailable();
    }
    return {
      providerOrderId: order.id,
      // The key id is public by design (it's in every checkout page); the secret never leaves the server.
      clientData: { key_id: keyId, amount: amountPaise, currency, name: "MyTilesTrial" },
    };
  },

  async verifyPayment({ providerOrderId, providerPaymentId, signature, amountPaise, currency }) {
    const { keySecret } = razorpayKeys();
    if (!providerOrderId || !ORDER_ID.test(providerOrderId)) throw notVerified();

    // Browser callback: check the signature first, then confirm with Razorpay.
    if (providerPaymentId || signature) {
      if (!providerPaymentId || !PAYMENT_ID.test(providerPaymentId) || !signature) throw notVerified();
      if (!(await isValidCheckoutSignature(keySecret, providerOrderId, providerPaymentId, signature))) {
        throw notVerified("Payment signature is invalid.");
      }
      const payment = await razorpayFetch<RazorpayPayment>(`/payments/${providerPaymentId}`);
      if (payment.id !== providerPaymentId) throw notVerified("This payment does not match the checkout response.");
      return { providerPaymentId: await settle(payment, providerOrderId, amountPaise, currency) };
    }

    // No callback data (page was closed, or a status re-check): ask Razorpay what was paid on this order.
    const { items } = await razorpayFetch<{ items: RazorpayPayment[] }>(`/orders/${providerOrderId}/payments`);
    const best = items.find((p) => p.status === "captured") ?? items.find((p) => p.status === "authorized");
    if (!best) throw notVerified("No completed payment was found for this order yet.");
    return { providerPaymentId: await settle(best, providerOrderId, amountPaise, currency) };
  },
};

const providers: Record<string, PaymentProvider> = {
  dummy: dummyProvider,
  razorpay: razorpayProvider,
};

/** Real providers move real money; the dummy provider would give images away. */
export const isTestProvider = (p: PaymentProvider) => p.name === "dummy";

export function getPaymentProvider(name = Deno.env.get("PAYMENT_PROVIDER") ?? "dummy"): PaymentProvider {
  const provider = providers[name];
  if (!provider) throw new Error(`Unknown PAYMENT_PROVIDER "${name}"`);
  return provider;
}
