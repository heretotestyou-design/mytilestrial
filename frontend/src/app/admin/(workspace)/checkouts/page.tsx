import type { Metadata } from "next";
import { AdminCheckouts } from "@/features/admin/AdminCheckouts";

export const metadata: Metadata = { title: "Admin checkouts" };

export default function AdminCheckoutsPage() {
  return <AdminCheckouts />;
}
