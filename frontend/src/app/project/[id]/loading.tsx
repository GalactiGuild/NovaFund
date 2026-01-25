import { StatCardSkeleton } from "@/components/skeletons/StatCardSkeleton";
import { MilestoneSkeleton } from "@/components/skeletons/MilestoneSkeleton";
import { SkeletonBase } from "@/components/skeletons/SkeletonBase";

export default function ProjectDetailLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content Area */}
        <div className="lg:col-span-2 space-y-8">
          {/* Hero Section Skeleton */}
          <div className="space-y-4">
            <SkeletonBase className="h-12 w-3/4" />
            <SkeletonBase className="h-6 w-full" />
            <SkeletonBase className="aspect-video w-full rounded-xl" />
          </div>

          {/* Project Details Tabs/Content */}
          <div className="space-y-6">
            <div className="flex gap-4 border-b pb-2">
              <SkeletonBase className="h-8 w-24" />
              <SkeletonBase className="h-8 w-24" />
              <SkeletonBase className="h-8 w-24" />
            </div>
            <div className="space-y-4">
              <SkeletonBase className="h-4 w-full" />
              <SkeletonBase className="h-4 w-full" />
              <SkeletonBase className="h-4 w-2/3" />
            </div>
          </div>

          {/* Milestones Section */}
          <div className="space-y-6">
            <SkeletonBase className="h-8 w-40" />
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <MilestoneSkeleton key={i} />
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="rounded-xl border border-muted bg-card p-6 shadow-sm space-y-6">
            <SkeletonBase className="h-8 w-full" />
            <div className="space-y-2">
              <div className="flex justify-between">
                <SkeletonBase className="h-4 w-20" />
                <SkeletonBase className="h-4 w-16" />
              </div>
              <SkeletonBase className="h-3 w-full rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <StatCardSkeleton />
              <StatCardSkeleton />
            </div>
            <SkeletonBase className="h-12 w-full rounded-lg" />
          </div>

          <div className="rounded-xl border border-muted bg-card p-6 shadow-sm space-y-4">
            <SkeletonBase className="h-6 w-32" />
            <div className="flex items-center gap-3">
              <SkeletonBase className="h-10 w-10 rounded-full" />
              <div className="space-y-2 flex-1">
                <SkeletonBase className="h-4 w-24" />
                <SkeletonBase className="h-3 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
