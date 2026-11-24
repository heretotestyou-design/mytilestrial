// Only ever redirect to a path on this site. Blocks open redirects such as
// "//evil.com", "/\evil.com" (browsers treat "\" as "/") and "https://evil.com".
const ORIGIN = "http://same-origin.invalid";

export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  try {
    const url = new URL(next, ORIGIN);
    return url.origin === ORIGIN ? url.pathname + url.search + url.hash : fallback;
  } catch {
    return fallback;
  }
}
