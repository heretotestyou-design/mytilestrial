// Buying an image pack with Razorpay:
//   1. the server has already created the order (amount from the database)
//   2. Razorpay Checkout collects the payment
//   3. the server verifies it with Razorpay and credits the images
// If step 3 can't complete right away (network, slow bank), the Razorpay webhook
// credits the images on the server, so a paid order is never lost.
import { api, ApiError } from "@/lib/api";
import { openRazorpay } from "@/lib/razorpay";
import type { Checkout, CreditPack } from "@/lib/types";

export type RazorpayResult =
  | { kind: "paid"; credits: number }
  | { kind: "failed"; message: string }
  | { kind: "cancelled" }
  /** Paid, but not confirmed yet: the webhook will finish it. */
  | { kind: "pending"; message: string };

type Options = {
  pack: CreditPack;
  checkout: Checkout;
  email?: string;
  name?: string;
  phone?: string;
  /** Called once the buyer has paid and we're confirming with the server. */
  onConfirming?: () => void;
  /** Delay between confirmation retries (tests use 0). */
  retryDelayMs?: number;
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function payWithRazorpay({ pack, checkout, email, name, phone, onConfirming, retryDelayMs = 1500 }: Options): Promise<RazorpayResult> {
  const c = checkout.checkout;
  if (!c.key_id || !c.order_id || typeof c.amount !== "number" || !c.currency) {
    throw new Error("Checkout couldn't start. Please try again.");
  }

  const outcome = await openRazorpay({
    key: c.key_id,
    order_id: c.order_id,
    amount: c.amount,
    currency: c.currency,
    name: c.name ?? "MyTilesTrial",
    description: `${pack.name} pack · ${pack.credits + pack.bonus_credits} images`,
    prefill: (email || name || phone) ? { ...(email && { email }), ...(name && { name }), ...(phone && { contact: phone }) } : undefined,
    readonly: phone && email ? { email: true, contact: true } : undefined,
    notes: { payment_id: checkout.payment.id },
    theme: { color: "#B08A5B" },
  });

  if (outcome.kind !== "paid") {
    // Safe even if a UPI payment completes later: the webhook still credits it.
    const closed = await api.cancelPayment(checkout.payment.id).catch(() => null);
    if (closed?.payment?.status === "paid") return { kind: "paid", credits: closed.payment.credits };
    return outcome.kind === "dismissed" ? { kind: "cancelled" } : outcome;
  }

  onConfirming?.();
  const body = {
    provider_payment_id: outcome.response.razorpay_payment_id,
    provider_order_id: outcome.response.razorpay_order_id,
    signature: outcome.response.razorpay_signature,
  };
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const { payment } = await api.confirmPayment(checkout.payment.id, body);
      if (payment.status === "paid") return { kind: "paid", credits: payment.credits };
    } catch (e) {
      lastError = e;
      // A forged/mismatched payment won't get better by retrying.
      if (e instanceof ApiError && e.status === 400) break;
    }
    if (attempt < 3) await wait(retryDelayMs * (attempt + 1));
  }
  console.warn("Payment confirmation pending", lastError);
  return {
    kind: "pending",
    message: `Payment received (${body.provider_payment_id}). We're confirming it with your bank — your images will be added automatically in a few minutes.`,
  };
}
