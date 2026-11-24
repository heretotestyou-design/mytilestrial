"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import { keys } from "@/lib/swr";

/** Most recent credit ledger entries (first page; paginate with api.transactions). */
export function useTransactions(limit: number) {
  return useSWR(keys.transactions(limit), () => api.transactions({ limit }));
}
