/**
 * OAuth failures as Supabase reports them.
 *
 * Supabase writes `error`, `error_code` and `error_description` into the query
 * string of the address it returns the browser to, and mirrors the same three
 * into the fragment. Both halves are read here so the reason survives either
 * shape of return address.
 */

/**
 * Turns Supabase's error code into something a visitor can act on. The raw
 * description ("OAuth state not found or expired") is accurate but reads like
 * the site is broken, when the usual cause is simply a slow round trip.
 */
export function friendlyAuthError(code: string, description: string): string {
  switch (code) {
    case "bad_oauth_state":
      // Supabase keeps the state it issued for five minutes. A Google account
      // chooser left open longer, or a second attempt started in another tab,
      // spends that window and the callback then has nothing to look up.
      return "The Google sign-in took longer than the five minutes Supabase allows, so it was dropped. Press “Continue with Google” again and pick the account without leaving the tab.";
    case "bad_oauth_callback":
      return "Google's answer arrived without the data Supabase needs. Start the sign-in again from this page.";
    case "bad_code_verifier":
      return "This tab lost the proof that it started the sign-in. Try again in this tab without clearing site data.";
    case "access_denied":
      return "Google sign-in was cancelled before it finished.";
    default:
      return description || "Google sign-in did not finish. Please try again.";
  }
}

function readError(read: (key: string) => string): string {
  const code = read("error_code");
  const description = read("error_description") || read("error");
  if (!code && !description) return "";
  return friendlyAuthError(code, description);
}

/** Reads a failure out of a query string (`window.location.search` or a bare one). */
export function errorFromQuery(search: string): string {
  const params = new URLSearchParams(search);
  return readError((key) => params.get(key) ?? "");
}

/** Reads a failure out of a URL fragment (`window.location.hash`). */
export function errorFromHash(hash: string): string {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return readError((key) => params.get(key) ?? "");
}

/** Reads a failure out of a route's `searchParams`, which may repeat a key. */
export function errorFromParams(
  params: Record<string, string | string[] | undefined>
): string {
  return readError((key) => {
    const value = params[key];
    return Array.isArray(value) ? value[0] ?? "" : value ?? "";
  });
}
