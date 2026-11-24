import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { mockSupabaseAuth } from "@/test/mocks";

const auth = vi.hoisted(() => ({ current: null as ReturnType<typeof import("@/test/mocks").mockSupabaseAuth> | null }));
const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: auth.current }) }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { OtpForm } from "./OtpForm";

const paste = (text: string) => fireEvent.paste(screen.getByLabelText("Digit 1"), { clipboardData: { getData: () => text } });

describe("Email code verification", () => {
  beforeEach(() => {
    auth.current = mockSupabaseAuth();
    router.replace.mockReset();
  });

  it("verifies a pasted 6-digit code and opens the dashboard", async () => {
    auth.current!.verifyOtp.mockResolvedValue({ error: null });
    render(<OtpForm email="priya@example.com" next="/dashboard" onBack={() => {}} />);
    paste("123456");
    await waitFor(() => expect(auth.current!.verifyOtp).toHaveBeenCalledWith({ email: "priya@example.com", token: "123456", type: "email" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("ignores non-digits in the pasted code", async () => {
    auth.current!.verifyOtp.mockResolvedValue({ error: null });
    render(<OtpForm email="priya@example.com" next="/dashboard" onBack={() => {}} />);
    paste("12-34 56");
    await waitFor(() => expect(auth.current!.verifyOtp).toHaveBeenCalledWith(expect.objectContaining({ token: "123456" })));
  });

  it("rejects a wrong code, clears the boxes and does not sign in", async () => {
    auth.current!.verifyOtp.mockResolvedValue({ error: new Error("Token has expired or is invalid") });
    render(<OtpForm email="priya@example.com" next="/dashboard" onBack={() => {}} />);
    paste("000000");
    expect(await screen.findByRole("alert")).toHaveTextContent(/incorrect or has expired/);
    expect(router.replace).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Digit 1")).toHaveValue("");
  });

  it("locks the resend button during the cooldown", () => {
    render(<OtpForm email="priya@example.com" next="/dashboard" onBack={() => {}} initialCooldown={60} />);
    expect(screen.getByRole("button", { name: /resend code in 60s/i })).toBeDisabled();
  });

  it("resends a code when allowed", async () => {
    render(<OtpForm email="priya@example.com" next="/dashboard" onBack={() => {}} initialCooldown={0} />);
    fireEvent.click(screen.getByRole("button", { name: /^resend code$/i }));
    await waitFor(() => expect(auth.current!.resend).toHaveBeenCalledWith({ type: "signup", email: "priya@example.com" }));
  });
});
