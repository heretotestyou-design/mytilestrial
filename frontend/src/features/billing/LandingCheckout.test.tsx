import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PACKS } from "@/lib/catalog";
import { LandingCheckout } from "./LandingCheckout";

const { checkout, open, replace } = vi.hoisted(() => ({ checkout: vi.fn(), open: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/components/auth/SessionGuard", () => ({ SessionGuard: () => null }));
vi.mock("@/lib/api", () => ({
  ApiError: Error,
  api: {
    catalog: async () => ({ packs: PACKS }),
    checkoutContact: async () => ({ email: "buyer@example.test", full_name: "", phone: "", company: "" }),
    checkout,
  },
}));
vi.mock("./razorpayFlow", () => ({ payWithRazorpay: open }));

describe("landing checkout", () => {
  beforeEach(() => {
    checkout.mockReset();
    open.mockReset();
    replace.mockReset();
  });

  it("saves the billing details before opening Razorpay and routes to the thank-you page", async () => {
    checkout.mockResolvedValue({ payment: { id: "payment-id" }, checkout: { provider: "razorpay" } });
    open.mockResolvedValue({ kind: "paid" });
    render(<LandingCheckout packId="starter" quotedPrice="149900" />);
    const user = userEvent.setup();
    const email = await screen.findByLabelText("Account email");
    expect(email).toHaveValue("buyer@example.test");
    expect(email).toHaveAttribute("readonly");
    await user.type(screen.getByLabelText("Full name"), "Buyer Name");
    await user.type(screen.getByLabelText("Contact number"), "+919999999999");
    await user.type(screen.getByLabelText("Company name (optional)"), "Sample Studio");
    await user.click(screen.getByRole("button", { name: "Continue to Razorpay" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/thank-you?payment=payment-id&from=landing"));
    expect(checkout).toHaveBeenCalledWith("starter", {
      expected_amount_paise: 149900,
      details: { full_name: "Buyer Name", phone: "+919999999999", company: "Sample Studio" },
    });
    expect(checkout.mock.invocationCallOrder[0]).toBeLessThan(open.mock.invocationCallOrder[0]);
    expect(open).toHaveBeenCalledWith(expect.objectContaining({ email: "buyer@example.test", name: "Buyer Name", phone: "+919999999999" }));
  });

  it("stays on checkout when the server cannot save the details", async () => {
    checkout.mockRejectedValue(new Error("Unable to save the checkout."));
    render(<LandingCheckout packId="starter" />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Full name"), "Buyer Name");
    await user.type(screen.getByLabelText("Contact number"), "+919999999999");
    await user.click(screen.getByRole("button", { name: "Continue to Razorpay" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Unable to save the checkout.");
    expect(open).not.toHaveBeenCalled();
    expect(replace).not.toHaveBeenCalled();
  });
});
