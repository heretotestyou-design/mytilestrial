"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import { FREE_PLAN, PACKS } from "@/lib/catalog";
import { keys } from "@/lib/swr";
import type { CreditPack } from "@/lib/types";

const EMPTY_PACKS: CreditPack[] = [];
function useCatalog() {
  return useSWR(keys.catalog, api.catalog, { revalidateOnFocus: false });
}

/** Live credit packs; falls back to the static catalog instantly. */
export function usePacks(liveOnly = false): CreditPack[] {
  return useCatalog().data?.packs ?? (liveOnly ? EMPTY_PACKS : PACKS);
}

/** The temporary ₹0 plan, or null when it's switched off on the server. */
export function useFreePlan() {
  const { data } = useCatalog();
  return data ? data.free_plan : FREE_PLAN;
}

/** True while the server uses test-mode payments (no money moves). */
export function useTestPayments() {
  return useCatalog().data?.payments?.test_mode ?? false;
}

/** Developer test packs (₹1 for 10 images) — empty for everyone except testers. */
export function useTestPacks() {
  return useSWR(keys.testPacks, api.testPacks, { revalidateOnFocus: false }).data?.packs ?? [];
}

export function usePayments(limit: number) {
  return useSWR(keys.payments(limit), () => api.payments({ limit }));
}
