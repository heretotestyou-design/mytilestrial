import type { Metadata } from "next";
import { SettingsView } from "@/features/account/SettingsView";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return <SettingsView />;
}
