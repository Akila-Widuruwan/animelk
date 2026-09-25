"use client";

import { useEffect } from "react";

export default function HashScroll() {
  useEffect(() => {
    const scroll = () => {
      const { hash } = window.location;
      if (!hash) return;
      const el = document.getElementById(hash.slice(1));
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    scroll();
    window.addEventListener("hashchange", scroll);
    return () => window.removeEventListener("hashchange", scroll);
  }, []);
  return null;
}
