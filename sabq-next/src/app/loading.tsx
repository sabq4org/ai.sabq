/**
 * Loading Skeleton
 * 
 * Displayed while Server Components are loading.
 * Provides a smooth loading experience with skeleton placeholders.
 */

export default function Loading() {
  return (
    <main className="flex-1">
      <div className="max-w-[1280px] mx-auto px-4 md:px-6 lg:px-12 py-6">
        {/* Hero Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-8">
          <div className="lg:col-span-2">
            <div className="aspect-[16/9] bg-[#F8F8F6] animate-pulse rounded-[4px]" />
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex gap-3 py-3">
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[#F8F8F6] animate-pulse rounded w-full" />
                  <div className="h-3 bg-[#F8F8F6] animate-pulse rounded w-2/3" />
                </div>
                <div className="w-16 h-16 bg-[#F8F8F6] animate-pulse rounded-[4px] shrink-0" />
              </div>
            ))}
          </div>
        </div>

        {/* Grid Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i}>
              <div className="aspect-[16/9] bg-[#F8F8F6] animate-pulse rounded-[4px] mb-3" />
              <div className="h-3 bg-[#F8F8F6] animate-pulse rounded w-1/4 mb-2" />
              <div className="h-4 bg-[#F8F8F6] animate-pulse rounded w-full mb-1" />
              <div className="h-4 bg-[#F8F8F6] animate-pulse rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
