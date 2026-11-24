import { Suspense } from "react";
import type { Metadata } from "next";
import { BillingView } from "@/features/billing/BillingView";

export const metadata: Metadata = { title: "Images & billing" };

export default function BillingPage() {
  // BillingView reads ?buy= (useSearchParams), which needs a Suspense boundary.
  return (
    <Suspense>
      <BillingView />
    </Suspense>
  );
}
