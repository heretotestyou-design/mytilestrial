"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Aurora } from "@/components/fx/Aurora";
import { Icon } from "@/components/ui/Icon";
import { SessionGuard } from "@/components/auth/SessionGuard";
import { Logo } from "@/components/ui/Logo";
import { LowCreditPrompt } from "@/features/credits/LowCreditPrompt";
import { CreditsWidget } from "./CreditsWidget";
import { NavProgress } from "./NavProgress";
import { SidebarNav } from "./SidebarNav";
import { UserCard } from "./UserCard";
import { useSidebarCollapsed } from "./useSidebarCollapsed";
import { cn } from "@/lib/format";
import { WarmCache } from "./WarmCache";

export function DashboardShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  // Optimistic navigation: highlight the clicked tab immediately.
  const [pending, setPending] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const { collapsed, toggle, ready } = useSidebarCollapsed();

  useEffect(() => {
    setPending(null);
    setMenuOpen(false);
  }, [pathname]);

  const navigate = (href: string) => {
    if (href !== pathname) setPending(href);
    setMenuOpen(false);
  };
  const currentPath = pending ?? pathname;

  const sidebar = (layoutId: string, compact = false) => (
    <div className="flex h-full flex-col overflow-hidden">
      <div className={cn("pb-2 pt-5", compact ? "flex justify-center px-0" : "px-5")}>
        <Logo compact={compact} href="/dashboard" />
      </div>
      <div className="mt-6 flex-1">
        <SidebarNav currentPath={currentPath} onNavigate={navigate} layoutId={layoutId} collapsed={compact} />
      </div>
      <CreditsWidget onNavigate={navigate} collapsed={compact} />
      <UserCard collapsed={compact} />
    </div>
  );

  return (
    <div className="relative min-h-screen">
      <Aurora />
      <SessionGuard when="signed-out" to="/login" />
      <NavProgress active={pending !== null} />
      <WarmCache />
      <LowCreditPrompt />

      <aside
        className={cn(
          "glass fixed inset-y-3 left-3 z-30 hidden rounded-[22px] lg:block",
          ready && "transition-[width] duration-300 ease-out",
          collapsed ? "w-[76px]" : "w-[248px]",
        )}
      >
        {sidebar("nav-desktop", collapsed)}
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          title={`${collapsed ? "Expand" : "Collapse"} sidebar (⌘B)`}
          className="absolute -right-3 top-7 grid h-6 w-6 place-items-center rounded-full border border-ink/10 bg-white text-stone-600 shadow-soft transition hover:scale-110 hover:text-ink"
        >
          <Icon name="chevronLeft" className={cn("h-3.5 w-3.5 transition-transform duration-300", collapsed && "rotate-180")} />
        </button>
      </aside>

      {/* Mobile top bar + drawer */}
      <div className="glass sticky top-0 z-40 flex h-14 items-center justify-between rounded-none border-x-0 border-t-0 !bg-ivory/95 px-4 backdrop-blur-xl lg:hidden">
        <Logo href="/dashboard" />
        <button onClick={() => setMenuOpen(true)} className="rounded-lg p-2 hover:bg-white/60" aria-label="Open menu">
          <Icon name="menu" />
        </button>
      </div>
      <AnimatePresence>
        {menuOpen && (
          <div className="fixed inset-0 z-50 lg:hidden">
            <motion.div className="absolute inset-0 bg-ink/30" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setMenuOpen(false)} />
            <motion.aside
              className="glass-strong absolute inset-y-2 left-2 w-[272px] rounded-[22px]"
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", stiffness: 380, damping: 36 }}
            >
              <button onClick={() => setMenuOpen(false)} className="absolute right-3 top-4 rounded-lg p-2 hover:bg-white/60" aria-label="Close menu">
                <Icon name="x" className="h-[18px] w-[18px]" />
              </button>
              {sidebar("nav-mobile")}
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      <main className={cn(ready && "transition-[padding] duration-300 ease-out", collapsed ? "lg:pl-[92px]" : "lg:pl-[264px]")}>
        <motion.div
          key={pathname}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="mx-auto max-w-[1120px] px-4 py-8 sm:px-8 lg:py-10"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
