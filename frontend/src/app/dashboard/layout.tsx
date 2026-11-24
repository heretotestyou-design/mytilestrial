import type { Metadata } from "next";
import { DashboardProviders } from "@/components/layout/DashboardProviders";
import { DashboardShell } from "@/components/layout/DashboardShell";

export const metadata: Metadata = { title: "Dashboard", robots: { index: false } };

// Access is enforced by middleware.ts (signed-out users go to /login) and by the API,
// which verifies the token on every request.
export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <DashboardProviders>
      <DashboardShell>{children}</DashboardShell>
    </DashboardProviders>
  );
}
