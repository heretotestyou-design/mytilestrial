"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Arrow, Button } from "@/components/ui/Button";
import { SIGNUP_BONUS_CREDITS } from "@/lib/catalog";
import { safeNext } from "@/lib/safeRedirect";
import { api, ApiError } from "@/lib/api";
import { PASSWORD_PATTERN } from "./passwordReset";
import { OtpForm } from "./OtpForm";

type Mode = "login" | "signup";

// Why the user landed on the login page (set by the dashboard when a session ends).
// Mirrors Supabase Auth (minimum_password_length = 8, password_requirements = letters_digits).
const PASSWORD_RULE = "At least 8 characters, including letters and numbers.";

const REASONS: Record<string, string> = {
  signed_out:
    "You were signed out on this device. Your account can be signed in on up to 3 devices at a time, so signing in elsewhere signs out the least recently used one.",
};

export function AuthForm({ mode, adminOnly = false, checkout }: {
  mode: Mode; adminOnly?: boolean;
  checkout?: { next: string; onAuthenticated: () => void; onModeChange: (mode: Mode) => void };
}) {
  const router = useRouter();
  const params = useSearchParams();
  const next = adminOnly ? "/admin" : checkout?.next ?? safeNext(params.get("next"));
  const nextQuery = next === "/dashboard" ? "" : `?next=${encodeURIComponent(next)}`;
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(params.get("error"));
  const [notice, setNotice] = useState<string | null>(
    params.get("password_updated") === "1" ? "Password saved. Log in with your new password." : REASONS[params.get("reason") ?? ""] ?? null,
  );
  // Sign-up with an email that already has an account.
  const [existing, setExisting] = useState(false);
  // Set once a verification code has been emailed; swaps the form for the code screen.
  const [verifying, setVerifying] = useState<{ email: string; cooldown: number } | null>(null);

  function finishAuth() {
    if (checkout) checkout.onAuthenticated();
    else {
      router.replace(next);
      router.refresh();
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setExisting(false);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");

    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error && (error.code === "email_not_confirmed" || /not confirmed/i.test(error.message))) {
          // Signed up but never entered the code: send a fresh one and ask for it.
          const { error: resendError } = await supabase.auth.resend({ type: "signup", email });
          setVerifying({ email, cooldown: resendError ? 0 : 60 });
          return;
        }
        if (error) throw error;
        if (adminOnly) {
          try {
            await api.adminAccess();
          } catch (failure) {
            if (failure instanceof ApiError && failure.status === 403) {
              await supabase.auth.signOut({ scope: "local" });
              throw new Error("This account does not have admin access.");
            }
            throw failure;
          }
        }
        finishAuth();
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
          data: {
            full_name: String(form.get("full_name") ?? "").trim(),
            company: String(form.get("company") ?? "").trim(),
            ...(checkout && { phone: String(form.get("phone") ?? "").trim() }),
          },
        },
      });
      if (error) throw error;

      // Supabase answers an already-registered (confirmed) email with a user that has no
      // identities and sends no email: say so instead of waiting for a code that never comes.
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        setExisting(true);
        return;
      }
      if (data.session) {
        finishAuth();
      } else {
        setVerifying({ email, cooldown: 60 });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  const isSignup = mode === "signup";

  if (verifying) {
    return (
      <OtpForm
        email={verifying.email}
        next={next}
        initialCooldown={verifying.cooldown}
        onAuthenticated={checkout?.onAuthenticated}
        onBack={() => {
          setVerifying(null);
          setError(null);
        }}
      />
    );
  }

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
      {!checkout && <p className="eyebrow">{adminOnly ? "Administration" : isSignup ? next.startsWith("/checkout?") ? "Checkout" : `Start free · ${SIGNUP_BONUS_CREDITS} images included` : "Welcome back"}</p>}
      <h1 className={checkout ? "font-display text-xl font-semibold" : "display mt-3 text-[44px]"}>{adminOnly ? "Admin sign in" : isSignup ? "Create your account" : "Log in to MyTilesTrial"}</h1>
      {!adminOnly && <p className="mt-3 text-[15px] text-stone-500">
        {isSignup ? "Already have an account? " : "New here? "}
        {checkout ? <button type="button" onClick={() => checkout.onModeChange(isSignup ? "login" : "signup")} className="font-medium text-ink underline underline-offset-4">
          {isSignup ? "Log in" : "Create an account"}
        </button> : <Link href={(isSignup ? "/login" : "/signup") + nextQuery} className="font-medium text-ink underline decoration-bronze/50 underline-offset-4 hover:decoration-bronze">
          {isSignup ? "Log in" : "Create an account"}
        </Link>}
      </p>}

      {/* method="post": if this submits before the JS loads, the password must never go in the URL. */}
      <form method="post" onSubmit={onSubmit} className="mt-8 space-y-4">
        {isSignup && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="full_name" className="label">Full name</label>
              <input id="full_name" name="full_name" required maxLength={120} autoComplete="name" className="input" placeholder="Priya Sharma" />
            </div>
            <div>
              <label htmlFor="company" className="label">Company {!checkout && <span className="text-stone-400">(optional)</span>}</label>
              <input id="company" name="company" required={Boolean(checkout)} maxLength={120} autoComplete="organization" className="input" placeholder="Sharma Tiles" />
            </div>
          </div>
        )}
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" placeholder="you@company.com" />
        </div>
        {checkout && isSignup && <div>
          <label htmlFor="signup-phone" className="label">Mobile number</label>
          <input id="signup-phone" name="phone" className="input" type="tel" autoComplete="tel" required maxLength={16} pattern="[+]?[0-9]{7,15}" />
        </div>}
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={isSignup ? 8 : undefined}
            pattern={isSignup ? PASSWORD_PATTERN : undefined}
            title={isSignup ? PASSWORD_RULE : undefined}
            autoComplete={isSignup ? "new-password" : "current-password"}
            className="input"
            placeholder={isSignup ? "8+ characters, letters and numbers" : "••••••••"}
          />
        </div>

        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-[13.5px] text-red-700">{error}</p>}
        {existing && (
          <p role="alert" className="rounded-xl bg-amber-50 px-4 py-3 text-[13.5px] text-amber-900">
            An account with this email already exists.{" "}
            {checkout ? <button type="button" onClick={() => checkout.onModeChange("login")} className="font-semibold underline underline-offset-4">Log in instead</button> : <Link href={`/login${nextQuery}`} className="font-semibold underline underline-offset-4">
              Log in instead
            </Link>}
          </p>
        )}
        {notice && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-[13.5px] text-emerald-800">{notice}</p>}
        {!isSignup && <Link href="/reset-password" className="text-sm font-medium underline underline-offset-4">Forgot password?</Link>}

        <Button type="submit" size="lg" loading={loading} className="group mt-2 w-full">
          {isSignup ? "Create account" : "Log in"} {!loading && <Arrow />}
        </Button>

        {isSignup && (
          <p className="text-center text-[12px] leading-relaxed text-stone-400">
            By creating an account you agree to our Terms and Privacy Policy.
          </p>
        )}
      </form>
    </motion.div>
  );
}
