import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GoogleSignIn from "@/components/login/GoogleSignIn";

export const metadata: Metadata = {
  title: "Sign In – AniLanka",
  description:
    "Sign in with Google to sync your AniLanka watchlist and continue watching across devices.",
  robots: { index: false, follow: true },
};

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-ink">
      <Header solid />
      <main className="relative flex flex-1 items-center justify-center px-4 pb-16 pt-[104px] md:pt-[120px]">
        <GoogleSignIn />
      </main>
      <Footer />
    </div>
  );
}
