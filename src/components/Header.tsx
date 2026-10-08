"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOutViewer, useViewer } from "@/lib/viewer-auth";
import {
  IconChevronDown,
  IconClose,
  IconMenu,
  IconPlay,
  IconSearch,
  IconUser,
} from "./Icons";
import SearchBox from "./SearchBox";

const MENU = [
  { label: "Home", href: "/#hero", sub: false },
  { label: "Anime", href: "/#browse", sub: true },
  { label: "Movies", href: "/#anime-movies", sub: false },
  { label: "Series", href: "/#new-series", sub: false },
  { label: "Genres", href: "/#categories", sub: true },
  { label: "Top Airing", href: "/#airing", sub: false, badge: "New" },
  { label: "Request Anime", href: "/request", sub: false },
];

export default function Header({ solid = false }: { solid?: boolean }) {
  const [sticky, setSticky] = useState(false);
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const accountRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { viewer } = useViewer();

  // Google sign-in returns the visitor to the page they started on.
  const loginHref = `/login?next=${encodeURIComponent(
    pathname && pathname !== "/login" ? pathname : "/"
  )}`;

  const isSticky = solid || sticky;

  useEffect(() => {
    const onScroll = () => setSticky(window.scrollY > 60);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!accountOpen) return;
    const onDown = (e: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(e.target as Node)) {
        setAccountOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [accountOpen]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <header
        className={`${isSticky ? "fixed" : "absolute"} inset-x-0 top-0 z-40 transition-colors duration-300 ${
          isSticky
            ? "bg-ink/90 shadow-[0_10px_30px_rgba(0,0,0,0.45)]"
            : "bg-gradient-to-b from-ink/70 via-ink/30 to-transparent backdrop-blur-[10px] md:backdrop-blur-none"
        }`}
      >
        <div className="container-site flex min-h-12 items-center gap-2.5 pt-[env(safe-area-inset-top)] md:h-16 md:gap-4 md:pt-0">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="bg-gradient-btn flex h-8 w-8 items-center justify-center rounded-[10px] shadow-[0_6px_18px_rgba(124,92,255,0.45)] md:h-9 md:w-9 md:rounded-xl">
              <IconPlay className="h-3.5 w-3.5 text-white md:h-4 md:w-4" />
            </span>
            <span className="text-[17px] font-extrabold tracking-tight text-white md:text-[20px]">
              ANI<span className="text-gradient">LANKA</span>
            </span>
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-0.5 xl:flex">
            {MENU.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className={`group relative flex items-center gap-1 rounded-lg px-3 py-2 text-[13.5px] font-semibold transition ${
                  item.label === "Home"
                    ? "text-white"
                    : "text-white/65 hover:text-white"
                }`}
              >
                {item.label}
                {item.sub && (
                  <IconChevronDown className="h-3.5 w-3.5 opacity-60 transition group-hover:rotate-180" />
                )}
                {item.badge && (
                  <span className="bg-gradient-btn absolute -top-0.5 right-0.5 rounded px-1.5 py-px text-[9px] font-bold text-white">
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          <div className="flex flex-1 items-center justify-end gap-2 md:gap-2.5 xl:flex-none">
            <div className="hidden md:block">
              <SearchBox />
            </div>

            <button
              onClick={() => {
                setSearchOpen((v) => !v);
                setAccountOpen(false);
              }}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:border-primary/60 md:hidden"
              aria-label="Search"
            >
              <IconSearch className="h-4 w-4" />
            </button>

            <div className="relative" ref={accountRef}>
              <button
                onClick={() => {
                  setAccountOpen((v) => !v);
                  setSearchOpen(false);
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:border-primary/60 lg:w-auto lg:gap-1.5 lg:px-3.5"
                aria-label="Account"
              >
                {viewer?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={viewer.avatarUrl}
                    alt=""
                    width={28}
                    height={28}
                    referrerPolicy="no-referrer"
                    className="h-7 w-7 rounded-full object-cover ring-1 ring-white/15"
                  />
                ) : (
                  <IconUser className="h-4 w-4" />
                )}
                <IconChevronDown
                  className={`hidden h-3.5 w-3.5 opacity-70 transition duration-300 lg:block ${
                    accountOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {accountOpen && (
                <div className="absolute right-0 top-full z-50 mt-3 w-[230px] overflow-hidden rounded-xl border border-white/10 bg-panel/95 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl">
                  <div className="border-b border-white/5 px-4 py-3.5">
                    {viewer ? (
                      <>
                        <p className="truncate text-sm font-bold text-white">
                          {viewer.name}
                        </p>
                        {viewer.email && (
                          <p className="mt-0.5 truncate text-xs text-muted">
                            {viewer.email}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-white">
                          Welcome to AniLanka
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-muted">
                          Sign in to sync your watchlist
                        </p>
                      </>
                    )}
                  </div>
                  <div className="p-2">
                    <Link
                      href="/my-list"
                      onClick={() => setAccountOpen(false)}
                      className="block rounded-lg px-3 py-2.5 text-[13px] font-semibold text-white/85 transition hover:bg-white/5 hover:text-white"
                    >
                      My List
                    </Link>
                    {viewer ? (
                      <button
                        onClick={() => {
                          setAccountOpen(false);
                          void signOutViewer();
                        }}
                        className="block w-full rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold text-white/85 transition hover:bg-white/5 hover:text-white"
                      >
                        Sign Out
                      </button>
                    ) : (
                      <>
                        <Link
                          href={loginHref}
                          onClick={() => setAccountOpen(false)}
                          className="block rounded-lg px-3 py-2.5 text-[13px] font-semibold text-white/85 transition hover:bg-white/5 hover:text-white"
                        >
                          Sign In
                        </Link>
                        <Link
                          href={loginHref}
                          onClick={() => setAccountOpen(false)}
                          className="bg-gradient-btn mt-1 block rounded-lg px-3 py-2.5 text-center text-[13px] font-bold text-white transition hover:opacity-90"
                        >
                          Create Account
                        </Link>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <Link
              href={loginHref}
              className="bg-gradient-btn hidden rounded-full px-5 py-2.5 text-[13px] font-bold text-white shadow-[0_6px_18px_rgba(124,92,255,0.4)] transition hover:opacity-90 md:inline-flex"
            >
              {viewer ? viewer.name.split(" ")[0] : "Sign Up"}
            </Link>

            <button
              className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white xl:hidden"
              onClick={() => {
                setOpen(true);
                setSearchOpen(false);
                setAccountOpen(false);
              }}
              aria-label="Open menu"
            >
              <IconMenu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {searchOpen && (
          <div className="border-t border-white/5 bg-ink/95 px-4 py-3 backdrop-blur md:hidden">
            <SearchBox onNavigate={() => setSearchOpen(false)} />
          </div>
        )}
      </header>

      {open && (
        <div className="fixed inset-0 z-50 xl:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm [animation:ak-fade-in_0.2s_ease]"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 flex h-full w-[300px] flex-col gap-6 overflow-y-auto border-r border-white/[0.06] bg-panel/95 p-6 backdrop-blur-xl [animation:ak-drawer-in_0.25s_ease]">
            <div className="flex items-center justify-between">
              <span className="text-[19px] font-extrabold text-white">
                ANI<span className="text-gradient">LANKA</span>
              </span>
              <button
                onClick={() => setOpen(false)}
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-white"
                aria-label="Close menu"
              >
                <IconClose className="h-4 w-4" />
              </button>
            </div>
            <label className="relative">
              <SearchBox onNavigate={() => setOpen(false)} />
            </label>
            <nav className="flex flex-col gap-1">
              {MENU.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between rounded-lg px-3 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
                >
                  {item.label}
                  {item.sub && <IconChevronDown className="h-4 w-4 opacity-70" />}
                </Link>
              ))}
              <Link
                href="/my-list"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-lg px-3 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/5 hover:text-white"
              >
                My List
              </Link>
            </nav>
            <Link
              href={loginHref}
              onClick={() => setOpen(false)}
              className="bg-gradient-btn rounded-full px-5 py-3 text-center text-sm font-bold text-white"
            >
              {viewer ? "My Account" : "Sign Up"}
            </Link>
            {viewer && (
              <button
                onClick={() => {
                  setOpen(false);
                  void signOutViewer();
                }}
                className="rounded-full border border-white/12 px-5 py-3 text-center text-sm font-bold text-white/85 transition hover:border-primary/60 hover:text-white"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
