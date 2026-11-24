import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PACKS } from "@/lib/catalog";
import { PricingCheckout, PricingCheckoutLink } from "./PricingCheckout";

const mock = vi.hoisted(() => ({
  guest: vi.fn(), confirmGuest: vi.fn(), open: vi.fn(), website: vi.fn(), pay: vi.fn(), replace: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mock.replace }) }));
vi.mock("@/lib/api", () => ({
  ApiError: Error,
  api: {
    catalog: async () => ({ packs: PACKS }),
    checkoutContact: async () => ({ full_name: "Demo Buyer", company: "Demo Tiles", email: "buyer@example.test", phone: "+919999999999" }),
    guestCheckout: mock.guest,
    confirmGuestCheckout: mock.confirmGuest,
    checkout: mock.website,
  },
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: { getSession: async () => ({ data: { session: null } }) } }) }));
vi.mock("@/features/auth/AuthForm", () => ({ AuthForm: ({ checkout }: { checkout: { onAuthenticated: () => void } }) =>
  <button onClick={checkout.onAuthenticated}>Finish account signup</button>,
}));
vi.mock("@/lib/razorpay", () => ({ openRazorpay: mock.open }));
vi.mock("./razorpayFlow", () => ({ payWithRazorpay: mock.pay }));

function view(landing: boolean) {
  return render(<PricingCheckout landing={landing}><section id="pricing">
    <PricingCheckoutLink id="starter" name="Starter" featured={false} />
  </section></PricingCheckout>);
}

describe("in-page pricing checkout", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    sessionStorage.clear();
    history.replaceState(null, "", "/");
  });

  it("reopens the selected landing plan and sends the payment proof without a password", async () => {
    history.replaceState(null, "", "/landing?buy=starter#pricing");
    mock.guest.mockResolvedValue({ id: "checkout", access: "access", key_id: "key", order_id: "order", amount: 176882, currency: "INR", name: "MyTilesTrial" });
    mock.open.mockResolvedValue({ kind: "paid", response: { razorpay_payment_id: "pay", razorpay_order_id: "order", razorpay_signature: "signature" } });
    mock.confirmGuest.mockResolvedValue({ status: "paid", activation: "sent" });
    const user = userEvent.setup();
    view(true);
    const dialog = within(await screen.findByRole("dialog", { name: "Starter checkout" }));
    expect(dialog.queryByLabelText("Password")).not.toBeInTheDocument();
    await user.type(dialog.getByLabelText("Full name"), "Demo Buyer");
    await user.type(dialog.getByLabelText("Company name"), "Demo Tiles");
    await user.type(dialog.getByLabelText("Email"), "buyer@example.test");
    await user.type(dialog.getByLabelText("Mobile number"), "+919999999999");
    await user.click(dialog.getByRole("button", { name: "Pay ₹1,768.82 with Razorpay" }));
    expect(await dialog.findByText(/activation link has been sent/i)).toBeInTheDocument();
    expect(mock.guest).toHaveBeenCalledWith({ pack_id: "starter", expected_amount_paise: 149900, full_name: "Demo Buyer", company: "Demo Tiles", email: "buyer@example.test", phone: "+919999999999" });
    expect(mock.confirmGuest).toHaveBeenCalledWith("checkout", "access", { provider_payment_id: "pay", provider_order_id: "order", signature: "signature" });
    await user.click(dialog.getByRole("button", { name: "Explore all plans" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keeps the website signup and payment in the same dialog before opening the portal", async () => {
    mock.website.mockResolvedValue({ payment: { id: "payment", amount_paise: 176882, credits: 100, validity_months: 1 },
      checkout: { provider: "razorpay", amount: 176882, currency: "INR" } });
    mock.pay.mockResolvedValue({ kind: "paid", credits: 100 });
    const user = userEvent.setup();
    view(false);
    await user.click(screen.getByRole("link", { name: "Get Starter" }));
    const dialog = within(await screen.findByRole("dialog", { name: "Starter checkout" }));
    await user.click(await dialog.findByRole("button", { name: "Finish account signup" }));
    await user.click(await dialog.findByRole("button", { name: "Pay ₹1,768.82 with Razorpay" }));
    expect(await dialog.findByText(/redirecting to the portal/i)).toBeInTheDocument();
    expect(mock.website).toHaveBeenCalledWith("starter", { expected_amount_paise: 149900 });
    expect(mock.pay).toHaveBeenCalledWith(expect.objectContaining({ email: "buyer@example.test", phone: "+919999999999" }));
    await waitFor(() => expect(mock.replace).toHaveBeenCalledWith("/dashboard"), { timeout: 2500 });
  });
});
