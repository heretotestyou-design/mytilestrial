"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";

export function ReceiptDialog({ paymentId, onClose }: Readonly<{ paymentId: string; onClose: () => void }>) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [html, setHtml] = useState<string>();
  const [error, setError] = useState<string>();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let current = true;
    void api.paymentReceipt(paymentId).then(
      (receipt) => { if (current) setHtml(receipt.html); },
      (error: unknown) => {
        if (current) setError(error instanceof Error ? error.message : "Couldn't load the receipt.");
      },
    );
    return () => { current = false; };
  }, [paymentId]);

  return (
    <Modal open onClose={onClose} label="Payment receipt" className="max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ink/10 px-4 py-3 sm:px-6">
        <h2 className="font-semibold">Payment receipt</h2>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={onClose}>Close</Button>
          <Button size="sm" disabled={!ready} onClick={() => frame.current?.contentWindow?.print()}>
            Print or save PDF
          </Button>
        </div>
      </div>
      {error && <p role="alert" className="p-6 text-sm text-red-700">{error}</p>}
      {!html && !error && <p role="status" className="p-6 text-sm text-stone-600">Loading receipt…</p>}
      {html && (
        <iframe
          ref={frame}
          title="Printable payment receipt"
          sandbox="allow-same-origin allow-modals"
          className="block h-[min(70dvh,720px)] w-full bg-white"
          srcDoc={html}
          onLoad={() => setReady(true)}
        />
      )}
    </Modal>
  );
}
