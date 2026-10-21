"use client";
// The one way a page starts a new canvas (docs/ip-studio-new-canvas-and-threads.md §2): startNewCanvas() behind a lock, so a
// double click or StrictMode's double-run effect still makes one canvas. On success the page navigates away and stays
// 「creating」 until it unmounts; a failure releases the lock for a retry.
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { isProductNotEnrolledError } from "@ai-star-eco/api-client";
import { startNewCanvas } from "./studio-entry";

export type StartNewCanvas = {
  /** Resolves once the navigation was requested, or with nothing when a start is already running or it failed. */
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

export function useStartNewCanvas({ navigate = "push" }: { navigate?: "push" | "replace" } = {}): StartNewCanvas {
  const router = useRouter();
  const lock = useRef(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<unknown>();
  const [notEnrolled, setNotEnrolled] = useState(false);
  const start = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    setCreating(true); setError(undefined);
    try {
      const href = await startNewCanvas();
      if (navigate === "replace") router.replace(href); else router.push(href);
    } catch (e) {
      setError(e ?? new Error());
      if (isProductNotEnrolledError(e)) setNotEnrolled(true);
      setCreating(false); lock.current = false;
    }
  }, [navigate, router]);
  const clearError = useCallback(() => setError(undefined), []);
  const errorMessage = error === undefined ? "" : error instanceof Error && error.message ? error.message : "新画布没有创建成功，请重试";
  return { start, creating, error, errorMessage, notEnrolled, clearError };
}
