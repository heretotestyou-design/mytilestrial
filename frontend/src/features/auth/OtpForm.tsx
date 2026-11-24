"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { Arrow, Button } from "@/components/ui/Button";

// Must match `otp_length` in backend/supabase/config.toml.
export const OTP_LENGTH = 6;
// Supabase refuses a resend within 60s of the last email (auth `max_frequency`).
const RESEND_COOLDOWN_S = 60;

type Props = {
  email: string;
  next: string;
  /** Seconds before "Resend" unlocks. 0 when no email was just sent. */
  initialCooldown?: number;
  onBack: () => void;
  /** After signup: no code arrives if the email already has an account, so point to login. */
  showLoginHint?: boolean;
  onAuthenticated?: () => void;
};

export function OtpForm({ email, next, initialCooldown = RESEND_COOLDOWN_S, onBack, showLoginHint, onAuthenticated }: Props) {
  const router = useRouter();
  const supabase = createClient();
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const [digits, setDigits] = useState<string[]>(() => Array(OTP_LENGTH).fill(""));
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(initialCooldown);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  async function verify(token: string) {
    if (verifying) return;
    setError(null);
    setNotice(null);
    setVerifying(true);
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) {
      setVerifying(false);
      setError(
        /expired|invalid/i.test(error.message)
          ? "That code is incorrect or has expired. Check the latest email, or send a new code."
          : error.message,
      );
      setDigits(Array(OTP_LENGTH).fill(""));
      inputs.current[0]?.focus();
      return;
    }
    if (onAuthenticated) onAuthenticated();
    else {
      router.replace(next);
      router.refresh();
    }
  }

  function fill(from: number, chars: string) {
    const clean = chars.replace(/\D/g, "");
    if (!clean) return;
    const nextDigits = [...digits];
    let i = from;
    for (const ch of clean) {
      if (i >= OTP_LENGTH) break;
      nextDigits[i++] = ch;
    }
    setDigits(nextDigits);
    setError(null);
    inputs.current[Math.min(i, OTP_LENGTH - 1)]?.focus();
    if (nextDigits.every(Boolean)) verify(nextDigits.join(""));
  }

  function onKeyDown(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      const nextDigits = [...digits];
      if (nextDigits[i]) {
        nextDigits[i] = "";
      } else if (i > 0) {
        nextDigits[i - 1] = "";
        inputs.current[i - 1]?.focus();
      }
      setDigits(nextDigits);
    } else if (e.key === "ArrowLeft" && i > 0) {
      inputs.current[i - 1]?.focus();
    } else if (e.key === "ArrowRight" && i < OTP_LENGTH - 1) {
      inputs.current[i + 1]?.focus();
    }
  }

  async function resend() {
    setError(null);
    setNotice(null);
    setResending(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setResending(false);
    if (error) {
      setError(error.message);
      return;
    }
    setDigits(Array(OTP_LENGTH).fill(""));
    setCooldown(RESEND_COOLDOWN_S);
    setNotice("A new code is on its way.");
    inputs.current[0]?.focus();
  }

  const code = digits.join("");

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
      <p className="eyebrow">Verify your email</p>
      <h1 className="display mt-3 text-[44px]">Enter your code</h1>
      <p className="mt-3 text-[15px] text-stone-500">
        We sent a {OTP_LENGTH}-digit code to <span className="font-medium text-ink">{email}</span>. It expires in 10 minutes.
      </p>
      {showLoginHint && (
        <p className="mt-2 text-[13px] text-stone-500">
          No code after a minute? You may already have an account:{" "}
          <a href="/login" className="font-medium text-ink underline decoration-bronze/50 underline-offset-4 hover:decoration-bronze">
            log in instead
          </a>
          .
        </p>
      )}

      <form
        method="post"
        className="mt-8 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === OTP_LENGTH) verify(code);
        }}
      >
        <fieldset disabled={verifying} className="flex justify-between gap-2 sm:gap-3">
          <legend className="sr-only">Verification code</legend>
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              value={d}
              onChange={(e) => fill(i, e.target.value.slice(-OTP_LENGTH))}
              onKeyDown={(e) => onKeyDown(i, e)}
              onPaste={(e) => {
                e.preventDefault();
                fill(i, e.clipboardData.getData("text"));
              }}
              onFocus={(e) => e.target.select()}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${i + 1}`}
              className="input h-14 w-full max-w-[60px] px-0 text-center font-display text-[26px] disabled:opacity-60"
            />
          ))}
        </fieldset>

        {error && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-[13.5px] text-red-700">{error}</p>}
        {notice && <p role="status" className="rounded-xl bg-emerald-50 px-4 py-3 text-[13.5px] text-emerald-800">{notice}</p>}

        <Button type="submit" size="lg" loading={verifying} disabled={code.length < OTP_LENGTH} className="group w-full">
          Verify and continue {!verifying && <Arrow />}
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-between text-[13.5px] text-stone-500">
        <button type="button" onClick={onBack} className="underline decoration-ink/20 underline-offset-4 hover:text-ink">
          Use a different email
        </button>
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0 || resending}
          className="font-medium text-ink underline decoration-bronze/50 underline-offset-4 hover:decoration-bronze disabled:cursor-not-allowed disabled:text-stone-400 disabled:no-underline"
        >
          {resending ? "Sending…" : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </motion.div>
  );
}
