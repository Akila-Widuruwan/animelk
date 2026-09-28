import Image from "next/image";
import Link from "next/link";
import type { Anime } from "@/lib/anime";
import { ageRating, metaTime, qualityBadges, score, year } from "@/lib/anime";
import { IconPlay, IconStar } from "./Icons";

interface Props {
  anime: Anime;
  variant?: "carousel" | "grid";
  className?: string;
}

export default function AnimeCard({ anime, variant = "grid", className = "" }: Props) {
  const [quality] = qualityBadges(anime);
  const meta = [year(anime), anime.genres[0] ?? "Anime"].filter(Boolean).join(" • ");

  return (
    <div
      className={`group ${
        variant === "carousel"
          ? "w-[132px] shrink-0 snap-start sm:w-[176px] lg:w-[196px] xl:w-[216px]"
          : "w-full"
      } ${className}`}
    >
      <Link
        href={`/anime/${anime.id}`}
        aria-label={anime.title}
        className="relative block aspect-[2/3] overflow-hidden rounded-xl bg-panel ring-1 ring-white/[0.06] transition-all duration-300 group-hover:scale-[1.04] group-hover:shadow-[0_18px_45px_rgba(0,0,0,0.55)] group-hover:ring-primary/40"
      >
        {anime.coverImage ? (
          <Image
            src={anime.coverImage}
            alt={anime.title}
            fill
            sizes="(max-width:640px) 132px, (max-width:1280px) 25vw, 216px"
            className="object-cover transition duration-300 group-hover:brightness-110"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center bg-panel-2 text-[11px] font-semibold text-muted">
            No image
          </span>
        )}

        <div className="absolute left-2 top-2 flex items-center gap-1.5">
          <span
            style={{ background: quality.color }}
            className="rounded px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
          >
            {quality.label}
          </span>
          {anime.episodes > 0 && (
            <span className="rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold leading-none text-white backdrop-blur">
              EP {anime.episodes}
            </span>
          )}
        </div>

        {anime.completed && (
          <span className="absolute bottom-2 left-2 rounded bg-emerald-500/90 px-1.5 py-0.5 text-[9px] font-bold leading-none text-white ring-1 ring-emerald-300/40 shadow-[0_2px_8px_rgba(16,185,129,0.35)] transition-opacity duration-200 group-hover:opacity-0 sm:text-[10px]">
            ✓ COMPLETED
          </span>
        )}

        {anime.averageScore > 0 && (
          <span className="absolute right-2 top-2 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 backdrop-blur">
            <IconStar className="h-2.5 w-2.5" />
            {score(anime)}
          </span>
        )}

        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/90 via-black/40 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
          <span className="bg-gradient-btn absolute left-1/2 top-[36%] flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full text-white shadow-[0_10px_25px_rgba(124,92,255,0.5)]">
            <IconPlay className="h-5 w-5" />
          </span>
          <p className="truncate text-[12px] font-semibold text-white/90">
            {ageRating(anime)} · {metaTime(anime)}
          </p>
        </div>
      </Link>

      <div className="mt-2.5 px-0.5">
        <h6 className="line-clamp-2 text-[12.5px] font-bold leading-snug text-white transition-colors group-hover:text-violet-2 sm:line-clamp-none sm:truncate sm:text-[13.5px] sm:leading-normal">
          {anime.title}
        </h6>
        <p className="mt-0.5 truncate text-[11.5px] text-muted sm:text-[12px]">{meta}</p>
      </div>
    </div>
  );
}
