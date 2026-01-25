import { SkeletonBase } from "./SkeletonBase";

export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-muted bg-card p-6 shadow-sm">
      <SkeletonBase className="h-4 w-24 mb-4" />
      <SkeletonBase className="h-8 w-32" />
    </div>
  );
}
