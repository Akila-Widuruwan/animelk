import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

/**
 * Monetag click-ad tag (zone 11986387). It builds its own loader element and
 * appends it to <body>, so it has to run as the inline snippet rather than
 * through the Script `src` prop. Monetag's script installs the click handler
 * that monetises the poster and thumbnail clicks across the site.
 */
const MONETAG_CLICK_TAG =
  "(function(s){s.dataset.zone='11986387',s.src='https://al5sm.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')))";

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
        {children}
        <Script
          id="monetag-click-tag"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{ __html: MONETAG_CLICK_TAG }}
        />
      </body>
    </html>
  );
}
