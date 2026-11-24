// /v1/me, /v1/spend-limit, /v1/credits/transactions
import type { Router } from "../../_shared/router.ts";
import { admin, requireUser } from "../../_shared/supabase.ts";
import { Errors, fromDbError, json, readJson } from "../../_shared/http.ts";
import { pagination, parse, spendLimitSchema, updateProfileSchema } from "../../_shared/validation.ts";

export async function loadAccount(userId: string) {
  const [profileRes, walletRes, spendRes] = await Promise.all([
    admin.from("profiles").select("id, email, full_name, company, phone, created_at").eq("id", userId).single(),
    admin.rpc("refresh_expiring_credits", { p_user_id: userId }),
    admin.rpc("current_month_spend_paise", { p_user_id: userId }),
  ]);

  if (profileRes.error) throw Errors.notFound("Account");
  if (walletRes.error) throw fromDbError(walletRes.error);
  if (spendRes.error) throw fromDbError(spendRes.error);

  const wallet = walletRes.data;
  const monthSpend = Number(spendRes.data ?? 0);
  const limit = Number(wallet.monthly_spend_limit_paise);

  return {
    profile: profileRes.data,
    wallet: {
      balance: wallet.balance,
      lifetime_purchased: wallet.lifetime_purchased,
      lifetime_used: wallet.lifetime_used,
      monthly_spend_limit_paise: limit,
      month_spend_paise: monthSpend,
      month_remaining_paise: Math.max(limit - monthSpend, 0),
      currency: "INR",
      free_plan_claimed: wallet.free_plan_claimed_at !== null,
      updated_at: wallet.updated_at,
    },
  };
}

export function accountRoutes(r: Router) {
  r.get("/v1/me", async ({ req }) => {
    const user = await requireUser(req);
    // (The device limit is enforced in requireUser for every request.)
    // Refund renders whose connection dropped before reading the current balance.
    await admin.rpc("fail_stale_generations", { p_user_id: user.id });
    return json(req, await loadAccount(user.id));
  });

  r.patch("/v1/me", async ({ req }) => {
    const user = await requireUser(req);
    const body = parse(updateProfileSchema, await readJson(req));
    if (Object.keys(body).length === 0) throw Errors.badRequest("Nothing to update.");

    const { error } = await admin.from("profiles").update(body).eq("id", user.id);
    if (error) throw fromDbError(error);
    return json(req, await loadAccount(user.id));
  });

  r.put("/v1/spend-limit", async ({ req }) => {
    const user = await requireUser(req);
    const { monthly_limit_inr } = parse(spendLimitSchema, await readJson(req));

    const { error } = await admin.rpc("set_monthly_spend_limit", {
      p_user_id: user.id,
      p_limit_paise: monthly_limit_inr * 100,
    });
    if (error) throw fromDbError(error);
    return json(req, await loadAccount(user.id));
  });

  r.get("/v1/credits/transactions", async ({ req, url }) => {
    const user = await requireUser(req);
    const { limit, before } = parse(pagination, Object.fromEntries(url.searchParams));

    let q = admin
      .from("credit_transactions")
      .select("id, delta, balance_after, kind, description, payment_id, generation_id, created_at")
      .eq("user_id", user.id)
      .order("id", { ascending: false })
      .limit(limit + 1);
    if (before) q = q.lt("id", Number(before));

    const { data, error } = await q;
    if (error) throw fromDbError(error);

    const items = data.slice(0, limit);
    const next = data.length > limit ? String(items[items.length - 1].id) : null;
    return json(req, { items, next_cursor: next });
  });
}
