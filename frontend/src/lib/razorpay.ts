// Razorpay Checkout (https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/).
// The script is loaded only when someone buys, from Razorpay's own origin (allowed in the CSP).
// Nothing here is trusted by the server: it re-verifies every payment with Razorpay's API.

export const RAZORPAY_SCRIPT = "https://checkout.razorpay.com/v1/checkout.js";

export type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export type RazorpayFailure = { error?: { description?: string; reason?: string } };

type RazorpayOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  prefill?: { email?: string; name?: string; contact?: string };
  readonly?: { email?: boolean; contact?: boolean };
  notes?: Record<string, string>;
  theme?: { color?: string };
  retry?: { enabled: boolean; max_count?: number };
  modal?: { ondismiss?: () => void; confirm_close?: boolean; escape?: boolean };
  handler: (response: RazorpaySuccess) => void;
};

type RazorpayInstance = { open: () => void; close: () => void; on: (event: "payment.failed", cb: (r: RazorpayFailure) => void) => void };
type RazorpayCtor = new (options: RazorpayOptions) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

let loading: Promise<RazorpayCtor> | null = null;

/** Loads checkout.js once. A failed load (offline, blocked) can be retried. */
export function loadRazorpay(): Promise<RazorpayCtor> {
  if (typeof window === "undefined") return Promise.reject(new Error("Razorpay needs a browser."));
  if (window.Razorpay) return Promise.resolve(window.Razorpay);
  loading ??= new Promise<RazorpayCtor>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = RAZORPAY_SCRIPT;
    script.async = true;
    script.onload = () => (window.Razorpay ? resolve(window.Razorpay) : reject(new Error("Razorpay didn't load.")));
    script.onerror = () => {
      script.remove();
      reject(new Error("Couldn't reach Razorpay. Check your connection, or turn off any ad-blocker for this site, and try again."));
    };
    document.head.appendChild(script);
  }).catch((e) => {
    loading = null;
    throw e;
  });
  return loading;
}

export type RazorpayOutcome =
  | { kind: "paid"; response: RazorpaySuccess }
  | { kind: "failed"; message: string }
  | { kind: "dismissed" };

/** Opens Checkout and hands failed attempts back to the billing page for retry. */
export async function openRazorpay(
  options: Omit<RazorpayOptions, "handler" | "modal">,
): Promise<RazorpayOutcome> {
  const Razorpay = await loadRazorpay();
  return new Promise((resolve) => {
    const rzp = new Razorpay({
      ...options,
      retry: { enabled: false },
      modal: { confirm_close: true, escape: false, ondismiss: () => resolve({ kind: "dismissed" }) },
      handler: (response) => resolve({ kind: "paid", response }),
    });
    rzp.on("payment.failed", (r) => {
      resolve({ kind: "failed", message: r.error?.description || "Your payment method was declined. Please try again." });
      rzp.close();
    });
    rzp.open();
  });
}
