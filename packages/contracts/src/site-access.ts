/** These endpoints have their own authentication, or serve only sign-in/health/brand assets. */
export function requiresSiteAccess(pathname: string): boolean {
  if (/^\/api\/(?:auth|admin|member|ingest)(?:\/|$)/.test(pathname)) return false;
  return !new Set([
    "/api/health", "/robots.txt", "/.well-known/security.txt", "/manifest.webmanifest",
    "/favicon.ico", "/icon.png", "/icon-192.png", "/apple-icon.png", "/logo.svg",
  ]).has(pathname);
}

export function requiresPageAccess(pathname: string): boolean {
  const page = decodeURIComponent(pathname).replace(/\.data$/, "").replace(/\/+$/, "") || "/";
  return page !== "/login" && !/^\/admin(?:\/|$)/.test(page);
}

export const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store",
  "X-Accel-Expires": "0",
  "X-Robots-Tag": "noindex, nofollow",
} as const;
