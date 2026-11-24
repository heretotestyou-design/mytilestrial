"use client";

// Pops up when the balance runs low (or hits zero), offering the most popular pack.
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import { useAccount } from "@/features/account/hooks";
import { usePacks } from "@/features/billing/hooks";
import { formatNumber, formatPaise } from "@/lib/format";
import { shouldPrompt, snoozeLowCredit } from "./lowCredit";

export function LowCreditPrompt() {
  const { account } = useAccount();
  const packs = usePacks();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const balance = account?.wallet.balance;

  useEffect(() => {
    // Not on the billing page: the user is already where they need to be.
    if (balance === undefined || pathname.startsWith("/dashboard/billing")) return;
    if (shouldPrompt(balance)) setOpen(true);
  }, [balance, pathname]);

  const dismiss = useCallback(() => {
    if (balance !== undefined) snoozeLowCredit(balance);
    setOpen(false);
  }, [balance]);

  if (balance === undefined) return null;
  const pack = packs.find((p) => p.is_featured) ?? packs[0];
  const total = pack ? pack.credits + pack.bonus_credits : 0;
  const empty = balance === 0;

  function go(href: string) {
    dismiss();
    router.push(href);
  }

  return (
    <Modal open={open} onClose={dismiss} label={empty ? "You're out of images" : "Running low on images"}>
      <div className="relative overflow-hidden bg-ink px-7 pb-6 pt-7 text-ivory">
        <div aria-hidden className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-[radial-gradient(closest-side,rgba(210,180,140,0.45),transparent)]" />
        <motion.span
          className="relative grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-bronze-light to-bronze text-ink shadow-glow"
          animate={{ rotate: [0, -8, 8, 0] }}
          transition={{ duration: 1.2, delay: 0.3 }}
        >
          <Icon name="coins" className="h-6 w-6" />
        </motion.span>
        <p className="relative mt-4 text-[22px] font-semibold tracking-tight">{empty ? "You're out of images" : "Running low on images"}</p>
        <p className="relative mt-1 text-[14px] text-ivory/65">
          {empty
            ? "Top up to keep creating renders."
            : `You have ${formatNumber(balance)} image${balance === 1 ? "" : "s"} left.`}
        </p>
      </div>

      {pack && (
        <div className="px-7 pt-6">
          <div className="flex items-center justify-between rounded-2xl border border-bronze/40 bg-white p-4 ring-4 ring-bronze/10">
            <div>
              <p className="flex items-center gap-2 text-[14px] font-semibold">
                {pack.name} pack
                {pack.is_featured && <span className="rounded-full bg-bronze/15 px-2 py-0.5 text-[11px] font-medium text-bronze-dark">Most popular</span>}
              </p>
              <p className="mt-0.5 text-[13px] text-stone-600">
                {formatNumber(total)} images
              </p>
            </div>
            <p className="text-[20px] font-semibold tabular-nums">{formatPaise(pack.price_paise)}</p>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2 px-7 pb-7 pt-5">
        {pack && (
          <Button variant="bronze" size="lg" autoFocus onClick={() => go(`/dashboard/billing?buy=${pack.id}&price=${pack.price_paise}`)}>
            <Icon name="plus" className="h-4 w-4" /> Buy {formatNumber(total)} images
          </Button>
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => go("/dashboard/billing")}>
            See all packs
          </Button>
          <Button variant="ghost" className="flex-1" onClick={dismiss}>
            Remind me later
          </Button>
        </div>
      </div>
    </Modal>
  );
}
