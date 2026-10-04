"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { isSupabaseConfigured } from "@/lib/db";
import Login from "@/components/admin/Login";
import StaffSubmissions from "@/components/staff/StaffSubmissions";
import TmdbBrowser from "@/components/admin/TmdbBrowser";
import CheckUrls from "@/components/admin/CheckUrls";
import AiringSchedule from "@/components/admin/AiringSchedule";
import { Spinner } from "@/components/admin/ui";

type Tab = "submissions" | "tmdb" | "check" | "airing";

const TABS: { id: Tab; label: string }[] = [
  { id: "submissions", label: "My Submissions" },
  { id: "tmdb", label: "TMDB Images" },
  { id: "check", label: "Check URLs" },
  { id: "airing", label: "Release Dates" },
];

async function fetchRole(uid: string): Promise<string | null> {
  const { data } = await supabaseBrowser()
    .from("profiles")
    .select("role")
    .eq("id", uid)
    .single();
  return (data as { role: string } | null)?.role ?? null;
}

export default function StaffPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [checking, setChecking] = useState(isSupabaseConfigured);
  const [tab, setTab] = useState<Tab>("submissions");

  const refreshSession = useCallback(async (uid: string) => {
    setRole(await fetchRole(uid));
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

  if (!isSupabaseConfigured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink p-4">
        <div className="w-full max-w-xl rounded-2xl border border-white/10 bg-panel p-8">
          <h1 className="text-xl font-extrabold text-white">
            ANIME<span className="text-gradient">LK</span> Staff
          </h1>
          <p className="mt-3 text-[14px] leading-7 text-body">
            Supabase is not configured yet. Follow{" "}
            <code className="text-white">SUPABASE_SETUP.md</code>, then run{" "}
            <code className="text-white">supabase/migrations/0005_staff.sql</code> to
            enable staff submissions.
          </p>
        </div>
      </div>
    );
  }

  if (checking) return <Spinner />;
  if (!session) {
    return (
      <Login
        heading="Staff"
        subtitle="Sign in with your staff account"
        footer="A staff account is created in Supabase Auth, then granted the role with: update public.profiles set role = 'staff' where id = '<uuid>';"
        onLoggedIn={() => window.location.reload()}
      />
    );
  }

  if (role !== "staff" && role !== "admin") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink p-4">
        <div className="w-full max-w-md rounded-2xl border border-white/10 bg-panel p-8 text-center">
          <h1 className="text-lg font-bold text-white">Access denied</h1>
          <p className="mt-2 text-[13px] leading-6 text-muted">
            This account is not staff. Ask the owner to grant access with:
          </p>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-ink p-3 text-left text-[11px] text-white/80">
{`update public.profiles
set role = 'staff'
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
              Staff
            </span>
          </span>
          <div className="flex items-center gap-3">
            <Link href="/" className="text-[13px] font-semibold text-muted transition hover:text-white">
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
          {tab === "submissions" && <StaffSubmissions />}
          {tab === "tmdb" && <TmdbBrowser />}
          {tab === "check" && <CheckUrls />}
          {tab === "airing" && <AiringSchedule />}
        </main>
      </div>
    </div>
  );
}
