import type { Metadata } from "next";
import { ResetPassword } from "@/features/auth/ResetPassword";

export const metadata: Metadata = { title: "Reset password", robots: { index: false } };

export default function PasswordPage() {
  return <ResetPassword />;
}
