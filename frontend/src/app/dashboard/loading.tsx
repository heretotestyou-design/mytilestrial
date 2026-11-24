import { Skeleton } from "@/components/ui/Skeleton";

// Shown instantly while a dashboard route's code loads.
export default function DashboardLoading() {
  return (
    <div aria-busy="true" aria-label="Loading">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="mt-3 h-4 w-80" />
      <Skeleton className="mt-8 h-[220px] rounded-[22px]" />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-[260px] rounded-[18px]" />
        <Skeleton className="h-[260px] rounded-[18px]" />
      </div>
    </div>
  );
}
