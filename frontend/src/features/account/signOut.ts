"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { clearPersistedCache } from "@/lib/swr";

/** Sign out and forget everything cached in this tab. Always ends on the login page,
 *  even when the network call fails (the local session is cleared either way). */
export async function signOut() {
  clearPersistedCache();
  const auth = createClient().auth;
  try {
    const { error } = await auth.signOut();
    if (error) throw error;
  } catch {
    // Offline or server error: at least forget the session in this browser.
    await auth.signOut({ scope: "local" }).catch(() => {});
  }
  window.location.href = "/login";
}

/** Sign-out with a busy flag for the button that triggers it. */
export function useSignOut() {
  const [signingOut, setSigningOut] = useState(false);
  return {
    signingOut,
    signOut: () => {
      if (signingOut) return;
      setSigningOut(true);
      void signOut();
    },
  };
}
