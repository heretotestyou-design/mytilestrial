import { Skeleton } from "@/components/ui/Skeleton";

// Instant placeholder for the login / signup form while the route loads.
export default function AuthLoading() {
  return (
    <div aria-busy="true" aria-label="Loading" className="w-full">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-4 h-10 w-72" />
      <Skeleton className="mt-3 h-4 w-56" />
      <div className="mt-8 space-y-4">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-[52px] w-full rounded-full" />
      </div>
    </div>
  );
}
