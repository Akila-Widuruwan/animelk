"use client";

import Image from "next/image";
import Link from "next/link";
import type { Anime } from "@/lib/anime";
import { score } from "@/lib/anime";
import { IconPlay, IconStar } from "./Icons";
import Carousel from "./Carousel";

export default function TopTen({ items }: { items: Anime[] }) {
  return (
    <Carousel className="items-stretch">
      {items.map((a, i) => (
        <div
          key={a.id}
          className="flex w-[190px] shrink-0 snap-start items-end md:w-[240px]"
        >
          <span className="rank-stroke -mr-3 shrink-0 pb-2 text-[84px] font-black leading-none md:text-[110px]">
            {i + 1}
          </span>
          <Link
            href={`/anime/${a.id}`}
            className="group relative block aspect-[2/3] w-full overflow-hidden rounded-xl bg-panel ring-1 ring-white/[0.06] transition-all duration-300 hover:scale-[1.04] hover:shadow-[0_18px_45px_rgba(0,0,0,0.55)] hover:ring-primary/40"
          >
            {a.coverImage ? (
              <Image
                src={a.coverImage}
                alt={a.title}
                fill
                sizes="(max-width:768px) 190px, 240px"
                className="object-cover transition duration-300 group-hover:brightness-110"
              />
            ) : (
              <span className="flex h-full w-full items-center justify-center bg-panel-2 text-[11px] font-semibold text-muted">
                No image
              </span>
            )}
            <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
            <span className="bg-gradient-btn absolute left-1/2 top-1/3 flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full text-white opacity-0 shadow-lg transition duration-300 group-hover:opacity-100">
              <IconPlay className="h-5 w-5" />
            </span>
            <span className="absolute inset-x-0 bottom-0 p-3">
              <span className="block truncate text-[13px] font-bold text-white">
                {a.title}
              </span>
              <span className="mt-1 flex items-center gap-1.5 text-[12px] font-semibold text-white/75">
                <IconStar className="h-3 w-3 text-[#f5c518]" />
                {score(a)}
              </span>
            </span>
          </Link>
        </div>
      ))}
    </Carousel>
  );
}
