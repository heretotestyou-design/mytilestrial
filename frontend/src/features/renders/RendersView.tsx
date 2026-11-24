"use client";

import { motion } from "framer-motion";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { PageHeader } from "@/components/ui/PageHeader";
import { rise } from "@/lib/motion";
import { useLeaveWarning } from "./hooks";
import { SessionRenders } from "./RecentRenders";

export function RendersView() {
  useLeaveWarning();
  return (
    <>
      <PageHeader title="My renders" description="Renders from this session. We don't store your images, so download the ones you want to keep.">
        <ButtonLink href="/dashboard" variant="bronze">
          <Icon name="sparkle" className="h-4 w-4" /> New render
        </ButtonLink>
      </PageHeader>
      <motion.div {...rise(0)}>
        <SessionRenders />
      </motion.div>
    </>
  );
}
