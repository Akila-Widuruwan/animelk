import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/**
 * Monetag click-ad tag (zone 11986387). Their snippet only builds a loader
 * element, and Next.js keeps inline script markup out of the server HTML, so the
 * loader is written directly as <script async src data-zone>. React hoists that
 * into the document head, which is the placement Monetag asks for. The loader
 * installs the click handler that monetises poster and thumbnail clicks.
 */
const MONETAG_ZONE = "11986387";

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
        {/* Monetag's loader: a plain async script tag, which React hoists into
            the document head, as close to their "paste at the end of <head>"
            instruction as an App Router layout can get. */}
        <script
          id="monetag-click-tag"
          async
          src="https://al5sm.com/tag.min.js"
          data-zone={MONETAG_ZONE}
        />
        {children}
      </body>
    </html>
  );
}
