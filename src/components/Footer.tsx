import Link from "next/link";
import { db } from "@/lib/anime";
import {
  IconDownload,
  IconFacebook,
  IconGithub,
  IconPlay,
  IconX,
  IconYoutube,
} from "./Icons";

const EXPLORE = [
  { label: "Home", href: "/#hero" },
  { label: "Anime", href: "/#browse" },
  { label: "Movies", href: "/#anime-movies" },
  { label: "Series", href: "/#new-series" },
  { label: "Genres", href: "/#categories" },
  { label: "Top Airing", href: "/#airing" },
];

const INFORMATION = [
  { label: "About Us", href: "#" },
  { label: "Contact", href: "/#contact" },
  { label: "FAQ", href: "#" },
  { label: "Privacy Policy", href: "#" },
  { label: "Terms of Service", href: "#" },
];

const COMMUNITY = [
  { label: "Discord", href: "#" },
  { label: "Telegram", href: "#" },
  { label: "Facebook", href: "#" },
  { label: "X (Twitter)", href: "#" },
  { label: "YouTube", href: "#" },
];

const SOCIALS = [
  { label: "Facebook", icon: <IconFacebook className="h-4 w-4" /> },
  { label: "X", icon: <IconX className="h-4 w-4" /> },
  { label: "GitHub", icon: <IconGithub className="h-4 w-4" /> },
  { label: "YouTube", icon: <IconYoutube className="h-4 w-4" /> },
];

function Column({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <h6 className="mb-5 text-[13px] font-bold uppercase tracking-wider text-white">
        {title}
      </h6>
      <ul className="space-y-3">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="text-[13.5px] font-medium text-muted transition hover:text-violet-2"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Footer() {
  return (
    <footer id="contact" className="border-t border-white/[0.06] bg-footer">
      <div className="container-site pb-10 pt-12 md:pt-16">
        <div className="grid gap-8 md:grid-cols-2 md:gap-12 xl:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="flex items-center gap-2.5">
              <span className="bg-gradient-btn flex h-9 w-9 items-center justify-center rounded-xl">
                <IconPlay className="h-4 w-4 text-white" />
              </span>
              <span className="text-[20px] font-extrabold tracking-tight text-white">
                ANIME<span className="text-gradient">LK</span>
              </span>
            </Link>
            <p className="mt-5 max-w-sm text-[13.5px] leading-7 text-muted">
              Stream the latest anime series and movies in HD. Your premium
              destination for trending shows, timeless classics and simulcasts —
              all in one cinematic experience.
            </p>

            <h6 className="mb-4 mt-8 text-[13px] font-bold uppercase tracking-wider text-white">
              Connect with us
            </h6>
            <div className="flex gap-2.5">
              {SOCIALS.map((s) => (
                <Link
                  key={s.label}
                  href="#"
                  aria-label={s.label}
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white transition hover:border-primary hover:bg-primary"
                >
                  {s.icon}
                </Link>
              ))}
            </div>

            <h6 className="mb-4 mt-8 text-[13px] font-bold uppercase tracking-wider text-white">
              Download Animelk app
            </h6>
            <div className="flex flex-wrap gap-3">
              <Link
                href="#"
                className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 transition hover:border-primary/60"
              >
                <IconDownload className="h-5 w-5 text-white" />
                <span className="text-left leading-tight">
                  <span className="block text-[9px] font-medium uppercase tracking-wide text-muted">
                    Download on the
                  </span>
                  <span className="block text-[13px] font-bold text-white">App Store</span>
                </span>
              </Link>
              <Link
                href="#"
                className="flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 transition hover:border-primary/60"
              >
                <IconPlay className="h-5 w-5 text-white" />
                <span className="text-left leading-tight">
                  <span className="block text-[9px] font-medium uppercase tracking-wide text-muted">
                    Get it on
                  </span>
                  <span className="block text-[13px] font-bold text-white">Google Play</span>
                </span>
              </Link>
            </div>
          </div>

          <Column title="Explore" links={EXPLORE} />
          <Column title="Information" links={INFORMATION} />

          <div>
            <h6 className="mb-5 text-[13px] font-bold uppercase tracking-wider text-white">
              Popular Now
            </h6>
            <ul className="space-y-3">
              {db.topToday.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/anime/${a.id}`}
                    className="line-clamp-1 text-[13.5px] font-medium text-muted transition hover:text-violet-2"
                  >
                    {a.title}
                  </Link>
                </li>
              ))}
            </ul>

            <h6 className="mb-4 mt-8 text-[13px] font-bold uppercase tracking-wider text-white">
              Community
            </h6>
            <ul className="space-y-3">
              {COMMUNITY.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-[13.5px] font-medium text-muted transition hover:text-violet-2"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-6 md:mt-14 md:flex-row">
          <p className="text-[13px] text-muted">
            Copyright © 2026 ANIMELK. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <Link href="#" className="text-[13px] font-medium text-muted transition hover:text-violet-2">
              Privacy Policy
            </Link>
            <Link href="#" className="text-[13px] font-medium text-muted transition hover:text-violet-2">
              Terms of Service
            </Link>
            <Link href="/admin" className="text-[13px] font-medium text-muted transition hover:text-violet-2">
              Admin
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
