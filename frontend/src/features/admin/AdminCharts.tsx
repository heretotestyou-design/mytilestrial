"use client";

import { useId, useState } from "react";
import type { AdminAnalytics, Payment } from "@/lib/types";
import { cn, formatNumber, formatPaise } from "@/lib/format";
import s from "./admin.module.css";

const dayFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
const day = (date: string) => dayFormat.format(new Date(`${date}T00:00:00Z`));
const palette = [
  { key: "paid", label: "Paid", color: "#bda1f9", tone: "text-[#dac9ff]" },
  { key: "created", label: "Pending", color: "#8fe2c5", tone: "text-[#a9e9d3]" },
  { key: "failed", label: "Failed", color: "#ec9eab", tone: "text-[#ffc5d0]" },
  { key: "cancelled", label: "Cancelled", color: "#a69bb6", tone: "text-[#d1c7df]" },
] as const;

export function OrderStatus({ status }: { status: Payment["status"] }) {
  const match = palette.find(({ key }) => key === status);
  return <span className={cn("inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.05] px-2.5 py-1 text-xs font-medium", match?.tone)}>
    <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: match?.color }} />{match?.label ?? "Unavailable"}
  </span>;
}

type Series = AdminAnalytics["series"];
type Props = { title: string; subtitle: string; series: Series; metric: "revenue_paise" | "registrations" };

export function ActivityChart({ title, subtitle, series, metric }: Props) {
  const id = useId();
  const [active, setActive] = useState(series.length - 1);
  const current = series[active];
  const money = metric === "revenue_paise";
  const format = money ? formatPaise : formatNumber;
  const values = series.map((point) => point[metric]);
  const peak = Math.max(0, ...values);
  const unit = money ? 10 ** Math.floor(Math.log10(Math.max(100, peak / 4))) : 1;
  const step = Math.max(1, Math.ceil(peak / (4 * unit))) * unit;
  const total = values.reduce((sum, n) => sum + n, 0);
  const periodLabel = (point: Series[number]) => point.starts_on === point.ends_on ? day(point.starts_on) : `${day(point.starts_on)}–${day(point.ends_on)}`;

  return (
    <section aria-labelledby={id} className={cn(s.panel, "p-5")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={id} className="font-display text-lg font-semibold">{title}</h2>
          <p className={cn(s.muted, "mt-1 text-xs")}>{subtitle}</p>
        </div>
        <p className="font-display text-2xl font-bold tabular-nums" title="Total for selected time range">{format(total)}</p>
      </div>
      {peak === 0 ? (
        <div className={cn(s.muted, s.emptyChart, "mt-5 text-sm")}>{money ? "No confirmed payments in this period." : "No registrations in this period."}</div>
      ) : (
        <>
          <div className={s.chartScroll}>
            <div className={s.plotLayout}>
              <div aria-hidden="true" className={s.axis}>
                {[4, 3, 2, 1, 0].map((tick) => <span key={tick}>{format(step * tick)}</span>)}
              </div>
              <div className={s.plot}>
                {series.map((point, index) => (
                  <button type="button" key={point.starts_on} className={s.chartColumn} aria-pressed={index === active}
                    aria-label={`${periodLabel(point)}, ${format(point[metric])}`}
                    onPointerEnter={() => setActive(index)} onFocus={() => setActive(index)} onClick={() => setActive(index)}>
                    <span aria-hidden="true" className={cn(s.bar, !money && s.mintBar)}
                      style={{ height: `${point[metric] / (step * 4) * 100}%` }} />
                    <span aria-hidden="true" className={s.xLabel}>{index % (series.length > 9 ? 2 : 1) === 0 ? day(point.starts_on) : ""}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
          {current && <p className={cn(s.muted, "mt-2 text-xs tabular-nums")}><span className="mr-2">{periodLabel(current)}</span><span className="font-semibold text-[#f6efff]">{format(current[metric])}</span></p>}
        </>
      )}
    </section>
  );
}

export function OrderChart({ orders }: { orders: AdminAnalytics["orders"] }) {
  let boundary = 0;
  const total = palette.reduce((sum, { key }) => sum + orders[key], 0);
  const segments = total ? palette.map(({ key, color }) => {
    const start = boundary;
    boundary += orders[key];
    return `${color} ${start / total * 100}% ${boundary / total * 100}%`;
  }) : [];

  return (
    <section className={cn(s.panel, "p-5")} aria-labelledby="order-chart-title">
      <h2 id="order-chart-title" className="font-display text-lg font-semibold">Order status</h2>
      <p className={cn(s.muted, "mt-1 text-xs")}>Razorpay orders created in this period</p>
      <div className={s.donutWrap} aria-label={`${formatNumber(total)} total orders`}>
        <div className={s.donut} style={{ background: total ? `conic-gradient(${segments.join(", ")})` : "#342d45" }}>
          <div className={s.donutInner}>
            <span className="font-display text-3xl font-bold tabular-nums">{formatNumber(total)}</span>
            <span className={cn(s.muted, "text-xs")}>Total orders</span>
          </div>
        </div>
      </div>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-[13px]">
        {palette.map(({ key, label, color }) => (
          <li key={key} className="flex items-center justify-between gap-2">
            <span className={cn(s.muted, "flex items-center gap-2")}><span aria-hidden="true" className="h-2 w-2 rounded-full" style={{ background: color }} />{label}</span>
            <span className="font-semibold tabular-nums">{formatNumber(orders[key])}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
