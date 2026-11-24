import Link from "next/link";
import { Logo } from "@/components/ui/Logo";

const COLS = [
  { title: "Product", links: [["Features", "#features"], ["Pricing", "#pricing"], ["How it works", "#how"], ["FAQ", "#faq"]] },
  { title: "Account", links: [["Log in", "/login"], ["Create account", "/signup"], ["Dashboard", "/dashboard"]] },
  { title: "Company", links: [["About", "#"], ["Contact", "mailto:hello@mytilestrial.com"], ["Privacy", "#"], ["Terms", "#"], ["Refunds", "#"]] },
];

export function Footer({ paidOnly = false }: { paidOnly?: boolean }) {
  return (
    <footer className="py-16">
      <div className={paidOnly ? "container grid gap-12 md:grid-cols-[1.4fr_repeat(2,1fr)]" : "container grid gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]"}>
        <div>
          <Logo href={paidOnly ? "/landing" : "/"} />
          <p className="mt-4 max-w-xs text-[14px] leading-relaxed text-stone-500">
            Photorealistic tile previews for showrooms, designers and homeowners. Made in India.
          </p>
        </div>
        {COLS.filter((c) => !paidOnly || c.title !== "Account").map((c) => (
          <div key={c.title}>
            <p className="text-[12px] font-medium uppercase tracking-eyebrow text-stone-400">{c.title}</p>
            <ul className="mt-4 space-y-2.5">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  <Link href={href} className="text-[14px] text-ink/70 transition hover:text-ink">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="container mt-14 flex flex-col justify-between gap-3 border-t border-ink/10 pt-8 text-[12.5px] text-stone-500 sm:flex-row">
        <p>© {new Date().getFullYear()} MyTilesTrial. All rights reserved.</p>
        <p>Prices in Indian Rupees (₹).</p>
      </div>
    </footer>
  );
}
