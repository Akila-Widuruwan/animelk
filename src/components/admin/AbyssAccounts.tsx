"use client";

import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { testAbyssAccounts } from "@/lib/abyss-sub";
import { isMissingSchema } from "@/lib/requests";
import { Button, Field, inputCls } from "./ui";

/**
 * Abyss account pool for subtitle uploads.
 *
 * The table behind this panel is closed to the browser (RLS, no grants), so the
 * list comes from an admin-only SQL function that never returns passwords. The
 * password field is therefore write-only: blank means "keep the stored one".
 *
 * Uploads pick the least recently used active account and fail over to the next
 * one automatically, which is why each row shows when it was last used and last
 * worked.
 */

interface AccountRow {
  id: number;
  label: string;
  username: string;
  is_active: boolean;
  last_used_at: string | null;
  last_ok_at: string | null;
  last_error: string | null;
  failure_count: number;
  created_at: string;
}

type Health = { ok: boolean; error: string | null };

function when(iso: string | null): string {
  if (!iso) return "never";
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "never";
  const mins = Math.round((Date.now() - time) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function AbyssAccounts() {
  const sb = supabaseBrowser();
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [health, setHealth] = useState<Record<string, Health>>({});
  const [missingSchema, setMissingSchema] = useState(false);

  /** Migration 0010 may not have been run yet - say so instead of a raw SQL error. */
  const reportError = (message: string) => {
    if (isMissingSchema(message)) {
      setMissingSchema(true);
      setError("");
      return;
    }
    setError(message);
  };

  const [editingId, setEditingId] = useState<number | null>(null);
  const [label, setLabel] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  /** Read the list. Split out so the effect never sets state synchronously. */
  const fetchAccounts = useCallback(async () => {
    const { data, error: loadErr } = await sb.rpc("abyss_accounts_list");
    return {
      rows: (data as AccountRow[]) ?? [],
      error: loadErr?.message ?? "",
    };
  }, [sb]);

  const refresh = useCallback(async () => {
    const res = await fetchAccounts();
    if (res.error) {
      if (isMissingSchema(res.error)) setMissingSchema(true);
      else setError(res.error);
      return;
    }
    setRows(res.rows);
    setError("");
  }, [fetchAccounts]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await fetchAccounts();
      if (ignore) return;
      if (res.error) {
        if (isMissingSchema(res.error)) setMissingSchema(true);
        else setError(res.error);
      } else {
        setRows(res.rows);
        setError("");
      }
      setLoading(false);
    })();
    return () => {
      ignore = true;
    };
  }, [fetchAccounts]);

  const resetForm = () => {
    setEditingId(null);
    setLabel("");
    setUsername("");
    setPassword("");
  };

  const startEdit = (row: AccountRow) => {
    setEditingId(row.id);
    setLabel(row.label);
    setUsername(row.username);
    setPassword("");
    setError("");
    setNotice("");
  };

  const save = async () => {
    setBusy("save");
    setError("");
    setNotice("");
    const { error: saveErr } = await sb.rpc("abyss_account_save", {
      p_id: editingId,
      p_label: label,
      p_username: username,
      p_password: password,
    });
    setBusy(null);
    if (saveErr) {
      reportError(saveErr.message);
      return;
    }
    setNotice(editingId === null ? "Account added." : "Account updated.");
    resetForm();
    await refresh();
  };

  const toggleActive = async (row: AccountRow) => {
    setBusy(`toggle-${row.id}`);
    setError("");
    const { error: toggleErr } = await sb.rpc("abyss_account_set_active", {
      p_id: row.id,
      p_active: !row.is_active,
    });
    setBusy(null);
    if (toggleErr) {
      reportError(toggleErr.message);
      return;
    }
    await refresh();
  };

  const remove = async (row: AccountRow) => {
    const name = row.label || row.username;
    if (!window.confirm(`Remove the abyss account “${name}”? Subtitle uploads will use the other accounts.`)) {
      return;
    }
    setBusy(`delete-${row.id}`);
    setError("");
    const { error: delErr } = await sb.rpc("abyss_account_delete", { p_id: row.id });
    setBusy(null);
    if (delErr) {
      reportError(delErr.message);
      return;
    }
    setNotice(`Removed ${name}.`);
    if (editingId === row.id) resetForm();
    await refresh();
  };

  const test = async (id: number | null) => {
    setBusy(id === null ? "test-all" : `test-${id}`);
    setError("");
    setNotice("");
    const res = await testAbyssAccounts(id);
    setBusy(null);

    if ("error" in res) {
      reportError(res.error);
      return;
    }

    const map: Record<string, Health> = {};
    for (const item of res.results) {
      map[item.id === null ? "env" : String(item.id)] = { ok: item.ok, error: item.error };
    }
    setHealth(map);

    const bad = res.results.filter((r) => !r.ok).length;
    setNotice(
      res.results.length === 0
        ? "No accounts to test yet."
        : bad === 0
          ? `All ${res.results.length} account${res.results.length === 1 ? "" : "s"} signed in successfully.`
          : `${bad} of ${res.results.length} account${res.results.length === 1 ? "" : "s"} could not sign in.`
    );
    await refresh();
  };

  const healthDot = (key: string) => {
    const h = health[key];
    if (!h) return null;
    return (
      <span
        className={`ml-2 rounded px-1.5 py-0.5 text-[10.5px] font-bold ${
          h.ok
            ? "bg-emerald-500/15 text-emerald-300"
            : "bg-red-500/15 text-red-300"
        }`}
      >
        {h.ok ? "✓ sign-in ok" : "✗ sign-in failed"}
      </span>
    );
  };

  return (
    <div className="mb-6 rounded-xl border border-white/10 bg-panel p-5">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-bold text-white">Abyss Accounts</h3>
        <Button onClick={() => test(null)} disabled={busy !== null || rows.length === 0}>
          {busy === "test-all" ? "Testing…" : "Test all"}
        </Button>
      </div>

      <p className="mb-4 text-[12px] leading-5 text-muted">
        Subtitle uploads rotate through these accounts — the one used longest ago goes first, and if it
        cannot sign in or the upload is rejected, the next account is tried automatically. Add every
        abyss.to account you want to share the load. Passwords are stored so the upload function can sign
        in with them; they are kept out of reach of the browser and are never shown here again.
      </p>

      {missingSchema ? (
        <div className="mb-4 rounded-lg border border-amber-400/30 bg-amber-400/5 p-4">
          <h4 className="mb-1 text-[13px] font-bold text-white">
            Account management needs a database update
          </h4>
          <p className="text-[12px] leading-5 text-muted">
            Run{" "}
            <code className="rounded bg-ink px-1.5 py-0.5 text-white">
              supabase/migrations/0010_abyss_accounts.sql
            </code>{" "}
            in the Supabase SQL editor to create the abyss accounts table, then reload this page.
            Subtitle uploads keep using the ABYSS_EMAIL secret until then.
          </p>
        </div>
      ) : loading ? (
        <p className="text-[13px] text-muted">Loading accounts…</p>
      ) : rows.length === 0 ? (
        <p className="mb-4 rounded-lg border border-white/10 bg-ink px-4 py-3 text-[12.5px] leading-5 text-muted">
          No accounts yet. Subtitle uploads currently use the single{" "}
          <b className="text-white">ABYSS_EMAIL</b> / <b className="text-white">ABYSS_PASSWORD</b> Edge
          Function secrets. Add an account below to start rotating.
        </p>
      ) : (
        <ul className="mb-4 space-y-2">
          {rows.map((row) => {
            const key = String(row.id);
            const stale = row.failure_count > 0;
            return (
              <li
                key={row.id}
                className={`rounded-lg border p-3 ${
                  row.is_active ? "border-white/10 bg-ink" : "border-white/5 bg-ink/50 opacity-70"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center text-[13.5px] font-bold text-white">
                      <span className="truncate">{row.label || row.username}</span>
                      {healthDot(key)}
                      {!row.is_active && (
                        <span className="ml-2 rounded bg-white/10 px-1.5 py-0.5 text-[10.5px] font-bold text-muted">
                          disabled
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] text-muted">{row.username}</p>
                    <p className="mt-1 text-[11.5px] text-muted">
                      Last used <b className="text-white/80">{when(row.last_used_at)}</b> · Last worked{" "}
                      <b className={row.last_ok_at ? "text-emerald-300" : "text-amber-300"}>
                        {when(row.last_ok_at)}
                      </b>
                      {stale && (
                        <>
                          {" "}
                          · <b className="text-red-300">{row.failure_count} failure{row.failure_count === 1 ? "" : "s"}</b>
                        </>
                      )}
                    </p>
                    {stale && row.last_error && (
                      <p className="mt-1 text-[11.5px] text-red-300/90">{row.last_error}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button variant="ghost" onClick={() => test(row.id)} disabled={busy !== null}>
                      {busy === `test-${row.id}` ? "Testing…" : "Test"}
                    </Button>
                    <Button variant="ghost" onClick={() => startEdit(row)} disabled={busy !== null}>
                      Edit
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => toggleActive(row)}
                      disabled={busy !== null}
                    >
                      {row.is_active ? "Disable" : "Enable"}
                    </Button>
                    <Button variant="danger" onClick={() => remove(row)} disabled={busy !== null}>
                      {busy === `delete-${row.id}` ? "Removing…" : "Remove"}
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!missingSchema && (
      <div className="rounded-lg border border-white/10 bg-ink p-4">
        <h4 className="mb-3 text-[13px] font-bold text-white">
          {editingId === null ? "Add an account" : "Edit account"}
        </h4>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="Label (optional)">
            <input
              className={inputCls}
              placeholder="Main account"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
            />
          </Field>
          <Field label="Username or email">
            <input
              className={inputCls}
              placeholder="you@example.com"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </Field>
          <Field label={editingId === null ? "Password" : "Password (blank = keep current)"}>
            <input
              type="password"
              className={inputCls}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {editingId !== null && (
            <Button variant="ghost" onClick={resetForm} disabled={busy !== null}>
              Cancel
            </Button>
          )}
          <Button
            onClick={save}
            disabled={busy !== null || username.trim() === "" || (editingId === null && password === "")}
          >
            {busy === "save" ? "Saving…" : editingId === null ? "Add account" : "Save changes"}
          </Button>
        </div>
      </div>
      )}

      {error && (
        <p className="mt-3 rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">{error}</p>
      )}
      {notice && (
        <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-[13px] text-emerald-300">
          {notice}
        </p>
      )}
    </div>
  );
}
