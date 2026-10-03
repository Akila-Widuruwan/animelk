"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Anime } from "@/lib/anime";
import {
  ageRating,
  heroSlides,
  metaTime,
  qualityBadges,
  score,
  year,
} from "@/lib/anime";
import { IconInfo, IconPlay, IconPlus, IconStar } from "./Icons";

export default function Hero({ slides }: { slides?: Anime[] }) {
  const list = slides && slides.length > 0 ? slides : heroSlides;
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const bgRef = useRef<HTMLDivElement>(null);
  const slide = list[active] ?? list[0];

  useEffect(() => {
    if (paused || list.length <= 1) return;
    const timer = setInterval(() => {
      setActive((i) => (i + 1) % list.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [paused, list.length]);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (bgRef.current) {
          const y = Math.min(window.scrollY, window.innerHeight) * 0.3;
          bgRef.current.style.transform = `translate3d(0, ${y}px, 0)`;
        }
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  if (!slide) return null;

  return (
    <section
      id="hero"
      className="relative h-[clamp(300px,83vw,365px)] w-full overflow-hidden sm:h-svh sm:min-h-[540px]"
      onMouseEnter={() => {
        if (
          typeof window !== "undefined" &&
          window.matchMedia("(hover: hover)").matches
        ) {
          setPaused(true);
        }
      }}
      onMouseLeave={() => setPaused(false)}
    >
      <div ref={bgRef} className="absolute inset-0 will-change-transform">
        {list.map((a, i) => (
          <div
            key={a.id}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === active ? "z-10 opacity-100" : "z-0 opacity-0"
            }`}
          >
            <Image
              src={a.bannerImage || a.coverImage}
              alt={a.title}
              fill
              priority={i === 0}
              loading={i === 0 ? "eager" : "lazy"}
              sizes="100vw"
              className="object-cover object-[65%_30%] sm:object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/55 to-transparent md:bg-[linear-gradient(90deg,rgba(3,5,12,0.96)_0%,rgba(3,5,12,0.82)_30%,rgba(3,5,12,0.35)_65%,rgba(3,5,12,0.08)_100%)]" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-black/45 to-black/10 md:from-ink/85 md:via-ink/20 md:to-transparent" />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 z-[5] bg-gradient-to-t from-ink via-ink/25 to-transparent md:hidden" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-24 bg-gradient-to-t from-ink to-transparent md:h-44" />

      <div className="container-site relative z-20 flex h-full flex-col items-stretch justify-start pt-[calc(48px+env(safe-area-inset-top))] md:flex-row md:items-center md:justify-start md:pt-0">
        <div key={slide.id} className="animate-fade-in-up mt-auto w-full max-w-[600px] pb-12 md:mt-0 md:pb-0 md:pt-[9vh]">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 sm:gap-x-3">
            <span className="flex items-center gap-1.5">
              <span className="rounded bg-[#f5c518] px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-black sm:text-[11px]">
                IMDb
              </span>
              <span className="text-[13px] font-bold text-white sm:text-sm">{score(slide)}</span>
            </span>
            {qualityBadges(slide).map((b) => (
              <span
                key={b.label}
                style={{ background: b.color }}
                className="rounded px-1.5 py-0.5 text-[10px] font-bold leading-none text-white sm:text-[11px]"
              >
                {b.label}
              </span>
            ))}
            <span className="hidden rounded border border-white/30 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white sm:inline">
              {ageRating(slide)}
            </span>
            <span className="text-[12px] font-semibold text-white/70 sm:text-[13px]">{year(slide)}</span>
            <span className="hidden text-[13px] font-semibold text-white/70 sm:inline">
              {metaTime(slide)}
            </span>
          </div>

          <h2 className="mt-1.5 max-w-[92%] line-clamp-2 text-[clamp(23px,6.5vw,29px)] font-extrabold leading-[1.05] tracking-[-0.02em] text-white sm:mt-4 sm:max-w-[640px] sm:line-clamp-2 sm:tracking-tight sm:text-[clamp(38px,4vw,60px)] [@media(max-height:640px)]:text-3xl">
            {slide.title}
          </h2>

          <div className="mt-1 flex items-center gap-1.5 text-[12px] font-bold text-[#f5c518] sm:text-[15px]">
            <IconStar className="h-3.5 w-3.5" />
            {score(slide)}
          </div>

          <div className="mt-3 hidden flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-white/90 sm:flex">
            {slide.genres.slice(0, 3).map((g, i) => (
              <span key={g} className="flex items-center gap-2">
                {i > 0 && <span className="text-white/40">•</span>}
                <Link href="/#browse" className="transition hover:text-violet-2">
                  {g}
                </Link>
              </span>
            ))}
          </div>

          <p className="hidden max-w-[560px] text-[12px] leading-[1.35] text-body sm:mt-5 sm:line-clamp-3 sm:block sm:text-[15px] sm:leading-7 [@media(max-height:640px)]:hidden">
            {slide.description}
          </p>

          <div className="mt-2 flex w-full flex-wrap items-center gap-2 sm:mt-7 sm:gap-3 [@media(max-height:640px)]:mt-4">
            <Link
              href={`/anime/${slide.id}/watch`}
              className="bg-gradient-btn flex h-[42px] min-w-0 flex-[1.2] items-center justify-center gap-2 rounded-full px-4 text-sm font-bold text-white shadow-[0_8px_22px_rgba(124,92,255,0.35)] transition duration-200 hover:scale-[1.03] hover:brightness-110 sm:h-12 sm:flex-none sm:px-8 sm:text-[15px]"
            >
              <IconPlay className="h-4 w-4" />
              Watch Now
            </Link>
            <Link
              href={`/anime/${slide.id}`}
              className="flex h-[42px] min-w-0 flex-1 shrink-0 items-center justify-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-3.5 text-sm font-semibold text-white backdrop-blur transition duration-200 hover:scale-[1.03] hover:border-violet-2/70 hover:bg-violet-2/15 sm:h-12 sm:px-7 sm:text-[15px]"
            >
              <IconPlus className="h-4 w-4" />
              Add to List
            </Link>
            <button
              aria-label="More info"
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white backdrop-blur transition hover:border-violet-2/70 hover:bg-violet-2/15 sm:h-12 sm:w-12"
            >
              <IconInfo className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="absolute bottom-3.5 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 md:bottom-8">
        {list.map((a, i) => (
          <button
            key={a.id}
            onClick={() => setActive(i)}
            aria-label={`Go to slide ${i + 1}: ${a.title}`}
            aria-current={i === active}
            className="group/dot flex h-7 min-w-7 items-center justify-center"
          >
            <span
              className={`rounded-full transition-all duration-300 ${
                i === active
                  ? "h-1 w-6 bg-primary shadow-[0_0_10px_rgba(124,92,255,0.65)]"
                  : "h-1 w-1 bg-white/40 group-hover/dot:bg-white/75"
              }`}
            />
          </button>
        ))}
      </div>
    </section>
  );
}
