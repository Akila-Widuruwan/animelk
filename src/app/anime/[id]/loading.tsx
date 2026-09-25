import Header from "@/components/Header";
import SkeletonCard from "@/components/ui/SkeletonCard";

export default function Loading() {
  return (
    <div className="min-h-screen bg-ink">
      <Header solid />
      <main className="pt-[72px]">
        <div className="h-[400px] w-full animate-pulse bg-white/[0.04] md:h-[500px]" />
        <div className="container-site">
          <div className="-mt-44 flex flex-col items-center gap-8 md:-mt-52 md:flex-row md:items-end">
            <div className="aspect-[488/680] w-[180px] shrink-0 animate-pulse rounded-xl bg-white/[0.07] md:w-[240px]" />
            <div className="w-full flex-1 space-y-4 pb-2">
              <div className="h-9 w-3/4 animate-pulse rounded-lg bg-white/[0.07]" />
              <div className="h-4 w-1/2 animate-pulse rounded bg-white/[0.05]" />
              <div className="h-4 w-2/3 animate-pulse rounded bg-white/[0.05]" />
              <div className="h-12 w-44 animate-pulse rounded-full bg-white/[0.07]" />
            </div>
          </div>
          <div className="mt-16 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {Array.from({ length: 7 }, (_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
