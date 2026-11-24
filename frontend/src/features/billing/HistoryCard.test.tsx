import { fireEvent, render, screen, within } from "@testing-library/react";
import { expect, it, vi } from "vitest";
import { ToastProvider } from "@/components/ui/Toast";
import { HistoryCard } from "./HistoryCard";

const { paymentReceipt } = vi.hoisted(() => ({ paymentReceipt: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { paymentReceipt } }));
vi.mock("@/features/credits/hooks", () => ({ useTransactions: () => ({ data: { items: [] } }) }));
vi.mock("./hooks", () => ({
  usePayments: () => ({
    data: {
      items: [
        { id: "paid-order", status: "paid", pack_id: "studio", credits: 400, amount_paise: 589882, created_at: "2026-11-24" },
        { id: "pending-order", status: "created", pack_id: "starter", credits: 100, amount_paise: 176882, created_at: "2026-11-24" },
      ],
      next_cursor: null,
    },
  }),
}));

it("opens and prints the receipt only for a paid order", async () => {
  paymentReceipt.mockResolvedValue({ html: "<main>Studio receipt</main>" });
  render(<ToastProvider><HistoryCard /></ToastProvider>);

  fireEvent.click(screen.getByRole("tab", { name: "Payments" }));
  const receipts = screen.getAllByRole("button", { name: "View receipt" });
  expect(receipts).toHaveLength(1);
  fireEvent.click(receipts[0]);
  expect(paymentReceipt).toHaveBeenCalledWith("paid-order");

  const dialog = within(screen.getByRole("dialog", { name: "Payment receipt" }));
  const preview = await dialog.findByTitle<HTMLIFrameElement>("Printable payment receipt");
  expect(preview).toHaveAttribute("srcdoc", "<main>Studio receipt</main>");
  expect(preview).toHaveAttribute("sandbox", "allow-same-origin allow-modals");

  const print = vi.spyOn(preview.contentWindow!, "print").mockImplementation(() => {});
  fireEvent.load(preview);
  fireEvent.click(dialog.getByRole("button", { name: "Print or save PDF" }));
  expect(print).toHaveBeenCalledOnce();
  print.mockRestore();
});
