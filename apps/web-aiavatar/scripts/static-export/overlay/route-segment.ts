"use client";
import { useSyncExternalStore } from "react";
const subscribe = (fn: () => void) => { window.addEventListener("popstate", fn); return () => window.removeEventListener("popstate", fn); };
/** Decoded path segment from the real URL; "" during prerender and hydration, so nothing runs with the placeholder. */
export function useRouteSegment(index: number): string {
  return useSyncExternalStore(subscribe, () => decodeURIComponent(window.location.pathname.split("/")[index] || ""), () => "");
}
