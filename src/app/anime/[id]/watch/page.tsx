import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import WatchPlayer from "@/components/WatchPlayer";
import AnimeCard from "@/components/AnimeCard";
import SectionHeading from "@/components/SectionHeading";
import EpisodeSidebar from "@/components/watch/EpisodeSidebar";
import AnimeWatchInfo from "@/components/watch/AnimeWatchInfo";
import { IconChevronLeft, IconChevronRight } from "@/components/Icons";
import { allAnime, db } from "@/lib/anime";
import { getAnime, getEpisodes, getRelated } from "@/lib/db";
import { isDirectMediaUrl, serverSources } from "@/lib/stream";
import {
  episodeLabel,
  episodeNeighbours,
  episodeNumbers,
  resolveEpisodeNumber,
  sameEpisode,
} from "@/lib/episode-number";

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
    title: anime ? `Watch ${anime.title} – AniLanka` : "AniLanka",
  };
}

function EpisodeNavCard({
  animeId,
  ep,
  label,
  title,
  align,
}: {
  animeId: number;
  ep: number;
  label: string;
  title: string | null;
  align: "left" | "right";
}) {
  return (
    <Link
      href={`/anime/${animeId}/watch?ep=${ep}`}
      className={`group flex items-center gap-3 rounded-xl border border-white/[0.07] bg-panel/40 p-4 transition duration-200 hover:border-violet-2/50 hover:bg-panel/70 ${
        align === "right" ? "flex-row-reverse text-right" : ""
      }`}
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/70 transition group-hover:border-violet-2 group-hover:text-white">
        {align === "left" ? (
          <IconChevronLeft className="h-4 w-4" />
        ) : (
          <IconChevronRight className="h-4 w-4" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-[11px] font-bold uppercase tracking-wider text-muted">
          {label}
        </span>
        <span className="block truncate text-[14px] font-bold text-white transition group-hover:text-violet-2">
          Episode {episodeLabel(ep)}
          {title ? ` — ${title}` : ""}
        </span>
      </span>
    </Link>
  );
}

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ep?: string }>;
}) {
  const { id } = await params;
  const { ep: epParam } = await searchParams;
  const [anime, episodes] = await Promise.all([
    getAnime(Number(id)),
    getEpisodes(Number(id)),
  ]);
  if (!anime) notFound();

  const isMovie = anime.format === "MOVIE" || anime.format === "SPECIAL";
  // Only the numbers that actually exist: a part 2 holds 13-24, a back
  // catalogue may only have 5, 6 and 9, and half episodes (13.5) are valid.
  // Without ?ep= the first available episode opens, so a title that starts at
  // 13 no longer lands on an empty episode 1.
  const numbers = episodeNumbers(episodes);
  const ep = resolveEpisodeNumber(epParam, numbers);
  const current = episodes.find((e) => sameEpisode(e.episode_number, ep)) ?? null;
  const { prev: prevEp, next: nextEp } = episodeNeighbours(numbers, ep);
  // Neighbours are adjacent in the list, so gaps and half numbers still step
  // correctly (13.5 -> 14, never 13.5 -> 14.5).
  const prev =
    prevEp === null ? null : episodes.find((e) => sameEpisode(e.episode_number, prevEp)) ?? null;
  const next =
    nextEp === null ? null : episodes.find((e) => sameEpisode(e.episode_number, nextEp)) ?? null;
  const episodesWithVideo = episodes
    .filter((e) => e.video_url)
    .map((e) => e.episode_number);
  const episodeTitles = Object.fromEntries(
    episodes
      .filter((e) => e.title)
      .map((e) => [e.episode_number, e.title as string])
  );

  const externalPlayerUrl = current?.video_url
    ? serverSources(current.video_url)
        .filter((s) => Boolean(s))
        .map((s) => s!.url)
        .find((u) => isDirectMediaUrl(u)) ?? null
    : null;

  const related = await getRelated(anime, 7);
  const popular = db.topToday.filter((a) => a.id !== anime.id).slice(0, 7);

  const sidebar = (orientation: "vertical" | "horizontal") =>
    !isMovie && numbers.length > 1 ? (
      <EpisodeSidebar
        animeId={anime.id}
        currentEp={ep}
        numbers={numbers}
        episodeTitles={episodeTitles}
        withVideo={episodesWithVideo}
        orientation={orientation}
      />
    ) : null;

  return (
    <div className="relative min-h-screen bg-ink">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[560px] overflow-hidden">
        {anime.coverImage && (
          <Image
            src={anime.coverImage}
            alt=""
            fill
            priority
            sizes="100vw"
            className="scale-110 object-cover opacity-[0.06] blur-[60px]"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-ink/60 to-ink" />
      </div>

      <Header solid />

      <main className="relative pt-[72px]">
        <div className="container-site py-6 lg:py-8">
          <nav
            aria-label="Breadcrumb"
            className="flex items-center gap-2 text-[13px] font-medium"
          >
            <Link href="/" className="text-muted transition hover:text-white">
              Home
            </Link>
            <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-muted/50" />
            <Link
              href={`/anime/${anime.id}`}
              className="truncate text-white/70 transition hover:text-white"
            >
              {anime.title}
            </Link>
            <IconChevronRight className="h-3.5 w-3.5 shrink-0 text-muted/50" />
            <span className="shrink-0 font-bold text-white">
              {isMovie ? "Watch" : `Episode ${episodeLabel(ep)}`}
            </span>
          </nav>

          <div className="mt-5 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_320px] 2xl:grid-cols-[minmax(0,1fr)_336px]">
            <div className="min-w-0">
              <WatchPlayer
                key={current?.video_url ?? "none"}
                anime={anime}
                ep={ep}
                videoUrl={current?.video_url ?? null}
                episodeTitle={current?.title ?? null}
                episodeId={current?.id ?? null}
                hasEpisodeRow={Boolean(current)}
                subtitles={current?.subtitles ?? []}
                hasPrevEpisode={Boolean(prev)}
                hasNextEpisode={Boolean(next)}
                prevEpisode={isMovie ? null : prevEp}
                nextEpisode={isMovie ? null : nextEp}
              />

              {sidebar("horizontal")}

              <AnimeWatchInfo
                anime={anime}
                ep={ep}
                episodeTitle={current?.title ?? null}
                isMovie={isMovie}
                videoUrl={externalPlayerUrl}
                subtitles={current?.subtitles ?? []}
              />

              {!isMovie && numbers.length > 1 && (
                <div className="mt-8 grid gap-3 border-t border-white/[0.06] pt-6 sm:grid-cols-2">
                  {prev && prevEp !== null ? (
                    <EpisodeNavCard
                      animeId={anime.id}
                      ep={prevEp}
                      label="Previous"
                      title={prev.title}
                      align="left"
                    />
                  ) : (
                    <span className="hidden sm:block" />
                  )}
                  {next && nextEp !== null ? (
                    <EpisodeNavCard
                      animeId={anime.id}
                      ep={nextEp}
                      label="Next Episode"
                      title={next.title}
                      align="right"
                    />
                  ) : (
                    <span className="hidden sm:block" />
                  )}
                </div>
              )}
            </div>

            {sidebar("vertical")}
          </div>

          {related.length > 0 && (
            <section className="mt-14">
              <SectionHeading title="More Like This" href="#" />
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
                {related.map((a) => (
                  <AnimeCard key={a.id} anime={a} />
                ))}
              </div>
            </section>
          )}

          {popular.length > 0 && (
            <section className="mt-14 pb-4">
              <SectionHeading title="Popular on AniLanka" href="#" />
              <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
                {popular.map((a) => (
                  <AnimeCard key={a.id} anime={a} />
                ))}
              </div>
            </section>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
