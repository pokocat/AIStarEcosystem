"use client";

export const GLOBAL_ERROR_EVENT = "aep-admin:global-error";

export interface GlobalErrorDetail {
  title: string;
  description?: string;
  source?: string;
  fingerprint?: string;
}

export function emitGlobalError(detail: GlobalErrorDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<GlobalErrorDetail>(GLOBAL_ERROR_EVENT, { detail }));
}

export function errorDetailFromUnknown(error: unknown, fallbackTitle: string): GlobalErrorDetail {
  if (error instanceof Error) {
    return {
      title: fallbackTitle,
      description: error.message || error.name,
      fingerprint: `${error.name}:${error.message}`,
    };
  }
  if (typeof error === "string") {
    return {
      title: fallbackTitle,
      description: error,
      fingerprint: error,
    };
  }
  return {
    title: fallbackTitle,
    description: "发生未知错误",
    fingerprint: fallbackTitle,
  };
}
