import type { Metadata } from "next";
import { AdminUsers } from "@/features/admin/AdminUsers";

export const metadata: Metadata = { title: "Admin users" };

export default function AdminUsersPage() {
  return <AdminUsers />;
}
