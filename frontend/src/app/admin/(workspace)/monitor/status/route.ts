import { createClient } from "@/lib/supabase/server";
import type { MonitorRun, MonitorStatus } from "@/features/admin/monitor-types";

const REPO = "heretotestyou-design/mytilestrial";
const WORKFLOW = `https://api.github.com/repos/${REPO}/actions/workflows/health-monitor.yml/runs?branch=main&per_page=10`;
const PRIVATE = { "Cache-Control": "private, no-store" };

function result(data: MonitorStatus | { error: string }, status = 200) {
  return Response.json(data, { status, headers: PRIVATE });
}

function parseRun(raw: unknown): MonitorRun | null {
  if (!raw || typeof raw !== "object" || !("id" in raw) || !("created_at" in raw) || !("status" in raw)) return null;
  if (typeof raw.id !== "number" || !Number.isSafeInteger(raw.id) || typeof raw.created_at !== "string" ||
      !Number.isFinite(Date.parse(raw.created_at))) return null;

  const conclusion = "conclusion" in raw ? raw.conclusion : null;
  const status = raw.status !== "completed" ? "running"
    : conclusion === "success" ? "passed"
      : conclusion === "cancelled" || conclusion === "skipped" ? "cancelled" : "issues";
  return { id: raw.id, checkedAt: raw.created_at, status, url: `https://github.com/${REPO}/actions/runs/${raw.id}` };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) return result({ error: "Sign in with an admin account." }, 401);

    const configured = process.env.NEXT_PUBLIC_API_URL ?? `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/api`;
    // Gateway deployments use a relative API URL in browsers.
    const api = new URL(configured, process.env.NEXT_PUBLIC_SITE_URL).href.replace(/\/$/, "");
    const access = await fetch(`${api}/v1/admin/access`, {
      headers: { Authorization: `Bearer ${session.access_token}`, apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8000),
    });
    if (access.status === 401 || access.status === 403) return result({ error: "Admin access required." }, access.status);
    if (!access.ok || (await access.json()).allowed !== true) return result({ error: "Admin access could not be verified." }, 503);

    const history = await fetch(WORKFLOW, {
      headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
      next: { revalidate: 60 },
      signal: AbortSignal.timeout(8000),
    });
    if (!history.ok) return result({ error: "Monitor history is temporarily unavailable." }, 503);
    const data: unknown = await history.json();
    if (!data || typeof data !== "object" || !("workflow_runs" in data) || !Array.isArray(data.workflow_runs)) {
      return result({ error: "Monitor history is temporarily unavailable." }, 503);
    }
    const runs = data.workflow_runs.map(parseRun).filter((run): run is MonitorRun => run !== null);
    return result({ runs });
  } catch {
    return result({ error: "Monitor status is temporarily unavailable." }, 503);
  }
}
