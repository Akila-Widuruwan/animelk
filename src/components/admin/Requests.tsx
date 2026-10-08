"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button, Field, Modal, Spinner, Thumb, inputCls } from "./ui";
import RequestStatusBadge from "@/components/request/RequestStatusBadge";
import {
  REQUEST_FIELDS,
  REQUEST_STATUS_ORDER,
  REQUEST_TYPE_LABELS,
  REQUEST_STATUS_META,
  formatCount,
  formatDate,
  isMissingSchema,
  relativeDate,
  type AnimeRequest,
  type RequestStatus,
  type RequestType,
} from "@/lib/requests";

interface SupportRow {
  id: number;
  message: string | null;
  created_at: string;
  supporter_key: string;
}

interface Stats {
  totalSupports: number;
  titles: number;
  today: number;
  week: number;
  month: number;
  byStatus: Record<RequestStatus, number>;
  daily: { date: string; label: string; count: number }[];
  top: AnimeRequest[];
}

const GROWTH_DAYS = 14;

/**
 * Count-only queries for the two request tables. Kept as separate factory
 * functions (rather than one helper over a table union) so each chain keeps its
 * own PostgREST types.
 */
function makeCountQueries(sb: ReturnType<typeof supabaseBrowser>) {
  return {
    requests: () =>
      sb.from("anime_requests").select("id", { count: "exact", head: true }),
    supports: () =>
      sb.from("anime_request_supports").select("id", { count: "exact", head: true }),
  };
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export default function Requests() {
  const sb = supabaseBrowser();
  const [rows, setRows] = useState<AnimeRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);

  const [status, setStatus] = useState<RequestStatus | "ALL">("ALL");
  const [search, setSearch] = useState("");

  const [detail, setDetail] = useState<AnimeRequest | null>(null);
  const [supports, setSupports] = useState<SupportRow[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AnimeRequest | null>(null);
  const [busy, setBusy] = useState(false);

  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Exact count of rows, for the dashboard cards. */
  const count = useCallback(
    async (promise: PromiseLike<{ count: number | null; error: unknown }>) => {
      const { count: value, error: err } = await promise;
      if (err) throw err;
      return value ?? 0;
    },
    []
  );

  const loadStats = useCallback(async () => {
    const today = startOfToday().toISOString();
    const week = new Date(Date.now() - 7 * 864e5).toISOString();
    const month = new Date(Date.now() - 30 * 864e5).toISOString();

    const { requests, supports } = makeCountQueries(sb);

    const [totalSupports, titles, todayCount, weekCount, monthCount] =
      await Promise.all([
        count(supports()),
        count(requests()),
        count(supports().gte("created_at", today)),
        count(supports().gte("created_at", week)),
        count(supports().gte("created_at", month)),
      ]);

    const statusCounts = await Promise.all(
      REQUEST_STATUS_ORDER.map((s) => count(requests().eq("status", s)))
    );
    const byStatus = Object.fromEntries(
      REQUEST_STATUS_ORDER.map((s, i) => [s, statusCounts[i]])
    ) as Record<RequestStatus, number>;

    // Growth: real support activity, bucketed per day.
    const since = new Date(Date.now() - (GROWTH_DAYS - 1) * 864e5);
    since.setHours(0, 0, 0, 0);
    const { data: supportDays } = await sb
      .from("anime_request_supports")
      .select("created_at")
      .gte("created_at", since.toISOString())
      .limit(3000);

    const buckets = new Map<string, number>();
    for (const s of (supportDays as { created_at: string }[] | null) ?? []) {
      const key = dayKey(new Date(s.created_at));
      buckets.set(key, (buckets.get(key) ?? 0) + 1);
    }
    const daily: Stats["daily"] = [];
    for (let i = GROWTH_DAYS - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      daily.push({
        date: dayKey(d),
        label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        count: buckets.get(dayKey(d)) ?? 0,
      });
    }

    const { data: top } = await sb
      .from("anime_requests")
      .select(REQUEST_FIELDS)
      .order("request_count", { ascending: false })
      .limit(5);

    setStats({
      totalSupports,
      titles,
      today: todayCount,
      week: weekCount,
      month: monthCount,
      byStatus,
      daily,
      top: (top as unknown as AnimeRequest[]) ?? [],
    });
  }, [sb, count]);

  const loadRows = useCallback(async () => {
    let query = sb
      .from("anime_requests")
      .select(REQUEST_FIELDS)
      .order("last_requested_at", { ascending: false })
      .limit(300);
    if (status !== "ALL") query = query.eq("status", status);
    if (search.trim()) query = query.ilike("anime_title", `%${search.trim()}%`);
    const { data, error: err } = await query;
    if (err) throw err;
    setRows((data as unknown as AnimeRequest[]) ?? []);
  }, [sb, status, search]);

  const loadAll = useCallback(async () => {
    setError("");
    try {
      await Promise.all([loadRows(), loadStats()]);
      setMissing(false);
    } catch (e) {
      if (isMissingSchema(e)) {
        setMissing(true);
        setRows([]);
      } else {
        setError(
          e instanceof Error && e.message
            ? "We couldn't load requests. Please try again."
            : "We couldn't load requests. Please try again."
        );
      }
    } finally {
      setLoading(false);
    }
  }, [loadRows, loadStats]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await loadAll();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, search]);

  // Realtime: new requests/supports keep the dashboard honest.
  useEffect(() => {
    if (missing) return;
    const channel = supabaseBrowser()
      .channel("animelk-admin-requests")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "anime_requests" },
        () => {
          if (reloadTimer.current) clearTimeout(reloadTimer.current);
          reloadTimer.current = setTimeout(() => void loadAll(), 1000);
        }
      )
      .subscribe();
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      supabaseBrowser().removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing]);

  const openDetail = async (row: AnimeRequest) => {
    setDetail(row);
    setSupports(null);
    const { data } = await supabaseBrowser()
      .from("anime_request_supports")
      .select("id, message, created_at, supporter_key")
      .eq("request_id", row.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setSupports((data as unknown as SupportRow[]) ?? []);
  };

  const updateStatus = async (row: AnimeRequest, next: RequestStatus) => {
    setBusy(true);
    const { error: err } = await supabaseBrowser()
      .from("anime_requests")
      .update({ status: next, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    setBusy(false);
    if (err) {
      setError("Could not update the status. Please try again.");
      return;
    }
    setDetail((d) => (d && d.id === row.id ? { ...d, status: next } : d));
    await loadAll();
  };

  const linkAnime = async (row: AnimeRequest, animeId: number) => {
    setBusy(true);
    const { error: err } = await supabaseBrowser()
      .from("anime_requests")
      .update({
        status: "ADDED",
        added_anime_id: animeId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    setBusy(false);
    if (err) {
      setError("Could not link that anime. Please try again.");
      return;
    }
    setDetail((d) =>
      d && d.id === row.id ? { ...d, status: "ADDED", added_anime_id: animeId } : d
    );
    await loadAll();
  };

  const removeRow = async (row: AnimeRequest) => {
    setBusy(true);
    const { error: err } = await supabaseBrowser()
      .from("anime_requests")
      .delete()
      .eq("id", row.id);
    setBusy(false);
    setConfirmDelete(null);
    if (err) {
      setError("Could not delete that request. Please try again.");
      return;
    }
    if (detail?.id === row.id) setDetail(null);
    await loadAll();
  };

  if (loading) return <Spinner />;

  if (missing) {
    return (
      <div className="rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-6">
        <h3 className="text-[15px] font-bold text-white">Request database not set up</h3>
        <p className="mt-2 text-[13px] leading-7 text-body">
          Run{" "}
          <code className="rounded bg-ink px-1.5 py-0.5 text-white">
            supabase/migrations/0009_anime_requests.sql
          </code>{" "}
          in the Supabase SQL editor. It creates the request tables, the RPCs that
          count votes and the realtime publication.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {stats && (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            <StatCard label="Total Requests" value={formatCount(stats.totalSupports)} accent />
            <StatCard label="Requests Today" value={formatCount(stats.today)} />
            <StatCard label="This Week" value={formatCount(stats.week)} />
            <StatCard label="This Month" value={formatCount(stats.month)} />
            <StatCard label="Titles Requested" value={formatCount(stats.titles)} />
          </div>

          <div className="flex flex-wrap gap-2">
            {REQUEST_STATUS_ORDER.map((s) => (
              <span
                key={s}
                className={`inline-flex items-center gap-2 rounded-lg border border-white/10 bg-panel px-3 py-2 text-[12px] font-bold text-white`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${REQUEST_STATUS_META[s].dot}`} />
                {REQUEST_STATUS_META[s].label}
                <span className="text-muted">{formatCount(stats.byStatus[s] ?? 0)}</span>
              </span>
            ))}
          </div>

          <GrowthChart daily={stats.daily} />

          {stats.top.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-panel p-5">
              <h3 className="text-[14px] font-bold text-white">Top Requested Anime</h3>
              <div className="mt-4 space-y-2.5">
                {stats.top.map((r, i) => {
                  const max = stats.top[0].request_count || 1;
                  return (
                    <div key={r.id} className="flex items-center gap-3">
                      <span className="w-4 shrink-0 text-[12px] font-bold text-muted">
                        {i + 1}
                      </span>
                      <Thumb src={r.anime_cover} alt={r.anime_title} className="h-11 w-8" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12.5px] font-bold text-white">
                          {r.anime_title}
                          {r.season > 0 ? ` – Season ${r.season}` : ""}
                        </p>
                        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                          <div
                            className="bg-gradient-btn h-full rounded-full"
                            style={{
                              width: `${Math.max(6, (r.request_count / max) * 100)}%`,
                            }}
                          />
                        </div>
                      </div>
                      <span className="shrink-0 text-[12px] font-bold text-amber-300">
                        {formatCount(r.request_count)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}

      <div className="rounded-xl border border-white/10 bg-panel">
        <div className="flex flex-col gap-3 border-b border-white/[0.06] p-4 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-[14px] font-bold text-white">
            Requests <span className="text-muted">({formatCount(rows.length)})</span>
          </h3>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as RequestStatus | "ALL")}
              className={`${inputCls} sm:w-44`}
              aria-label="Filter by status"
            >
              <option value="ALL">All statuses</option>
              {REQUEST_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {REQUEST_STATUS_META[s].label}
                </option>
              ))}
            </select>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search title…"
              className={`${inputCls} sm:w-56`}
              aria-label="Search requests"
            />
          </div>
        </div>

        {error && (
          <p className="border-b border-white/[0.06] bg-red-500/10 px-4 py-2.5 text-[12.5px] text-red-300">
            {error}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead>
              <tr className="border-b border-white/[0.06] text-[11px] font-bold uppercase tracking-wide text-muted">
                <th className="px-4 py-3">Poster</th>
                <th className="px-4 py-3">Anime</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Requests</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">First Requested</th>
                <th className="px-4 py-3">Last Requested</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-[13px] text-muted">
                    No requests yet. Be the first person to request an anime.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-white/[0.04] last:border-0">
                  <td className="px-4 py-3">
                    <Thumb src={r.anime_cover} alt={r.anime_title} />
                  </td>
                  <td className="max-w-[240px] px-4 py-3">
                    <p className="truncate text-[13px] font-bold text-white">
                      {r.anime_title}
                    </p>
                    <p className="truncate text-[11.5px] text-muted">
                      {[
                        r.anime_year ? String(r.anime_year) : null,
                        r.season > 0 ? `Season ${r.season}` : null,
                        `AniList #${r.external_id}`,
                      ]
                        .filter(Boolean)
                        .join(" • ")}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-[12.5px] text-white/80">
                    {REQUEST_TYPE_LABELS[r.request_type as RequestType] ?? r.request_type}
                  </td>
                  <td className="px-4 py-3 text-[13px] font-bold text-amber-300">
                    {formatCount(r.request_count)}
                  </td>
                  <td className="px-4 py-3">
                    <RequestStatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-[12px] text-muted">
                    {formatDate(r.first_requested_at)}
                  </td>
                  <td className="px-4 py-3 text-[12px] text-muted">
                    {relativeDate(r.last_requested_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" onClick={() => void openDetail(r)}>
                        Details
                      </Button>
                      <Button variant="danger" onClick={() => setConfirmDelete(r)}>
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {detail && (
        <DetailModal
          row={detail}
          supports={supports}
          busy={busy}
          onClose={() => {
            setDetail(null);
            setSupports(null);
          }}
          onStatus={(s) => void updateStatus(detail, s)}
          onLink={(id) => void linkAnime(detail, id)}
          onDelete={() => setConfirmDelete(detail)}
        />
      )}

      {confirmDelete && (
        <Modal
          title="Delete this request?"
          onClose={() => setConfirmDelete(null)}
        >
          <p className="text-[13px] leading-7 text-body">
            <b className="text-white">{confirmDelete.anime_title}</b> and all{" "}
            {formatCount(confirmDelete.request_count)} supports will be removed. This
            cannot be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => void removeRow(confirmDelete)}
            >
              {busy ? "Deleting…" : "Delete request"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent ? "border-primary/30 bg-primary/[0.08]" : "border-white/10 bg-panel"
      }`}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-1.5 text-[26px] font-extrabold leading-none text-white">{value}</p>
    </div>
  );
}

function GrowthChart({ daily }: { daily: { label: string; count: number }[] }) {
  const max = Math.max(1, ...daily.map((d) => d.count));
  const total = daily.reduce((sum, d) => sum + d.count, 0);
  return (
    <div className="rounded-xl border border-white/10 bg-panel p-5">
      <div className="flex items-end justify-between">
        <h3 className="text-[14px] font-bold text-white">Anime Request Growth</h3>
        <span className="text-[12px] text-muted">
          {formatCount(total)} in the last {GROWTH_DAYS} days
        </span>
      </div>
      <div className="mt-5 flex h-32 items-end gap-1.5">
        {daily.map((d) => (
          <div key={d.label} className="group flex flex-1 flex-col items-center gap-1.5">
            <span className="text-[10px] font-bold text-muted opacity-0 transition group-hover:opacity-100">
              {d.count}
            </span>
            <div
              className="bg-gradient-btn w-full rounded-t transition-all duration-300"
              style={{ height: `${Math.max(3, (d.count / max) * 100)}%` }}
              title={`${d.label}: ${d.count}`}
            />
            <span className="hidden text-[9.5px] text-muted sm:block">
              {d.label.split(" ")[1]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DetailModal({
  row,
  supports,
  busy,
  onClose,
  onStatus,
  onLink,
  onDelete,
}: {
  row: AnimeRequest;
  supports: SupportRow[] | null;
  busy: boolean;
  onClose: () => void;
  onStatus: (status: RequestStatus) => void;
  onLink: (animeId: number) => void;
  onDelete: () => void;
}) {
  const [linkQuery, setLinkQuery] = useState("");
  const [linkResults, setLinkResults] = useState<
    { id: number; title: string; cover_image: string | null }[]
  >([]);

  useEffect(() => {
    const q = linkQuery.trim();
    const t = setTimeout(async () => {
      if (q.length < 2) {
        setLinkResults([]);
        return;
      }
      const { data } = await supabaseBrowser()
        .from("anime")
        .select("id, title, cover_image")
        .ilike("title", `%${q}%`)
        .limit(6);
      setLinkResults(
        (data as { id: number; title: string; cover_image: string | null }[]) ?? []
      );
    }, 300);
    return () => clearTimeout(t);
  }, [linkQuery]);

  const messages = useMemo(
    () => (supports ?? []).filter((s) => s.message && s.message.trim().length > 0),
    [supports]
  );

  return (
    <Modal title="Request details" onClose={onClose} wide>
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="relative mx-auto h-56 w-40 shrink-0 overflow-hidden rounded-xl bg-panel-2 ring-1 ring-white/[0.06] sm:mx-0">
          {row.anime_cover ? (
            <Image
              src={row.anime_cover}
              alt={row.anime_title}
              fill
              sizes="160px"
              className="object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-[11px] text-muted">
              No image
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="text-[17px] font-extrabold text-white">
            {row.anime_title}
            {row.season > 0 ? ` – Season ${row.season}` : ""}
          </h4>
          {row.anime_title_native && (
            <p className="mt-0.5 text-[12.5px] text-muted">{row.anime_title_native}</p>
          )}
          <p className="mt-1 text-[12.5px] text-white/70">
            {[
              row.anime_year ? String(row.anime_year) : null,
              row.anime_format ?? null,
              row.anime_format && row.anime_episodes
                ? `${row.anime_episodes} Episodes`
                : null,
            ]
              .filter(Boolean)
              .join(" • ")}
          </p>

          <p className="mt-3 text-[22px] font-extrabold leading-none text-amber-300">
            {formatCount(row.request_count)}{" "}
            <span className="text-[13px] font-bold text-muted">Requests</span>
          </p>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-[12px]">
            <div>
              <dt className="text-muted">Anime ID</dt>
              <dd className="font-semibold text-white">
                {row.source} #{row.external_id}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Request type</dt>
              <dd className="font-semibold text-white">
                {REQUEST_TYPE_LABELS[row.request_type as RequestType] ?? row.request_type}
              </dd>
            </div>
            <div>
              <dt className="text-muted">First requested</dt>
              <dd className="font-semibold text-white">{formatDate(row.first_requested_at)}</dd>
            </div>
            <div>
              <dt className="text-muted">Last requested</dt>
              <dd className="font-semibold text-white">{formatDate(row.last_requested_at)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="mt-6 space-y-4">
        <Field label="Status">
          <select
            value={row.status}
            disabled={busy}
            onChange={(e) => onStatus(e.target.value as RequestStatus)}
            className={inputCls}
          >
            {REQUEST_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>
                {REQUEST_STATUS_META[s].label}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" disabled={busy} onClick={() => onStatus("PLANNED")}>
            Mark as planned
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => onStatus("UNDER_REVIEW")}>
            Mark under review
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => onStatus("ADDED")}>
            Mark as added
          </Button>
          <Button variant="ghost" disabled={busy} onClick={() => onStatus("REJECTED")}>
            Reject request
          </Button>
        </div>

        {row.status === "ADDED" &&
          (row.added_anime_id ? (
            <div className="flex items-center gap-3 rounded-lg border border-emerald-400/25 bg-emerald-500/[0.08] px-3.5 py-3">
              <RequestStatusBadge status="ADDED" />
              <span className="text-[12.5px] font-semibold text-emerald-200">
                Available now
              </span>
              <a
                href={`/anime/${row.added_anime_id}`}
                target="_blank"
                rel="noreferrer"
                className="ml-auto text-[12.5px] font-bold text-violet-2 hover:underline"
              >
                Watch Now →
              </a>
            </div>
          ) : (
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3.5">
              <p className="text-[12.5px] font-bold text-white">
                Link this request to a title on the site
              </p>
              <p className="mt-1 text-[11.5px] text-muted">
                The public page will then offer a “Watch Now” button.
              </p>
              <input
                value={linkQuery}
                onChange={(e) => setLinkQuery(e.target.value)}
                placeholder="Search your catalogue…"
                className={`${inputCls} mt-2.5`}
              />
              {linkResults.length > 0 && (
                <div className="mt-2 space-y-1">
                  {linkResults.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => onLink(a.id)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/5"
                    >
                      <Thumb src={a.cover_image} alt={a.title} className="h-10 w-7" />
                      <span className="truncate text-[12.5px] font-semibold text-white">
                        {a.title}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

        <div>
          <h5 className="text-[12px] font-bold uppercase tracking-wide text-muted">
            User messages
          </h5>
          {supports === null ? (
            <p className="mt-2 text-[12.5px] text-muted">Loading…</p>
          ) : messages.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-muted">
              No messages were left with these requests.
            </p>
          ) : (
            <ul className="mt-2 space-y-1.5">
              {messages.slice(0, 20).map((m) => (
                <li
                  key={m.id}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2"
                >
                  <p className="text-[12.5px] text-white/90">“{m.message}”</p>
                  <p className="mt-0.5 text-[10.5px] text-muted">
                    {relativeDate(m.created_at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h5 className="text-[12px] font-bold uppercase tracking-wide text-muted">
            Request history ({supports?.length ?? 0})
          </h5>
          {supports && supports.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-1.5">
              {supports.slice(0, 40).map((s) => (
                <li
                  key={s.id}
                  className="rounded bg-white/[0.05] px-2 py-0.5 text-[10.5px] text-muted"
                >
                  {new Date(s.created_at).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end border-t border-white/[0.06] pt-4">
          <Button variant="danger" onClick={onDelete}>
            Delete request
          </Button>
        </div>
      </div>
    </Modal>
  );
}
