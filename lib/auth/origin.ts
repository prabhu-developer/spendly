/**
 * CSRF defence: same-origin check for state-changing requests.
 * Dependency-free so it can run in proxy.ts as well as route handlers.
 */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export interface OriginCheckInput {
  method: string;
  url: string;
  headers: Headers;
  /** Extra trusted origins, e.g. NEXT_PUBLIC_APP_URL */
  allowedOrigins?: (string | undefined)[];
}

function hostOf(value: string | null | undefined): string | null {
  if (!value || value === "null") return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

/** Hosts this request may legitimately originate from. */
function trustedHosts(input: OriginCheckInput): Set<string> {
  const hosts = new Set<string>();
  const forwardedHost = input.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = input.headers.get("host");
  if (forwardedHost) hosts.add(forwardedHost.toLowerCase());
  if (host) hosts.add(host.toLowerCase());
  const urlHost = hostOf(input.url);
  if (urlHost) hosts.add(urlHost);
  for (const origin of input.allowedOrigins ?? []) {
    const h = hostOf(origin);
    if (h) hosts.add(h);
  }
  return hosts;
}

export function isSameOriginRequest(input: OriginCheckInput): boolean {
  if (SAFE_METHODS.has(input.method.toUpperCase())) return true;

  const hosts = trustedHosts(input);
  const origin = input.headers.get("origin");

  if (origin !== null) {
    const originHost = hostOf(origin);
    return originHost !== null && hosts.has(originHost);
  }

  // No Origin header: rely on Fetch Metadata, then Referer.
  const fetchSite = input.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin" || fetchSite === "none") return true;
  if (fetchSite === "cross-site" || fetchSite === "same-site") return false;

  const refererHost = hostOf(input.headers.get("referer"));
  return refererHost !== null && hosts.has(refererHost);
}
