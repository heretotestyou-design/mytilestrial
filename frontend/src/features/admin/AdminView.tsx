"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import SpotlightCard from "@/components/fx/react-bits/SpotlightCard";
import { Icon, type IconName } from "@/components/ui/Icon";
import { api } from "@/lib/api";
import { cn, formatNumber, formatPaise } from "@/lib/format";
import type { AdminPeriod } from "@/lib/types";
import { ActivityChart, OrderChart } from "./AdminCharts";
import s from "./admin.module.css";

const periods: AdminPeriod[] = [7, 30, 90];

export function AdminView() {
  const [period, setPeriod] = useState<AdminPeriod>(30);
  const totals = useSWR("admin-summary", api.adminSummary);
  const analytics = useSWR(["admin-analytics", period] as const, ([, days]) => api.adminAnalytics(days));
  const current = analytics.data;
  const data = totals.data;
  const metrics: { label: string; value: string; icon: IconName; color: string }[] = [
    { label: "Registered users", value: data ? formatNumber(data.users) : "—", icon: "user", color: "#c8abff" },
    { label: "Paid Razorpay orders", value: data ? formatNumber(data.paid_orders) : "—", icon: "card", color: "#8de1bf" },
    { label: "Razorpay payments", value: data ? formatPaise(data.paid_amount_paise) : "—", icon: "wallet", color: "#e3b8fd" },
    { label: "Awaiting Sheet sync", value: data ? formatNumber(data.pending_sheet_rows) : "—", icon: "receipt", color: "#ffd0a4" },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[clamp(1.8rem,4vw,2.55rem)] font-bold tracking-tight">Overview</h1>
          <p className={cn(s.muted, "mt-1 text-sm")}>Track payments, registrations, and checkout activity.</p>
        </div>
        <label className={cn(s.muted, "flex items-center gap-2.5 text-xs font-semibold")}>
          Chart period
          <select className={s.input} value={period} onChange={(event) => setPeriod(Number(event.target.value) as AdminPeriod)}>
            {periods.map((days) => <option key={days} value={days}>Last {days} days</option>)}
          </select>
        </label>
      </header>

      <section aria-label="Account totals" className="space-y-2.5">
        <p className={cn(s.muted, "text-xs font-semibold")}>All-time totals</p>
        {totals.error && <p role="alert" className="text-sm text-rose-200">Couldn’t load totals. <button className="underline" onClick={() => void totals.mutate()}>Retry</button></p>}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map(({ label, value, icon, color }) => (
            <SpotlightCard key={label} theme="dark" spotlightColor={color} intensity={0.32} grain={0}
              className="h-full !p-4" style={{ "--spotlight-card-surface": "#211b30", "--spotlight-card-border": "#443750" } as React.CSSProperties}>
              <div className="mb-3 grid h-8 w-8 place-items-center rounded-xl bg-white/[.07]" style={{ color }}>
                <Icon name={icon} className="h-4 w-4" />
              </div>
              <dl>
                <dt className={cn(s.muted, "text-[13px] font-medium")}>{label}</dt>
                <dd className="mt-1 break-words font-display text-[clamp(1.35rem,2.2vw,1.85rem)] font-bold tracking-tight tabular-nums">{value}</dd>
              </dl>
            </SpotlightCard>
          ))}
        </div>
      </section>

      {analytics.error ? (
        <section className={cn(s.panel, "flex flex-wrap items-center justify-between gap-3 p-5")} aria-label="Chart status">
          <p role="alert" className="text-sm text-rose-200">Couldn’t load chart data.</p>
          <button className={s.button} onClick={() => void analytics.mutate()}>Retry charts</button>
        </section>
      ) : !current ? (
        <div className={cn(s.panel, s.muted, "min-h-48 p-6 text-sm")} role="status">Loading charts…</div>
      ) : (
        <div className={s.overviewGrid}>
          <ActivityChart key={`revenue-${period}`} title="Revenue" subtitle="Confirmed Razorpay payments · IST" series={current.series} metric="revenue_paise" />
          <OrderChart orders={current.orders} />
          <ActivityChart key={`registrations-${period}`} title="New users" subtitle="Account registrations · IST" series={current.series} metric="registrations" />
          <section className={cn(s.panel, "flex flex-col justify-between gap-5 p-5")} aria-labelledby="sync-card-title">
            <div>
              <h2 id="sync-card-title" className="font-display text-lg font-semibold">Checkout operations</h2>
              <p className={cn(s.muted, "mt-1 text-sm")}>Google Sheets</p>
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3 border-b border-white/10 pb-3">
                  <dt className={s.muted}>Connection</dt>
                  <dd className={data?.sheet_connected ? "text-emerald-200" : "text-amber-200"}>{data ? data.sheet_connected ? "Configured" : "Not configured" : "—"}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className={s.muted}>Pending rows</dt>
                  <dd className="font-semibold">{data ? formatNumber(data.pending_sheet_rows) : "—"}</dd>
                </div>
              </dl>
            </div>
            <Link href="/admin/checkouts" className={cn(s.button, "self-start")}>View checkouts <Icon name="chevronRight" className="h-4 w-4" /></Link>
          </section>
        </div>
      )}
    </div>
  );
}
