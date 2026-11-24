import { Badge } from "@/components/ui/Badge";
import { ButtonLink } from "@/components/ui/Button";
import { PREMIUM_OFFER, percentOff, validityLabel } from "@/lib/catalog";
import { formatPaise } from "@/lib/format";

export function SoldOutPlan() {
  const offer = PREMIUM_OFFER;
  return (
    <article className="card relative flex h-full flex-col rounded-3xl p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-[25px]">{offer.name}</h3>
        <Badge tone="neutral">Sold out</Badge>
      </div>
      <p className="mt-1 text-sm text-stone-600">Limited to 5 slots</p>
      <p className="mt-6 flex flex-wrap items-center gap-2 text-sm text-stone-600">
        <del>{formatPaise(offer.list_price_paise)}</del>
        <Badge tone="success">{`${percentOff(offer.price_paise, offer.list_price_paise)}% off`}</Badge>
      </p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="font-display text-[38px] font-semibold leading-tight">{formatPaise(offer.price_paise)}</span>
        <span className="text-xs font-medium text-stone-600">+ 18% GST</span>
      </p>
      <ul className="mt-5 space-y-2.5 text-sm text-ink/80">
        <li>{validityLabel(offer.validity_months)}</li>
        <li>One-to-one training session</li>
        <li>Personal support</li>
      </ul>
      <div className="mt-auto pt-6">
        <ButtonLink href={offer.contact} variant="outline" className="w-full px-3 text-center leading-tight">Contact us for the next slot</ButtonLink>
      </div>
    </article>
  );
}
