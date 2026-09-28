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
  }, [paused, active, list.length]);

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
      className="relative h-[56svh] min-h-[500px] max-h-[620px] w-full overflow-hidden sm:h-[85svh] sm:min-h-[520px] sm:max-h-none xl:h-[100svh] xl:min-h-[560px]"
      onMouseEnter={() => setPaused(true)}
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
              className="object-cover object-[60%_center] sm:object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/55 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-ink/40" />
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-0 z-[5] bg-gradient-to-t from-ink via-ink/25 to-transparent md:hidden" />

      <div className="container-site relative z-20 flex h-full flex-col items-stretch justify-start pt-[76px] md:flex-row md:items-center md:justify-start md:pt-0">
        <div key={slide.id} className="animate-fade-in-up w-full max-w-[640px] md:pb-16 lg:pb-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-2 sm:gap-x-3">
            <span className="flex items-center gap-1.5">
              <span className="rounded bg-[#f5c518] px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-black">
                IMDb
              </span>
              <span className="text-sm font-bold text-white">{score(slide)}</span>
            </span>
            {qualityBadges(slide).map((b) => (
              <span
                key={b.label}
                style={{ background: b.color }}
                className="rounded px-1.5 py-0.5 text-[11px] font-bold leading-none text-white"
              >
                {b.label}
              </span>
            ))}
            <span className="rounded border border-white/30 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">
              {ageRating(slide)}
            </span>
            <span className="text-[13px] font-semibold text-white/70">{year(slide)}</span>
            <span className="hidden text-[13px] font-semibold text-white/70 sm:inline">
              {metaTime(slide)}
            </span>
          </div>

          <h2 className="mt-3 max-w-[95%] line-clamp-2 text-[26px] font-extrabold leading-[1.08] tracking-tight text-white min-[400px]:text-[28px] sm:mt-4 sm:max-w-none sm:line-clamp-none sm:text-[42px] md:text-[50px] xl:text-[58px] [@media(max-height:640px)]:text-3xl">
            {slide.title}
          </h2>

          <div className="mt-2 flex items-center gap-1.5 text-[13px] font-bold text-[#f5c518] md:hidden">
            <IconStar className="h-4 w-4" />
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
            <span className="flex items-center gap-2">
              <span className="text-white/40">•</span>
              <span className="flex items-center gap-1 text-[#f5c518]">
                <IconStar className="h-3.5 w-3.5" />
                {score(slide)}
              </span>
            </span>
          </div>

          <p className="mt-3 line-clamp-2 max-w-[560px] text-[13px] leading-[1.5] text-body sm:mt-5 sm:line-clamp-3 sm:text-[15px] sm:leading-7 [@media(max-height:640px)]:hidden">
            {slide.description}
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2.5 sm:mt-7 sm:gap-3 [@media(max-height:640px)]:mt-4">
            <Link
              href={`/anime/${slide.id}/watch`}
              className="bg-gradient-btn flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold text-white shadow-[0_12px_30px_rgba(124,92,255,0.45)] transition duration-200 hover:scale-[1.03] hover:brightness-110 sm:flex-none sm:px-8 sm:text-[15px]"
            >
              <IconPlay className="h-5 w-5" />
              Watch Now
            </Link>
            <Link
              href={`/anime/${slide.id}`}
              className="flex h-12 items-center gap-2 rounded-full border border-white/20 bg-white/5 px-4 text-sm font-semibold text-white backdrop-blur transition duration-200 hover:scale-[1.03] hover:border-violet-2/70 hover:bg-violet-2/15 sm:px-7 sm:text-[15px]"
            >
              <IconPlus className="h-4 w-4" />
              Add to List
            </Link>
            <button
              aria-label="More info"
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white backdrop-blur transition hover:border-violet-2/70 hover:bg-violet-2/15"
            >
              <IconInfo className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="mt-auto w-full pb-6 pt-6 md:hidden">
          <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {list.map((a, i) => (
              <button
                key={a.id}
                onClick={() => setActive(i)}
                aria-label={a.title}
                className={`group relative aspect-video w-[84px] shrink-0 overflow-hidden rounded-lg border-2 transition-all duration-300 ${
                  i === active
                    ? "border-primary shadow-[0_0_16px_rgba(124,92,255,0.45)]"
                    : "border-white/10 opacity-60 hover:opacity-100"
                }`}
              >
                <Image
                  src={a.bannerImage || a.coverImage}
                  alt={a.title}
                  fill
                  sizes="88px"
                  loading={i === 0 ? "eager" : "lazy"}
                  className="object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="absolute bottom-5 left-0 right-0 z-20 hidden md:block lg:right-[clamp(20px,5vw,80px)] lg:left-auto lg:bottom-[72px]">
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-6 lg:w-auto lg:justify-end lg:overflow-visible lg:px-0 lg:pr-0">
          {list.map((a, i) => (
            <button
              key={a.id}
              onClick={() => setActive(i)}
              aria-label={a.title}
              className={`group relative aspect-video w-[140px] shrink-0 overflow-hidden rounded-lg border transition-all duration-300 xl:w-[150px] ${
                i === active
                  ? "scale-105 border-primary shadow-[0_0_20px_rgba(124,92,255,0.45)]"
                  : "border-white/10 opacity-60 hover:scale-[1.04] hover:opacity-100"
              }`}
            >
              <Image
                src={a.bannerImage || a.coverImage}
                alt={a.title}
                fill
                sizes="150px"
                loading={i === 0 ? "eager" : "lazy"}
                className="object-cover transition duration-300 group-hover:brightness-110"
              />
              <span className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-70" />
              <span className="absolute inset-x-2 bottom-1.5 truncate text-left text-[10px] font-semibold text-white/90">
                {a.title}
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
