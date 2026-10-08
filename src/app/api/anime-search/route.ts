import { NextResponse } from "next/server";
import { searchAnimeCatalog } from "@/lib/anime-provider";

export const dynamic = "force-dynamic";

/**
 * Public anime catalogue search for the "Request an Anime" page.
 *
 * The client debounces input and aborts stale requests; this route validates
 * the query, leans on the provider's short-lived cache, and always answers with
 * a friendly message instead of raw upstream errors.
 */
export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();

  if (q.length < 2) {
    return NextResponse.json({ ok: true, results: [] });
  }
  if (q.length > 80) {
    return NextResponse.json(
      { ok: false, error: "That search is too long. Try a shorter title." },
      { status: 400 }
    );
  }

  try {
    const results = await searchAnimeCatalog(q, 12);
    return NextResponse.json(
      { ok: true, results },
      {
        headers: {
          // Cheap CDN/browser reuse of identical searches.
          "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error) {
    const message =
      error instanceof Error && error.message === "RATE_LIMITED"
        ? "The anime database is busy right now. Please try again in a moment."
        : "Something went wrong while searching. Please try again.";
    return NextResponse.json({ ok: false, error: message }, { status: 502 });
  }
}
