"use client";
// The one way a page starts a new canvas (docs/ip-studio-new-canvas-and-threads.md §2): startNewCanvas() behind a lock, so a
// double click or StrictMode's double-run effect still makes one canvas. On success the page navigates away and stays
// 「creating」 until it unmounts; a failure releases the lock for a retry.
//
// The navigation belongs to the page that asked for it (Codex review 2026-10-20): when the answer comes back after the page
// was left (the back button on /create, a link clicked meanwhile), it does not pull the user to the new canvas. The canvas
// stays; the next 「新建」 reuses it (startNewCanvas's reuse rule).
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isProductNotEnrolledError } from "@ai-star-eco/api-client";
import { startNewCanvas } from "./studio-entry";

export type StartNewCanvas = {
  /** Resolves once the navigation was requested, or with nothing when a start is already running, it failed, or the page was left. */
  start: () => Promise<void>;
  creating: boolean;
  /** The raw failure, for pages that show it through their own error notice. */
  error: unknown;
  /** A readable reason, empty when nothing failed. */
  errorMessage: string;
  /** The account has not enabled this product; pages with an enrolment screen show it (the error is set as well). */
  notEnrolled: boolean;
  clearError: () => void;
};

/** Where the page is: a start that comes back somewhere else was overtaken by another navigation. */
const here = () => typeof window === "undefined" ? "" : `${window.location.pathname}${window.location.search}`;

export function useStartNewCanvas({ navigate = "push" }: { navigate?: "push" | "replace" } = {}): StartNewCanvas {
  const router = useRouter();
  const lock = useRef(false);
  // Mounted, per effect lifetime. StrictMode runs cleanup and setup once more on the same instance: the flag is back to
  // true by the time any answer arrives, so the page that is really there still navigates (once).
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<unknown>();
  const [notEnrolled, setNotEnrolled] = useState(false);
  const start = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    const from = here();
    setCreating(true); setError(undefined);
    try {
      const href = await startNewCanvas();
      if (!mounted.current || here() !== from) {
        // Left while it was being made: no navigation. Still mounted (the address changed under it) → usable again.
        if (mounted.current) { setCreating(false); lock.current = false; }
        return;
      }
      if (navigate === "replace") router.replace(href); else router.push(href);
    } catch (e) {
      if (!mounted.current) return;
      setError(e ?? new Error());
      if (isProductNotEnrolledError(e)) setNotEnrolled(true);
      setCreating(false); lock.current = false;
    }
  }, [navigate, router]);
  const clearError = useCallback(() => setError(undefined), []);
  const errorMessage = error === undefined ? "" : error instanceof Error && error.message ? error.message : "新画布没有创建成功，请重试";
  return { start, creating, error, errorMessage, notEnrolled, clearError };
}
