import type { Metadata } from "next";
import { AdminMonitor } from "@/features/admin/AdminMonitor";

export const metadata: Metadata = { title: "Health monitor" };

export default function AdminMonitorPage() {
  return <AdminMonitor />;
}
