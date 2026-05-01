import { Skeleton } from "@ewos/ui";

export default function Loading() {
  return (
    <div className="space-y-6" aria-label="Loading dashboard">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {["metric-1", "metric-2", "metric-3", "metric-4"].map((key) => (
          <Skeleton key={key} className="h-32" />
        ))}
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Skeleton className="h-96" />
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}

