import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnimeCard from "@/components/AnimeCard";
import { searchAnime } from "@/lib/db";

export const metadata: Metadata = {
  title: "Search – AniLanka",
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const results = await searchAnime(query, 60);

  return (
    <div className="min-h-screen bg-ink">
      <Header solid />
      <main className="pt-[72px]">
        <div className="container-site py-10">
          <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
            {query ? <>Search results for “{query}”</> : "Search"}
          </h1>
          <p className="mt-2 text-[13.5px] text-muted">
            {results.length} title{results.length === 1 ? "" : "s"} found
          </p>

          {results.length > 0 ? (
            <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7">
              {results.map((a) => (
                <AnimeCard key={a.id} anime={a} />
              ))}
            </div>
          ) : (
            <p className="mt-10 rounded-xl border border-white/[0.06] bg-panel/40 px-6 py-12 text-center text-[15px] text-muted">
              No anime found for “{query}”. Try a different title or genre.
            </p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
