import { createClient } from "@/lib/supabase/client";

export const PASSWORD_PATTERN = "(?=.*[A-Za-z])(?=.*[0-9]).{8,}";

export async function requestPasswordReset(email: string) {
  const url = new URL("/auth/callback", window.location.origin);
  url.searchParams.set("next", "/reset-password");
  const { error } = await createClient().auth.resetPasswordForEmail(email, { redirectTo: url.href });
  if (error) throw error;
}
