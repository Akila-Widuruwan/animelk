"use client";

import { useRef } from "react";
import type { ReactNode } from "react";
import { IconChevronLeft, IconChevronRight } from "./Icons";

export default function Carousel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const scroll = (dir: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  const btn =
    "absolute top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-panel/90 text-white opacity-0 backdrop-blur transition hover:border-primary hover:bg-primary group-hover/car:opacity-100 sm:flex";

  return (
    <div className="group/car relative">
      <div
        ref={ref}
        className={`no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-2 [-webkit-overflow-scrolling:touch] md:snap-proximity md:gap-5 ${className}`}
      >
        {children}
      </div>
      <button
        aria-label="Scroll left"
        onClick={() => scroll(-1)}
        className={`${btn} left-0`}
      >
        <IconChevronLeft className="h-5 w-5" />
      </button>
      <button
        aria-label="Scroll right"
        onClick={() => scroll(1)}
        className={`${btn} right-0`}
      >
        <IconChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}
