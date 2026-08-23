const DEFAULT_RETURN_PATH = "/dashboard";

const ALLOWED_WORKSPACE_PREFIXES = [
  "/dashboard",
  "/market",
  "/generate",
  "/star",
  "/projects",
  "/library",
  "/products",
  "/mixcut",
  "/distribution",
  "/material",
  "/data",
  "/wallet",
  "/account",
  // Legacy routes are still handled by proxy.ts and remain safe in this app.
  "/console",
  "/cast",
] as const;

/**
 * Keep post-login navigation inside the celebrity workspace.
 *
 * URLSearchParams already decodes one layer. URL then normalizes dot segments,
 * so values such as `/products/../admin` cannot bypass the prefix check.
 */
export function celebrityReturnPath(raw: string | null | undefined): string {
  const candidate = raw?.trim();
  if (!candidate || !candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return DEFAULT_RETURN_PATH;
  }

  try {
    const base = new URL("https://celebrity.invalid");
    const parsed = new URL(candidate, base);
    if (parsed.origin !== base.origin) return DEFAULT_RETURN_PATH;

    const allowed = ALLOWED_WORKSPACE_PREFIXES.some(
      (prefix) => parsed.pathname === prefix || parsed.pathname.startsWith(`${prefix}/`),
    );
    return allowed
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : DEFAULT_RETURN_PATH;
  } catch {
    return DEFAULT_RETURN_PATH;
  }
}
