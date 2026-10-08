import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/**
 * Monetag ad tags. Each snippet they hand out only builds a loader element
 * (<script data-zone src=".../tag.min.js">), and Next.js keeps inline script
 * markup out of the server HTML, so the loaders are written directly. React
 * hoists them into the document head — the placement Monetag asks for — which
 * installs their click handlers before a visitor can click a poster.
 */
const MONETAG_TAGS = [
  { zone: "11986387", src: "https://al5sm.com/tag.min.js" },
  { zone: "11986434", src: "https://nap5k.com/tag.min.js" },
];

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
        {/* Plain async script tags, which React hoists into the document head. */}
        {MONETAG_TAGS.map(({ zone, src }) => (
          <script
            key={zone}
            id={`monetag-${zone}`}
            async
            src={src}
            data-zone={zone}
          />
        ))}
        {children}
      </body>
    </html>
  );
}
