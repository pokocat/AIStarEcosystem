"use client";

import * as React from "react";
import { AlertTriangle, Check, Copy, X } from "lucide-react";
import {
  ApiError,
  GLOBAL_API_ERROR_EVENT,
  type GlobalApiErrorEventDetail,
} from "@ai-star-eco/api-client";
import { errorMessage, parseLogId } from "./ai-error-notice";

type GlobalApiFailure = {
  message: string;
  text: string;
  logId: string | null;
  code?: string;
  status?: number;
  source?: string;
  unauthorized: boolean;
};

const GLOBAL_API_ERROR_DEDUPE_MS = 10_000;
const GLOBAL_API_ERROR_VISIBLE_MS = 7_000;

function stringProp(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== "object") return null;
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function detailLogId(details: unknown): string | null {
  return stringProp(details, "logId") ?? stringProp(details, "log_id");
}

function toGlobalApiFailure(reason: unknown, source?: string): GlobalApiFailure | null {
  if (!reason) return null;
  if ((reason as { name?: unknown }).name === "AbortError") return null;

  const message = errorMessage(reason, "");
  if (!message) return null;

  const parsed = parseLogId(message);
  const maybe = reason as { code?: unknown; status?: unknown; details?: unknown };
  const code = typeof maybe.code === "string" ? maybe.code : undefined;
  const status = typeof maybe.status === "number" ? maybe.status : undefined;
  const logId = parsed.logId ?? detailLogId(maybe.details);
  const unauthorized = code === "UNAUTHORIZED" || status === 401;

  const isBackendError =
    unauthorized ||
    reason instanceof ApiError ||
    Boolean(logId) ||
    (typeof code === "string" && typeof status === "number");

  if (!isBackendError) return null;

  return {
    message,
    text: parsed.text,
    logId,
    code,
    status,
    source,
    unauthorized,
  };
}

function displayText(failure: GlobalApiFailure): string {
  if (failure.unauthorized) return "登录状态已清除，请重新登录后继续。";
  if (failure.code === "PARSE_ERROR" && (failure.status ?? 0) >= 500) {
    return "后台接口返回异常，本页数据可能没有刷新。";
  }
  return failure.text || "服务器处理请求失败，请稍后重试。";
}

function failureMeta(failure: GlobalApiFailure): string {
  return [
    failure.source,
    failure.status ? `HTTP ${failure.status}` : null,
    failure.code ? `错误码 ${failure.code}` : null,
    failure.logId ? `日志 ID ${failure.logId}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function GlobalApiErrorNotification() {
  const [failure, setFailure] = React.useState<GlobalApiFailure | null>(null);
  const [copied, setCopied] = React.useState(false);
  const lastKeyRef = React.useRef<{ key: string; at: number } | null>(null);
  const dismissTimerRef = React.useRef<number | null>(null);

  const clearDismissTimer = React.useCallback(() => {
    if (!dismissTimerRef.current) return;
    window.clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = null;
  }, []);

  const close = React.useCallback(() => {
    clearDismissTimer();
    setFailure(null);
  }, [clearDismissTimer]);

  const openFailure = React.useCallback(
    (reason: unknown, source?: string): boolean => {
      const next = toGlobalApiFailure(reason, source);
      if (!next) return false;

      const key = `${next.source ?? ""}:${next.status ?? ""}:${next.code ?? ""}:${next.message}`;
      const now = Date.now();
      const last = lastKeyRef.current;
      if (last?.key === key && now - last.at < GLOBAL_API_ERROR_DEDUPE_MS) return true;

      lastKeyRef.current = { key, at: now };
      clearDismissTimer();
      setCopied(false);
      setFailure(next);
      dismissTimerRef.current = window.setTimeout(() => {
        setFailure(null);
        dismissTimerRef.current = null;
      }, GLOBAL_API_ERROR_VISIBLE_MS);
      return true;
    },
    [clearDismissTimer],
  );

  React.useEffect(() => {
    const onGlobalApiError = (event: Event) => {
      const detail = (event as CustomEvent<GlobalApiErrorEventDetail>).detail;
      if (!detail?.error) return;
      openFailure(detail.error, detail.path);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!openFailure(event.reason)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const onWindowError = (event: ErrorEvent) => {
      if (!openFailure(event.error)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    window.addEventListener(GLOBAL_API_ERROR_EVENT, onGlobalApiError);
    window.addEventListener("unhandledrejection", onUnhandledRejection, true);
    window.addEventListener("error", onWindowError, true);
    return () => {
      window.removeEventListener(GLOBAL_API_ERROR_EVENT, onGlobalApiError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection, true);
      window.removeEventListener("error", onWindowError, true);
      clearDismissTimer();
    };
  }, [clearDismissTimer, openFailure]);

  const copyLogId = () => {
    if (!failure?.logId || typeof navigator === "undefined" || !navigator.clipboard) return;
    void navigator.clipboard
      .writeText(failure.logId)
      .then(() => {
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1400);
      })
      .catch(() => undefined);
  };

  if (!failure) return null;

  const meta = failureMeta(failure);

  return (
    <div
      aria-atomic="true"
      aria-live="polite"
      className={[
        "pointer-events-none fixed inset-x-3 top-[calc(env(safe-area-inset-top)+12px)] z-[220]",
        "flex justify-center sm:inset-x-auto sm:right-5 sm:top-5 sm:block sm:w-[min(420px,calc(100vw-40px))]",
      ].join(" ")}
    >
      <div
        role="status"
        className={[
          "pointer-events-auto w-full max-w-[420px] overflow-hidden rounded-lg",
          "border border-amber-200 bg-zinc-50 text-zinc-950 shadow-[0_18px_44px_rgba(31,26,20,0.18)]",
          "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-2",
        ].join(" ")}
      >
        <div className="flex items-start gap-3 px-4 py-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-5">
                  {failure.unauthorized ? "登录状态已失效" : "请求处理失败"}
                </p>
                <p className="mt-1 text-sm leading-5 text-zinc-700">{displayText(failure)}</p>
              </div>
              <button
                type="button"
                aria-label="关闭错误提醒"
                onClick={close}
                className="mt-[-2px] inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {meta && (
              <p className="mt-2 break-words text-xs leading-5 text-zinc-500">{meta}</p>
            )}
            {failure.logId && (
              <button
                type="button"
                onClick={copyLogId}
                className={[
                  "mt-2 inline-flex h-7 items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2.5",
                  "text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-zinc-950",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300",
                ].join(" ")}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                复制日志 ID
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
