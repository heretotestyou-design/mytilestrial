"use client";

import Link from "next/link";
import { AnimatedNumber } from "@/components/fx/AnimatedNumber";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAccount } from "@/features/account/hooks";
import { isLowBalance } from "@/features/credits/lowCredit";
import { cn } from "@/lib/format";

type Props = { onNavigate: (href: string) => void; collapsed?: boolean };

export function CreditsWidget({ onNavigate, collapsed }: Readonly<Props>) {
  const { account } = useAccount();
  const low = account ? isLowBalance(account.wallet.balance) : false;
  const balance = account ? <AnimatedNumber id="wallet.balance" value={account.wallet.balance} /> : <Skeleton dark className="my-1.5 h-7 w-10" />;

  if (collapsed) {
    return (
      <Link
        href="/dashboard/billing"
        onClick={() => onNavigate("/dashboard/billing")}
        title={low ? "Images running low: top up" : "Images left: buy more"}
        className="glass-dark relative mx-3 flex flex-col items-center rounded-2xl py-3 transition hover:brightness-110"
      >
        <Icon name="coins" className={cn("h-4 w-4", low ? "text-amber-300" : "text-bronze-light")} />
        <span className="mt-1 text-[15px] font-semibold tabular-nums leading-none">{balance}</span>
        {low && <span className="absolute right-2 top-2 h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" aria-hidden />}
      </Link>
    );
  }

  return (
    <Link href="/dashboard/billing" onClick={() => onNavigate("/dashboard/billing")} className="glass-dark group mx-3 block rounded-2xl p-4 transition hover:brightness-110">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-[12px] font-medium text-ivory/60">
          Images left
          {low && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" aria-hidden />}
        </p>
        <span className="grid h-6 w-6 place-items-center rounded-full bg-bronze/25 text-bronze-light transition group-hover:bg-bronze group-hover:text-ink">
          <Icon name="plus" className="h-3.5 w-3.5" />
        </span>
      </div>
      <div className="mt-1 text-[28px] font-semibold leading-tight tracking-tight tabular-nums">{balance}</div>
      <p className={cn("whitespace-nowrap text-[12px]", low ? "font-medium text-amber-300" : "text-bronze-light")}>{low ? "Running low · top up" : "Buy more images"}</p>
    </Link>
  );
}
