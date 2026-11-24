"use client";

import { motion } from "framer-motion";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon, type IconName } from "@/components/ui/Icon";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { cn, formatDate, formatNumber } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";
import type { CreditTransaction } from "@/lib/types";

const KIND: Record<CreditTransaction["kind"], { label: string; icon: IconName; tint: string }> = {
  signup_bonus: { label: "Welcome bonus", icon: "gift", tint: "bg-bronze/15 text-bronze-dark" },
  purchase: { label: "Image pack purchase", icon: "wallet", tint: "bg-emerald-50 text-emerald-700" },
  generation: { label: "Render", icon: "wand", tint: "bg-ink/[0.06] text-ink" },
  refund: { label: "Refund", icon: "undo", tint: "bg-sky-50 text-sky-700" },
  adjustment: { label: "Adjustment", icon: "info", tint: "bg-ink/[0.06] text-stone-600" },
};

/** Stored descriptions (e.g. "Welcome trial credits") predate calling the unit "images". */
export const imageWording = (text: string) =>
  text.replace(/\b(c)redit(s?)\b/gi, (_, c: string, s: string) => `${c === "C" ? "I" : "i"}mage${s}`);

/** Credit ledger rows. `items === undefined` renders the skeleton. */
export function ActivityList({ items, emptyHint }: Readonly<{ items: CreditTransaction[] | undefined; emptyHint?: string }>) {
  if (!items) return <SkeletonRows />;
  if (items.length === 0) {
    return (
      <EmptyState icon="receipt" title="No activity yet">
        {emptyHint ?? "Image pack purchases and renders will show up here."}
      </EmptyState>
    );
  }
  return (
    <ul className="divide-y divide-ink/[0.06]">
      {items.map((t, i) => {
        const k = KIND[t.kind];
        return (
          <motion.li
            key={t.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: Math.min(i, 8) * 0.03, ease: EASE_OUT }}
            className="flex items-center gap-3.5 px-6 py-3.5 transition-colors hover:bg-white/50"
          >
            <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-full", k.tint)}>
              <Icon name={k.icon} className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium text-ink">{t.description ? imageWording(t.description) : k.label}</p>
              <p className="text-[12.5px] text-stone-600">{formatDate(t.created_at)}</p>
            </div>
            <div className="text-right">
              <p className={cn("text-[14px] font-semibold tabular-nums", t.delta > 0 ? "text-emerald-700" : "text-ink")}>
                {t.delta > 0 ? "+" : "−"}
                {formatNumber(Math.abs(t.delta))}
              </p>
              <p className="text-[12px] tabular-nums text-stone-500">Balance {formatNumber(t.balance_after)}</p>
            </div>
          </motion.li>
        );
      })}
    </ul>
  );
}
