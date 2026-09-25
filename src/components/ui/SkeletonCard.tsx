export default function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`w-full ${className}`}>
      <div className="aspect-[2/3] w-full animate-pulse rounded-xl bg-white/[0.06]" />
      <div className="mt-2.5 h-3.5 w-4/5 animate-pulse rounded bg-white/[0.07]" />
      <div className="mt-2 h-3 w-3/5 animate-pulse rounded bg-white/[0.05]" />
    </div>
  );
}
