"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { NavIcon } from "./NavIcon";
import { cn } from "@/lib/format";
import { springSnappy } from "@/lib/motion";
import { DASHBOARD_NAV, isActive } from "./nav";

type Props = {
  /** The path being shown, or the one just clicked (optimistic). */
  currentPath: string;
  onNavigate: (href: string) => void;
  /** Distinguishes the desktop and mobile instances' highlight animation. */
  layoutId: string;
  collapsed?: boolean;
};

const MotionLink = motion.create(Link);

export function SidebarNav({ currentPath, onNavigate, layoutId, collapsed }: Readonly<Props>) {
  return (
    <nav className="space-y-1 px-3" aria-label="Dashboard">
      {DASHBOARD_NAV.map((n) => {
        const active = isActive(n.href, currentPath);
        return (
          <MotionLink
            key={n.href}
            initial="rest"
            animate={active ? "active" : "rest"}
            whileHover="hover"
            href={n.href}
            prefetch
            title={collapsed ? n.label : undefined}
            aria-label={collapsed ? n.label : undefined}
            aria-current={active ? "page" : undefined}
            onClick={(e) => {
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // new tab etc.
              onNavigate(n.href);
            }}
            className={cn(
              "relative flex items-center gap-3 rounded-xl py-2.5 text-[14px] font-medium transition-colors",
              collapsed ? "justify-center px-0" : "px-3",
              active ? "text-ink" : "text-ink/60 hover:bg-white/50 hover:text-ink",
            )}
          >
            {active && <motion.span layoutId={layoutId} className="glass-strong absolute inset-0 rounded-xl" transition={springSnappy} />}
            <NavIcon name={n.icon} className={cn("relative h-[19px] w-[19px] shrink-0 overflow-visible", active && "text-bronze-dark")} />
            {!collapsed && <span className="relative whitespace-nowrap">{n.label}</span>}
          </MotionLink>
        );
      })}
    </nav>
  );
}
