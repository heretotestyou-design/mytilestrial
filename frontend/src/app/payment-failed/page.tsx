import type { Metadata } from "next";
import { PaymentResult } from "@/features/billing/PaymentResult";

export const metadata: Metadata = { title: "Payment status", robots: { index: false } };

export default async function PaymentFailedPage({ searchParams }: { searchParams: Promise<{ payment?: string; from?: string }> }) {
  const { payment, from } = await searchParams;
  return <PaymentResult paymentId={payment} landingCheckout={from === "landing"} />;
}
