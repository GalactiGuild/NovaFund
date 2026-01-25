import { SkeletonBase } from "./SkeletonBase";

export function ProjectCardSkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-muted bg-card shadow-sm">
      {/* Image placeholder */}
      <SkeletonBase className="aspect-video w-full rounded-none" />

      <div className="flex flex-1 flex-col p-5">
        {/* Title area */}
        <SkeletonBase className="h-6 w-3/4 mb-3" />

        {/* Description lines */}
        <div className="space-y-2">
          <SkeletonBase className="h-4 w-full" />
          <SkeletonBase className="h-4 w-5/6" />
        </div>

        {/* Footer area */}
        <div className="mt-auto pt-6 flex justify-between items-center">
          <SkeletonBase className="h-4 w-20" />
          <SkeletonBase className="h-8 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
