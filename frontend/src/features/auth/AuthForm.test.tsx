import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockSupabaseAuth } from "@/test/mocks";

const auth = vi.hoisted(() => ({ current: null as ReturnType<typeof import("@/test/mocks").mockSupabaseAuth> | null }));
const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
const search = vi.hoisted(() => ({ params: new URLSearchParams() }));

vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: auth.current }) }));
vi.mock("next/navigation", () => ({ useRouter: () => router, useSearchParams: () => search.params, usePathname: () => "/login" }));

import { AuthForm } from "./AuthForm";

async function fillLogin(email = "priya@example.com", password = "correct horse") {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
  await user.click(screen.getByRole("button", { name: /log in/i }));
}

describe("Login", () => {
  beforeEach(() => {
    auth.current = mockSupabaseAuth();
    router.replace.mockReset();
    search.params = new URLSearchParams();
  });

  it("never sends the password in the URL, even before the page's JS has loaded", () => {
    const { container } = render(<AuthForm mode="login" />);
    expect(container.querySelector("form")?.getAttribute("method")).toBe("post");
  });

  it("signs in with email and password and opens the dashboard", async () => {
    auth.current!.signInWithPassword.mockResolvedValue({ error: null });
    render(<AuthForm mode="login" />);
    await fillLogin();
    expect(auth.current!.signInWithPassword).toHaveBeenCalledWith({ email: "priya@example.com", password: "correct horse" });
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("shows the error and stays on the page for wrong credentials", async () => {
    auth.current!.signInWithPassword.mockResolvedValue({ error: new Error("Invalid login credentials") });
    render(<AuthForm mode="login" />);
    await fillLogin("priya@example.com", "wrong");
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid login credentials");
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("returns to the requested page after login", async () => {
    search.params = new URLSearchParams({ next: "/dashboard/billing" });
    auth.current!.signInWithPassword.mockResolvedValue({ error: null });
    render(<AuthForm mode="login" />);
    await fillLogin();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard/billing"));
  });

  it.each(["//evil.com", "/\\evil.com", "https://evil.com"])("never redirects off-site (next=%s)", async (next) => {
    search.params = new URLSearchParams({ next });
    auth.current!.signInWithPassword.mockResolvedValue({ error: null });
    render(<AuthForm mode="login" />);
    await fillLogin();
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/dashboard"));
  });

  it("sends a fresh code and asks for it when the email isn't verified yet", async () => {
    auth.current!.signInWithPassword.mockResolvedValue({ error: Object.assign(new Error("Email not confirmed"), { code: "email_not_confirmed" }) });
    render(<AuthForm mode="login" />);
    await fillLogin();
    expect(auth.current!.resend).toHaveBeenCalledWith({ type: "signup", email: "priya@example.com" });
    expect(await screen.findByText("Enter your code")).toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it("explains why the device was signed out", () => {
    search.params = new URLSearchParams({ reason: "signed_out" });
    render(<AuthForm mode="login" />);
    expect(screen.getByRole("status")).toHaveTextContent(/up to 3 devices/);
  });
});

describe("Signup", () => {
  beforeEach(() => {
    auth.current = mockSupabaseAuth();
    router.replace.mockReset();
    search.params = new URLSearchParams();
  });

  async function fillSignup() {
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Full name"), "Priya Sharma");
    await user.type(screen.getByLabelText("Email"), "priya@example.com");
    await user.type(screen.getByLabelText("Password"), "tiles-2026-strong");
    await user.click(screen.getByRole("button", { name: /create account/i }));
  }

  it("creates the account and asks for the emailed code", async () => {
    auth.current!.signUp.mockResolvedValue({ data: { user: { identities: [{}] }, session: null }, error: null });
    render(<AuthForm mode="signup" />);
    await fillSignup();
    expect(auth.current!.signUp).toHaveBeenCalledWith(
      expect.objectContaining({ email: "priya@example.com", password: "tiles-2026-strong", options: expect.objectContaining({ data: { full_name: "Priya Sharma", company: "" } }) }),
    );
    expect(await screen.findByText("Enter your code")).toBeInTheDocument();
  });

  it("says when the email already has an account instead of waiting for a code", async () => {
    auth.current!.signUp.mockResolvedValue({ data: { user: { identities: [] }, session: null }, error: null });
    render(<AuthForm mode="signup" />);
    await fillSignup();
    expect(await screen.findByText(/an account with this email already exists/i)).toBeInTheDocument();
    expect(screen.queryByText("Enter your code")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /log in instead/i })).toHaveAttribute("href", "/login");
  });

  it("requires 8+ characters with letters and numbers", () => {
    render(<AuthForm mode="signup" />);
    const password = screen.getByLabelText("Password");
    expect(password).toHaveAttribute("minLength", "8");
    const re = new RegExp(`^(?:${password.getAttribute("pattern")})$`);
    expect(re.test("a-long-password")).toBe(false); // no digit
    expect(re.test("12345678")).toBe(false); // no letter
    expect(re.test("tiles2026")).toBe(true);
  });
});
