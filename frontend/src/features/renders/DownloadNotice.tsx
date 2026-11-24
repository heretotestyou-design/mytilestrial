"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useToast } from "@/components/ui/Toast";
import { downloadRender, type SessionRender } from "./sessionRenders";

/** "Download it now" banner: renders aren't stored, so this is the only copy. */
export function DownloadNotice({ render, compact }: Readonly<{ render: SessionRender; compact?: boolean }>) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      await downloadRender(render);
      toast("Saved to your device. Check your Downloads folder.");
    } catch {
      toast("Couldn't download this image. Try “Open full size” and save it from there.", "error");
    } finally {
      setBusy(false);
    }
  }

  if (render.downloaded) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <p className="flex flex-1 items-center gap-2 rounded-xl bg-emerald-50 px-3.5 py-2.5 text-[12.5px] font-medium text-emerald-800">
          <Icon name="check" className="h-4 w-4" /> Saved to your device
        </p>
        <Button size="sm" variant="outline" loading={busy} onClick={download}>
          {!busy && <Icon name="download" className="h-4 w-4" />} Again
        </Button>
      </div>
    );
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-900"
    >
      <Icon name="info" className="h-4 w-4 shrink-0" />
      <p className="min-w-0 flex-1">
        <b className="font-semibold">Download it now.</b>
        {!compact && " We don't keep a copy: this image disappears when you refresh or close this tab."}
      </p>
      <Button size="sm" variant="primary" loading={busy} onClick={download}>
        {!busy && <Icon name="download" className="h-4 w-4" />} {busy ? "Saving…" : "Download"}
      </Button>
    </motion.div>
  );
}
