"use client";

import Link from "next/link";
import { createContext, Suspense, useContext, useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Arrow, Button, buttonClass } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { AuthForm } from "@/features/auth/AuthForm";
import { api, ApiError } from "@/lib/api";
import { checkoutPrice, GST_PERCENT } from "@/lib/checkout-price";
import { cn, formatPaise } from "@/lib/format";
import { PACKS, validityLabel } from "@/lib/catalog";
import { openRazorpay } from "@/lib/razorpay";
import { createClient } from "@/lib/supabase/client";
import type { CheckoutContact, CreditPack } from "@/lib/types";
import { payWithRazorpay } from "./razorpayFlow";

const CheckoutContext = createContext<{ path: string; select: (id: string) => void } | null>(null);
const purchaseUrl = (path: string, id: string) => `${path}?buy=${encodeURIComponent(id)}#pricing`;

export function PricingCheckout({ landing, children }: { landing: boolean; children: React.ReactNode }) {
  const path = landing ? "/landing" : "/";
  const [selected, setSelected] = useState("");
  useEffect(() => {
    const sync = () => setSelected(new URLSearchParams(location.search).get("buy") ?? "");
    sync();
    window.addEventListener("popstate", sync);
    return () => window.removeEventListener("popstate", sync);
  }, []);

  function select(id: string) {
    history.replaceState(null, "", purchaseUrl(path, id));
    setSelected(id);
  }

  function close(explore = false) {
    const next = new URL(location.href);
    next.searchParams.delete("buy");
    history.replaceState(null, "", next.pathname + next.search + next.hash);
    setSelected("");
    if (explore) document.getElementById("pricing")?.scrollIntoView?.();
  }

  return <CheckoutContext.Provider value={{ path, select }}>
    {children}
    {selected && PACKS.some((pack) => pack.id === selected) && <CheckoutDialog key={selected} id={selected} landing={landing} path={path} close={close} />}
  </CheckoutContext.Provider>;
}

export function PricingCheckoutLink({ id, name, featured }: { id: string; name: string; featured: boolean }) {
  const checkout = useContext(CheckoutContext);
  return <Link href={purchaseUrl(checkout?.path ?? "/landing", id)}
    className={cn(buttonClass(featured ? "bronze" : "primary"), "group w-full")}
    onClick={(event) => {
      if (!checkout || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      checkout.select(id);
    }}>
    Get {name} <Arrow />
  </Link>;
}

type GuestPayment = { id: string; access: string; evidence?: { provider_payment_id: string; provider_order_id: string; signature: string } };
type Completion = "sent" | "existing" | "pending" | "website";

function CheckoutDialog({ id, landing, path, close }: { id: string; landing: boolean; path: string; close: (explore?: boolean) => void }) {
  const router = useRouter();
  const [pack, setPack] = useState<CreditPack>();
  const [contact, setContact] = useState<CheckoutContact>();
  const [signedIn, setSignedIn] = useState<boolean>();
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [providerOpen, setProviderOpen] = useState(false);
  const [completion, setCompletion] = useState<Completion>();
  const [guestPayment, setGuestPayment] = useState<GuestPayment>();
  const [pending, setPending] = useState("");
  const [limit, setLimit] = useState<number>();
  const [reload, setReload] = useState(0);
  const inProgress = useRef(false);
  const closeButton = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const storageKey = `checkout-confirmation:${landing ? "guest" : "website"}:${id}`;

  function saveConfirmation(value: GuestPayment | string | null) {
    try {
      if (value) sessionStorage.setItem(storageKey, JSON.stringify(value));
      else sessionStorage.removeItem(storageKey);
    } catch {}
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) ?? "null");
      if (landing && saved?.id && saved?.access) setGuestPayment(saved);
      else if (!landing && typeof saved === "string") setPending(saved);
    } catch {}
  }, [storageKey, landing]);

  useEffect(() => {
    let active = true;
    api.catalog().then(({ packs }) => {
      if (!active) return;
      const found = packs.find((p) => p.id === id);
      if (found) setPack(found);
      else setError("This plan is currently unavailable.");
    }).catch((e: unknown) => { if (active) setError(message(e)); });
    if (!landing) createClient().auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) setError(error.message);
      else setSignedIn(Boolean(data.session));
    }).catch((e: unknown) => { if (active) setError(message(e)); });
    return () => { active = false; };
  }, [id, landing, reload]);

  useEffect(() => {
    if (!signedIn || landing) return;
    let active = true;
    api.checkoutContact("website").then((details) => { if (active) setContact(details); })
      .catch((e: unknown) => { if (active) setError(message(e)); });
    return () => { active = false; };
  }, [signedIn, landing, reload]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, []);

  useEffect(() => {
    if (completion !== "website") return;
    const timer = window.setTimeout(() => router.replace("/dashboard"), 1800);
    return () => window.clearTimeout(timer);
  }, [completion, router]);

  const quote = pack ? checkoutPrice(Number(pack.price_paise)) : undefined;

  async function verifyGuest(value: GuestPayment) {
    const result = await api.confirmGuestCheckout(value.id, value.access, value.evidence);
    setCompletion(result.activation);
    if (result.activation !== "pending") {
      setGuestPayment(undefined);
      saveConfirmation(null);
    }
  }

  async function pay(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pack || !quote || guestPayment || pending || inProgress.current) return;
    const form = new FormData(event.currentTarget);
    const read = (key: string) => String(form.get(key) ?? "").trim();
    inProgress.current = true;
    setBusy(true);
    setError("");
    try {
      if (landing) {
        const buyer = { full_name: read("full_name"), company: read("company"), email: read("email"), phone: read("phone") };
        const gstin = read("gstin").toUpperCase();
        const order = await api.guestCheckout({ ...buyer, pack_id: id, expected_amount_paise: quote.base, ...(gstin && { gstin }) });
        if (!order.key_id || !order.order_id || order.amount !== quote.total || order.currency !== "INR") throw new Error("The checkout amount does not match this plan. Please try again.");
        setProviderOpen(true);
        const result = await openRazorpay({
          key: order.key_id, order_id: order.order_id, amount: order.amount, currency: order.currency, name: order.name,
          description: pack.name + " image pack", prefill: { name: buyer.full_name, email: buyer.email, contact: buyer.phone },
          readonly: { email: true, contact: true },
        });
        setProviderOpen(false);
        if (result.kind === "failed") { setError(result.message); return; }
        if (result.kind !== "paid") return;
        const proof = { id: order.id, access: order.access, evidence: {
          provider_payment_id: result.response.razorpay_payment_id,
          provider_order_id: result.response.razorpay_order_id,
          signature: result.response.razorpay_signature,
        } };
        setGuestPayment(proof);
        saveConfirmation(proof);
        await verifyGuest(proof);
      } else if (contact?.email) {
        const phone = contact.phone || read("phone");
        if (!contact.phone) {
          await api.updateProfile({ phone });
          setContact({ ...contact, phone });
        }
        const checkout = await api.checkout(id, { expected_amount_paise: quote.base });
        if (Number(checkout.payment.amount_paise) !== quote.total || checkout.payment.credits !== pack.credits + pack.bonus_credits ||
            (checkout.payment.validity_months ?? null) !== (pack.validity_months ?? null) ||
            (checkout.checkout.provider === "razorpay" && (checkout.checkout.amount !== quote.total || checkout.checkout.currency !== "INR"))) {
          await api.cancelPayment(checkout.payment.id).catch(() => {});
          throw new Error("The checkout amount does not match this plan. Please try again.");
        }
        if (checkout.checkout.provider === "dummy") {
          if ((await api.confirmPayment(checkout.payment.id)).payment.status === "paid") setCompletion("website");
          return;
        }
        setProviderOpen(true);
        const result = await payWithRazorpay({
          pack, checkout, email: contact.email, phone, name: contact.full_name ?? undefined,
          onConfirming: () => { setProviderOpen(false); setPending(checkout.payment.id); saveConfirmation(checkout.payment.id); },
        });
        if (result.kind === "paid") { setPending(""); saveConfirmation(null); setCompletion("website"); }
        if (result.kind === "failed") setError(result.message);
        if (result.kind === "pending") setError(result.message);
      }
    } catch (failure) {
      setError(message(failure));
      if (failure instanceof ApiError && failure.code === "SPEND_LIMIT_EXCEEDED") {
        const account = await api.me().catch(() => null);
        if (account) setLimit(Math.ceil((account.wallet.month_spend_paise + quote.total) / 100));
      }
    } finally {
      setProviderOpen(false);
      setBusy(false);
      inProgress.current = false;
      if (!completion) closeButton.current?.focus();
    }
  }

  async function checkPayment() {
    if (inProgress.current) return;
    inProgress.current = true;
    setBusy(true);
    setError("");
    try {
      if (guestPayment) await verifyGuest(guestPayment);
      else if (pending) {
        const { payment } = await api.confirmPayment(pending);
        if (payment.status === "paid") { setPending(""); saveConfirmation(null); setCompletion("website"); }
      }
    } catch (failure) { setError(message(failure)); }
    finally { inProgress.current = false; setBusy(false); }
  }

  async function raiseLimit() {
    if (!limit || inProgress.current) return;
    inProgress.current = true;
    setBusy(true);
    try { await api.setSpendLimit(limit); setLimit(undefined); setError(""); }
    catch (failure) { setError(message(failure)); }
    finally { inProgress.current = false; setBusy(false); }
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] grid place-items-center overflow-y-auto bg-ink/60 p-3 backdrop-blur-sm sm:p-6" hidden={providerOpen}
      style={providerOpen ? { display: "none" } : undefined}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby="pricing-checkout-title"
        className="relative max-h-[calc(100dvh-24px)] w-full max-w-lg overflow-y-auto rounded-3xl bg-ivory-50 p-5 shadow-lift sm:p-7"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) { event.preventDefault(); close(); }
          if (event.key !== "Tab") return;
          const items = Array.from(panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled)') ?? []);
          const first = items[0], last = items[items.length - 1];
          if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
          if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
        }}>
        <button ref={closeButton} type="button" aria-label="Close checkout" disabled={busy} onClick={() => close()}
          className="absolute right-4 top-4 rounded-full p-2 text-stone-600 hover:bg-ivory-200 disabled:opacity-50"><Icon name="x" /></button>
        <h2 id="pricing-checkout-title" className="pr-10 font-display text-2xl font-semibold">{pack ? `${pack.name} checkout` : "Checkout"}</h2>
        {pack && quote && <div className="my-4 rounded-2xl bg-ivory-200 p-4 text-sm">
          <p className="font-semibold">{pack.credits + pack.bonus_credits} images{pack.validity_months ? ` · ${validityLabel(pack.validity_months)}` : ""}</p>
          <p className="mt-1 text-stone-600">{formatPaise(quote.base)} + {GST_PERCENT}% GST ({formatPaise(quote.tax)})</p>
          <p className="mt-1 font-semibold">Total {formatPaise(quote.total)}</p>
        </div>}
        {completion ? <div className="space-y-3" role="status">
          <p className="text-lg font-semibold">Your payment is successfully completed.</p>
          {completion === "sent" && <p className="text-sm">A secure activation link has been sent to your email. Open it to set your password, then log in.</p>}
          {completion === "existing" && <p className="text-sm">Your images are available in your existing account. <Link href="/login" className="underline">Log in</Link> to use them.</p>}
          {completion === "pending" && <p className="text-sm">We’re preparing your account activation email. Check again in a minute.</p>}
          {completion === "website" && <p className="text-sm">Redirecting to the portal. <Link href="/dashboard" className="underline">Open portal</Link></p>}
        </div> : !pack ? (!error && <p role="status">Loading the plan…</p>) :
          guestPayment || pending ? <p role="status" className="text-sm">Check your payment status before paying again.</p> :
          !landing && signedIn === false ? (
            <Suspense><AuthForm key={mode} mode={mode} checkout={{ next: purchaseUrl(path, id), onAuthenticated: () => { setError(""); setSignedIn(true); }, onModeChange: setMode }} /></Suspense>
          ) : landing || contact ? (
            <form method="post" onSubmit={pay} className="space-y-3">
              {landing && <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2">
                <CheckoutInput name="full_name" label="Full name" autoComplete="name" />
                <CheckoutInput name="company" label="Company name" autoComplete="organization" />
                <CheckoutInput name="email" label="Email" type="email" autoComplete="email" />
                <CheckoutInput name="phone" label="Mobile number" type="tel" autoComplete="tel" />
                <label className="block sm:col-span-2"><span className="label">GSTIN (optional)</span>
                  <input className="input uppercase" name="gstin" maxLength={15} autoCapitalize="characters"
                    pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][A-Za-z0-9][Zz][A-Za-z0-9]" />
                </label>
              </fieldset>}
              {!landing && !contact?.phone && <CheckoutInput name="phone" label="Mobile number" type="tel" autoComplete="tel" />}
              {limit && <Button type="button" variant="outline" className="w-full" disabled={busy} onClick={raiseLimit}>Raise monthly limit to {formatPaise(limit * 100)}</Button>}
              <Button className="w-full" type="submit" loading={busy} disabled={!landing && !contact?.email}>{`Pay ${formatPaise(quote?.total ?? 0)} with Razorpay`}</Button>
            </form>
          ) : !error && <p role="status" className="text-sm">Loading your account…</p>}
        {error && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {error && !guestPayment && !pending && (!pack || (!landing && signedIn !== false && !contact)) && <Button variant="outline" className="mt-3" onClick={() => { setError(""); setReload((n) => n + 1); }}>Retry</Button>}
        {(guestPayment || pending) && <Button variant="outline" className="mt-3 w-full" loading={busy} onClick={checkPayment}>{completion === "pending" ? "Check activation email status" : "Check payment status"}</Button>}
        {!pending && !guestPayment && completion !== "website" && <Button variant="ghost" className="mt-2 w-full" type="button" disabled={busy} onClick={() => close(true)}>Explore all plans</Button>}
      </div>
    </div>,
    document.body,
  );
}

function CheckoutInput({ name, label, type = "text", autoComplete }: { name: string; label: string; type?: string; autoComplete: string }) {
  return <label className="block"><span className="label">{label}</span>
    <input className="input" name={name} type={type} autoComplete={autoComplete}
      required maxLength={type === "tel" ? 16 : type === "email" ? 254 : 120} pattern={type === "tel" ? "[+]?[0-9]{7,15}" : undefined} />
  </label>;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Couldn’t continue checkout. Try again.";
}
