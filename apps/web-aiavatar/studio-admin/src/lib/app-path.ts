const configuredBasePath = process.env.NEXT_PUBLIC_STUDIO_ADMIN_BASE_PATH || "";

export const STUDIO_ADMIN_BASE_PATH = configuredBasePath.replace(/\/$/, "");

export function studioAdminPath(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (!STUDIO_ADMIN_BASE_PATH) return normalized;
  if (normalized === "/") return STUDIO_ADMIN_BASE_PATH;
  return `${STUDIO_ADMIN_BASE_PATH}${normalized}`;
}
export function safeStudioAdminNext(next: string | null): string {
  const fallback = studioAdminPath("/");
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return fallback;
  }

  const pathname = next.split(/[?#]/, 1)[0] || "/";
  if (
    STUDIO_ADMIN_BASE_PATH
    && pathname !== STUDIO_ADMIN_BASE_PATH
    && !pathname.startsWith(`${STUDIO_ADMIN_BASE_PATH}/`)
  ) {
    return fallback;
  }
  return next;
}
