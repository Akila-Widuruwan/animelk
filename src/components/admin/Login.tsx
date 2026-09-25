"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { Button, Field, inputCls } from "./ui";

export default function Login({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error } = await supabaseBrowser().auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (error) setError(error.message);
    else onLoggedIn();
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-white/10 bg-panel p-8 shadow-2xl"
      >
        <h1 className="text-xl font-extrabold text-white">
          ANIME<span className="text-gradient">LK</span> Admin
        </h1>
        <p className="mt-1 text-[13px] text-muted">Sign in with an admin account</p>

        <div className="mt-6 space-y-4">
          <Field label="Email">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputCls}
              placeholder="admin@animelk.com"
            />
          </Field>
          <Field label="Password">
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputCls}
              placeholder="••••••••"
            />
          </Field>
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-[13px] text-red-300">
            {error}
          </p>
        )}

        <Button type="submit" disabled={busy} className="mt-6 w-full py-2.5">
          {busy ? "Signing in..." : "Sign In"}
        </Button>

        <p className="mt-4 text-center text-[12px] text-muted">
          First time? Create a user in Supabase Auth, then run the SQL from
          SUPABASE_SETUP.md to grant the admin role.
        </p>
      </form>
    </div>
  );
}
