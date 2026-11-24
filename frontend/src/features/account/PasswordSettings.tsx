"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { requestPasswordReset } from "@/features/auth/passwordReset";
import { useAccount } from "./hooks";

export function PasswordSettings() {
  const { account } = useAccount();
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean }>();
  const email = account?.profile.email;
  async function send() {
    if (!email || busy) return;
    setBusy(true);
    setFeedback(undefined);
    try {
      await requestPasswordReset(email);
      setFeedback({ text: "Check your email for the password reset link." });
    } catch (failure) {
      setFeedback({ text: failure instanceof Error ? failure.message : "Couldn’t send the reset link.", error: true });
    } finally { setBusy(false); }
  }
  return <section className="card rounded-2xl p-5" aria-labelledby="password-settings-title">
    <h2 id="password-settings-title" className="font-display text-lg font-semibold">Password</h2>
    <p className="mt-1 text-sm text-stone-600">Send a secure reset link to your account email.</p>
    <Button className="mt-4" variant="outline" disabled={!email} loading={busy} onClick={send}>Send password reset link</Button>
    {feedback && <p role={feedback.error ? "alert" : "status"} className="mt-2 text-sm">{feedback.text}</p>}
  </section>;
}
