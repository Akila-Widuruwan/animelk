import { statusMeta } from "@/lib/requests";

/** Small status badge used on the public request list. */
export default function RequestStatusBadge({
  status,
  className = "",
}: {
  status: string;
  className?: string;
}) {
  const meta = statusMeta(status);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${meta.className} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  );
}
