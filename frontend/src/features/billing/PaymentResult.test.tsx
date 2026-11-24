import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PaymentResult } from "./PaymentResult";

const payments = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ api: { payments } }));

const paymentId = "3a6c46fd-9f36-4d31-9d6e-6309bb60b484";
const payment = { id: paymentId, pack_id: "studio", amount_paise: 149900, credits: 100, provider: "razorpay" };

describe("PaymentResult", () => {
  beforeEach(() => {
    payments.mockReset();
    sessionStorage.clear();
  });

  it("shows confirmation using the buyer's payment history", async () => {
    payments.mockResolvedValue({ items: [{ ...payment, status: "paid" }] });
    render(<PaymentResult paymentId={paymentId} />);
    expect(await screen.findByRole("heading", { name: "Welcome to MyTilesTrial!" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to dashboard" })).toHaveAttribute("href", "/dashboard");
  });

  it("lets the buyer retry the same pack after a decline", async () => {
    payments.mockResolvedValue({ items: [{ ...payment, status: "cancelled" }] });
    sessionStorage.setItem(`payment-failure:${paymentId}`, "Bank declined this payment.");
    render(<PaymentResult paymentId={paymentId} />);
    expect(await screen.findByText("Bank declined this payment.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Try again" })).toHaveAttribute("href", "/dashboard/billing?buy=studio&price=149900");
  });

  it("keeps a pending payment separate from confirmation or retry", async () => {
    payments.mockResolvedValue({ items: [{ ...payment, status: "created" }] });
    render(<PaymentResult paymentId={paymentId} />);
    expect(await screen.findByRole("button", { name: "Check status" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Try again" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Welcome to MyTilesTrial!" })).not.toBeInTheDocument();
  });
});
