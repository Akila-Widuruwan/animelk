"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { Anime } from "@/lib/anime";
import {
  ageRating,
  librarySlides,
  metaTime,
  qualityBadges,
  score,
  year,
} from "@/lib/anime";
import { IconPlay, IconStar } from "./Icons";

export default function LibrarySlider({ items }: { items?: Anime[] }) {
  const list = (items && items.length > 0 ? items : librarySlides).filter(
    (a) => a.bannerImage || a.coverImage
  );
  const [active, setActive] = useState(0);
  const slide = list[active] ?? list[0];

  if (!slide) return null;

  return (
    <div className="relative h-[320px] overflow-hidden rounded-2xl ring-1 ring-white/[0.06] sm:h-[380px] xl:h-[440px]">
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
            sizes="100vw"
            className="object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/30 to-ink/40" />
          <div className="absolute inset-0 bg-gradient-to-r from-ink/40 via-transparent to-ink/40" />
        </div>
      ))}

      <div className="relative z-20 flex h-full flex-col items-center justify-center px-6 text-center">
        <div key={slide.id} className="animate-fade-in-up max-w-[820px]">
          <p className="text-[11px] font-bold uppercase tracking-[0.25em] text-violet-2">
            Latest Anime Library
          </p>
          <h2 className="mt-3 text-[22px] font-extrabold leading-tight tracking-tight text-white sm:text-[26px] md:text-[36px]">
            {slide.title}
          </h2>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-2">
            <span className="flex items-center gap-1.5">
              <span className="rounded bg-[#f5c518] px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-black">
                IMDb
              </span>
              <span className="text-[13px] font-bold text-white">{score(slide)}</span>
            </span>
            {qualityBadges(slide).map((b) => (
              <span
                key={b.label}
                style={{ background: b.color }}
                className="rounded px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
              >
                {b.label}
              </span>
            ))}
            <span className="rounded border border-white/30 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white">
              {ageRating(slide)}
            </span>
            <span className="text-[13px] font-semibold text-white/70">{year(slide)}</span>
            <span className="text-[13px] font-semibold text-white/70">{metaTime(slide)}</span>
            <span className="flex items-center gap-1 text-[13px] font-bold text-[#f5c518]">
              <IconStar className="h-3.5 w-3.5" />
              {score(slide)}
            </span>
          </div>
          <div className="mt-6 flex justify-center">
            <Link
              href={`/anime/${slide.id}/watch`}
              className="bg-gradient-btn flex h-12 items-center gap-2 rounded-full px-8 text-[15px] font-bold text-white shadow-[0_12px_30px_rgba(124,92,255,0.45)] transition duration-200 hover:scale-[1.03] hover:brightness-110"
            >
              <IconPlay className="h-4 w-4" />
              Watch Now
            </Link>
          </div>
        </div>
      </div>

      <div className="absolute bottom-5 left-1/2 z-20 flex -translate-x-1/2 gap-2.5">
        {list.map((a, i) => (
          <button
            key={a.id}
            onClick={() => setActive(i)}
            aria-label={a.title}
            className={`relative hidden aspect-video w-[84px] shrink-0 overflow-hidden rounded-md border transition-all duration-300 sm:block xl:w-[96px] ${
              i === active
                ? "border-primary shadow-[0_0_16px_rgba(124,92,255,0.4)]"
                : "border-white/10 opacity-50 hover:opacity-100"
            }`}
          >
            <Image
              src={a.bannerImage || a.coverImage}
              alt={a.title}
              fill
              sizes="100px"
              className="object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
