"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDate } from "@/lib/format";
import { DownloadNotice } from "./DownloadNotice";
import { useSessionRenders } from "./sessionRenders";

/** Renders made in this tab (kept in memory only), each with a download button.
 *  The 3D "Look around" viewer (LookAroundDialog) is switched off for now. */
export function SessionRenders() {
  const renders = useSessionRenders();
  const pending = renders.filter((r) => !r.downloaded).length;

  return (
    <>
      <Card
        title="This session"
        description={pending > 0 ? `${pending} not downloaded yet. Renders aren't saved: download them before you refresh or close this tab.` : "Renders aren't saved anywhere: download the ones you want to keep."}
      >
        {renders.length === 0 ? (
          <EmptyState icon="image" title="No renders in this session">
            Pick a template on the Overview page to create one. It shows up here until you refresh the page.
          </EmptyState>
        ) : (
          <ul className="grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
            {renders.map((r, i) => (
              <motion.li key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04, duration: 0.4 }} className="group">
                <div className="relative overflow-hidden rounded-xl ring-1 ring-ink/[0.08]">
                  <a href={r.src} target="_blank" rel="noreferrer" className="block aspect-[3/2]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={r.src} alt={r.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
                  </a>
                </div>
                <p className="mt-2 flex items-center justify-between text-[13px]">
                  <span className="font-medium">{r.title}</span>
                  <span className="text-[12px] text-stone-500">{formatDate(new Date(r.createdAt).toISOString())}</span>
                </p>
                <div className="mt-2">
                  <DownloadNotice render={r} compact />
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
