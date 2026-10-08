import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RequestClient from "@/components/request/RequestClient";

export const metadata: Metadata = {
  title: "Request an Anime – ANIMELK",
  description:
    "Can't find the anime you're looking for? Search AniList and request it — see what the community wants us to add next.",
};

export default function RequestAnimePage() {
  return (
    <div className="min-h-screen bg-ink">
      <Header solid />
      <main className="pt-[72px]">
        <div className="container-site py-10 sm:py-14">
          <RequestClient />
        </div>
      </main>
      <Footer />
    </div>
  );
}
