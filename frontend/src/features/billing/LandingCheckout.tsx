"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { SessionGuard } from "@/components/auth/SessionGuard";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { api, ApiError } from "@/lib/api";
import { validityLabel } from "@/lib/catalog";
import { formatNumber, formatPaise } from "@/lib/format";
import { packCheckoutPrice } from "@/lib/checkout-price";
import type { Checkout, CheckoutContact, CreditPack } from "@/lib/types";
import { CheckoutModal } from "./CheckoutModal";
import { payWithRazorpay } from "./razorpayFlow";

const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function LandingCheckout({ packId, quotedPrice, pendingPayment }: {
  packId?: string; quotedPrice?: string; pendingPayment?: string;
}) {
  const router = useRouter();
  const [offer, setOffer] = useState<{ pack?: CreditPack; contact: CheckoutContact }>();
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const active = useRef(false);
  const [pending, setPending] = useState(typeof pendingPayment === "string" && uuid.test(pendingPayment) ? pendingPayment : "");
  const [limit, setLimit] = useState<number>();
  const [testCheckout, setTestCheckout] = useState<Checkout | null>(null);

  useEffect(() => {
    let current = true;
    Promise.all([api.catalog(), api.checkoutContact()]).then(([catalog, contact]) => {
      if (current) setOffer({ pack: catalog.packs.find((pack) => pack.id === packId), contact });
    }).catch((e) => {
      if (current) setError(e instanceof Error ? e.message : "Checkout is unavailable. Please try again.");
    });
    return () => { current = false; };
  }, [packId]);

  const pack = offer?.pack;
  const contact = offer?.contact;
  const quoteChanged = Boolean(pack && quotedPrice && Number(quotedPrice) !== Number(pack.price_paise));
  function redirect(id: string, paid: boolean) {
    router.replace(`/${paid ? "thank-you" : "payment-failed"}?payment=${encodeURIComponent(id)}&from=landing`);
  }

  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pack || !contact?.email || active.current || pending) return;
    const form = new FormData(event.currentTarget);
    const read = (name: string) => String(form.get(name) ?? "").trim();
    const details = { full_name: read("full_name"), phone: read("phone"), company: read("company") || undefined, gstin: read("gstin").toUpperCase() || undefined };
    if (!details.full_name) {
      setError("Enter your full name.");
      return;
    }
    const digits = details.phone.replace(/\D/g, "").length;
    if (digits < 7 || digits > 15 || !/^\+?[0-9 ()-]+$/.test(details.phone)) {
      setError("Enter a valid contact number, including the country code if applicable.");
      return;
    }
    active.current = true;
    setBusy(true);
    setError("");
    setStatus("Saving your checkout details…");
    let checkout: Checkout | undefined;
    try {
      checkout = await api.checkout(pack.id, { expected_amount_paise: Number(pack.price_paise), details });
      if (checkout.checkout.provider === "dummy") {
        setStatus("");
        setTestCheckout(checkout);
        return;
      }
      const id = checkout.payment.id;
      setStatus("Opening Razorpay…");
      const result = await payWithRazorpay({
        pack, checkout, email: contact.email, name: details.full_name, phone: details.phone,
        onConfirming: () => {
          setPending(id);
          const url = new URL(window.location.href);
          url.searchParams.set("pending", id);
          window.history.replaceState(null, "", url);
          setStatus("Confirming your payment…");
        },
      });
      if (result.kind === "paid") redirect(id, true);
      else if (result.kind === "failed") {
        try { sessionStorage.setItem(`payment-failure:${id}`, result.message); } catch {}
        redirect(id, false);
      } else {
        setStatus(result.kind === "pending" ? result.message : "Checkout closed. You can reopen Razorpay when ready.");
      }
    } catch (e) {
      if (checkout) await api.cancelPayment(checkout.payment.id).catch(() => {});
      setStatus("");
      setError(e instanceof Error ? e.message : "Couldn't open payment.");
      if (e instanceof ApiError && e.code === "SPEND_LIMIT_EXCEEDED") {
        const account = await api.me().catch(() => null);
        if (account) setLimit(Math.ceil((account.wallet.month_spend_paise + packCheckoutPrice(pack).total) / 100));
      }
    } finally {
      active.current = false;
      setBusy(false);
    }
  }

  async function checkStatus() {
    if (active.current || !pending) return;
    active.current = true;
    setBusy(true);
    setError("");
    try {
      let { payment } = await api.payment(pending);
      if (payment.status === "created" && payment.provider === "razorpay") {
        try {
          payment = (await api.confirmPayment(pending)).payment;
        } catch (e) {
          if (!(e instanceof ApiError) || e.code !== "PAYMENT_NOT_VERIFIED") throw e;
        }
      }
      if (payment.status === "paid") redirect(payment.id, true);
      else if (payment.status === "failed" || payment.status === "cancelled") redirect(payment.id, false);
      else setStatus("Your payment is still awaiting confirmation. Check again before paying.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't check the payment status.");
    } finally {
      active.current = false;
      setBusy(false);
    }
  }

  async function raiseLimit() {
    if (!limit || active.current) return;
    active.current = true;
    setBusy(true);
    try {
      await api.setSpendLimit(limit);
      setLimit(undefined);
      setError("");
      setStatus("Monthly limit updated. You can continue to payment.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't change your monthly limit.");
    } finally {
      active.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-ivory-100 px-4 py-8 sm:py-12">
      <SessionGuard when="signed-out" to={`/login?next=${encodeURIComponent(`/checkout?${new URLSearchParams({ buy: packId ?? "", price: quotedPrice ?? "", ...(pending && { pending }) })}`)}`} />
      <main className="card mx-auto max-w-lg rounded-3xl p-6 sm:p-8">
        <Logo href="/landing" />
        <h1 className="display mt-7 text-[34px]">Checkout</h1>
        {pack && <div className="mt-5 flex items-start justify-between gap-4 rounded-2xl bg-ivory-200 p-4">
          <div>
            <p className="font-semibold">{pack.name}</p>
            <p className="mt-1 text-sm text-stone-600">{formatNumber(pack.credits + pack.bonus_credits)} images{pack.validity_months ? ` · ${validityLabel(pack.validity_months)}` : ""}</p>
          </div>
          <p className="shrink-0 text-xl font-semibold">{formatPaise(packCheckoutPrice(pack).total)}</p>
        </div>}
        {quoteChanged && <p className="mt-3 text-sm text-amber-900">The pack price has changed. Review the current amount above before paying.</p>}
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {status && <p role="status" className="mt-4 rounded-xl bg-ivory-200 p-3 text-sm">{status}</p>}
        {pending ? (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-stone-600">Check your payment status before making another payment.</p>
            <Button onClick={checkStatus} loading={busy} className="w-full">Check payment status</Button>
          </div>
        ) : pack && contact?.email ? (
          <form method="post" onSubmit={pay} className="mt-6 space-y-4">
            <fieldset disabled={busy || Boolean(testCheckout)} className="space-y-4">
              <div><label className="label" htmlFor="checkout-name">Full name</label><input className="input" name="full_name" id="checkout-name" autoComplete="name" defaultValue={contact.full_name ?? ""} maxLength={120} required /></div>
              <div><label className="label" htmlFor="checkout-email">Account email</label><input className="input" id="checkout-email" type="email" value={contact.email} readOnly /></div>
              <div><label className="label" htmlFor="checkout-contact">Contact number</label><input className="input" name="phone" id="checkout-contact" type="tel" autoComplete="tel" defaultValue={contact.phone ?? ""} minLength={7} maxLength={20} required /></div>
              <div><label className="label" htmlFor="checkout-company">Company name (optional)</label><input className="input" name="company" id="checkout-company" autoComplete="organization" defaultValue={contact.company ?? ""} maxLength={120} /></div>
              <div><label className="label" htmlFor="checkout-gstin">GSTIN (optional)</label><input className="input uppercase" name="gstin" id="checkout-gstin" defaultValue={contact.gstin ?? ""} pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][A-Za-z0-9][Zz][A-Za-z0-9]" maxLength={15} /></div>
            </fieldset>
            {limit && <Button type="button" variant="outline" onClick={raiseLimit} disabled={busy} className="w-full">Raise monthly limit to {formatPaise(limit * 100)}</Button>}
            <Button type="submit" size="lg" loading={busy} disabled={Boolean(testCheckout)} className="w-full">Continue to Razorpay</Button>
          </form>
        ) : offer ? (
          <p className="mt-4 text-sm text-stone-600">{pack ? "A verified account email is required." : "This pack is unavailable. Choose a pack from pricing."}</p>
        ) : !error && <p role="status" className="mt-4 text-sm text-stone-600">Loading checkout…</p>}
        {!pending && <ButtonLink href="/landing#pricing" variant="ghost" className="mt-3 w-full">Back to pricing</ButtonLink>}
      </main>
      <CheckoutModal pack={pack ?? null} checkout={testCheckout} onClose={() => setTestCheckout(null)} onPaid={(id) => redirect(id, true)} onError={setError} />
    </div>
  );
}
