"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { isSupabaseConfigured } from "@/lib/db";
import Login from "@/components/admin/Login";
import AnimeManager from "@/components/admin/AnimeManager";
import SectionsManager from "@/components/admin/SectionsManager";
import HeroManager from "@/components/admin/HeroManager";
import TopicsManager from "@/components/admin/TopicsManager";
import MenuManager from "@/components/admin/MenuManager";
import SettingsManager from "@/components/admin/SettingsManager";
import LibraryImport from "@/components/admin/LibraryImport";
import TmdbBrowser from "@/components/admin/TmdbBrowser";
import { Spinner } from "@/components/admin/ui";

type Tab = "dashboard" | "anime" | "sections" | "hero" | "topics" | "menu" | "settings" | "tmdb";

const TABS: { id: Tab; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "anime", label: "Anime" },
  { id: "sections", label: "Sections" },
  { id: "hero", label: "Hero Slides" },
  { id: "topics", label: "Topics" },
  { id: "menu", label: "Menu" },
  { id: "tmdb", label: "TMDB Images" },
  { id: "settings", label: "Settings" },
];

async function fetchRole(uid: string): Promise<string | null> {
  const { data } = await supabaseBrowser()
    .from("profiles")
    .select("role")
    .eq("id", uid)
    .single();
  return (data as { role: string } | null)?.role ?? null;
}

function Dashboard() {
  const sb = supabaseBrowser();
  const [stats, setStats] = useState<{ label: string; value: string }[] | null>(null);

  useEffect(() => {
    const load = async () => {
      const keys: [string, string][] = [
        ["anime", "Anime"],
        ["episodes", "Episodes"],
        ["sections", "Sections"],
        ["topics", "Topics"],
        ["profiles", "Users"],
      ];
      const values = await Promise.all(
        keys.map(async ([table, label]) => {
          const { count } = await sb
            .from(table)
            .select("id", { count: "exact", head: true });
          return { label, value: count === null ? "—" : String(count) };
        })
      );
      setStats(values);
    };
    load();
  }, [sb]);

  if (!stats) return <Spinner />;
  return (
    <div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-white/10 bg-panel p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">{s.label}</p>
            <p className="mt-2 text-3xl font-extrabold text-white">{s.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-xl border border-white/10 bg-panel p-6 text-[13px] leading-7 text-body">
        <h3 className="mb-2 text-[15px] font-bold text-white">Quick guide</h3>
        <p>
          • <b className="text-white">Anime</b> — add/edit/delete anime, link genres, manage episodes and video URLs.
        </p>
        <p>
          • <b className="text-white">Sections</b> — control every homepage row: which anime appear, their order, layout kind.
        </p>
        <p>
          • <b className="text-white">Hero Slides</b> — pick and order the homepage hero slider.
        </p>
        <p>
          • <b className="text-white">Topics / Menu / Settings</b> — category tiles, navbar links, and site-wide config.
        </p>
        <p className="mt-3 text-muted">
          Changes go live instantly on the public site (RLS allows admins to write, everyone can read).
        </p>
      </div>
      <LibraryImport />
    </div>
  );
}

function SetupNotice() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-ink p-4">
      <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-panel p-8">
        <h1 className="text-xl font-extrabold text-white">
          ANIME<span className="text-gradient">LK</span> Admin
        </h1>
        <p className="mt-3 text-[14px] leading-7 text-body">
          Supabase is not configured yet. To activate the admin dashboard:
        </p>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-[13px] leading-6 text-body">
          <li>Create a project at supabase.com</li>
          <li>
            Run <code className="rounded bg-ink px-1.5 py-0.5 text-white">supabase/migrations/0001_init.sql</code> in the SQL editor
          </li>
          <li>
            Run <code className="rounded bg-ink px-1.5 py-0.5 text-white">npm run db:seed</code> then execute{" "}
            <code className="rounded bg-ink px-1.5 py-0.5 text-white">supabase/seed.sql</code>
          </li>
          <li>
            Copy <code className="rounded bg-ink px-1.5 py-0.5 text-white">.env.example</code> to{" "}
            <code className="rounded bg-ink px-1.5 py-0.5 text-white">.env.local</code> and fill in URL + anon key
          </li>
          <li>
            Restart <code className="rounded bg-ink px-1.5 py-0.5 text-white">npm run dev</code>
          </li>
        </ol>
        <p className="mt-4 text-[13px] text-muted">
          Full instructions in <code className="text-white">SUPABASE_SETUP.md</code>.
        </p>
      </div>
    </div>
  );
}

export default function AdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(isSupabaseConfigured);
  const [tab, setTab] = useState<Tab>("dashboard");

  const refreshSession = useCallback(async (uid: string) => {
    const r = await fetchRole(uid);
    setRole(r);
    setChecking(false);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const sb = supabaseBrowser();
    let mounted = true;

    sb.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) {
        fetchRole(data.session.user.id).then((r) => {
          if (mounted) {
            setRole(r);
            setChecking(false);
          }
        });
      } else {
        setChecking(false);
      }
    });

    const { data: sub } = sb.auth.onAuthStateChange((_event, s) => {
      if (!mounted) return;
      setSession(s);
      if (s) refreshSession(s.user.id);
      else {
        setRole(null);
        setChecking(false);
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [refreshSession]);

  if (!isSupabaseConfigured) return <SetupNotice />;
  if (checking) return <Spinner />;
  if (!session) return <Login onLoggedIn={() => window.location.reload()} />;

  if (role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink p-4">
        <div className="w-full max-w-sm rounded-2xl border border-white/10 bg-panel p-8 text-center">
          <h1 className="text-lg font-bold text-white">Access denied</h1>
          <p className="mt-2 text-[13px] leading-6 text-muted">
            Your account is not an admin. Run this SQL to grant access:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-ink p-3 text-left text-[11px] text-white/80">
{`update public.profiles
set role = 'admin'
where id = '${session.user.id}';`}
          </pre>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink">
      <header className="sticky top-0 z-40 border-b border-white/5 bg-panel">
        <div className="mx-auto flex h-16 w-full max-w-[1400px] items-center justify-between px-4">
          <span className="text-lg font-extrabold text-white">
            ANIME<span className="text-gradient">LK</span>{" "}
            <span className="ml-2 rounded bg-primary/20 px-2 py-0.5 text-[11px] font-bold text-white">
              Admin
            </span>
          </span>
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="text-[13px] font-semibold text-muted transition hover:text-white"
            >
              View site
            </Link>
            <button
              onClick={() => supabaseBrowser().auth.signOut()}
              className="rounded-lg border border-white/10 px-3.5 py-2 text-[13px] font-bold text-white transition hover:border-primary/60"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1400px] gap-6 px-4 py-6">
        <nav className="w-48 shrink-0">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`mb-1 block w-full rounded-lg px-3 py-2.5 text-left text-[13px] font-bold transition ${
                tab === t.id
                  ? "bg-gradient-btn text-white"
                  : "text-muted hover:bg-white/5 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <main className="min-w-0 flex-1 pb-16">
          {tab === "dashboard" && <Dashboard />}
          {tab === "anime" && <AnimeManager />}
          {tab === "sections" && <SectionsManager />}
          {tab === "hero" && <HeroManager />}
          {tab === "topics" && <TopicsManager />}
          {tab === "menu" && <MenuManager />}
          {tab === "tmdb" && <TmdbBrowser />}
          {tab === "settings" && <SettingsManager />}
        </main>
      </div>
    </div>
  );
}
