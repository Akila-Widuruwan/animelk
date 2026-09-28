import { createClient } from "@supabase/supabase-js";

export async function isAdminRequest(request: Request): Promise<boolean> {
  const auth = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!auth) return false;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return false;
  try {
    const sb = createClient(url, anon);
    const { data, error } = await sb.auth.getUser(auth);
    if (error || !data.user) return false;
    const { data: profile } = await sb
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();
    return (profile as { role?: string } | null)?.role === "admin";
  } catch {
    return false;
  }
}
