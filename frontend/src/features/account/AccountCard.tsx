"use client";

import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAccount } from "./hooks";
import { useSignOut } from "./signOut";

export function AccountCard() {
  const { account } = useAccount();
  const { signingOut, signOut } = useSignOut();
  const memberSince = account
    ? new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric" }).format(new Date(account.profile.created_at))
    : null;

  return (
    <Card title="Account">
      <dl className="divide-y divide-ink/[0.06]">
        <Row icon="user" label="Email">
          {account ? (
            <>
              <span className="truncate">{account.profile.email}</span>
              <Badge tone="success">Verified</Badge>
            </>
          ) : (
            <Skeleton className="h-4 w-48" />
          )}
        </Row>
        <Row icon="sparkle" label="Member since">
          {memberSince ?? <Skeleton className="h-4 w-32" />}
        </Row>
      </dl>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink/[0.06] px-6 py-4">
        <p className="text-[13.5px] text-stone-600">Sign out of MyTilesTrial on this device.</p>
        <Button variant="outline" size="sm" loading={signingOut} onClick={signOut}>
          {!signingOut && <Icon name="logout" className="h-4 w-4" />} {signingOut ? "Signing out…" : "Sign out"}
        </Button>
      </div>
    </Card>
  );
}

function Row({ icon, label, children }: Readonly<{ icon: IconName; label: string; children: React.ReactNode }>) {
  return (
    <div className="flex items-center gap-4 px-6 py-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/80 text-stone-600 shadow-[inset_0_0_0_1px_rgba(18,16,14,0.06)]">
        <Icon name={icon} className="h-[18px] w-[18px]" />
      </span>
      <dt className="w-28 shrink-0 text-[13.5px] text-stone-600 sm:w-32">{label}</dt>
      <dd className="flex min-w-0 flex-1 items-center gap-2 text-[14px] font-medium">{children}</dd>
    </div>
  );
}
