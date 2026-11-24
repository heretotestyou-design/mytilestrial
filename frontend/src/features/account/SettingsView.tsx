"use client";

import { motion } from "framer-motion";
import { PageHeader } from "@/components/ui/PageHeader";
import { rise } from "@/lib/motion";
import { AccountCard } from "./AccountCard";
import { DevicesCard } from "./DevicesCard";
import { ProfileCard } from "./ProfileCard";
import { PasswordSettings } from "./PasswordSettings";

export function SettingsView() {
  return (
    <div className="max-w-3xl">
      <PageHeader title="Settings" description="Manage your profile and account." />
      <div className="space-y-6">
        <motion.div {...rise(0)}>
          <ProfileCard />
        </motion.div>
        <motion.div {...rise(1)}>
          <PasswordSettings />
        </motion.div>
        <motion.div {...rise(2)}>
          <DevicesCard />
        </motion.div>
        <motion.div {...rise(3)}>
          <AccountCard />
        </motion.div>
      </div>
    </div>
  );
}
