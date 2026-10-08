import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/**
 * Monetag's tag is loaded by /ad-gate.js rather than pasted here, because that
 * file has to decide whether to load it before any ad request goes out: it keeps
 * ads off for ten minutes after a visitor clicks one. See public/ad-gate.js for
 * the zone, the detection rules and the rest of the reasoning.
 */
const AD_GATE_SRC = "/ad-gate.js";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AniLanka – Watch Anime Online",
  description:
    "Stream the latest anime series and movies in HD. Watch trending anime, top-rated classics and new releases online for free.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} antialiased`}
      suppressHydrationWarning
      data-scroll-behavior="smooth"
    >
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        {/* A plain async script tag, which React hoists into the document head. */}
        <script id="ad-gate" async src={AD_GATE_SRC} />
        {children}
      </body>
    </html>
  );
}
