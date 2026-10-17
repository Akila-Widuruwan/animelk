import { redirect } from "next/navigation";

/**
 * Supabase sends a failed OAuth round trip to whatever is configured as the
 * project's Site URL, keeping any path that URL carries. When that path is
 * `/error` (or when anyone bookmarked a failed callback), the visitor lands
 * here with `error`, `error_code` and `error_description` on the query.
 *
 * Forward those to /login, which knows how to explain them, so a failed sign-in
 * always ends on a page with a retry button instead of a bare 404.
 */
const ERROR_PARAMS = ["error", "error_code", "error_description"] as const;

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();

  for (const key of ERROR_PARAMS) {
    const value = params[key];
    if (typeof value === "string" && value) query.set(key, value);
  }

  redirect(query.size ? `/login?${query}` : "/login");
}
