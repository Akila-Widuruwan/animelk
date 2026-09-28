import Link from "next/link";
import { IconChevronRight } from "./Icons";

export default function SectionHeading({
  title,
  href,
}: {
  title: string;
  href?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4 sm:mb-5">
      <h5 className="text-[18px] font-extrabold tracking-tight text-white sm:text-[20px] md:text-[22px]">
        {title}
      </h5>
      {href && (
        <Link
          href={href}
          className="group flex shrink-0 items-center gap-1 pb-0.5 text-[12px] font-semibold text-muted transition hover:text-violet-2 sm:text-[13px]"
        >
          View all
          <IconChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}
    </div>
  );
}
