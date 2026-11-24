// Runtime settings (Supabase secrets). Changing a secret needs no redeploy.

/** Free credits granted once per account by the temporary ₹0 plan. 0 disables it. */
export const FREE_PLAN_CREDITS = Math.max(0, Number(Deno.env.get("FREE_PLAN_CREDITS") ?? 50) || 0);

/** Largest photo accepted for a render, in bytes. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
