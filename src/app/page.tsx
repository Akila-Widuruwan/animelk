import type { ReactNode } from "react";
import Header from "@/components/Header";
import Hero from "@/components/Hero";
import CategoryTiles from "@/components/CategoryTiles";
import SectionHeading from "@/components/SectionHeading";
import MediaRow from "@/components/MediaRow";
import TopTen from "@/components/TopTen";
import LibrarySlider from "@/components/LibrarySlider";
import Browse from "@/components/Browse";
import Footer from "@/components/Footer";
import HashScroll from "@/components/HashScroll";
import Reveal from "@/components/ui/Reveal";
import ContinueWatching from "@/components/ContinueWatching";
import { db, heroSlides, librarySlides, allAnime } from "@/lib/anime";
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

const DEFAULT_TOPICS = [
  "Action",
  "Romance",
  "Isekai",
  "Slice of Life",
  "Mecha",
  "Horror",
  "Sports",
  "Adventure",
];

function fallbackSections(): HomeSection[] {
  const topicImages = DEFAULT_TOPICS.map((genre) => {
    const hit = allAnime.find((a) => a.genres.includes(genre)) ?? allAnime[0];
    return hit.coverImage;
  });
  return [
    {
      slug: "categories",
      title: "What are you interested in?",
      kind: "topics",
      panel: false,
      viewAllUrl: "#",
      items: [],
      topics: DEFAULT_TOPICS.map((name, i) => ({
        name,
        color: ["#104aa8", "#7fb237", "#b56129", "#d38d30", "#b625ea", "#e023a7", "#18ba2d", "#590020"][i],
        image: topicImages[i],
      })),
    },
    { slug: "latest-episode", title: "Latest Episode", kind: "carousel", panel: false, viewAllUrl: "#", items: db.airing.map((a) => ({ ...a, lastEpisode: a.episodes || 1 })), topics: null },
    { slug: "airing", title: "Airing Now", kind: "carousel", panel: false, viewAllUrl: "#", items: db.airing, topics: null },
    { slug: "new-anime", title: "New Anime", kind: "carousel", panel: false, viewAllUrl: "#", items: db.popular, topics: null },
    { slug: "top-series", title: "Top 10 Anime Series Today", kind: "top10", panel: false, viewAllUrl: null, items: db.topToday, topics: null },
    { slug: "action-anime", title: "Action Anime", kind: "carousel", panel: false, viewAllUrl: "#", items: db.action, topics: null },
    { slug: "top-movies", title: "Top 10 Anime Movies Today", kind: "top10", panel: false, viewAllUrl: null, items: db.topMovies, topics: null },
    { slug: "library", title: "Latest Anime Library", kind: "slider", panel: false, viewAllUrl: "#", items: librarySlides, topics: null },
    { slug: "browse", title: "Browse", kind: "filter", panel: false, viewAllUrl: "#", items: allAnime, topics: null },
    { slug: "horror", title: "Horror Anime", kind: "carousel", panel: false, viewAllUrl: "#", items: db.horror, topics: null },
    { slug: "anime-movies", title: "Anime Movies", kind: "carousel", panel: false, viewAllUrl: "#", items: db.movies, topics: null },
    { slug: "slice-of-life", title: "Slice of Life Anime", kind: "carousel", panel: false, viewAllUrl: "#", items: db.family, topics: null },
  ];
}

const ANCHORS: Record<string, string> = {
  categories: "categories",
  "latest-episode": "latest-episode",
  airing: "airing",
  browse: "browse",
  "anime-movies": "anime-movies",
};

function SectionBody({ section }: { section: HomeSection }) {
  switch (section.kind) {
    case "topics":
      return <CategoryTiles topics={section.topics ?? undefined} />;
    case "top10":
      return <TopTen items={section.items} />;
    case "slider":
      return <LibrarySlider items={section.items} />;
    case "filter":
      return <Browse pool={section.items} />;
    default:
      return (
        <MediaRow
          items={section.items}
          panel={section.kind === "panel"}
          episodeLinks={section.slug === "latest-episode"}
        />
      );
  }
}

export default async function Home() {
  const home = await fetchHome();
  const hero = home?.hero && home.hero.length > 0 ? home.hero : heroSlides;
  const sections = home?.sections && home.sections.length > 0 ? home.sections : fallbackSections();

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
