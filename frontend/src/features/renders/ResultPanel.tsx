"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { TileLoader } from "@/components/fx/TileLoader";
import { Icon, type IconName } from "@/components/ui/Icon";
import { useElapsed } from "@/lib/hooks";
import { EASE_OUT } from "@/lib/motion";
import { DownloadNotice } from "./DownloadNotice";
import { useSessionRenders, type SessionRender } from "./sessionRenders";

type Props = { result: SessionRender | null; error: string | null; busy: boolean; containImage?: boolean };

/** The right-hand preview: empty state, live loader, finished image or failure. */
export function ResultPanel({ result, error, busy, containImage }: Readonly<Props>) {
  const elapsed = useElapsed(busy);
  // Read the live entry so the "downloaded" state stays in sync with the gallery.
  const renders = useSessionRenders();
  const done = result ? (renders.find((r) => r.id === result.id) ?? result) : null;

  let view: React.ReactNode;
  if (busy) {
    view = (
      <motion.div key="run" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0">
        <TileLoader elapsed={elapsed} />
      </motion.div>
    );
  } else if (done) {
    view = (
      <motion.img
        key={done.id}
        src={done.src}
        alt="Your tile render"
        initial={{ opacity: 0, scale: 1.03, filter: "blur(12px)" }}
        animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.9, ease: EASE_OUT }}
        className={`absolute inset-0 h-full w-full ${containImage ? "object-contain" : "object-cover"}`}
      />
    );
  } else if (error) {
    view = (
      <Notice key="fail" icon="info" tone="danger" title="This render didn't work">
        {error}
      </Notice>
    );
  } else {
    view = (
      <Notice key="empty" icon="image" title="Your render appears here" pattern>
        Choose your photos, then press Generate.
      </Notice>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="relative aspect-[3/2] overflow-hidden rounded-2xl bg-ink/[0.04] ring-1 ring-ink/[0.06]">
        <AnimatePresence mode="wait">{view}</AnimatePresence>
      </div>

      {done && !busy && (
        <div className="mt-3 space-y-2">
          <DownloadNotice render={done} />
          <div className="flex flex-wrap gap-2">
            <a href={done.src} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center rounded-full border border-ink/15 bg-white/50 px-4 text-[13px] font-medium hover:border-ink/40">
              Open full size
            </a>
            <Link href="/dashboard/renders" className="inline-flex h-9 items-center px-2 text-[13px] font-medium text-bronze-dark hover:text-ink">
              This session&apos;s renders →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function Notice({ icon, title, tone, pattern, children }: Readonly<{ icon: IconName; title: string; tone?: "danger"; pattern?: boolean; children: React.ReactNode }>) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 grid place-items-center p-6 text-center">
      {pattern && (
        <div
          aria-hidden
          className="absolute inset-0 bg-[linear-gradient(45deg,rgba(176,138,91,0.1)_25%,transparent_25%,transparent_75%,rgba(176,138,91,0.1)_75%),linear-gradient(45deg,rgba(176,138,91,0.1)_25%,transparent_25%,transparent_75%,rgba(176,138,91,0.1)_75%)] bg-[size:32px_32px] bg-[position:0_0,16px_16px] opacity-70 [mask-image:radial-gradient(circle_at_center,#000,transparent_75%)]"
        />
      )}
      <div className="relative">
        <span className={tone === "danger" ? "mx-auto grid h-12 w-12 place-items-center rounded-full bg-red-50 text-red-600" : "mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-white text-bronze-dark shadow-soft"}>
          <Icon name={icon} className="h-6 w-6" />
        </span>
        <p className="mt-3 text-[14px] font-semibold">{title}</p>
        <p className="mx-auto mt-1 max-w-xs text-[12.5px] text-stone-600">{children}</p>
      </div>
    </motion.div>
  );
}
