// Landing page sections below the hero.
import { CountUp, Marquee, Reveal } from "@/components/fx/Motion";
import { SpotlightCard } from "@/components/fx/SpotlightCard";
import { SplitText } from "@/components/fx/SplitText";
import { Arrow, ButtonLink } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { TileSurface } from "@/components/tiles/TileSurface";
import { FINISHES, GROUTS, type PatternId } from "@/components/tiles/patterns";
import { FREE_PLAN, PACKS, ROOM_TYPES, SIGNUP_BONUS_CREDITS, percentOff, validityLabel } from "@/lib/catalog";
import { cn, formatNumber, formatPaise } from "@/lib/format";
import { SoldOutPlan } from "./SoldOutPlan";
import { PricingCheckoutLink } from "@/features/billing/PricingCheckout";

function SectionHead({ eyebrow, title, accent, sub, center }: { eyebrow: string; title: string; accent?: string[]; sub?: string; center?: boolean }) {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      <Reveal>
        <p className="eyebrow">{eyebrow}</p>
      </Reveal>
      <h2 className="display mt-4 text-[40px] sm:text-[54px]">
        <SplitText text={title} accentWords={accent} stagger={0.015} />
      </h2>
      {sub && (
        <Reveal delay={0.2}>
          <p className="mt-5 text-[16.5px] leading-relaxed text-stone-600">{sub}</p>
        </Reveal>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Stats */
export function Stats() {
  const stats = [
    { to: 12, suffix: "s", label: "Average render time" },
    { to: 13, label: "Layouts to choose from" },
    { to: 10, suffix: "+", label: "Room types supported" },
    { to: 0, prefix: "₹", label: "To get started" },
  ];
  return (
    <section className="border-b border-ink/[0.07] bg-ivory-50">
      <div className="container grid grid-cols-2 divide-ink/[0.07] md:grid-cols-4 md:divide-x">
        {stats.map((s) => (
          <div key={s.label} className="px-6 py-10 text-center">
            <CountUp to={s.to} prefix={s.prefix} suffix={s.suffix} className="display text-[44px] text-ink" />
            <p className="mt-1 text-[13px] text-stone-500">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* --------------------------------------------------------------- Features */
const FEATURES: { icon: IconName; title: string; body: string; span?: string }[] = [
  { icon: "sparkle", title: "Room-aware AI", body: "Reads depth, perspective and light in your photo so every tile sits exactly where it would in real life.", span: "md:col-span-2" },
  { icon: "layers", title: "Floors, walls & more", body: "Tile floors, feature walls, backsplashes and facades — together, in one render." },
  { icon: "grid", title: "Every layout", body: "Grid, brick, herringbone, chevron, checker and more. Switch layouts in a click." },
  { icon: "droplet", title: "Grout studio", body: "Pick grout colour and width and see how it changes the whole room." },
  { icon: "sun", title: "True-to-life lighting", body: "Natural shadows, reflections and sheen on gloss, matte and textured finishes.", span: "md:col-span-2" },
  { icon: "upload", title: "Your photos or ours", body: "Upload your own tile and room, or start from ready-made example tiles and rooms in a click." },
  { icon: "download", title: "One-click export", body: "Download high-resolution JPEG or PNG, ready for WhatsApp, quotes and portfolios." },
  { icon: "share", title: "Showroom-ready", body: "Show options to walk-in customers on a tablet and close the sale on the spot." },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-24 py-28 sm:py-36">
      <div className="container">
        <SectionHead
          eyebrow="Features"
          title="Everything a showroom needs, nothing it doesn't."
          accent={["nothing"]}
          sub="A focused set of tools that make choosing tiles feel effortless — for you and for your customers."
        />
        <div className="mt-16 grid gap-4 md:grid-cols-4">
          {FEATURES.map((f, i) => (
            <Reveal key={f.title} delay={(i % 4) * 0.06} className={f.span}>
              <SpotlightCard className="card h-full p-7">
                <div className="grid h-11 w-11 place-items-center rounded-xl bg-ink text-bronze-light">
                  <Icon name={f.icon} />
                </div>
                <h3 className="mt-6 font-display text-[24px] leading-tight">{f.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-stone-600">{f.body}</p>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------- How it works */
export function HowItWorks() {
  const steps: { icon: IconName; title: string; body: string }[] = [
    { icon: "upload", title: "Upload a room", body: "Snap a photo of any space on your phone, or pick one of our sample rooms." },
    { icon: "grid", title: "Choose your tile", body: "Upload a tile image from your catalogue, then set the layout, size and grout." },
    { icon: "wand", title: "Render & share", body: "Get a photorealistic preview in seconds. Download it or send it straight to your customer." },
  ];
  return (
    <section id="how" className="grain relative scroll-mt-24 overflow-hidden bg-ink py-28 text-ivory sm:py-36">
      <div aria-hidden className="absolute -right-40 top-0 h-[480px] w-[480px] rounded-full bg-bronze/20 blur-[140px]" />
      <div className="container relative">
        <div className="max-w-2xl">
          <Reveal><p className="eyebrow">How it works</p></Reveal>
          <h2 className="display mt-4 text-[40px] sm:text-[54px]">
            <SplitText text="From photo to final look in three steps." accentWords={["three"]} stagger={0.015} />
          </h2>
        </div>
        <div className="mt-16 grid gap-px overflow-hidden rounded-3xl border border-white/10 bg-white/10 md:grid-cols-3">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.1} className="h-full">
              <div className="h-full bg-ink-800 p-8 sm:p-10">
                <div className="flex items-center justify-between">
                  <span className="font-display text-[56px] italic leading-none text-bronze/70">0{i + 1}</span>
                  <span className="grid h-11 w-11 place-items-center rounded-full border border-white/10 text-bronze-light">
                    <Icon name={s.icon} />
                  </span>
                </div>
                <h3 className="mt-10 font-display text-[28px]">{s.title}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ivory/60">{s.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ----------------------------------------------------------------- Spaces */
const SPACE_STYLE: { pattern: PatternId; finish: number; grout: number }[] = [
  { pattern: "herringbone", finish: 1, grout: 0 },
  { pattern: "grid", finish: 0, grout: 1 },
  { pattern: "brick", finish: 3, grout: 0 },
  { pattern: "checker", finish: 2, grout: 1 },
  { pattern: "grid", finish: 4, grout: 2 },
];

export function Spaces() {
  return (
    <section className="overflow-hidden py-28 sm:py-36">
      <div className="container">
        <SectionHead
          center
          eyebrow="Built for every space"
          title="Homes, showrooms, and everything in between."
          accent={["everything"]}
        />
      </div>
      <div className="mt-16 space-y-4">
        {[0, 1].map((row) => (
          <Marquee key={row} className={row === 1 ? "[&>div]:[animation-direction:reverse]" : ""}>
            {ROOM_TYPES.slice(row * 5, row * 5 + 5).map((room, i) => {
              const s = SPACE_STYLE[(i + row * 2) % SPACE_STYLE.length];
              return (
                <div key={room} className="relative h-[220px] w-[300px] shrink-0 overflow-hidden rounded-3xl shadow-soft">
                  <TileSurface
                    id={`space-${row}-${i}`}
                    pattern={s.pattern}
                    finish={FINISHES[s.finish]}
                    grout={GROUTS[s.grout].color}
                    unit={46}
                    gap={2}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-ink/75 via-ink/10 to-transparent" />
                  <div className="absolute bottom-5 left-5 right-5 flex items-end justify-between text-ivory">
                    <span className="font-display text-[26px]">{room}</span>
                    <span className="text-[11px] uppercase tracking-eyebrow text-ivory/60">{s.pattern}</span>
                  </div>
                </div>
              );
            })}
          </Marquee>
        ))}
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- Pricing */
export function Pricing({ paidOnly = false }: { paidOnly?: boolean }) {
  return (
    <section id="pricing" className="scroll-mt-24 border-y border-ink/[0.07] bg-ivory-50 py-28 sm:py-36">
      <div className="container">
        <SectionHead
          center
          eyebrow="Pricing"
          title="Pay for renders, not subscriptions."
          accent={["renders,"]}
          sub="Limited-time offer. Save up to 20% on image packs."
        />

        <div className={cn("mx-auto mt-16 grid gap-5 sm:grid-cols-2", paidOnly ? "max-w-6xl lg:grid-cols-4" : "max-w-[1350px] lg:grid-cols-3 xl:grid-cols-5")}>
          {!paidOnly && <Reveal>
            <div className="card relative flex h-full flex-col rounded-3xl p-6">
              <span className="absolute -top-3 left-8 rounded-full bg-emerald-600 px-3 py-1 text-[11px] font-semibold text-white">Limited time</span>
              <p className="font-display text-[28px]">Free</p>
              <p className="mt-1 text-[14px] text-stone-500">Try every layout, no card needed.</p>
              <p className="mt-8 flex items-baseline gap-2">
                <span className="display text-[52px]">₹0</span>
              </p>
              <p className="text-[13px] text-stone-500">One free plan per account</p>
              <ul className="mt-8 space-y-3 text-[14px] text-ink/80">
                <li className="flex gap-3"><Icon name="check" className="h-5 w-5 text-bronze" />{FREE_PLAN.credits} renders</li>
                <li className="flex gap-3"><Icon name="check" className="h-5 w-5 text-bronze" />All 13 layouts</li>
                <li className="flex gap-3"><Icon name="check" className="h-5 w-5 text-bronze" />Example tiles &amp; rooms included</li>
              </ul>
              <div className="mt-auto pt-10">
                <ButtonLink href="/signup" variant="primary" className="group w-full">
                  Start free <Arrow />
                </ButtonLink>
              </div>
            </div>
          </Reveal>}
          {PACKS.map((p, i) => {
            const total = p.credits + p.bonus_credits;
            return (
              <Reveal key={p.id} delay={i * 0.08}>
                <div
                  className={cn(
                    "relative flex h-full flex-col rounded-3xl p-6",
                    p.is_featured ? "bg-ink text-ivory shadow-lift" : "card",
                  )}
                >
                  {p.is_featured && (
                    <span className="absolute -top-3 left-8 rounded-full bg-gradient-to-b from-bronze-light to-bronze px-3 py-1 text-[11px] font-semibold text-ink">
                      Most popular
                    </span>
                  )}
                  <p className={cn("font-display text-[28px]", p.is_featured && "text-ivory")}>{p.name}</p>
                  <p className={cn("mt-1 text-[14px]", p.is_featured ? "text-ivory/60" : "text-stone-500")}>{p.description}</p>
                  <p className={cn("mt-6 flex flex-wrap items-center gap-2 text-sm", p.is_featured ? "text-ivory/70" : "text-stone-600")}>
                    <del>{formatPaise(p.list_price_paise)}</del>
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">{`${percentOff(p.price_paise, p.list_price_paise)}% off`}</span>
                  </p>
                  <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="display text-[38px]">{formatPaise(p.price_paise)}</span>
                    <span className={cn("text-xs font-medium", p.is_featured ? "text-ivory/75" : "text-stone-600")}>+ 18% GST</span>
                  </p>
                  <p className={cn("text-[13px]", p.is_featured ? "text-ivory/50" : "text-stone-500")}>
                    {formatNumber(total)} images
                  </p>
                  <ul className={cn("mt-5 space-y-3 text-[14px]", p.is_featured ? "text-ivory/80" : "text-ink/80")}>
                    <li className="flex gap-3"><Icon name="check" className="h-5 w-5 shrink-0 text-bronze" />{validityLabel(p.validity_months)}</li>
                    <li className="flex gap-3"><Icon name="check" className="h-5 w-5 shrink-0 text-bronze" />Tutorial videos</li>
                    <li className="flex gap-3"><Icon name="check" className="h-5 w-5 shrink-0 text-bronze" />Full-resolution downloads</li>
                  </ul>
                  <div className="mt-auto pt-6">
                    <PricingCheckoutLink id={p.id} name={p.name} featured={p.is_featured} />
                  </div>
                </div>
              </Reveal>
            );
          })}
          <Reveal delay={0.24}><SoldOutPlan /></Reveal>
        </div>

        <Reveal>
          <p className="mx-auto mt-10 max-w-2xl text-center text-[14px] text-stone-500">
            A standard render uses one image credit. Your latest paid pack sets the expiry for its credits and any unused pack credits that are still valid.
          </p>
        </Reveal>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- FAQ */
const FAQS = [
  { q: "What counts as an image?", a: "Each render you generate is one image, whatever the layout. If a render ever fails, the image goes straight back to your balance." },
  { q: "Do image credits expire?", a: "Yes. Starter, Studio and Showroom are valid for 1, 3 and 6 months respectively. When you buy another pack, its validity starts at payment confirmation and applies to your new credits and any unused pack credits that are still valid. A shorter pack moves the expiry sooner." },
  { q: "What is the monthly spend limit?", a: "You choose the most you want to spend on images in a calendar month. We'll never let a purchase take you over it, and you can change it any time from your dashboard." },
  { q: "Do I need a card to start?", a: `No. Every new account gets ${SIGNUP_BONUS_CREDITS} free images so you can try MyTilesTrial before you pay anything.`, freeSignup: true },
  { q: "Can I use my own tile catalogue?", a: "Yes. Upload a photo or scan of any tile and we'll render it in the room at the size and layout you choose." },
  { q: "Is it built for showrooms and teams?", a: "Yes. MyTilesTrial works on tablets and laptops, so your team can show options to walk-in customers. Larger packs give you a lower price per render." },
];

export function FAQ({ paidOnly = false }: { paidOnly?: boolean }) {
  return (
    <section id="faq" className="scroll-mt-24 py-28 sm:py-36">
      <div className="container grid gap-14 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHead eyebrow="FAQ" title="Questions, answered." accent={["answered."]} sub="Can't find what you're looking for? Write to us and we'll reply within a day." />
        <div className="divide-y divide-ink/10 border-y border-ink/10">
          {FAQS.filter((f) => !paidOnly || !f.freeSignup).map((f) => (
            <details key={f.q} className="group py-6 [&_summary::-webkit-details-marker]:hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 font-display text-[22px]">
                {f.q}
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-ink/15 transition group-open:rotate-45">
                  <Icon name="plus" className="h-4 w-4" />
                </span>
              </summary>
              <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-stone-600">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------- CTA */
export function CTA({ paidOnly = false }: { paidOnly?: boolean }) {
  return (
    <section className="px-3 pb-3">
      <div className="grain relative isolate mx-auto max-w-[1400px] overflow-hidden rounded-[36px] bg-ink px-6 py-24 text-center text-ivory sm:py-32">
        <div aria-hidden className="absolute inset-0 -z-10 opacity-25 [mask-image:radial-gradient(ellipse_at_center,#000_20%,transparent_70%)]">
          <TileSurface id="cta" pattern="herringbone" finish={FINISHES[2]} grout="#12100E" unit={40} gap={2} />
        </div>
        <div aria-hidden className="absolute left-1/2 top-1/2 -z-10 h-[400px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-bronze/25 blur-[120px]" />
        <h2 className="display mx-auto max-w-3xl text-[44px] sm:text-[68px]">
          <SplitText text="Your next sale starts with a preview." accentWords={["preview."]} stagger={0.015} />
        </h2>
        <Reveal delay={0.2}>
          <p className="mx-auto mt-6 max-w-md text-[16px] text-ivory/60">
            {paidOnly ? "Choose an image pack and render your first room today." : "Create a free account in under a minute and render your first room today."}
          </p>
          <div className="mt-10 flex justify-center">
            <ButtonLink href={paidOnly ? "#pricing" : "/signup"} variant="bronze" size="lg" className="group">
              {paidOnly ? "See image packs" : `Claim ${SIGNUP_BONUS_CREDITS} free renders`} <Arrow />
            </ButtonLink>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
