"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";
import { createClient } from "@/lib/supabase/client";
import { clearPersistedCache } from "@/lib/swr";
import { PASSWORD_PATTERN, requestPasswordReset } from "./passwordReset";

export function ResetPassword() {
  const [ready, setReady] = useState<boolean>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const initialized = useRef<Promise<void> | null>(null);

  useEffect(() => {
    let active = true;
    if (!initialized.current) initialized.current = authorize();
    initialized.current.then(() => { if (active) setReady(true); })
      .catch((failure: unknown) => {
        if (!active) return;
        setReady(false);
        if (failure instanceof Error && failure.message) setError(failure.message);
      });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const data = new FormData(event.currentTarget);
    const password = String(data.get("password") ?? "");
    if (ready && password !== data.get("confirm")) { setError("Both passwords must match."); return; }
    setError("");
    setNotice("");
    setBusy(true);
    try {
      if (ready) {
        const auth = createClient().auth;
        const { error } = await auth.updateUser({ password });
        if (error) throw error;
        await auth.signOut({ scope: "local" });
        clearPersistedCache();
        window.location.replace("/login?password_updated=1");
        return;
      }
      await requestPasswordReset(String(data.get("email") ?? "").trim());
      setNotice("If that email belongs to an account, you’ll receive a password reset link.");
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Couldn’t complete the request."); }
    finally { setBusy(false); }
  }

  return <main className="grid min-h-screen place-items-center bg-ivory-100 p-5">
    <div className="card w-full max-w-md rounded-3xl p-6 sm:p-8">
      <Logo href="/landing" />
      <h1 className="display mt-6 text-3xl">{ready ? "Set your password" : "Reset password"}</h1>
      {ready === undefined ? <p role="status" className="mt-4 text-sm">Checking your link…</p> :
        <form method="post" onSubmit={submit} className="mt-5 space-y-3">
          {ready ? <>
            <label className="block"><span className="label">New password</span><input name="password" type="password" className="input"
              pattern={PASSWORD_PATTERN} minLength={8} autoComplete="new-password" required /></label>
            <label className="block"><span className="label">Confirm password</span><input name="confirm" type="password" className="input"
              autoComplete="new-password" required /></label>
            <p className="text-xs text-stone-600">Use at least 8 characters, including letters and numbers.</p>
          </> : <label className="block"><span className="label">Account email</span><input name="email" type="email" className="input" autoComplete="email" required /></label>}
          {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
          {notice && <p role="status" className="text-sm text-emerald-800">{notice}</p>}
          <Button type="submit" className="w-full" loading={busy}>{ready ? "Save password and log in" : "Send reset link"}</Button>
        </form>}
      <ButtonLink href="/login" variant="ghost" className="mt-3 w-full">Back to login</ButtonLink>
    </div>
  </main>;
}

async function authorize() {
  const url = new URL(location.href);
  const hash = new URLSearchParams(url.hash.slice(1));
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const access = hash.get("access_token");
  const refresh = hash.get("refresh_token");
  if (hash.has("error") || url.searchParams.has("error")) throw new Error("This link is invalid or expired. Request a new link.");
  const auth = createClient().auth;

  if (tokenHash && (type === "invite" || type === "recovery")) {
    history.replaceState(null, "", url.pathname);
    const { error } = await auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) throw new Error("This link is invalid or expired. Request a new link.");
  } else if (access && refresh) {
    history.replaceState(null, "", url.pathname);
    const { error } = await auth.setSession({ access_token: access, refresh_token: refresh });
    if (error) throw new Error("This link is invalid or expired. Request a new link.");
  } else if (!url.searchParams.has("ready")) {
    throw new Error();
  }
  const { data, error } = await auth.getUser();
  if (error || !data.user) throw new Error("This link is invalid or expired. Request a new link.");
  history.replaceState(null, "", "/reset-password?ready=1");
}
