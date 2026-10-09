"use client";

import { supabaseBrowser } from "./supabase-browser";

/**
 * Ad-free accounts - the addresses that browse this site without the Monetag
 * tag.
 *
 * The list lives in Supabase (`ad_free_emails`), which row-level security keeps
 * private: a signed-in visitor can only read the row matching their own address,
 * and only an admin can see or change the whole list. See
 * supabase/migrations/0013_ad_free_emails.sql.
 *
 * The head script that loads ads runs before React, so it cannot query anything.
 * Instead this module writes a small answer into localStorage whenever a signed
 * in viewer's address is checked, and public/ad-gate.js reads that answer
 * synchronously - which is what lets the tag be stopped rather than hidden.
 */

/** Must match the key public/ad-gate.js reads. */
export const AD_FREE_CACHE_KEY = "animelk:ads-off";

/** How long a cached answer is trusted before the address is checked again. */
export const AD_FREE_TTL_MS = 12 * 60 * 60 * 1000;

export interface AdFreeCache {
  email: string;
  until: number;
}

export interface AdFreeRow {
  email: string;
  note: string;
  created_at: string;
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

/** The cached answer, expired or not - callers decide what to trust. */
export function readAdFreeCache(): AdFreeCache | null {
  try {
    const raw = window.localStorage.getItem(AD_FREE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<AdFreeCache>;
    if (typeof parsed?.email !== "string" || typeof parsed?.until !== "number") {
      return null;
    }
    return { email: parsed.email, until: parsed.until };
  } catch {
    return null;
  }
}

export function writeAdFreeCache(email: string, now = Date.now()): void {
  try {
    const value: AdFreeCache = {
      email: normalizeEmail(email),
      until: now + AD_FREE_TTL_MS,
    };
    window.localStorage.setItem(AD_FREE_CACHE_KEY, JSON.stringify(value));
  } catch {
    // Private mode without storage: the address is simply checked again next load.
  }
}

export function clearAdFreeCache(): void {
  try {
    window.localStorage.removeItem(AD_FREE_CACHE_KEY);
  } catch {
    // nothing to clear
  }
}

/** True when the cached answer covers this address and has not expired. */
export function cachedAdFreeFor(
  email: string | null,
  now = Date.now()
): boolean {
  if (!email) return false;
  const cached = readAdFreeCache();
  if (!cached || cached.until <= now) return false;
  return cached.email === normalizeEmail(email);
}

/**
 * Asks the database whether one address is on the list. RLS means a signed-in
 * visitor can only ever get the row for their own address, so an admin reading
 * this sees their own answer rather than the whole list.
 */
export async function isAdFreeAddress(email: string): Promise<boolean> {
  const { data, error } = await supabaseBrowser()
    .from("ad_free_emails")
    .select("email")
    .eq("email", normalizeEmail(email))
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/* ------------------------------------------------------------------ */
/* Admin list                                                          */
/* ------------------------------------------------------------------ */

/** Every ad-free address, newest first. Admins only; RLS returns nothing else. */
export async function fetchAdFreeAccounts(): Promise<AdFreeRow[]> {
  const { data, error } = await supabaseBrowser()
    .from("ad_free_emails")
    .select("email, note, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as AdFreeRow[] | null) ?? [];
}

export async function addAdFreeAccount(
  email: string,
  note = ""
): Promise<void> {
  const address = normalizeEmail(email);
  const { data } = await supabaseBrowser().auth.getSession();
  const { error } = await supabaseBrowser()
    .from("ad_free_emails")
    .insert({
      email: address,
      note: note.trim(),
      created_by: data.session?.user?.id ?? null,
    });
  if (error) throw new Error(error.message);
}

export async function removeAdFreeAccount(email: string): Promise<void> {
  const { error } = await supabaseBrowser()
    .from("ad_free_emails")
    .delete()
    .eq("email", normalizeEmail(email));
  if (error) throw new Error(error.message);
}
