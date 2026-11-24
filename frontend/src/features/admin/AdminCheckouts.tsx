"use client";

import { useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { cn, formatDate, formatNumber, formatPaise } from "@/lib/format";
import { OrderStatus } from "./AdminCharts";
import s from "./admin.module.css";

export function AdminCheckouts() {
  const overview = useSWR("admin-overview", api.adminOverview);
  const data = overview.data;
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<{ text: string; error?: boolean }>();

  async function syncSheet() {
    if (syncing) return;
    setSyncing(true);
    setMessage(undefined);
    try {
      const { synced } = await api.adminSyncSheet();
      await overview.mutate();
      setMessage({ text: synced === 1 ? "1 checkout synced." : `${formatNumber(synced)} checkouts synced.` });
    } catch (error) {
      setMessage({ text: error instanceof Error ? error.message : "Could not sync checkout records.", error: true });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-[clamp(1.8rem,4vw,2.55rem)] font-bold tracking-tight">Checkouts</h1>
        <p className={cn(s.muted, "mt-1 text-sm")}>Review checkout details, payment status, and Google Sheets sync.</p>
      </header>
      {message && <p role={message.error ? "alert" : "status"} className={cn(s.panel, "p-3 text-sm", message.error ? "text-rose-200" : "text-emerald-200")}>{message.text}</p>}
      <section aria-label="Recent checkouts" className={cn(s.panel, "overflow-hidden")}>
        <header className="flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
          <div>
            <h2 className="font-display text-lg font-semibold">Recent checkouts</h2>
            {data && <p className={cn(s.muted, "mt-1 text-sm")}>{data.sheet_connected ? `Google Sheets configured · ${formatNumber(data.pending_sheet_rows)} pending rows` : "Google Sheets is not configured. Details are saved in Supabase."}</p>}
          </div>
          <button className={s.button} disabled={!data?.sheet_connected || !data.pending_sheet_rows || syncing} onClick={() => void syncSheet()}>
            {syncing ? "Syncing…" : "Sync pending rows"}
          </button>
        </header>
        <div className={s.tableScroll}>
          <table className={s.table}>
            <thead><tr><th scope="col">Buyer</th><th scope="col">Company / GSTIN</th><th scope="col">Payment</th><th scope="col">Sheet</th></tr></thead>
            <tbody>
              {data?.contacts.map((contact) => {
                const payment = contact.payment;
                return <tr key={contact.id}>
                  <td><p className="font-semibold">{contact.full_name}</p><p className={cn(s.muted, "text-xs")}>{contact.email} · {contact.phone}</p><p className={cn(s.muted, "mt-0.5 text-xs")}>{formatDate(contact.created_at)}</p></td>
                  <td><p>{contact.company || "—"}</p>{contact.gstin && <p className={cn(s.muted, "font-mono text-xs")}>{contact.gstin}</p>}</td>
                  <td>{payment ? <><OrderStatus status={payment.status} /><p className={cn(s.muted, "mt-1 text-xs capitalize")}>{payment.pack_id} · {formatPaise(payment.amount_paise)}</p></> : "Unavailable"}</td>
                  <td><span className={contact.sheet_synced_at ? "text-emerald-200" : "text-amber-200"}>{contact.sheet_synced_at ? "Synced" : "Pending"}</span></td>
                </tr>;
              })}
              {!data?.contacts.length && <tr><td colSpan={4}><span className={s.muted}>{overview.error ? "Couldn’t load checkouts." : data ? "No checkout details yet." : "Loading checkouts…"}</span>
                {overview.error && <button className={cn(s.button, "ml-3")} onClick={() => void overview.mutate()}>Retry</button>}</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
