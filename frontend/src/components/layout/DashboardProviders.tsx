"use client";

import { ToastProvider } from "@/components/ui/Toast";
import { DataProvider } from "@/lib/swr";

export function DashboardProviders({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <DataProvider>
      <ToastProvider>{children}</ToastProvider>
    </DataProvider>
  );
}
