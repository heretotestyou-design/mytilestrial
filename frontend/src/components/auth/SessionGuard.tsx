"use client";

// Browser-side half of route protection. The middleware handles real page loads, but
// Chrome's back/forward cache can show a page without asking the server:
//   * signed in  + Back to the website or login page  -> straight to the dashboard
//   * signed out + Back to a cached dashboard page     -> to the login page
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safeRedirect";

type Props = { when: "signed-in" | "signed-out"; to: string; preserveNext?: boolean; allowPricingCheckout?: boolean };

export function SessionGuard({ when, to, preserveNext = false, allowPricingCheckout = false }: Readonly<Props>) {
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      const { data } = await createClient().auth.getSession().catch(() => ({ data: { session: null } }));
      const signedIn = Boolean(data.session);
      if (allowPricingCheckout && /^(starter|studio|showroom)$/.test(new URLSearchParams(window.location.search).get("buy") ?? "")) return;
      if (!cancelled && signedIn === (when === "signed-in")) {
        const next = preserveNext ? safeNext(new URLSearchParams(window.location.search).get("next"), to) : to;
        window.location.replace(next);
      }
    };
    void check();
    // Restored from the back/forward cache: effects don't re-run, so check again.
    const onShow = (e: PageTransitionEvent) => e.persisted && void check();
    window.addEventListener("pageshow", onShow);
    return () => {
      cancelled = true;
      window.removeEventListener("pageshow", onShow);
    };
  }, [when, to, preserveNext, allowPricingCheckout]);
  return null;
}
