"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { useAccount } from "@/features/account/hooks";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import { useRevalidate } from "@/lib/swr";
import type { FreePlan } from "@/lib/types";

/** The temporary ₹0 plan: a one-time grant of free renders per account. */
export function FreePlanCard({ plan }: Readonly<{ plan: FreePlan }>) {
  const { account, setAccount } = useAccount();
  const toast = useToast();
  const revalidate = useRevalidate();
  const [claiming, setClaiming] = useState(false);
  const claimed = account?.wallet.free_plan_claimed ?? false;

  async function claim() {
    setClaiming(true);
    try {
      await setAccount(await api.claimFreePlan());
      toast(`${formatNumber(plan.credits)} free images added`);
      void revalidate("transactions");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't claim the free plan.", "error");
      void revalidate("me");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <div className="glass relative flex h-full flex-col overflow-hidden rounded-[18px] p-6">
      <div aria-hidden className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-[radial-gradient(closest-side,rgba(16,185,129,0.18),transparent)]" />
      <div className="relative flex items-center justify-between">
        <p className="text-[15px] font-semibold">Free</p>
        <Badge tone="success">Limited time</Badge>
      </div>
      <p className="relative mt-1 text-[13px] text-stone-600">Try everything at no cost. One per account.</p>

      <p className="relative mt-6 flex items-baseline gap-1.5">
        <span className="text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{formatNumber(plan.credits)}</span>
        <span className="text-[14px] text-stone-600">renders</span>
      </p>
      <p className="relative mt-2 text-[13px] text-stone-600">₹0 · no card needed</p>

      <div className="relative mt-auto pt-6">
        <Button variant={claimed ? "outline" : "primary"} className="w-full" loading={claiming} disabled={claimed || !account} onClick={claim}>
          {claimed ? (
            <>
              <Icon name="check" className="h-4 w-4" /> Claimed
            </>
          ) : (
            `Claim ${formatNumber(plan.credits)} free renders`
          )}
        </Button>
      </div>
    </div>
  );
}
