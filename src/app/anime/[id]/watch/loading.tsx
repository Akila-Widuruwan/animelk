import Header from "@/components/Header";

export default function Loading() {
  return (
    <div className="min-h-screen bg-ink">
      <Header solid />
      <main className="pt-[72px]">
        <div className="container-site py-8">
          <div className="h-4 w-72 animate-pulse rounded bg-white/[0.06]" />
          <div className="mt-5 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_336px]">
            <div className="min-w-0">
              <div className="aspect-video w-full animate-pulse rounded-xl bg-white/[0.05]" />
              <div className="mt-8 flex gap-5">
                <div className="hidden aspect-[2/3] w-[110px] shrink-0 animate-pulse rounded-xl bg-white/[0.06] md:w-[150px] sm:block" />
                <div className="flex-1 space-y-3">
                  <div className="h-8 w-1/2 animate-pulse rounded-lg bg-white/[0.07]" />
                  <div className="h-4 w-1/3 animate-pulse rounded bg-white/[0.05]" />
                  <div className="h-4 w-full animate-pulse rounded bg-white/[0.04]" />
                  <div className="h-4 w-3/4 animate-pulse rounded bg-white/[0.04]" />
                  <div className="h-11 w-40 animate-pulse rounded-full bg-white/[0.06]" />
                </div>
              </div>
            </div>
            <div className="hidden h-[480px] animate-pulse rounded-2xl bg-white/[0.05] xl:block" />
          </div>
          <div className="mt-14 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="w-full">
                <div className="aspect-[2/3] w-full animate-pulse rounded-xl bg-white/[0.06]" />
                <div className="mt-2.5 h-3.5 w-4/5 animate-pulse rounded bg-white/[0.07]" />
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
