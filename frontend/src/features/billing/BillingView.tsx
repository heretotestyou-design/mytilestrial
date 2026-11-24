"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { PageHeader } from "@/components/ui/PageHeader";
import { SoldOutPlan } from "@/components/marketing/SoldOutPlan";
import { useToast } from "@/components/ui/Toast";
import { useAccount } from "@/features/account/hooks";
import { BalanceHero } from "@/features/credits/BalanceHero";
import { api } from "@/lib/api";
import { packCheckoutPrice } from "@/lib/checkout-price";
import { rise } from "@/lib/motion";
import { useRevalidate } from "@/lib/swr";
import type { Checkout, CreditPack } from "@/lib/types";
import { CheckoutModal } from "./CheckoutModal";
import { HistoryCard } from "./HistoryCard";
import { FreePlanCard } from "./FreePlanCard";
import { useFreePlan, usePacks, useTestPacks, useTestPayments } from "./hooks";
import { PackCard } from "./PackCard";
import { payWithRazorpay } from "./razorpayFlow";
import { SpendLimitCard } from "./SpendLimitCard";
import { TestModeNotice } from "./TestModeNotice";

export function BillingView() {
  const packs = usePacks(true);
  const freePlan = useFreePlan();
  const { account } = useAccount();
  const toast = useToast();
  const revalidate = useRevalidate();
  const [buying, setBuying] = useState<string | null>(null);
  const [active, setActive] = useState<{ pack: CreditPack; checkout: Checkout } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const testPayments = useTestPayments();
  const testPacks = useTestPacks();
  const remaining = account?.wallet.month_remaining_paise ?? Infinity;

  // Deep link from the low-credit prompt: ?buy=<pack id> starts that checkout once.
  const params = useSearchParams();
  const router = useRouter();
  const autoBuy = useRef(false);
  useEffect(() => {
    const id = params.get("buy");
    if (!id || autoBuy.current || !account) return;
    const pack = [...packs, ...testPacks].find((p) => p.id === id);
    if (!pack) return;
    autoBuy.current = true;
    router.replace("/dashboard/billing", { scroll: false });
    const price = params.get("price");
    if (price !== null && Number(price) !== Number(pack.price_paise)) {
      toast("The price of that pack has changed. Review the current price below before buying.", "error");
    } else if (packCheckoutPrice(pack).total <= remaining) void buy(pack);
    else toast("That pack would go over your monthly limit. Raise the limit below to buy it.", "error");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, packs, testPacks, account]);

  async function buy(pack: CreditPack) {
    if (buying || confirming) return; // one checkout at a time
    setBuying(pack.id);
    let checkout: Checkout;
    try {
      checkout = await api.checkout(pack.id, { expected_amount_paise: Number(pack.price_paise) });
      if (Number(checkout.payment.amount_paise) !== packCheckoutPrice(pack).total ||
          checkout.payment.credits !== pack.credits + pack.bonus_credits ||
          (checkout.payment.validity_months ?? null) !== (pack.validity_months ?? null)) {
        await api.cancelPayment(checkout.payment.id).catch(() => {});
        void revalidate("catalog", "payments");
        throw new Error("That pack has changed. Review the updated offer before buying.");
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't start checkout.", "error");
      setBuying(null);
      return;
    }
    if (checkout.checkout.provider !== "razorpay") {
      setBuying(null);
      setActive({ pack, checkout });
      return;
    }
    try {
      const result = await payWithRazorpay({
        pack,
        checkout,
        email: account?.profile.email,
        onConfirming: () => setConfirming(true),
      });
      if (result.kind === "paid") router.push(`/thank-you?payment=${encodeURIComponent(checkout.payment.id)}`);
      else if (result.kind === "failed") {
        try { sessionStorage.setItem(`payment-failure:${checkout.payment.id}`, result.message); } catch {}
        router.push(`/payment-failed?payment=${encodeURIComponent(checkout.payment.id)}`);
      } else if (result.kind === "cancelled") toast("Checkout closed. Check billing history if you completed a payment.");
      else {
        toast(result.message);
        // The webhook finishes it on the server; refresh the balance shortly.
        setTimeout(() => void revalidate("me", "transactions", "payments"), 20_000);
      }
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't open checkout.", "error");
      await api.cancelPayment(checkout.payment.id).catch(() => {});
    } finally {
      setBuying(null);
      setConfirming(false);
      void revalidate("me", "transactions", "payments");
    }
  }

  return (
    <>
      <PageHeader title="Images & billing" description="Your balance, spending, image packs and history." />

      <motion.div {...rise(0)}>
        <BalanceHero wallet={account?.wallet ?? null} buyHref="#packs" />
      </motion.div>

      <motion.div {...rise(1)} id="packs" className="mb-5 mt-10 scroll-mt-6">
        <h2 className="text-[18px] font-semibold tracking-tight">Buy images</h2>
        <p className="mt-1 text-[13.5px] text-stone-600">Your latest paid pack resets the expiry of any unused, still-valid pack credits. A shorter pack can move that date sooner.</p>
        {testPayments && (
          <div className="mt-4">
            <TestModeNotice />
          </div>
        )}
      </motion.div>

      <div className={freePlan ? "grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" : "grid gap-5 md:grid-cols-2 xl:grid-cols-4"}>
        {freePlan && (
          <motion.div {...rise(1)}>
            <FreePlanCard plan={freePlan} />
          </motion.div>
        )}
        {packs.map((p, i) => (
          <motion.div key={p.id} {...rise(i + 1)}>
            <PackCard pack={p} overLimit={packCheckoutPrice(p).total > remaining} loading={buying === p.id} onBuy={() => buy(p)} />
          </motion.div>
        ))}
        <motion.div {...rise(4)}><SoldOutPlan /></motion.div>
      </div>

      {testPacks.length > 0 && (
        <motion.section {...rise(3)} aria-label="Developer testing" className="mt-8 rounded-3xl border-2 border-dashed border-amber-300/80 bg-amber-50/50 p-5">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-amber-400/25 px-2.5 py-1 text-[10.5px] font-semibold uppercase tracking-wider text-amber-800">Developer testing</span>
            <p className="text-[13px] text-amber-900">Only your tester account sees this. It runs a real payment through the live checkout.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-3">
            {testPacks.map((p) => (
              <PackCard key={p.id} pack={p} overLimit={packCheckoutPrice(p).total > remaining} loading={buying === p.id} onBuy={() => buy(p)} />
            ))}
          </div>
        </motion.section>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_1.35fr]">
        <motion.div {...rise(4)}>
          <SpendLimitCard />
        </motion.div>
        <motion.div {...rise(5)}>
          <HistoryCard />
        </motion.div>
      </div>

      <CheckoutModal
        pack={active?.pack ?? null}
        checkout={active?.checkout ?? null}
        onClose={() => {
          setActive(null);
          toast("Checkout cancelled. Nothing was charged.");
          void revalidate("payments");
        }}
        onPaid={(paymentId) => {
          setActive(null);
          router.push(`/thank-you?payment=${encodeURIComponent(paymentId)}`);
          void revalidate("me", "transactions", "payments");
        }}
        onError={(m) => toast(m, "error")}
      />

      {confirming && (
        <div role="status" aria-live="polite" className="fixed inset-0 z-[95] grid place-items-center bg-ink/50 p-4 backdrop-blur-sm">
          <div className="glass-strong flex items-center gap-3 rounded-2xl px-6 py-5 text-[14px] font-medium">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-bronze/30 border-t-bronze" />
            Confirming your payment… please don&apos;t close this page.
          </div>
        </div>
      )}
    </>
  );
}
