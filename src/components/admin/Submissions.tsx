"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button, Modal, StatusPill, Thumb, inputCls } from "./ui";

interface SubmissionRow {
  id: number;
  title: string;
  romaji: string | null;
  description: string | null;
  cover_image: string | null;
  banner_image: string | null;
  format: string;
  status: string;
  season_year: number | null;
  episodes_count: number;
  submitted_by: string | null;
  moderation_status: "pending" | "approved" | "rejected";
  review_note: string | null;
  created_at: string;
  anime_genres: { genres: { name: string } | null }[];
}

type Filter = "pending" | "approved" | "rejected";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "approved", label: "Approved" },
  { id: "rejected", label: "Rejected" },
];

export default function Submissions() {
  const sb = supabaseBrowser();
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("pending");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState<SubmissionRow | null>(null);
  const [rejectNote, setRejectNote] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await sb
      .from("anime")
      .select(
        "id, title, romaji, description, cover_image, banner_image, format, status, season_year, episodes_count, submitted_by, moderation_status, review_note, created_at, anime_genres(genres(name))"
      )
      .not("submitted_by", "is", null)
      .order("created_at", { ascending: false })
      .limit(300);
    const list = (data as unknown as SubmissionRow[]) ?? [];
    setRows(list);

    const ids = [...new Set(list.map((r) => r.submitted_by).filter(Boolean))] as string[];
    if (ids.length) {
      const { data: profiles } = await sb
        .from("profiles")
        .select("id, username")
        .in("id", ids);
      const map: Record<string, string> = {};
      for (const p of (profiles as { id: string; username: string | null }[] | null) ?? []) {
        map[p.id] = p.username ?? p.id.slice(0, 8);
      }
      setNames(map);
    }
    setLoading(false);
  }, [sb]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const { data } = await sb
        .from("anime")
        .select(
          "id, title, romaji, description, cover_image, banner_image, format, status, season_year, episodes_count, submitted_by, moderation_status, review_note, created_at, anime_genres(genres(name))"
        )
        .not("submitted_by", "is", null)
        .order("created_at", { ascending: false })
        .limit(300);
      if (ignore) return;
      const list = (data as unknown as SubmissionRow[]) ?? [];
      setRows(list);
      setLoading(false);
      const ids = [...new Set(list.map((r) => r.submitted_by).filter(Boolean))] as string[];
      if (!ids.length) return;
      const { data: profiles } = await sb
        .from("profiles")
        .select("id, username")
        .in("id", ids);
      if (ignore) return;
      const map: Record<string, string> = {};
      for (const p of (profiles as { id: string; username: string | null }[] | null) ?? []) {
        map[p.id] = p.username ?? p.id.slice(0, 8);
      }
      setNames(map);
    })();
    return () => {
      ignore = true;
    };
  }, [sb]);

  const placeInSections = async (animeId: number) => {
    for (const secSlug of ["new-series", "new-anime"]) {
      const { data: secData } = await sb
        .from("sections")
        .select("id")
        .eq("slug", secSlug)
        .single();
      if (!secData) continue;
      const sectionId = (secData as { id: number }).id;
      const { data: items } = await sb
        .from("section_items")
        .select("position")
        .eq("section_id", sectionId);
      const positions = ((items ?? []) as { position: number }[]).map((r) => r.position ?? 0);
      const nextPos = positions.length ? Math.min(...positions) - 1 : 1;
      await sb
        .from("section_items")
        .upsert({ section_id: sectionId, anime_id: animeId, position: nextPos });
    }
  };

  const approve = async (row: SubmissionRow) => {
    setBusyId(row.id);
    setError("");
    const { data: user } = await sb.auth.getUser();
    const { error: upErr } = await sb
      .from("anime")
      .update({
        moderation_status: "approved",
        reviewed_by: user.user?.id ?? null,
        reviewed_at: new Date().toISOString(),
        review_note: null,
      })
      .eq("id", row.id);
    if (upErr) {
      setError(upErr.message);
      setBusyId(null);
      return;
    }
    await placeInSections(row.id);
    setBusyId(null);
    await load();
  };

  const reject = async () => {
    if (!rejecting) return;
    setBusyId(rejecting.id);
    setError("");
    const { data: user } = await sb.auth.getUser();
    const { error: upErr } = await sb
      .from("anime")
      .update({
        moderation_status: "rejected",
        reviewed_by: user.user?.id ?? null,
        reviewed_at: new Date().toISOString(),
        review_note: rejectNote.trim() || null,
      })
      .eq("id", rejecting.id);
    setBusyId(null);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    setRejecting(null);
    setRejectNote("");
    await load();
  };

  const filtered = rows.filter((r) => r.moderation_status === filter);
  const pendingCount = rows.filter((r) => r.moderation_status === "pending").length;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-extrabold text-white">Submissions</h2>
        <p className="mt-1 text-[13px] text-muted">
          Staff uploads land here. Approve to publish an anime on the live site;
          reject with a note to send it back.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{error}</p>
      )}

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`rounded-full px-3.5 py-1.5 text-[12px] font-bold transition ${
              filter === f.id ? "bg-primary/25 text-white" : "bg-white/5 text-muted hover:text-white"
            }`}
          >
            {f.label}
            {f.id === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-muted">Loading...</p>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-white/10 bg-panel px-4 py-10 text-center text-sm text-muted">
          Nothing {filter} right now.
        </p>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-4 rounded-xl border border-white/10 bg-panel p-4 md:flex-row"
            >
              <Thumb src={r.cover_image} alt={r.title} className="h-32 w-22 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-bold text-white">{r.title}</h3>
                  <StatusPill ok={r.moderation_status === "approved"} text={r.moderation_status} />
                </div>
                {r.romaji && <p className="text-[12px] text-muted">{r.romaji}</p>}
                <p className="mt-1 text-[12px] text-muted">
                  {r.format} · {r.status}
                  {r.season_year ? ` · ${r.season_year}` : ""} · {r.episodes_count} eps · by{" "}
                  <span className="text-white/80">
                    {r.submitted_by ? names[r.submitted_by] ?? r.submitted_by.slice(0, 8) : "—"}
                  </span>
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  {(r.anime_genres ?? []).map((g) => g.genres?.name).filter(Boolean).join(", ") || "No genres"}
                </p>
                {r.description && (
                  <p className="mt-2 line-clamp-2 text-[12.5px] leading-6 text-body">{r.description}</p>
                )}
                {r.review_note && (
                  <p className="mt-2 text-[12px] text-red-300">Note: {r.review_note}</p>
                )}
              </div>
              <div className="flex shrink-0 flex-row gap-2 md:flex-col md:items-end">
                {r.moderation_status !== "approved" && (
                  <Button
                    className="px-3 py-1.5"
                    disabled={busyId === r.id}
                    onClick={() => approve(r)}
                  >
                    {busyId === r.id ? "Approving…" : "Approve"}
                  </Button>
                )}
                {r.moderation_status !== "rejected" && (
                  <Button
                    variant="danger"
                    className="px-3 py-1.5"
                    disabled={busyId === r.id}
                    onClick={() => {
                      setRejecting(r);
                      setRejectNote("");
                    }}
                  >
                    Reject
                  </Button>
                )}
                <a
                  href={`/anime/${r.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center rounded-lg border border-white/10 px-3 py-1.5 text-[13px] font-bold text-muted transition hover:text-white"
                >
                  Preview
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {rejecting && (
        <Modal title={`Reject — ${rejecting.title}`} onClose={() => setRejecting(null)}>
          <p className="mb-3 text-[13px] leading-6 text-muted">
            Tell the staff member what needs fixing. They will see this note on
            their submission while it is rejected.
          </p>
          <textarea
            rows={4}
            className={inputCls}
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="e.g. Wrong cover image, episodes mismatched..."
          />
          <div className="mt-5 flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="danger" disabled={busyId === rejecting.id} onClick={reject}>
              {busyId === rejecting.id ? "Rejecting…" : "Reject submission"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
