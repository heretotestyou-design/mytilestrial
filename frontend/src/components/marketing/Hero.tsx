import { ParticleField } from "@/components/fx/ParticleField";
import { SplitText } from "@/components/fx/SplitText";
import { ShinyText } from "@/components/fx/ShinyText";
import { Magnet, Reveal } from "@/components/fx/Motion";
import { Arrow, ButtonLink } from "@/components/ui/Button";
import { TileStudio } from "@/components/tiles/TileStudio";
import { SIGNUP_BONUS_CREDITS } from "@/lib/catalog";

export function Hero({ paidOnly = false }: { paidOnly?: boolean }) {
  return (
    <section className="grain relative isolate overflow-hidden bg-ink pb-24 pt-32 text-ivory sm:pt-40">
      {/* Atmosphere */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute -left-40 -top-40 h-[620px] w-[620px] rounded-full bg-[radial-gradient(closest-side,rgba(176,138,91,0.3),transparent)]" />
        <div className="absolute -right-40 top-20 h-[520px] w-[520px] rounded-full bg-[radial-gradient(closest-side,rgba(142,156,136,0.25),transparent)]" />
        <div className="absolute inset-0 opacity-70">
          <ParticleField />
        </div>
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-ink" />
      </div>

      <div className="container grid grid-cols-[minmax(0,1fr)] items-center gap-16 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
        <div className="min-w-0">
          <Reveal>
            <a
              href="#features"
              className="group inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] py-1.5 pl-1.5 pr-4 text-[12px] backdrop-blur"
            >
              <span className="rounded-full bg-bronze/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-eyebrow text-bronze-light">
                New
              </span>
              <ShinyText>Photoreal AI renders in seconds</ShinyText>
              <Arrow className="text-ivory/50" />
            </a>
          </Reveal>

          <h1 className="display mt-8 text-[52px] sm:text-[72px] lg:text-[84px]">
            <SplitText text="See every tile before it's laid." accentWords={["before"]} />
          </h1>

          <Reveal delay={0.5}>
            <p className="mt-7 max-w-[520px] text-[17px] leading-relaxed text-ivory/65">
              MyTilesTrial turns one photo of a room into a photorealistic preview with any tile, layout
              and grout — in seconds. Help your customers choose with confidence and close the sale on the spot.
            </p>
          </Reveal>

          <Reveal delay={0.65}>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Magnet>
                <ButtonLink href={paidOnly ? "#pricing" : "/signup"} variant="bronze" size="lg" className="group">
                  {paidOnly ? "See image packs" : `Start free — ${SIGNUP_BONUS_CREDITS} renders on us`} <Arrow />
                </ButtonLink>
              </Magnet>
              <ButtonLink href="#how" variant="light" size="lg">
                See how it works
              </ButtonLink>
            </div>
            <p className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px] text-ivory/45">
              {!paidOnly && <span>✓ No card required</span>}
              <span>✓ Pay only for what you render</span>
              <span>✓ Priced in ₹</span>
            </p>
          </Reveal>
        </div>

        <Reveal delay={0.3} y={40} className="min-w-0">
          <TileStudio />
        </Reveal>
      </div>
    </section>
  );
}
