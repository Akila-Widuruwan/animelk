"use client";

import { useCallback, useEffect, useState } from "react";
import { isMissingSchema } from "@/lib/requests";
import {
  addAdFreeAccount,
  fetchAdFreeAccounts,
  isValidEmail,
  normalizeEmail,
  removeAdFreeAccount,
  type AdFreeRow,
} from "@/lib/ad-free";
import { Button, Field, inputCls } from "./ui";

/**
 * Accounts that browse the site without ads.
 *
 * An address added here is matched against the signed-in visitor in
 * public/ad-gate.js, which stops the Monetag tag before it loads, so no ad
 * request goes out for that account at all. The account is ad-free from its next
 * page load - and the load right after it is added reloads once to drop the ads
 * already on screen.
 */

function when(iso: string): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return "";
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

export default function AdFreeAccounts() {
  const [rows, setRows] = useState<AdFreeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [missingSchema, setMissingSchema] = useState(false);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");

  /** Migration 0013 may not have been run yet - say so instead of a raw SQL error. */
  const reportError = (message: string) => {
    if (isMissingSchema(message)) {
      setMissingSchema(true);
      setError("");
      return;
    }
    setError(message);
  };

  const refresh = useCallback(async () => {
    try {
      setRows(await fetchAdFreeAccounts());
      setError("");
    } catch (err) {
      reportError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const data = await fetchAdFreeAccounts();
        if (!ignore) {
          setRows(data);
          setError("");
        }
      } catch (err) {
        if (!ignore) reportError(err instanceof Error ? err.message : String(err));
      }
      if (!ignore) setLoading(false);
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const address = normalizeEmail(email);
    if (!isValidEmail(address)) {
      setError("Enter an email address, for example name@gmail.com");
      return;
    }
    setBusy("add");
    setError("");
    setNotice("");
    try {
      await addAdFreeAccount(address, note);
      setEmail("");
      setNote("");
      setNotice(`${address} is now ad-free on its next page load.`);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      reportError(
        /duplicate key|already exists|23505/i.test(message)
          ? `${address} is already on the list.`
          : message
      );
    } finally {
      setBusy(null);
    }
  };

  const remove = async (row: AdFreeRow) => {
    setBusy(row.email);
    setError("");
    setNotice("");
    try {
      await removeAdFreeAccount(row.email);
      setNotice(`${row.email} will see ads again on its next page load.`);
      await refresh();
    } catch (err) {
      reportError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  if (missingSchema) {
    return (
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 text-[13px] leading-6 text-body">
        <h3 className="text-[15px] font-bold text-white">One SQL step left</h3>
        <p className="mt-2">
          Run{" "}
          <code className="rounded bg-ink px-1.5 py-0.5 text-white">
            supabase/migrations/0013_ad_free_emails.sql
          </code>{" "}
          in the Supabase SQL editor to create the ad-free list, then reload this
          page.
        </p>
        <p className="mt-2 text-muted">
          Until then the hard-coded owner address in{" "}
          <code className="text-white">public/ad-gate.js</code> still keeps ads
          off for that one account.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-xl border border-white/10 bg-panel p-6">
        <h3 className="text-[15px] font-bold text-white">Ad-free accounts</h3>
        <p className="mt-1 text-[13px] leading-6 text-muted">
          These accounts never load the ad tag, so no ad request is made while
          they are signed in. Anyone else - and any signed-out visitor - sees ads
          as usual.
        </p>

        <form onSubmit={submit} className="mt-5 flex flex-wrap items-end gap-3">
          <Field label="Email" className="min-w-[240px] flex-1">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@gmail.com"
              className={inputCls}
            />
          </Field>
          <Field label="Note (optional)" className="min-w-[180px] flex-1">
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Why this account is ad-free"
              className={inputCls}
            />
          </Field>
          <Button type="submit" disabled={busy === "add"}>
            {busy === "add" ? "Adding…" : "Add account"}
          </Button>
        </form>

        {(error || notice) && (
          <p
            className={`mt-3 text-[13px] font-semibold ${
              error ? "text-red-300" : "text-emerald-300"
            }`}
          >
            {error || notice}
          </p>
        )}
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-white/10 bg-panel">
        {loading ? (
          <p className="p-5 text-[13px] text-muted">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-5 text-[13px] text-muted">
            No ad-free accounts yet. Add one above and it stops seeing ads from
            its next page load.
          </p>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead className="bg-white/[0.03] text-[11px] uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Note</th>
                <th className="px-4 py-3 font-semibold">Added</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.email} className="border-t border-white/5">
                  <td className="px-4 py-3 font-semibold text-white">{row.email}</td>
                  <td className="px-4 py-3 text-muted">{row.note || "—"}</td>
                  <td className="px-4 py-3 text-muted">{when(row.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="danger"
                      onClick={() => remove(row)}
                      disabled={busy === row.email}
                    >
                      {busy === row.email ? "Removing…" : "Remove"}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
