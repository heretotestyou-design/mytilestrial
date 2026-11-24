import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Checkout, CreditPack } from "@/lib/types";

const openRazorpay = vi.fn();
vi.mock("@/lib/razorpay", () => ({ openRazorpay: (...a: unknown[]) => openRazorpay(...a) }));
const confirmPayment = vi.fn();
const cancelPayment = vi.fn();
vi.mock("@/lib/api", async (orig) => {
  const real = await orig<typeof import("@/lib/api")>();
  return { ...real, api: { confirmPayment: (...a: unknown[]) => confirmPayment(...a), cancelPayment: (...a: unknown[]) => cancelPayment(...a) } };
});

const { payWithRazorpay } = await import("./razorpayFlow");
const { ApiError } = await import("@/lib/api");

const pack: CreditPack = { id: "studio", name: "Studio", description: null, credits: 100, bonus_credits: 10, price_paise: 199900, is_featured: true };
const checkout = {
  payment: { id: "pay-row-1", credits: 110 },
  checkout: { provider: "razorpay", order_id: "order_ABC123", key_id: "rzp_live_x", amount: 199900, currency: "INR", name: "MyTilesTrial" },
} as unknown as Checkout;
const success = { razorpay_payment_id: "pay_XYZ789", razorpay_order_id: "order_ABC123", razorpay_signature: "f".repeat(64) };

beforeEach(() => {
  openRazorpay.mockReset();
  confirmPayment.mockReset();
  cancelPayment.mockReset().mockResolvedValue({});
});

describe("payWithRazorpay", () => {
  it("opens Checkout with the server's order and amount, then confirms with the signature", async () => {
    openRazorpay.mockResolvedValue({ kind: "paid", response: success });
    confirmPayment.mockResolvedValue({ payment: { status: "paid", credits: 110 } });
    const onConfirming = vi.fn();

    const r = await payWithRazorpay({ pack, checkout, email: "a@b.co", onConfirming, retryDelayMs: 0 });

    expect(r).toEqual({ kind: "paid", credits: 110 });
    const [opts] = openRazorpay.mock.calls[0];
    expect(opts).toMatchObject({ key: "rzp_live_x", order_id: "order_ABC123", amount: 199900, currency: "INR", prefill: { email: "a@b.co" } });
    expect(confirmPayment).toHaveBeenCalledWith("pay-row-1", {
      provider_payment_id: "pay_XYZ789",
      provider_order_id: "order_ABC123",
      signature: "f".repeat(64),
    });
    expect(onConfirming).toHaveBeenCalledOnce();
  });

  it("closing Checkout cancels the pending order and charges nothing", async () => {
    openRazorpay.mockResolvedValue({ kind: "dismissed" });
    expect(await payWithRazorpay({ pack, checkout, retryDelayMs: 0 })).toEqual({ kind: "cancelled" });
    expect(cancelPayment).toHaveBeenCalledWith("pay-row-1");
    expect(confirmPayment).not.toHaveBeenCalled();
  });

  it("retries a flaky confirmation, then succeeds", async () => {
    openRazorpay.mockResolvedValue({ kind: "paid", response: success });
    confirmPayment.mockRejectedValueOnce(new ApiError(503, "PAYMENTS_UNAVAILABLE", "down")).mockResolvedValue({ payment: { status: "paid", credits: 110 } });
    expect(await payWithRazorpay({ pack, checkout, retryDelayMs: 0 })).toEqual({ kind: "paid", credits: 110 });
    expect(confirmPayment).toHaveBeenCalledTimes(2);
  });

  it("reports a declined payment separately from a checkout closed by the buyer", async () => {
    const failed = { kind: "failed", message: "Your bank declined this payment." };
    openRazorpay.mockResolvedValue(failed);
    expect(await payWithRazorpay({ pack, checkout })).toEqual(failed);
    expect(cancelPayment).toHaveBeenCalledWith(checkout.payment.id);
    expect(confirmPayment).not.toHaveBeenCalled();
  });

  it("reports a payment confirmed by the server while the checkout was closing", async () => {
    openRazorpay.mockResolvedValue({ kind: "failed", message: "Payment declined" });
    cancelPayment.mockResolvedValue({ payment: { status: "paid", credits: 110 } });
    expect(await payWithRazorpay({ pack, checkout })).toEqual({ kind: "paid", credits: 110 });
  });

  it("if confirmation keeps failing, reports 'pending' (the webhook finishes it) instead of an error", async () => {
    openRazorpay.mockResolvedValue({ kind: "paid", response: success });
    confirmPayment.mockRejectedValue(new ApiError(503, "PAYMENTS_UNAVAILABLE", "down"));
    const r = await payWithRazorpay({ pack, checkout, retryDelayMs: 0 });
    expect(r.kind).toBe("pending");
    expect(confirmPayment).toHaveBeenCalledTimes(4);
    expect(cancelPayment).not.toHaveBeenCalled();
  });

  it("does not retry a rejected (mismatched) payment", async () => {
    openRazorpay.mockResolvedValue({ kind: "paid", response: success });
    confirmPayment.mockRejectedValue(new ApiError(400, "BAD_REQUEST", "different order"));
    await payWithRazorpay({ pack, checkout, retryDelayMs: 0 });
    expect(confirmPayment).toHaveBeenCalledTimes(1);
  });

  it("refuses to open without the server's order details", async () => {
    const broken = { ...checkout, checkout: { provider: "razorpay", order_id: "" } } as Checkout;
    await expect(payWithRazorpay({ pack, checkout: broken })).rejects.toThrow();
    expect(openRazorpay).not.toHaveBeenCalled();
  });
});
