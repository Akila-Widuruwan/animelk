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
];

const nextConfig: NextConfig = {
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
