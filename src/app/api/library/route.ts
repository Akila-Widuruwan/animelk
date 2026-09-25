import { NextResponse } from "next/server";
import data from "@/data/anime.json";

export function GET() {
  return NextResponse.json(data);
}
