import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MyList from "@/components/MyList";

export const metadata: Metadata = {
  title: "My List – AniLanka",
  description: "The anime you saved, on every device you sign in on.",
  robots: { index: false, follow: true },
};

export default function MyListPage() {
  return (
    <div className="min-h-screen bg-ink">
      <Header solid />
      <main className="pt-[72px]">
        <div className="container-site py-10">
          <h1 className="text-2xl font-extrabold tracking-tight text-white md:text-3xl">
            My List
          </h1>
          <p className="mb-8 mt-2 text-[13.5px] text-muted">
            Everything you saved with <strong className="font-bold">Add to List</strong>.
          </p>
          <MyList />
        </div>
      </main>
      <Footer />
    </div>
  );
}
