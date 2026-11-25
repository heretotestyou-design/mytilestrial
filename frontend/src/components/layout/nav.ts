import type { NavIconName } from "./NavIcon";

export type NavItem = { href: string; label: string; icon: NavIconName };

export const DASHBOARD_NAV: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: "overview" },
  { href: "/dashboard/floor-planner", label: "Floor planner", icon: "floor-planner" },
  { href: "/dashboard/renders", label: "My renders", icon: "renders" },
  { href: "/dashboard/billing", label: "Images & billing", icon: "billing" },
  { href: "/dashboard/settings", label: "Settings", icon: "settings" },
];

export const isActive = (href: string, path: string) => (href === "/dashboard" ? path === href : path.startsWith(href));
