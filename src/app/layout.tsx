import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/**
 * Monetag ad tag (zone 292661). Written as the plain script element itself
 * rather than through next/script: Next routes script markup into the client
 * payload instead of the server HTML, while React hoists a plain async script
 * into the document head — the placement Monetag asks for.
 */
const MONETAG_TAG = {
  zone: "292661",
  src: "https://quge5.com/88/tag.min.js",
};

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
        {/* Plain async script tag, which React hoists into the document head. */}
        <script
          id="monetag-tag"
          async
          data-cfasync="false"
          src={MONETAG_TAG.src}
          data-zone={MONETAG_TAG.zone}
        />
        {children}
      </body>
    </html>
  );
}
