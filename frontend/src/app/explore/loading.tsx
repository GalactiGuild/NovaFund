import { ProjectCardSkeleton } from "@/components/skeletons/ProjectCardSkeleton";

export default function ExploreLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8 space-y-4">
        <div className="h-10 w-48 bg-muted/60 animate-pulse rounded-md" />
        <div className="h-6 w-96 bg-muted/60 animate-pulse rounded-md" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <ProjectCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
