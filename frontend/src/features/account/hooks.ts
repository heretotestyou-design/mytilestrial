"use client";

import useSWR from "swr";
import { api } from "@/lib/api";
import { keys } from "@/lib/swr";
import type { Account } from "@/lib/types";

/** The signed-in account (profile + wallet). Shared by every dashboard screen. */
export function useAccount() {
  const { data, error, mutate, isLoading } = useSWR(keys.me, api.me);
  return {
    account: data ?? null,
    isLoading,
    error: error ? (error instanceof Error ? error.message : "Couldn't load your account.") : null,
    /** Replace the cached account with a server response (no refetch). */
    setAccount: (a: Account) => mutate(a, { revalidate: false }),
    refresh: () => mutate(),
  };
}
