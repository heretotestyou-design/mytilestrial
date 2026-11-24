import { SessionGuard } from "@/components/auth/SessionGuard";
import { Logo } from "@/components/ui/Logo";
import { ParticleField } from "@/components/fx/ParticleField";
import { TileSurface } from "@/components/tiles/TileSurface";
import { FINISHES } from "@/components/tiles/patterns";
import { SIGNUP_BONUS_CREDITS } from "@/lib/catalog";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <SessionGuard when="signed-in" to="/dashboard" preserveNext />
      {/* Visual side */}
      <aside className="grain relative isolate hidden overflow-hidden bg-ink p-12 text-ivory lg:flex lg:flex-col">
        <div aria-hidden className="absolute inset-0 -z-10 opacity-30 [mask-image:linear-gradient(to_top,#000,transparent_85%)]">
          <TileSurface id="auth" pattern="herringbone" finish={FINISHES[1]} grout="#12100E" unit={52} gap={2.5} />
        </div>
        <div aria-hidden className="absolute -left-20 top-1/3 -z-10 h-[420px] w-[420px] rounded-full bg-bronze/30 blur-[120px]" />
        <div aria-hidden className="absolute inset-0 -z-10 opacity-60">
          <ParticleField density={0.6} />
        </div>

        <Logo tone="light" />

        <div className="mt-auto max-w-md">
          <p className="display text-[46px]">
            Every tile, every room, <span className="italic text-bronze-light">before</span> a single one is laid.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 text-center">
            {[
              [String(SIGNUP_BONUS_CREDITS), "free renders"],
              ["12s", "avg. render"],
              ["₹0", "to start"],
            ].map(([v, l]) => (
              <div key={l} className="bg-ink-800/80 px-3 py-5 backdrop-blur">
                <p className="font-display text-[30px] text-bronze-light">{v}</p>
                <p className="text-[11px] uppercase tracking-eyebrow text-ivory/45">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Form side */}
      <main className="flex min-h-screen flex-col bg-ivory-50 px-6 py-8 sm:px-12">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">{children}</div>
      </main>
    </div>
  );
}
