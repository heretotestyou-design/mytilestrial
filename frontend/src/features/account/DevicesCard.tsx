"use client";

import { useState } from "react";
import useSWR from "swr";
import { AnimatePresence, motion } from "framer-motion";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { SkeletonRows } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { api } from "@/lib/api";
import { keys } from "@/lib/swr";
import type { DeviceSession } from "@/lib/types";
import { parseUserAgent, timeAgo } from "@/lib/userAgent";

/** Devices signed in to this account, with per-device and "all others" sign-out. */
export function DevicesCard() {
  const toast = useToast();
  const { data, mutate } = useSWR(keys.sessions, api.sessions);
  const [busy, setBusy] = useState<string | null>(null);
  const others = data?.sessions.filter((s) => !s.current) ?? [];

  async function revoke(id: string | "others") {
    setBusy(id);
    try {
      if (id === "others") {
        const { revoked } = await api.revokeOtherSessions();
        toast(revoked ? `Signed out ${revoked} other device${revoked === 1 ? "" : "s"}` : "No other devices were signed in");
      } else {
        await api.revokeSession(id);
        toast("Device signed out");
      }
      await mutate();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Couldn't sign that device out.", "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card
      title="Devices"
      description={`Your account can be signed in on up to ${data?.max_devices ?? 3} devices. Signing in on another one signs out the least recently used.`}
      action={data && <Badge className="shrink-0 whitespace-nowrap px-2.5 py-1 tabular-nums" tone={data.sessions.length >= data.max_devices ? "warning" : "neutral"}>{`${data.sessions.length} of ${data.max_devices}`}</Badge>}
      footer={
        others.length > 0 && (
          <Button variant="outline" size="sm" loading={busy === "others"} disabled={busy !== null} onClick={() => revoke("others")}>
            <Icon name="shield" className="h-4 w-4" /> Sign out all other devices
          </Button>
        )
      }
    >
      {data ? (
        <ul className="divide-y divide-ink/[0.06]">
          <AnimatePresence initial={false}>
            {data.sessions.map((s) => (
              <DeviceRow key={s.id} session={s} busy={busy === s.id} disabled={busy !== null} onRevoke={() => revoke(s.id)} />
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <SkeletonRows rows={2} />
      )}
    </Card>
  );
}

function DeviceRow({ session: s, busy, disabled, onRevoke }: Readonly<{ session: DeviceSession; busy: boolean; disabled: boolean; onRevoke: () => void }>) {
  const d = parseUserAgent(s.user_agent);
  return (
    <motion.li layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, height: 0 }} className="flex items-center gap-3.5 px-6 py-3.5">
      <span className={s.current ? "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-ink text-bronze-light" : "grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/80 text-stone-600 shadow-[inset_0_0_0_1px_rgba(18,16,14,0.06)]"}>
        <Icon name={d.mobile ? "phone" : "laptop"} className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-[14px] font-medium">
          {d.browser} on {d.os}
          {s.current && <Badge tone="success">This device</Badge>}
        </p>
        <p className="truncate text-[12.5px] text-stone-600">
          {s.current ? "Active now" : `Last active ${timeAgo(s.last_active_at)}`}
          {s.ip && ` · ${s.ip}`}
        </p>
      </div>
      {!s.current && (
        <Button variant="ghost" size="sm" loading={busy} disabled={disabled} onClick={onRevoke}>
          Sign out
        </Button>
      )}
    </motion.li>
  );
}
