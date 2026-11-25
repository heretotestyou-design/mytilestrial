"use client";

import useSWR from "swr";
import { AgentAvatar } from "@jamesalmeida/agent-avatars";
import { cn } from "@/lib/format";
import type { MonitorRun, MonitorStatus } from "./monitor-types";
import s from "./admin.module.css";

const DATE = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
});

const STATUS = {
  running: { label: "Checking", tone: "text-violet-200", mood: "working" },
  passed: { label: "Checks passed", tone: "text-emerald-200", mood: "happy" },
  issues: { label: "Issues detected", tone: "text-rose-200", mood: "sorry" },
  cancelled: { label: "Cancelled or skipped", tone: "text-stone-300", mood: "idle" },
} as const satisfies Record<MonitorRun["status"], { label: string; tone: string; mood: string }>;

async function loadStatus(path: string): Promise<MonitorStatus> {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok || response.redirected) throw new Error("Could not load monitor history.");
  return response.json();
}

export function AdminMonitor() {
  const { data, error, isValidating, mutate } = useSWR("/admin/monitor/status", loadStatus, {
    refreshInterval: 120_000,
    shouldRetryOnError: false,
  });
  const runs = error ? [] : data?.runs ?? [];
  const latest = runs[0];
  const state = latest && STATUS[latest.status];
  const lastFinished = runs.find((run) => run.status === "passed" || run.status === "issues");
  const stale = lastFinished && Date.now() - Date.parse(lastFinished.checkedAt) > 2 * 60 * 60 * 1000;
  const label = error ? "Status unavailable" : stale ? "Checks are overdue" : state?.label ?? (data ? "Waiting for a check" : "Loading status");

  return (
    <div className="space-y-6">
      <h1 className="font-display text-[clamp(1.8rem,4vw,2.55rem)] font-bold tracking-tight">Health monitor</h1>
      <section aria-labelledby="monitor-state" className={cn(s.panel, "flex flex-wrap items-center gap-4 p-5 sm:p-6")}>
        <AgentAvatar shape="squircle" color="#8065d1" eyes="curious" size={60}
          mood={error || stale ? "confused" : state?.mood ?? "thinking"} />
        <div className="min-w-0 flex-1">
          <h2 id="monitor-state" className={cn("font-display text-xl font-semibold", stale ? "text-amber-200" : state?.tone)} role="status">{label}</h2>
          <p className={cn(s.muted, "mt-1 text-sm")}>Hourly checks. Daily report at 9:07 AM IST.</p>
        </div>
        <button type="button" className={s.button} disabled={isValidating} onClick={() => void mutate()}>
          Refresh
        </button>
      </section>
      <section aria-labelledby="recent-checks" className={cn(s.panel, "p-5 sm:p-6")}>
        <h2 id="recent-checks" className="font-display text-lg font-semibold">Recent checks</h2>
        {error ? (
          <p role="alert" className="mt-3 text-sm text-rose-200">Could not load monitor history. Try refreshing.</p>
        ) : runs.length ? (
          <ul className="mt-3 divide-y divide-white/10">
            {runs.map((run) => (
              <li key={run.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <div className="flex items-baseline gap-3">
                  <time className={s.muted} dateTime={run.checkedAt}>{DATE.format(new Date(run.checkedAt))} IST</time>
                  <span className={STATUS[run.status].tone}>{STATUS[run.status].label}</span>
                </div>
                <a className="font-medium text-violet-200 hover:underline" href={run.url} target="_blank" rel="noreferrer">
                  View run<span className="sr-only"> {run.id}</span>
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className={cn(s.muted, "mt-3 text-sm")}>{data ? "No monitor runs yet." : "Loading monitor history…"}</p>
        )}
      </section>
    </div>
  );
}
