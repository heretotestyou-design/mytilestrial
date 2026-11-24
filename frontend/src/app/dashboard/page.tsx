import { Suspense } from "react";
import { OverviewView } from "@/features/overview/OverviewView";

export default function OverviewPage() {
  // OverviewView reads ?tab= (useSearchParams), which needs a Suspense boundary.
  return (
    <Suspense>
      <OverviewView />
    </Suspense>
  );
}
