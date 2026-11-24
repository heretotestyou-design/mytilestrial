import type { Metadata } from "next";
import { LandingCheckout } from "@/features/billing/LandingCheckout";

export const metadata: Metadata = { title: "Checkout", robots: { index: false } };

export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ buy?: string; price?: string; pending?: string }> }) {
  const { buy, price, pending } = await searchParams;
  return <LandingCheckout packId={buy} quotedPrice={price} pendingPayment={pending} />;
}
