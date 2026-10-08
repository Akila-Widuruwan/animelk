"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

/**
 * Reveals a section as it scrolls into view.
 *
 * Only the transform is animated — never opacity. Starting from an
 * `opacity-0` class means a frozen or throttled animation timeline (background
 * or occluded tabs, browsers with animations disabled, script-blocked
 * visitors) leaves the section permanently invisible with no way to recover.
 * With a transform-only reveal the content is always painted and readable; the
 * worst case is that it sits a few pixels lower than intended.
 */
export default function Reveal({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const t = setTimeout(() => setShown(true), 0);
      return () => clearTimeout(t);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-transform duration-500 ease-out motion-reduce:transition-none ${
        shown ? "translate-y-0" : "translate-y-6 motion-reduce:translate-y-0"
      } ${className}`}
    >
      {children}
    </div>
  );
}
