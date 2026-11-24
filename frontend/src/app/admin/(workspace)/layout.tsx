import type { Metadata } from "next";
import { AdminShell } from "@/features/admin/AdminShell";
import { SessionGuard } from "@/components/auth/SessionGuard";

export const metadata: Metadata = { title: "Administration", robots: { index: false } };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <><SessionGuard when="signed-out" to="/admin/login" /><AdminShell>{children}</AdminShell></>;
}
