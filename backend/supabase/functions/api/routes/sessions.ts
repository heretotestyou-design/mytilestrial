// /v1/sessions — the devices signed in to this account (max MAX_DEVICES).
import type { Router } from "../../_shared/router.ts";
import { admin, forgetSession, MAX_DEVICES, requireUser } from "../../_shared/supabase.ts";
import { Errors, fromDbError, json } from "../../_shared/http.ts";
import { parse, uuid } from "../../_shared/validation.ts";

type SessionRow = { id: string; created_at: string; last_active_at: string; user_agent: string | null; ip: string | null };

/** Trims the account to MAX_DEVICES, always keeping the calling device. */
export async function enforceDeviceLimit(userId: string, sessionId: string | undefined) {
  if (!sessionId) return;
  const { error } = await admin.rpc("enforce_session_limit", { p_user_id: userId, p_current: sessionId, p_max: MAX_DEVICES });
  if (error) console.error("enforce_session_limit failed", error);
}

export function sessionRoutes(r: Router) {
  r.get("/v1/sessions", async ({ req }) => {
    const user = await requireUser(req);
    await enforceDeviceLimit(user.id, user.sessionId);
    const { data, error } = await admin.rpc("list_sessions", { p_user_id: user.id });
    if (error) throw fromDbError(error);
    const sessions = (data as SessionRow[]).map((s) => ({ ...s, current: s.id === user.sessionId }));
    return json(req, { sessions, max_devices: MAX_DEVICES });
  });

  r.delete("/v1/sessions/:id", async ({ req, params }) => {
    const user = await requireUser(req);
    parse(uuid, params.id);
    if (params.id === user.sessionId) throw Errors.badRequest("Use Sign out to end the session on this device.");
    const { data, error } = await admin.rpc("revoke_session", { p_user_id: user.id, p_session_id: params.id });
    if (error) throw fromDbError(error);
    if (!data) throw Errors.notFound("Device");
    forgetSession(params.id);
    return json(req, { revoked: 1 });
  });

  r.post("/v1/sessions/revoke-others", async ({ req }) => {
    const user = await requireUser(req);
    if (!user.sessionId) throw Errors.badRequest("Sign in again to manage devices.");
    const { data, error } = await admin.rpc("revoke_other_sessions", { p_user_id: user.id, p_current: user.sessionId });
    if (error) throw fromDbError(error);
    return json(req, { revoked: data ?? 0 });
  });
}
