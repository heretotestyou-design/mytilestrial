import { MarketingPage } from "@/components/marketing/MarketingPage";
import { SessionGuard } from "@/components/auth/SessionGuard";

export default function HomePage() {
  return (
    <>
      <SessionGuard when="signed-in" to="/dashboard" allowPricingCheckout />
      <MarketingPage />
    </>
  );
}
