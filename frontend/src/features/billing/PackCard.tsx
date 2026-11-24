"use client";

import { GlowBorder } from "@/components/fx/GlowBorder";
import { SpotlightCard } from "@/components/fx/SpotlightCard";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PACKS, percentOff, validityLabel } from "@/lib/catalog";
import { cn, formatNumber, formatPaise } from "@/lib/format";
import { GST_PERCENT, packCheckoutPrice } from "@/lib/checkout-price";
import type { CreditPack } from "@/lib/types";

type Props = { pack: CreditPack; overLimit: boolean; loading: boolean; onBuy: () => void };

/** One credit pack. The featured pack gets a travelling glow border. */
export function PackCard({ pack, overLimit, loading, onBuy }: Readonly<Props>) {
  const total = pack.credits + pack.bonus_credits;
  const quote = packCheckoutPrice(pack);
  const offer = PACKS.find((p) => p.id === pack.id && p.price_paise === Number(pack.price_paise) && p.validity_months === pack.validity_months);
  const body = (
    <SpotlightCard className={cn("flex h-full flex-col rounded-[18px] p-6", pack.is_featured ? "rounded-[17px] bg-[#FFFDF9]" : "glass")}>
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-semibold">{pack.name}</p>
        {pack.is_featured && <Badge tone="bronze">Most popular</Badge>}
      </div>
      {pack.description && <p className="mt-1 text-[13px] text-stone-600">{pack.description}</p>}

      <p className="mt-6 flex items-baseline gap-1.5">
        <span className="text-[40px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{formatNumber(total)}</span>
        <span className="text-[14px] text-stone-600">images</span>
      </p>
      {pack.bonus_credits > 0 && (
        <div className="mt-2">
          <Badge tone="success">+{pack.bonus_credits} bonus</Badge>
        </div>
      )}
      {pack.validity_months && (
        <ul className="mt-4 space-y-1.5 text-[13px] text-stone-600">
          <li>{validityLabel(pack.validity_months)}</li>
          <li>Tutorial videos</li>
        </ul>
      )}

      <div className="mt-auto pt-6">
        {offer && <p className="mb-2 flex flex-wrap items-center gap-2 text-[13px] text-stone-600">
          <del>{formatPaise(offer.list_price_paise)}</del>
          <Badge tone="success">{`${percentOff(offer.price_paise, offer.list_price_paise)}% off`}</Badge>
        </p>}
        {quote.tax > 0 && <p className="mb-2 text-xs text-stone-600">{formatPaise(quote.base)} + {GST_PERCENT}% GST</p>}
        <Button variant={pack.is_featured ? "bronze" : "primary"} className="w-full" loading={loading} disabled={overLimit} onClick={onBuy}>
          {overLimit ? "Over your monthly limit" : `Buy for ${formatPaise(quote.total)}`}
        </Button>
      </div>
    </SpotlightCard>
  );

  return pack.is_featured ? (
    <GlowBorder className="h-full shadow-glow md:-translate-y-2" innerClassName="bg-transparent">
      {body}
    </GlowBorder>
  ) : (
    body
  );
}
