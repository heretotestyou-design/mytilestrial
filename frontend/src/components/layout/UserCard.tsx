"use client";

import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAccount } from "@/features/account/hooks";
import { useSignOut } from "@/features/account/signOut";
import { cn } from "@/lib/format";

function initialsOf(name: string) {
  return name
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");
}

export function UserCard({ collapsed }: Readonly<{ collapsed?: boolean }>) {
  const { account } = useAccount();
  const { signingOut, signOut } = useSignOut();
  const name = account?.profile.full_name || account?.profile.email || "";
  const avatar = (
    <span
      title={collapsed ? (account?.profile.email ?? undefined) : undefined}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-bronze-light to-bronze text-[12px] font-semibold text-ink"
    >
      {initialsOf(name) || "·"}
    </span>
  );
  const signOutButton = (
    <button onClick={signOut} disabled={signingOut} title="Sign out" aria-label={signingOut ? "Signing out" : "Sign out"} className="rounded-lg p-2 text-stone-600 transition hover:bg-white/60 hover:text-ink disabled:cursor-wait">
      {signingOut ? (
        <span className="block h-[18px] w-[18px] animate-spin rounded-full border-2 border-ink/20 border-t-ink/70" />
      ) : (
        <Icon name="logout" className="h-[18px] w-[18px]" />
      )}
    </button>
  );

  return (
    <div className={cn("mt-3 flex items-center border-t border-ink/[0.06] py-4", collapsed ? "flex-col gap-2 px-2" : "gap-3 px-4")}>
      {avatar}
      {!collapsed && (
        <div className="min-w-0 flex-1">
          {account ? (
            <>
              <p className="truncate text-[13px] font-medium">{account.profile.full_name ?? "Your account"}</p>
              <p className="truncate text-[12px] text-stone-600">{account.profile.email}</p>
            </>
          ) : (
            <div className="space-y-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-32" />
            </div>
          )}
        </div>
      )}
      {signOutButton}
    </div>
  );
}
