"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { label: "Home", href: "/", icon: "home", hash: "" },
  { label: "Airing", href: "/#airing", icon: "clock", hash: "airing" },
  { label: "Browse", href: "/#browse", icon: "grid", hash: "browse" },
  { label: "Top 10", href: "/#top-series", icon: "star", hash: "top-series" },
];

function NavIcon({ name, className }: { name: string; className?: string }) {
  switch (name) {
    case "home":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5.5 9.5V20h13V9.5" />
          <path d="M10 20v-6h4v6" />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3.2 2" />
        </svg>
      );
    case "grid":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
          <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
          <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
          <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
        </svg>
      );
    case "star":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
          <path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8-5.2-2.8-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z" />
        </svg>
      );
    default:
      return null;
  }
}

export default function MobileBottomNav() {
  const pathname = usePathname();
  const [hash, setHash] = useState("");

  useEffect(() => {
    const update = () => setHash(window.location.hash.replace("#", ""));
    update();
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);

  return (
    <nav
      aria-label="Mobile navigation"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-ink/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
    >
      <div className="flex h-16 items-stretch justify-around px-2">
        {TABS.map((t) => {
          const active =
            pathname === "/" &&
            (t.hash === "" ? hash === "" || hash === "hero" : hash === t.hash);
          return (
            <Link
              key={t.label}
              href={t.href}
              aria-label={t.label}
              className={`flex min-w-[56px] flex-1 flex-col items-center justify-center gap-1 rounded-xl transition-colors duration-150 ${
                active ? "text-primary" : "text-muted hover:text-white"
              }`}
            >
              <NavIcon name={t.icon} className="h-[22px] w-[22px]" />
              <span
                className={`text-[10.5px] font-bold leading-none ${
                  active ? "text-primary" : ""
                }`}
              >
                {t.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
