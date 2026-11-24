import type { Metadata } from "next";
import { PaymentResult } from "@/features/billing/PaymentResult";

export const metadata: Metadata = { title: "Payment confirmation", robots: { index: false } };

export default async function ThankYouPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const { payment } = await searchParams;
  return <PaymentResult paymentId={payment} />;
}
