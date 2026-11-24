"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import useSWR from "swr";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { api, ApiError } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { clearPersistedCache } from "@/lib/swr";
import { cn } from "@/lib/format";
import s from "./admin.module.css";

const links: { href: string; label: string; icon: IconName }[] = [
  { href: "/admin", label: "Overview", icon: "grid" },
  { href: "/admin/users", label: "Users", icon: "user" },
  { href: "/admin/checkouts", label: "Checkouts", icon: "receipt" },
];

async function signOut() {
  await createClient().auth.signOut({ scope: "local" });
  clearPersistedCache();
  window.location.replace("/admin/login");
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const access = useSWR("admin-access", api.adminAccess, {
    shouldRetryOnError: (error) => !(error instanceof ApiError && (error.status === 401 || error.status === 403)),
    revalidateOnFocus: true,
  });

  if (!access.data || access.error) {
    const code = access.error instanceof ApiError ? access.error.status : null;
    return (
      <main className={cn(s.shell, "grid min-h-screen place-items-center p-5")}>
        <div className={cn(s.panel, "w-full max-w-md p-7")}>
          <Logo tone="light" href="/landing" />
          <h1 className="mt-6 font-display text-2xl font-semibold">Administration</h1>
          <p role={access.error ? "alert" : "status"} className="mt-3 text-sm text-[#afabc0]">
            {code === 403 ? "This account does not have admin access." : code === 401 ? "Sign in with an authorized admin account." : access.error?.message ?? "Verifying admin access…"}
          </p>
          {code === 403 ? <button className={cn(s.button, "mt-5")} onClick={() => void signOut()}>Switch account</button>
            : code === 401 ? <Link className={cn(s.button, "mt-5")} href="/admin/login">Admin sign in</Link>
            : access.error && <button className={cn(s.button, "mt-5")} onClick={() => void access.mutate()}>Try again</button>}
        </div>
      </main>
    );
  }

  return (
    <div className={s.shell}>
      <div className={s.frame}>
        <aside className={s.sidebar}>
          <Logo href="/admin" tone="light" className={s.brand} />
          <nav aria-label="Administration" className={s.nav}>
            {links.map(({ href, label, icon }) => (
              <Link key={href} href={href} aria-current={path === href ? "page" : undefined} className={s.navLink}>
                <Icon name={icon} className="h-[18px] w-[18px] shrink-0" />{label}
              </Link>
            ))}
          </nav>
          <button type="button" className={cn(s.navLink, s.signOut)} onClick={() => void signOut()}>
            <Icon name="logout" className="h-[18px] w-[18px]" /><span>Sign out</span>
          </button>
        </aside>
        <main id="admin-content" className={s.content}>{children}</main>
      </div>
    </div>
  );
}
