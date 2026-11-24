"use client";

// Data layer for the dashboard: one shared SWR cache.
//  - Every hook reads through the cache, so switching tabs renders instantly from
//    memory and quietly revalidates in the background (stale-while-revalidate).
//  - A small allow-list of keys is mirrored to sessionStorage so even a full reload
//    paints the last-known balance immediately.
//  - A 401 anywhere sends the user to /login.
import { useCallback, useEffect } from "react";
import { SWRConfig, useSWRConfig } from "swr";
import { ApiError } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";

/** Cache keys. Strings only, "<resource>" or "<resource>:<variant>". */
export const keys = {
  me: "me",
  catalog: "catalog",
  testPacks: "test-packs",
  transactions: (limit: number) => `transactions:${limit}`,
  payments: (limit: number) => `payments:${limit}`,
  generations: (limit: number) => `generations:${limit}`,
  sessions: "sessions",
} as const;

/** Resources whose last value is kept for the tab session (signed URLs are not: they expire). */
const PERSISTED = ["me", "catalog", "transactions", "payments"];
const STORAGE_PREFIX = "mtt.swr.";
const isPersisted = (key: string) => PERSISTED.includes(key.split(":")[0]);

function persist(key: string, data: unknown) {
  if (!isPersisted(key)) return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(data));
  } catch {
    /* storage full or unavailable: fine */
  }
}

/** Forget everything cached for this tab (call on sign-out). */
export function clearPersistedCache() {
  try {
    Object.keys(sessionStorage)
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

let ending = false;
/** Local sign-out after the server rejected this device, then back to the login page. */
async function endSession(reason?: string) {
  if (ending) return;
  ending = true;
  clearPersistedCache();
  await createClient().auth.signOut({ scope: "local" }).catch(() => {});
  const params = new URLSearchParams({ next: window.location.pathname });
  if (reason) params.set("reason", reason);
  window.location.href = `/login?${params}`;
}

/** Seeds the cache from sessionStorage after hydration (avoids SSR mismatches). */
function CacheHydrator() {
  const { mutate } = useSWRConfig();
  useEffect(() => {
    try {
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith(STORAGE_PREFIX))
        .forEach((k) => {
          const raw = sessionStorage.getItem(k);
          // Show the stored value now, then fetch fresh (a mutation discards older in-flight requests).
          if (raw) void mutate(k.slice(STORAGE_PREFIX.length), JSON.parse(raw), { revalidate: true });
        });
    } catch {
      /* ignore */
    }
  }, [mutate]);
  return null;
}

export function DataProvider({ children }: { children: React.ReactNode }) {
  return (
    <SWRConfig
      value={{
        revalidateOnFocus: true,
        dedupingInterval: 4000,
        errorRetryCount: 2,
        keepPreviousData: true,
        onSuccess: (data, key) => persist(String(key), data),
        onError: (error) => {
          if (error instanceof ApiError && error.status === 401) void endSession(error.code === "SESSION_REVOKED" ? "signed_out" : undefined);
        },
      }}
    >
      <CacheHydrator />
      {children}
    </SWRConfig>
  );
}

/** Revalidate every cached entry of the given resources, e.g. revalidate("me", "transactions"). */
export function useRevalidate() {
  const { mutate } = useSWRConfig();
  return useCallback(
    (...resources: string[]) =>
      mutate((key) => typeof key === "string" && resources.includes(key.split(":")[0]), undefined, { revalidate: true }),
    [mutate],
  );
}
