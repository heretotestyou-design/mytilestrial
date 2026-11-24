"use client";

import { useState } from "react";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Icon } from "@/components/ui/Icon";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { ActivityList } from "@/features/credits/ActivityList";
import { useTransactions } from "@/features/credits/hooks";
import { api } from "@/lib/api";
import { formatDate, formatNumber, formatPaise } from "@/lib/format";
import type { CreditTransaction, Payment } from "@/lib/types";
import { usePayments } from "./hooks";
import { ReceiptDialog } from "./ReceiptDialog";

const PAGE = 15;
type Tab = "credits" | "payments";
const TABS = [
  { value: "credits", label: "Images" },
  { value: "payments", label: "Payments" },
] as const;

/** Credit ledger and payment history, one card with tabs. */
export function HistoryCard() {
  const [tab, setTab] = useState<Tab>("credits");
  const [receiptId, setReceiptId] = useState<string | null>(null);
  return (
    <>
      <Card id="history" title="History" className="h-full scroll-mt-8" action={<SegmentedControl id="history" value={tab} options={TABS} onChange={setTab} />}>
        {tab === "credits" ? <CreditHistory /> : <PaymentHistory onReceipt={setReceiptId} />}
      </Card>
      {receiptId && <ReceiptDialog key={receiptId} paymentId={receiptId} onClose={() => setReceiptId(null)} />}
    </>
  );
}

function CreditHistory() {
  const toast = useToast();
  const { data } = useTransactions(PAGE);
  // Older pages are fetched on demand and appended after the cached first page.
  const [older, setOlder] = useState<CreditTransaction[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const next = cursor === undefined ? data?.next_cursor : cursor;

  async function loadMore() {
    if (!next) return;
    setLoading(true);
    try {
      const page = await api.transactions({ limit: PAGE, before: next });
      setOlder((o) => [...o, ...page.items]);
      setCursor(page.next_cursor);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't load more.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <ActivityList items={data ? [...data.items, ...older] : undefined} />
      {next && (
        <div className="border-t border-ink/[0.06] p-3 text-center">
          <Button variant="ghost" size="sm" onClick={loadMore} loading={loading}>
            Show more
          </Button>
        </div>
      )}
    </>
  );
}

const STATUS: Record<Payment["status"], [BadgeTone, string]> = {
  paid: ["success", "Paid"],
  created: ["warning", "Pending"],
  failed: ["danger", "Failed"],
  cancelled: ["neutral", "Cancelled"],
};

function PaymentHistory({ onReceipt }: Readonly<{ onReceipt: (id: string) => void }>) {
  const toast = useToast();
  const { data } = usePayments(PAGE);
  const [older, setOlder] = useState<Payment[]>([]);
  const [cursor, setCursor] = useState<string | null | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const next = cursor === undefined ? data?.next_cursor : cursor;

  async function loadMore() {
    if (!next) return;
    setLoading(true);
    try {
      const page = await api.payments({ limit: PAGE, before: next });
      setOlder((current) => [...current, ...page.items]);
      setCursor(page.next_cursor);
    } catch (error) {
      toast(error instanceof Error ? error.message : "Couldn't load more payments.", "error");
    } finally {
      setLoading(false);
    }
  }
  if (!data) return <SkeletonRows />;
  if (data.items.length === 0) {
    return (
      <EmptyState icon="receipt" title="No payments yet">
        Your image pack purchases will be listed here.
      </EmptyState>
    );
  }
  return (
    <>
      <ul className="divide-y divide-ink/[0.06]">
        {[...data.items, ...older].map((p) => (
          <li key={p.id} className="flex items-center gap-3.5 px-6 py-3.5">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-emerald-50 text-emerald-700">
              <Icon name="receipt" className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[14px] font-medium capitalize">
                {p.pack_id} pack · {formatNumber(p.credits)} images
              </p>
              <p className="text-[12.5px] text-stone-600">{formatDate(p.created_at)}</p>
              {p.credits_expire_at && <p className="text-[12.5px] text-stone-600">Credits expire {formatDate(p.credits_expire_at)}</p>}
            </div>
            <div className="text-right">
              <p className="text-[14px] font-semibold tabular-nums">{formatPaise(p.amount_paise)}</p>
              <Badge tone={STATUS[p.status][0]}>{STATUS[p.status][1]}</Badge>
              {p.status === "paid" && (
                <div className="mt-1">
                  <Button variant="outline" size="sm" onClick={() => onReceipt(p.id)}>View receipt</Button>
                </div>
              )}
            </div>
          </li>
        ))}
      </ul>
      {next && (
        <div className="border-t border-ink/[0.06] p-3 text-center">
          <Button variant="ghost" size="sm" onClick={loadMore} loading={loading}>Show more payments</Button>
        </div>
      )}
    </>
  );
}
