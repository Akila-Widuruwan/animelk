"use client";

import { useEffect } from "react";
import { useViewer } from "@/lib/viewer-auth";
import {
  cachedAdFreeFor,
  clearAdFreeCache,
  isAdFreeAddress,
  readAdFreeCache,
  writeAdFreeCache,
} from "@/lib/ad-free";

/**
 * Keeps the cached ad-free answer (see @/lib/ad-free) in step with the
 * signed-in viewer, so the head script can decide before any ad request goes
 * out.
 *
 * The check runs on every page load for a signed-in viewer, but only every
 * AD_FREE_TTL_MS: the cached answer is trusted until it expires.
 */

/** sessionStorage marker so the one-off refresh below can never loop. */
const REFRESHED_KEY = "animelk:ads-off-refreshed";

export default function AdFreeSync() {
  const { viewer, loading } = useViewer();
  const email = viewer?.email ?? null;

  useEffect(() => {
    if (loading) return;

    if (!email) {
      // Signed out: leave nothing behind for whoever uses the browser next.
      clearAdFreeCache();
      return;
    }

    if (cachedAdFreeFor(email)) return;

    const alreadyCached = readAdFreeCache();
    let cancelled = false;

    (async () => {
      let adFree: boolean;
      try {
        adFree = await isAdFreeAddress(email);
      } catch {
        // Table not migrated yet, offline, or the read was refused. Leave any
        // existing cache alone so an ad-free visitor keeps browsing ad-free.
        return;
      }
      if (cancelled) return;

      if (!adFree) {
        // Removed from the list since the cache was written.
        if (alreadyCached) clearAdFreeCache();
        return;
      }

      writeAdFreeCache(email);

      // This page already loaded its ads before the answer arrived, so reload
      // once to drop them - only the first time this browser learns the news.
      let refreshed = false;
      try {
        refreshed = window.sessionStorage.getItem(REFRESHED_KEY) === email;
      } catch {
        // No sessionStorage: reloading on every load would be worse than one
        // page with ads, so skip it.
        refreshed = true;
      }
      if (refreshed) return;
      try {
        window.sessionStorage.setItem(REFRESHED_KEY, email);
      } catch {
        return;
      }
      window.location.reload();
    })();

    return () => {
      cancelled = true;
    };
  }, [email, loading]);

  return null;
}
