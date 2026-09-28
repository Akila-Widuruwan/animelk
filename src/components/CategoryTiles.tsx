"use client";

import Image from "next/image";
import Link from "next/link";
import { findByGenre } from "@/lib/anime";
import type { HomeTopic } from "@/lib/db";
import Carousel from "./Carousel";

const DEFAULT_TOPICS = [
  { name: "Action", color: "#104aa8", genre: "Action" },
  { name: "Romance", color: "#7fb237", genre: "Romance" },
  { name: "Isekai", color: "#b56129", genre: "Fantasy" },
  { name: "Slice of Life", color: "#d38d30", genre: "Slice of Life" },
  { name: "Mecha", color: "#b625ea", genre: "Mecha" },
  { name: "Horror", color: "#e023a7", genre: "Horror" },
  { name: "Sports", color: "#18ba2d", genre: "Sports" },
  { name: "Adventure", color: "#590020", genre: "Adventure" },
];

export default function CategoryTiles({ topics }: { topics?: HomeTopic[] }) {
  const tiles: HomeTopic[] =
    topics && topics.length > 0
      ? topics
      : DEFAULT_TOPICS.map((t) => ({
          name: t.name,
          color: t.color,
          image: findByGenre(t.genre).coverImage,
        }));

  return (
    <Carousel>
      {tiles.map((t) => (
        <Link
          key={t.name}
          href="/#browse"
          className="group relative aspect-[2/1] w-[150px] shrink-0 snap-start overflow-hidden rounded-xl ring-1 ring-white/[0.06] sm:w-[190px] lg:w-[210px]"
          style={{ background: t.image ? undefined : t.color }}
        >
          {t.image && (
            <Image
              src={t.image}
              alt={t.name}
              fill
              sizes="(max-width:640px) 150px, 210px"
              className="object-cover transition duration-300 group-hover:scale-110"
            />
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />
          <span className="absolute left-3 top-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">
            Genre
          </span>
          <span className="absolute bottom-2.5 left-3 text-[15px] font-extrabold text-white transition group-hover:text-violet-2">
            {t.name}
          </span>
        </Link>
      ))}
    </Carousel>
  );
}
