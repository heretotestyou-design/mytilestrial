import { Navbar } from "./Navbar";
import { Hero } from "./Hero";
import { CTA, FAQ, Features, HowItWorks, Pricing, Spaces, Stats } from "./Sections";
import { Footer } from "./Footer";
import { PricingCheckout } from "@/features/billing/PricingCheckout";

export function MarketingPage({ paidOnly = false }: { paidOnly?: boolean }) {
  return (
    <>
      <Navbar paidOnly={paidOnly} />
      <main>
        <Hero paidOnly={paidOnly} />
        <Stats />
        <Features />
        <HowItWorks />
        <Spaces />
        <PricingCheckout landing={paidOnly}><Pricing paidOnly={paidOnly} /></PricingCheckout>
        <FAQ paidOnly={paidOnly} />
        <CTA paidOnly={paidOnly} />
      </main>
      <Footer paidOnly={paidOnly} />
    </>
  );
}
