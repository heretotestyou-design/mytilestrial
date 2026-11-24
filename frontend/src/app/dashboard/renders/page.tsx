import type { Metadata } from "next";
import { RendersView } from "@/features/renders/RendersView";

export const metadata: Metadata = { title: "My renders" };

export default function RendersPage() {
  return <RendersView />;
}
