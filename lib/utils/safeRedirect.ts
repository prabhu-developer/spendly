/**
 * Only allow same-site relative paths ("/dashboard/x"), never "//evil.com",
 * "/\\evil.com" or absolute URLs — prevents open redirects via ?redirect=.
 */
export function safeRedirectPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  try {
    const url = new URL(value, "https://spendly.invalid");
    if (url.origin !== "https://spendly.invalid") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
