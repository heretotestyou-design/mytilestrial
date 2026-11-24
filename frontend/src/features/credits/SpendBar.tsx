"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import type { Wallet } from "@/lib/types";

/** First day of next month, when the monthly spend resets. */
export function resetDateLabel(now = new Date()) {
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(next);
}

function fillTone(pct: number) {
  if (pct >= 90) return "bg-red-500";
  if (pct >= 70) return "bg-amber-500";
  return "bg-bronze";
}

/** This month's spend as a fraction of the monthly limit. */
export function SpendBar({ wallet, tone = "light" }: Readonly<{ wallet: Wallet; tone?: "light" | "dark" }>) {
  const limit = wallet.monthly_spend_limit_paise;
  const pct = limit > 0 ? Math.min((wallet.month_spend_paise / limit) * 100, 100) : 100;
  return (
    <div className={cn("h-1.5 overflow-hidden rounded-full", tone === "dark" ? "bg-white/10" : "bg-ink/[0.07]")}>
      <motion.div
        className={cn("h-full rounded-full", fillTone(pct))}
        initial={{ width: 0 }}
        animate={{ width: `${pct > 0 ? Math.max(pct, 2) : 0}%` }}
        transition={{ duration: 0.8, ease: EASE_OUT }}
      />
    </div>
  );
}
