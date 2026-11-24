"use client";

import { AnimatedNumber } from "@/components/fx/AnimatedNumber";
import { ShinyText } from "@/components/fx/ShinyText";
import { SpotlightCard } from "@/components/fx/SpotlightCard";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatPaise } from "@/lib/format";
import type { Wallet } from "@/lib/types";
import { SpendBar, resetDateLabel } from "./SpendBar";

/** The dark headline card: balance, what it buys, and this month's numbers. */
export function BalanceHero({ wallet, buyHref = "/dashboard/billing" }: Readonly<{ wallet: Wallet | null; /** Where "Buy images" goes, e.g. "#packs" on the billing page. */ buyHref?: string }>) {
  if (!wallet) return <BalanceHeroSkeleton />;

  return (
    <SpotlightCard className="glass-dark rounded-[22px]" color="rgba(210,180,140,0.18)">
      <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgba(176,138,91,0.35),transparent)]" />
      <div className="relative p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-[13px] font-medium">
              <ShinyText>Images left</ShinyText>
            </p>
            <p className="mt-2 flex items-baseline gap-2">
              <AnimatedNumber id="wallet.balance" value={wallet.balance} className="text-[56px] font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-[64px]" />
              <span className="text-[16px] text-ivory/55">images</span>
            </p>
            <p className="mt-3 text-[13.5px] text-ivory/60">One image per render, in any layout</p>
          </div>
          <ButtonLink href={buyHref} variant="bronze" size="lg">
            <Icon name="plus" className="h-4 w-4" /> Buy images
          </ButtonLink>
        </div>

        <div className="mt-8 grid gap-px overflow-hidden rounded-2xl bg-white/[0.08] sm:grid-cols-3">
          <HeroStat label="Spent this month" note={`Resets ${resetDateLabel()}`}>
            <AnimatedNumber id="wallet.month_spend" value={wallet.month_spend_paise} format={formatPaise} />
            <span className="ml-1.5 text-[13px] font-normal text-ivory/50">of {formatPaise(wallet.monthly_spend_limit_paise)}</span>
            <div className="mt-3">
              <SpendBar wallet={wallet} tone="dark" />
            </div>
          </HeroStat>
          <HeroStat label="Images used" note="All time">
            <AnimatedNumber id="wallet.lifetime_used" value={wallet.lifetime_used} />
          </HeroStat>
          <HeroStat label="Images bought" note="All time">
            <AnimatedNumber id="wallet.lifetime_purchased" value={wallet.lifetime_purchased} />
          </HeroStat>
        </div>
      </div>
    </SpotlightCard>
  );
}

function HeroStat({ label, note, children }: Readonly<{ label: string; note: string; children: React.ReactNode }>) {
  return (
    <div className="bg-ink/40 px-5 py-4">
      <p className="text-[12px] font-medium text-ivory/55">{label}</p>
      <div className="mt-1 text-[22px] font-semibold tabular-nums tracking-tight">{children}</div>
      <p className="mt-2 text-[12px] text-ivory/45">{note}</p>
    </div>
  );
}

export function BalanceHeroSkeleton() {
  return (
    <div className="glass-dark rounded-[22px] p-6 sm:p-8">
      <Skeleton dark className="h-3.5 w-28" />
      <Skeleton dark className="mt-4 h-14 w-40" />
      <Skeleton dark className="mt-4 h-3.5 w-64" />
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} dark className="h-[92px] rounded-2xl" />
        ))}
      </div>
    </div>
  );
}
