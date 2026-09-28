import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import SectionHeading from "@/components/SectionHeading";
import PosterCard from "@/components/AnimeCard";
import TrailerButton from "@/components/TrailerButton";
import { IconBookmark, IconPlay, IconStar } from "@/components/Icons";
import {
  ageRating,
  allAnime,
  formatLabel,
  metaTime,
  qualityBadges,
  score,
  statusLabel,
  year,
} from "@/lib/anime";
import { getAnime, getRelated } from "@/lib/db";

export const revalidate = 60;

export function generateStaticParams() {
  return allAnime.map((a) => ({ id: String(a.id) }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const anime = allAnime.find((a) => a.id === Number(id));
  return {
    title: anime ? `${anime.title} – ANIMELK` : "ANIMELK",
    description: anime?.description.slice(0, 160),
  };
}

export default async function AnimePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const anime = await getAnime(Number(id));
  if (!anime) notFound();

  const isMovie = anime.format === "MOVIE" || anime.format === "SPECIAL";
  const episodeCount = anime.episodes || 0;
  const related = await getRelated(anime, 7);

  const info: [string, string][] = [
    ["Status", statusLabel(anime.status)],
    ["Type", formatLabel(anime.format)],
    ["Episodes", episodeCount ? String(episodeCount) : "—"],
    ["Duration", anime.duration ? `${anime.duration} mins` : "—"],
    ["Season", String(year(anime))],
    ["Score", `${score(anime)} / 10`],
  ];

  return (
    <div className="min-h-screen bg-ink">
      <Header solid />

      <main>
        <section className="relative h-[420px] w-full overflow-hidden pt-[72px] md:h-[520px]">
          {anime.bannerImage || anime.coverImage ? (
            <Image
              src={anime.bannerImage || anime.coverImage}
              alt={anime.title}
              fill
              priority
              sizes="100vw"
              className="object-cover object-top"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-panel via-panel-2 to-ink" />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-ink/85 via-ink/40 to-ink/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/55 to-ink/25" />
        </section>

        <div className="container-site">
          <div className="relative z-10 -mt-36 grid grid-cols-1 items-start gap-8 pb-6 md:-mt-48 md:grid-cols-[200px_minmax(0,1fr)] md:gap-9 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-10">
            <div className="relative mx-auto aspect-[488/680] w-[180px] shrink-0 overflow-hidden rounded-xl bg-panel shadow-[0_25px_60px_rgba(0,0,0,0.6)] ring-1 ring-white/10 md:mx-0 md:w-full lg:w-[240px]">
              {anime.coverImage ? (
                <Image
                  src={anime.coverImage}
                  alt={anime.title}
                  fill
                  sizes="240px"
                  className="object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center bg-panel-2 text-xs font-semibold text-muted">
                  No image
                </span>
              )}
              <div className="absolute left-2 top-2 flex gap-1.5">
                {qualityBadges(anime).map((b) => (
                  <span
                    key={b.label}
                    style={{ background: b.color }}
                    className="rounded px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
                  >
                    {b.label}
                  </span>
                ))}
              </div>
            </div>

            <div className="min-w-0 flex-1 pb-2 text-center md:text-left">
              <h1 className="max-w-3xl text-2xl font-extrabold leading-tight text-white md:text-[34px] md:leading-[1.15]">
                {anime.title}
              </h1>

              <div className="mt-3 flex flex-wrap items-center justify-center gap-x-2.5 gap-y-2 md:justify-start">
                <span className="inline-flex h-6 items-center gap-1.5">
                  <span className="rounded bg-[#f5c518] px-1.5 py-0.5 text-[11px] font-extrabold leading-none text-black">
                    IMDb
                  </span>
                  <span className="text-sm font-bold text-white">{score(anime)}</span>
                </span>
                <span className="inline-flex h-6 items-center gap-1 rounded border border-white/15 bg-white/5 px-2 text-sm font-bold text-[#f5c518]">
                  <IconStar className="h-3.5 w-3.5" />
                  {score(anime)}
                </span>
                {qualityBadges(anime).map((b) => (
                  <span
                    key={b.label}
                    style={{ background: b.color }}
                    className="inline-flex h-6 items-center rounded px-2 text-[11px] font-bold leading-none text-white"
                  >
                    {b.label}
                  </span>
                ))}
                <span className="inline-flex h-6 items-center rounded border border-white/30 px-2 text-[11px] font-bold leading-none text-white">
                  {ageRating(anime)}
                </span>
                <span className="inline-flex h-6 items-center text-sm font-semibold text-white/80">
                  {year(anime)}
                </span>
                <span className="inline-flex h-6 items-center text-sm font-semibold text-white/80">
                  {metaTime(anime)}
                </span>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-medium text-white md:justify-start">
                {anime.genres.map((g, i) => (
                  <span key={g} className="flex items-center gap-2">
                    {i > 0 && <span className="text-white/40">•</span>}
                    <Link href="/#browse" className="transition hover:text-primary">
                      {g}
                    </Link>
                  </span>
                ))}
              </div>

              <p className="mt-5 max-w-[700px] text-[15px] leading-7 text-body">
                {anime.description || "No description available."}
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-4 md:justify-start">
                <Link
                  href={`/anime/${anime.id}/watch`}
                  className="bg-gradient-btn flex items-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold text-white shadow-[0_10px_25px_rgba(123,97,255,0.35)] transition hover:opacity-90"
                >
                  <IconPlay className="h-5 w-5" />
                  {isMovie ? "Watch Now" : "Play Episode 1"}
                </Link>
                <button className="flex items-center gap-2 rounded-full border border-white/25 px-7 py-3.5 text-sm font-semibold text-white transition hover:border-primary hover:bg-primary/20">
                  <IconBookmark className="h-4 w-4" />
                  Watchlist
                </button>
                {anime.trailerUrl && <TrailerButton url={anime.trailerUrl} />}
              </div>

              <dl className="mt-7 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-white/10 pt-6 md:grid-cols-3">
                {info.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                      {label}
                    </dt>
                    <dd className="mt-1 text-sm font-bold text-white">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>

          {episodeCount > 1 && (
            <section className="mt-16">
              <SectionHeading title="Episodes" />
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
                {Array.from(
                  { length: Math.min(episodeCount, 32) },
                  (_, i) => i + 1
                ).map((n) => (
                  <Link
                    key={n}
                    href={`/anime/${anime.id}/watch?ep=${n}`}
                    className="rounded-lg border border-white/10 bg-panel py-3 text-center text-sm font-bold text-white/85 transition hover:border-primary hover:bg-primary/15 hover:text-white"
                  >
                    {n}
                  </Link>
                ))}
              </div>
              {episodeCount > 32 && (
                <p className="mt-4 text-[13px] text-muted">
                  Showing 32 of {episodeCount} episodes
                </p>
              )}
            </section>
          )}

          <section className="mb-[70px] mt-16">
            <SectionHeading title="You may also like" href="#" />
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
              {related.map((a) => (
                <PosterCard key={a.id} anime={a} />
              ))}
            </div>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
