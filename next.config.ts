import type { NextConfig } from "next";

const IMAGE_HOSTS = [
  "s4.anilist.co",
  "image.tmdb.org",
  "www.themoviedb.org",
  "themoviedb.org",
  "cdn.myanimelist.net",
  "media.kitsu.app",
  "artworks.thetvdb.com",
  "assets.fanart.tv",
  "static.wikia.nocookie.net",
  "cdn.anidb.net",
];

const nextConfig: NextConfig = {
  // The dev server is reached through the Preview tab on the loopback IP, which
  // Next treats as a cross-origin dev request and blocks. Without this the
  // client bundle never hydrates in that tab and scroll-reveal sections stay
  // invisible. Development only; unused in production builds.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  images: {
    remotePatterns: IMAGE_HOSTS.map((hostname) => ({
      protocol: "https",
      hostname,
      port: "",
      pathname: "**",
      search: "",
    })),
  },
};

export default nextConfig;
