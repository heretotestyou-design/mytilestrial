"use client";

// Fetches every tab's data once, in the background, so switching tabs is instant.
import { useEffect, useState } from "react";
import { usePacks, usePayments } from "@/features/billing/hooks";
import { useTransactions } from "@/features/credits/hooks";

function Prefetch() {
  usePacks();
  usePayments(10);
  useTransactions(15);
  return null;
}

type IdleWindow = Window & {
  requestIdleCallback?: (cb: () => void) => number;
  cancelIdleCallback?: (id: number) => void;
};

export function WarmCache() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Let the current page fetch its own data first.
    const w = window as IdleWindow;
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(() => setReady(true));
      return () => w.cancelIdleCallback?.(id);
    }
    const id = window.setTimeout(() => setReady(true), 1200);
    return () => window.clearTimeout(id);
  }, []);
  return ready ? <Prefetch /> : null;
}
