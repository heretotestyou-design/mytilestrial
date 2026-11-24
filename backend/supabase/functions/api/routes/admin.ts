import type { Router } from "../../_shared/router.ts";
import { admin, requireUser } from "../../_shared/supabase.ts";
import { ApiError, Errors, fromDbError, json, readJson } from "../../_shared/http.ts";
import { parse, updateProfileSchema, uuid, z } from "../../_shared/validation.ts";
import { sheetConfigured, syncCheckoutContacts } from "../../_shared/checkout-sheet.ts";

const ADMIN_EMAILS = new Set((Deno.env.get("ADMIN_EMAILS") ?? "")
  .split(",").map((email) => email.trim().toLowerCase()).filter(Boolean));

const userListQuery = z.object({
  q: z.string().trim().max(120).default(""),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
});
const PAGE_SIZE = 25;

async function requireAdmin(req: Request) {
  const { id, email } = await requireUser(req);
  if (!email || !ADMIN_EMAILS.has(email.toLowerCase())) throw Errors.forbidden();
  const { data, error } = await admin.auth.admin.getUserById(id);
  if (error) throw new ApiError(503, "ADMIN_CHECK_UNAVAILABLE", "Admin access could not be verified. Try again.");
  const current = data.user;
  if (!current?.email_confirmed_at || !current.email || !ADMIN_EMAILS.has(current.email.toLowerCase())) {
    throw Errors.forbidden();
  }
}

export function adminRoutes(r: Router) {
  r.get("/v1/admin/access", async ({ req }) => {
    await requireAdmin(req);
    return json(req, { allowed: true });
  });

  r.get("/v1/admin/overview", async ({ req, url }) => {
    await requireAdmin(req);
    const totals = admin.rpc("admin_checkout_overview");
    if (url.searchParams.get("view") === "summary") {
      const { data, error } = await totals;
      if (error) throw fromDbError(error);
      return json(req, { ...data, sheet_connected: sheetConfigured() });
    }
    const [overview, contacts] = await Promise.all([
      totals,
      admin.from("checkout_contacts")
        .select("id,created_at,full_name,phone,email,company,gstin,sheet_synced_at,payment:payments(pack_id,status,amount_paise)")
        .order("id", { ascending: false }).limit(15),
    ]);
    if (overview.error || contacts.error) throw fromDbError(overview.error ?? contacts.error!);
    return json(req, { ...overview.data, sheet_connected: sheetConfigured(), contacts: contacts.data });
  });

  r.get("/v1/admin/analytics", async ({ req, url }) => {
    await requireAdmin(req);
    const days = Number(url.searchParams.get("days") ?? 30);
    if (![7, 30, 90].includes(days)) throw Errors.badRequest("Choose a 7, 30 or 90 day period.");
    const { data, error } = await admin.rpc("admin_analytics", { p_days: days });
    if (error) throw fromDbError(error);
    return json(req, data);
  });

  r.get("/v1/admin/users", async ({ req, url }) => {
    await requireAdmin(req);
    const { q, offset } = parse(userListQuery, Object.fromEntries(url.searchParams));
    const { data, error } = await admin.rpc("admin_find_users", { p_search: q, p_offset: offset, p_limit: PAGE_SIZE + 1 });
    if (error) throw fromDbError(error);
    return json(req, { users: data.slice(0, PAGE_SIZE), next_offset: data.length > PAGE_SIZE ? offset + PAGE_SIZE : null });
  });

  r.patch("/v1/admin/users/:id", async ({ req, params }) => {
    await requireAdmin(req);
    const id = parse(uuid, params.id);
    const fields = parse(updateProfileSchema, await readJson(req));
    if (!Object.keys(fields).length) throw Errors.badRequest("Nothing to update.");
    const { data, error } = await admin.from("profiles").update(fields).eq("id", id).select("id").maybeSingle();
    if (error) throw fromDbError(error);
    if (!data) throw Errors.notFound("User");
    return json(req, { id: data.id });
  });

  r.post("/v1/admin/sheets/sync", async ({ req }) => {
    await requireAdmin(req);
    return json(req, { synced: await syncCheckoutContacts() });
  });
}
