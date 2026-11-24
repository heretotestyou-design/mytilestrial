"use client";

import { useEffect, useState } from "react";
import { AnimatedNumber } from "@/components/fx/AnimatedNumber";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useAccount } from "@/features/account/hooks";
import { SpendBar, resetDateLabel } from "@/features/credits/SpendBar";
import { api } from "@/lib/api";
import { cn, formatPaise } from "@/lib/format";

const PRESETS = [1000, 5000, 10000, 25000];
const MAX_LIMIT = 1_000_000;

export function SpendLimitCard() {
  const { account, setAccount } = useAccount();
  const toast = useToast();
  const current = account ? account.wallet.monthly_spend_limit_paise / 100 : null;
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (current !== null) setValue(String(current));
  }, [current]);

  const n = Number(value);
  const valid = value !== "" && Number.isInteger(n) && n >= 0 && n <= MAX_LIMIT;
  const dirty = current !== null && n !== current;

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || !dirty) return;
    setSaving(true);
    try {
      await setAccount(await api.setSpendLimit(n));
      toast("Monthly limit updated");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Couldn't save the limit.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Monthly spending limit" description="Purchases that would go over this limit are blocked." className="h-full">
      <form onSubmit={save} className="p-6">
        {account ? (
          <>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-[24px] font-semibold tabular-nums tracking-tight">
                <AnimatedNumber id="wallet.month_spend" value={account.wallet.month_spend_paise} format={formatPaise} />
                <span className="ml-1.5 text-[13px] font-normal text-stone-600">spent this month</span>
              </p>
              <p className="text-[12.5px] text-stone-600">Resets {resetDateLabel()}</p>
            </div>
            <div className="mt-3">
              <SpendBar wallet={account.wallet} />
            </div>
            <p className="mt-2 text-[12.5px] text-stone-600">{formatPaise(account.wallet.month_remaining_paise)} left this month</p>
          </>
        ) : (
          <div className="space-y-3">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-1.5 w-full" />
            <Skeleton className="h-3 w-32" />
          </div>
        )}

        <label htmlFor="limit" className="label mt-6">
          Limit per month
        </label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-stone-600">₹</span>
            <input
              id="limit"
              type="number"
              inputMode="numeric"
              min={0}
              max={MAX_LIMIT}
              step={1}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="input bg-white/80 pl-8 tabular-nums"
            />
          </div>
          <Button type="submit" loading={saving} disabled={!valid || !dirty} className="shrink-0">
            Save
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => setValue(String(p))}
              className={cn(
                "rounded-full border px-3 py-1 text-[12.5px] font-medium tabular-nums transition",
                n === p ? "border-ink bg-ink text-ivory" : "border-ink/10 bg-white/60 text-ink/75 hover:border-ink/30 hover:text-ink",
              )}
            >
              ₹{new Intl.NumberFormat("en-IN").format(p)}
            </button>
          ))}
        </div>
        {!valid && value !== "" && <p className="mt-2 text-[12.5px] text-red-600">Enter a whole amount between ₹0 and ₹10,00,000.</p>}
      </form>
    </Card>
  );
}
