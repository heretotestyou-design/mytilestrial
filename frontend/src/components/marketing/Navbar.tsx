"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { ButtonLink } from "@/components/ui/Button";
import { cn } from "@/lib/format";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#how", label: "How it works" },
  { href: "#pricing", label: "Pricing" },
  { href: "#faq", label: "FAQ" },
];

export function Navbar({ paidOnly = false }: { paidOnly?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3">
      <nav
        className={cn(
          "mx-auto flex h-14 max-w-[1240px] items-center justify-between rounded-full px-4 transition-all duration-500 sm:px-5",
          scrolled ? "border border-white/10 bg-ink/70 shadow-lift backdrop-blur-xl" : "border border-transparent",
        )}
      >
        <Logo tone="light" href={paidOnly ? "/landing" : "/"} />

        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-4 py-2 text-[13px] text-ivory/70 transition hover:text-ivory">
              {l.label}
            </a>
          ))}
        </div>

        {!paidOnly && <div className="hidden items-center gap-2 md:flex">
          <Link href="/login" className="px-3 text-[13px] text-ivory/80 transition hover:text-ivory">
            Log in
          </Link>
          <ButtonLink href="/signup" variant="bronze" size="sm">
            Start free
          </ButtonLink>
        </div>}

        <button
          className="grid h-10 w-10 place-items-center rounded-full text-ivory md:hidden"
          aria-label="Menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span className="relative block h-3 w-5">
            <span className={cn("absolute left-0 h-px w-5 bg-current transition", open ? "top-1.5 rotate-45" : "top-0")} />
            <span className={cn("absolute left-0 h-px w-5 bg-current transition", open ? "top-1.5 -rotate-45" : "top-3")} />
          </span>
        </button>
      </nav>

      {open && (
        <div className="mx-auto mt-2 max-w-[1240px] rounded-3xl border border-white/10 bg-ink/95 p-4 backdrop-blur-xl md:hidden">
          {LINKS.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="block rounded-xl px-4 py-3 text-ivory/80">
              {l.label}
            </a>
          ))}
          {!paidOnly && <div className="mt-2 grid grid-cols-2 gap-2">
            <ButtonLink href="/login" variant="light">Log in</ButtonLink>
            <ButtonLink href="/signup" variant="bronze">Start free</ButtonLink>
          </div>}
        </div>
      )}
    </header>
  );
}
