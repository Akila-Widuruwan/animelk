import type { ReactNode } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import SectionHeading from "@/components/SectionHeading";
import MediaRow from "@/components/MediaRow";
import LatestEpisodeGrid from "@/components/LatestEpisodeGrid";
import TopTen from "@/components/TopTen";
import LibrarySlider from "@/components/LibrarySlider";
import Browse from "@/components/Browse";
import Footer from "@/components/Footer";
import HashScroll from "@/components/HashScroll";
import Reveal from "@/components/ui/Reveal";
import ContinueWatching from "@/components/ContinueWatching";
import {
  db,
  heroSlides,
  librarySlides,
  allAnime,
  completedAnime,
  movieAnime,
  isMovie,
} from "@/lib/anime";
import { fetchHome, type HomeSection } from "@/lib/db";

export const revalidate = 60;

function Section({
  children,
  id,
}: {
  children: ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="container-site mb-7 scroll-mt-24 sm:mb-12 lg:mb-16">
      {children}
    </section>
  );
}

function fallbackSections(): HomeSection[] {
  return [
    { slug: "latest-episode", title: "Latest Episode", kind: "carousel", panel: false, viewAllUrl: "#", items: db.airing.map((a) => ({ ...a, lastEpisode: a.episodes || 1 })), topics: null },
    { slug: "airing", title: "Airing Now", kind: "carousel", panel: false, viewAllUrl: "#", items: db.airing, topics: null },
    { slug: "completed-anime", title: "Completed Anime", kind: "carousel", panel: false, viewAllUrl: "#", items: completedAnime.slice(0, 24), topics: null },
    { slug: "top-series", title: "Top 10 Anime Series Today", kind: "top10", panel: false, viewAllUrl: null, items: db.topToday, topics: null },
    { slug: "action-anime", title: "Action Anime", kind: "carousel", panel: false, viewAllUrl: "#", items: db.action, topics: null },
    { slug: "top-movies", title: "Top 10 Anime Movies Today", kind: "top10", panel: false, viewAllUrl: null, items: db.topMovies.filter(isMovie), topics: null },
    { slug: "library", title: "Latest Anime Library", kind: "slider", panel: false, viewAllUrl: "#", items: librarySlides, topics: null },
    { slug: "browse", title: "Browse", kind: "filter", panel: false, viewAllUrl: "#", items: allAnime, topics: null },
    { slug: "horror", title: "Horror Anime", kind: "carousel", panel: false, viewAllUrl: "#", items: db.horror, topics: null },
    { slug: "anime-movies", title: "Anime Movies", kind: "carousel", panel: false, viewAllUrl: "#", items: movieAnime, topics: null },
    { slug: "slice-of-life", title: "Slice of Life Anime", kind: "carousel", panel: false, viewAllUrl: "#", items: db.family, topics: null },
  ];
}

const ANCHORS: Record<string, string> = {
  "latest-episode": "latest-episode",
  airing: "airing",
  "completed-anime": "completed-anime",
  "new-anime": "completed-anime",
  browse: "browse",
  "anime-movies": "anime-movies",
};

function SectionBody({ section }: { section: HomeSection }) {
  // "Latest Episode" is a real responsive grid of up to three rows, not a
  // horizontally-scrolling carousel.
  if (section.slug === "latest-episode") {
    return <LatestEpisodeGrid items={section.items} />;
  }

  switch (section.kind) {
    case "top10":
      return <TopTen items={section.items} />;
    case "slider":
      return <LibrarySlider items={section.items} />;
    case "filter":
      return <Browse pool={section.items} />;
    default:
      return <MediaRow items={section.items} panel={section.kind === "panel"} />;
  }
}

export default async function Home() {
  const home = await fetchHome();
  const hero = home?.hero && home.hero.length > 0 ? home.hero : heroSlides;
  const sections = (
    home?.sections && home.sections.length > 0 ? home.sections : fallbackSections()
  ).filter(
    // The genre-tile "What are you interested in?" row is gone from the home
    // page. The topics data and the admin tab stay, so nothing is lost if the
    // row is ever wanted again.
    (s) => s.slug !== "categories" && s.kind !== "topics"
  );

  return (
    <div className="bg-ink">
      <HashScroll />
      <Header />
      <Hero slides={hero} />
      <main>
        <div className="pt-6 md:pt-8">
          <ContinueWatching />
        </div>
        {sections.map((s) => (
          <Section key={s.slug} id={ANCHORS[s.slug]}>
            <Reveal>
              <SectionHeading title={s.title} href={s.viewAllUrl ?? undefined} />
              <SectionBody section={s} />
            </Reveal>
          </Section>
        ))}
      </main>
      <Footer />
    </div>
  );
}
