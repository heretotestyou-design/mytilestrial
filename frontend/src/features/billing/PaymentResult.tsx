"use client";

import { useEffect, useState } from "react";
import { Button, ButtonLink, buttonClass } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { api } from "@/lib/api";
import { PACKS } from "@/lib/catalog";
import { formatDate, formatPaise } from "@/lib/format";
import type { Payment } from "@/lib/types";

const billing = "/dashboard/billing";
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const whatsapp = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;

export function PaymentResult({ paymentId, landingCheckout = false }: { paymentId?: string; landingCheckout?: boolean }) {
  const backHref = landingCheckout ? "/landing#pricing" : billing;
  const [status, setStatus] = useState<{ payment: Payment | null; reason: string | null }>();
  const [refresh, setRefresh] = useState(0);
  const validId = typeof paymentId === "string" && uuid.test(paymentId);

  useEffect(() => {
    if (!validId) return;
    let current = true;
    setStatus(undefined);
    async function loadPayment() {
      try {
        let before: string | null = null;
        do {
          const result = await api.payments({ limit: 100, before });
          if (!current) return;
          const payment = result.items.find(({ id }) => id === paymentId);
          if (payment) {
            let reason = null;
            try { reason = sessionStorage.getItem(`payment-failure:${paymentId}`); } catch {}
            setStatus({ payment, reason });
            return;
          }
          if (result.next_cursor === before) break;
          before = result.next_cursor;
        } while (before);
      } catch {
        // The result may be unavailable while the buyer is signed out or offline.
      }
      if (current) setStatus({ payment: null, reason: null });
    }
    void loadPayment();
    return () => { current = false; };
  }, [paymentId, validId, refresh]);

  const payment = status?.payment;
  const paid = payment?.status === "paid";
  const failed = payment?.status === "failed" || payment?.status === "cancelled";
  const loading = validId && !status;
  const title = paid ? "Welcome to MyTilesTrial!" : failed ? "Your payment didn't go through" : "Payment status";
  const supportText = payment ? `Hi, I need help with my MyTilesTrial payment. Reference: ${payment.id}` : "Hi, I need help with my MyTilesTrial payment.";
  const hasWhatsApp = whatsapp && /^\d{8,15}$/.test(whatsapp);
  const support = hasWhatsApp
    ? `https://wa.me/${whatsapp}?text=${encodeURIComponent(supportText)}`
    : `mailto:hello@mytilestrial.com?subject=MyTilesTrial%20payment&body=${encodeURIComponent(supportText)}`;

  return (
    <div className="min-h-screen bg-[#faf5ee] bg-[radial-gradient(ellipse_at_top,#f5e6dd,transparent_42%)] px-4 pb-10 pt-6 text-[#2b1d1a] sm:pt-8">
      <header className="mb-6 text-center"><Logo href="/landing" /></header>
      <main className="mx-auto max-w-[600px] rounded-3xl border border-[#ebdfd3] bg-[#fffdf9] p-6 shadow-[0_18px_40px_-24px_#58302666] sm:p-8" aria-labelledby="payment-title">
        {(paid || failed) && (
          <div aria-hidden="true" className={`mx-auto mb-5 grid h-16 w-16 place-items-center rounded-full text-3xl ${paid ? "bg-emerald-50" : "bg-rose-50"}`}>
            {paid ? "🎉" : "😕"}
          </div>
        )}
        <h1 id="payment-title" className="text-center text-[clamp(1.9rem,5vw,2.5rem)] font-semibold leading-tight tracking-tight text-[#5a1f35] [font-family:Georgia,serif]">{title}</h1>
        {paid && payment ? (
          <>
            <p className="mx-auto mt-3 max-w-md text-center text-[15px] leading-relaxed text-stone-600">
              {payment.provider === "dummy" ? "Your test checkout is complete. No money was charged." : "Your payment is confirmed."} {payment.credits} images were added to your account.
            </p>
            <dl className="my-5 space-y-2 rounded-xl bg-[#faf5ee] p-4 text-sm">
              <ResultRow label="Image pack">{PACKS.find((pack) => pack.id === payment.pack_id)?.name ?? "Image pack"}</ResultRow>
              <ResultRow label="Images added">{payment.credits}</ResultRow>
              {payment.credits_expire_at && <ResultRow label="Credits expire">{formatDate(payment.credits_expire_at)}</ResultRow>}
              {payment.provider !== "dummy" && <ResultRow label="Amount paid">{formatPaise(payment.amount_paise)}</ResultRow>}
              <ResultRow label="Payment reference">{payment.id}</ResultRow>
            </dl>
            <h2 className="mt-6 font-display text-lg font-semibold text-[#5a1f35]">What happens next</h2>
            <ol className="mt-2 divide-y divide-dashed divide-stone-200 border-b border-dashed border-stone-200 text-sm leading-relaxed">
              <NextStep number={1} title="Open your dashboard.">Your new images are ready to use.</NextStep>
              <NextStep number={2} title="Upload your tile and room photos.">Choose the layout and finish you want to preview.</NextStep>
              <NextStep number={3} title="Generate and download.">Save the renders you want to share.</NextStep>
            </ol>
            <div className="mt-5 grid gap-2.5">
              <ButtonLink href="/dashboard" size="lg" className="!bg-emerald-700 hover:!bg-emerald-800">Go to dashboard</ButtonLink>
              <ButtonLink href="/landing" variant="outline" size="lg">Back to home</ButtonLink>
            </div>
          </>
        ) : failed && payment ? (
          <>
            <p className="mx-auto mt-3 max-w-md text-center text-[15px] leading-relaxed text-stone-600">Your image pack is ready to retry. You can choose another payment method at checkout.</p>
            {status?.reason && <p className="mt-5 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{status.reason}</p>}
            <p className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900">
              <strong>Was money deducted?</strong> {landingCheckout ? "Contact support to check the payment before trying again." : "Check your billing history or contact support before paying again."}
            </p>
            <h2 className="mt-6 font-display text-lg font-semibold text-[#5a1f35]">Quick fixes</h2>
            <ul className="mt-2 list-disc space-y-3 border-b border-dashed border-stone-200 pb-4 pl-5 text-sm leading-relaxed marker:text-bronze">
              <li>Check the OTP or payment approval in your bank app.</li>
              <li>Try another card, UPI, or net banking if available.</li>
              <li>For an international card, check that online international payments are enabled.</li>
            </ul>
            <div className="mt-5 grid gap-2.5">
              <ButtonLink href={landingCheckout ? `/landing?buy=${encodeURIComponent(payment.pack_id)}#pricing` : `${billing}?buy=${encodeURIComponent(payment.pack_id)}&price=${payment.base_amount_paise ?? payment.amount_paise}`} size="lg" className="!bg-[#5a1f35] hover:!bg-[#742c49]">Try again</ButtonLink>
              <ButtonLink href="/landing#pricing" variant="outline" size="lg">Explore all plans</ButtonLink>
              <a href={support} className={buttonClass("primary", "lg", "!bg-emerald-700 hover:!bg-emerald-800")}>{hasWhatsApp ? "Get help on WhatsApp" : "Email payment support"}</a>
              <ButtonLink href={backHref} variant="outline" size="lg">{landingCheckout ? "Back to pricing" : "Back to billing"}</ButtonLink>
            </div>
          </>
        ) : (
          <>
            <p role="status" className="mt-3 text-center text-[15px] leading-relaxed text-stone-600">
              {loading ? "Checking your payment…" : payment ? "Your payment is awaiting confirmation. Check its status before paying again." : landingCheckout ? "We couldn’t find this payment. Contact support if you need help." : "We couldn’t find this payment. Open billing to check your payment history."}
            </p>
            <div className="mt-5 grid gap-2.5">
              {validId && !loading && <Button size="lg" onClick={() => setRefresh((count) => count + 1)}>Check status</Button>}
              <ButtonLink href={backHref} variant="outline" size="lg">{landingCheckout ? "Back to pricing" : "Go to billing"}</ButtonLink>
            </div>
          </>
        )}
        {payment && (
          <p className="mt-5 break-words text-center text-xs leading-relaxed text-stone-600">
            {paid ? <a className="underline underline-offset-2" href={support}>{hasWhatsApp ? "Get help on WhatsApp" : "Email payment support"}</a> : `Payment reference ${payment.id}`}
          </p>
        )}
      </main>
    </div>
  );
}

function ResultRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
      <dt className="text-stone-600">{label}</dt>
      <dd className="break-all text-right font-medium">{children}</dd>
    </div>
  );
}

function NextStep({ number, title, children }: { number: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 py-3">
      <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[#efe1c3] font-semibold text-[#5a1f35]">{number}</span>
      <span><strong className="text-[#5a1f35]">{title}</strong> {children}</span>
    </li>
  );
}
