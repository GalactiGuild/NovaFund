import { SkeletonBase } from "./SkeletonBase";

export function MilestoneSkeleton() {
  return (
    <div className="flex gap-4 p-4 border-l-2 border-muted ml-3 relative">
      {/* Timeline dot */}
      <div className="absolute -left-[9px] top-6 h-4 w-4 rounded-full border-2 border-background bg-muted" />

      <div className="flex-1 space-y-3">
        <div className="flex justify-between items-start">
          <SkeletonBase className="h-5 w-1/2" />
          <SkeletonBase className="h-4 w-20" />
        </div>
        <SkeletonBase className="h-4 w-full" />
        <SkeletonBase className="h-4 w-4/5" />
        <div className="pt-2">
          <SkeletonBase className="h-8 w-24 rounded-lg" />
        </div>
      </div>
    </div>
  );
}
