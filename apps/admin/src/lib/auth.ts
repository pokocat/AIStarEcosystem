"use client";

const AUTH_COOKIE = "aep_admin_token";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const parts = document.cookie.split("; ").find((part) => part.startsWith(`${name}=`));
  if (!parts) return null;
  return decodeURIComponent(parts.split("=").slice(1).join("="));
}

export function getAuthToken(): string | null {
  return readCookie(AUTH_COOKIE);
}

export function setAuthToken(token: string) {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=${60 * 60}; SameSite=Lax`;
}

export function clearAuthToken() {
  if (typeof document === "undefined") return;
  document.cookie = `${AUTH_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
