import { NextResponse } from "next/server";
import { searchAnime } from "@/lib/db";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const results = await searchAnime(q, 8);
  return NextResponse.json({ results });
}
