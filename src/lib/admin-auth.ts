import { createClient } from "@supabase/supabase-js";

export type StaffRole = "admin" | "staff";

/**
 * Resolves the signed-in user's role from the request's bearer token.
 * Returns null when there is no valid session.
 */
export async function getRequestRole(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!auth) return null;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return null;
  try {
    const sb = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${auth}` } },
    });
    const { data, error } = await sb.auth.getUser(auth);
    if (error || !data.user) return null;
    const { data: profile } = await sb
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();
    return (profile as { role?: string } | null)?.role ?? null;
  } catch {
    return null;
  }
}

export async function isAdminRequest(request: Request): Promise<boolean> {
  return (await getRequestRole(request)) === "admin";
}

/** Admins and staff — the two roles allowed into staff-only API routes. */
export async function isStaffRequest(request: Request): Promise<boolean> {
  const role = await getRequestRole(request);
  return role === "admin" || role === "staff";
}
