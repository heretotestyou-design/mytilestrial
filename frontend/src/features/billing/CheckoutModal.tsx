"use client";

// TEST-MODE checkout. Stands in for Razorpay/Stripe until a real provider is
// connected: no money moves, the payment is confirmed through the same API
// call a real provider's success callback would make.
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { api } from "@/lib/api";
import { formatPaise } from "@/lib/format";
import type { Checkout, CreditPack } from "@/lib/types";
import { Button } from "@/components/ui/Button";

type Props = {
  pack: CreditPack | null;
  checkout: Checkout | null;
  onClose: () => void;
  onPaid: (paymentId: string) => void;
  onError: (msg: string) => void;
};

export function CheckoutModal({ pack, checkout, onClose, onPaid, onError }: Props) {
  const [busy, setBusy] = useState<"pay" | "cancel" | null>(null);
  const open = Boolean(pack && checkout);

  async function pay() {
    if (!checkout) return;
    setBusy("pay");
    try {
      const { payment } = await api.confirmPayment(checkout.payment.id);
      onPaid(payment.id);
    } catch (e) {
      onError(e instanceof Error ? e.message : "Payment failed.");
    } finally {
      setBusy(null);
    }
  }

  async function cancel() {
    if (!checkout) return onClose();
    setBusy("cancel");
    try {
      await api.cancelPayment(checkout.payment.id);
    } catch {
      /* already closed or expired — fine */
    } finally {
      setBusy(null);
      onClose();
    }
  }

  return (
    <AnimatePresence>
      {open && pack && checkout && (
        <motion.div className="fixed inset-0 z-[90] grid place-items-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={busy ? undefined : cancel} />
          <motion.div
            role="dialog"
            aria-modal
            aria-labelledby="checkout-title"
            className="relative w-full max-w-md overflow-hidden glass-strong rounded-3xl"
            initial={{ y: 24, scale: 0.98 }}
            animate={{ y: 0, scale: 1 }}
            exit={{ y: 16, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="grain relative bg-ink px-7 py-6 text-ivory">
              <div className="flex items-center justify-between">
                <p className="text-[11px] uppercase tracking-eyebrow text-ivory/50">Checkout</p>
                <span className="rounded-full bg-amber-400/20 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-amber-300">
                  Test mode
                </span>
              </div>
              <p id="checkout-title" className="mt-3 text-[26px] font-semibold tracking-tight">{pack.name} pack</p>
              <p className="text-[14px] text-ivory/60">{pack.credits + pack.bonus_credits} images</p>
            </div>

            <div className="space-y-3 px-7 py-6 text-[14px]">
              <Row label="Pack price" value={formatPaise(checkout.payment.base_amount_paise ?? pack.price_paise)} />
              {checkout.payment.base_amount_paise && checkout.payment.amount_paise > checkout.payment.base_amount_paise &&
                <Row label="GST (18%)" value={formatPaise(checkout.payment.amount_paise - checkout.payment.base_amount_paise)} />}
              <Row label="Order ID" value={<code className="text-[12px]">{checkout.checkout.order_id}</code>} />
              <div className="border-t border-ink/10 pt-3">
                <Row label={<b>Total</b>} value={<b className="text-[20px] font-semibold tabular-nums">{formatPaise(checkout.payment.amount_paise)}</b>} />
              </div>
              <p className="rounded-xl bg-amber-50 px-4 py-3 text-[12.5px] leading-relaxed text-amber-800">
                Payments are in test mode. No money will be charged — images are added instantly.
              </p>
            </div>

            <div className="flex gap-3 px-7 pb-7">
              <Button variant="outline" className="flex-1" onClick={cancel} loading={busy === "cancel"} disabled={busy === "pay"}>
                Cancel
              </Button>
              <Button variant="bronze" className="flex-[1.4]" onClick={pay} loading={busy === "pay"} disabled={busy === "cancel"}>
                Pay {formatPaise(checkout.payment.amount_paise)}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-stone-500">{label}</span>
      <span>{value}</span>
    </div>
  );
}
