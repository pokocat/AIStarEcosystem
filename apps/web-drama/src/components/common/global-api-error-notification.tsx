"use client";

import * as React from "react";
import { toast } from "sonner";
import { ApiError } from "@ai-star-eco/api-client";

type GlobalApiFailure = {
  message: string;
  text: string;
  logId: string | null;
  code?: string;
  status?: number;
  unauthorized: boolean;
};

function stringProp(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== "object") return null;
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function parseLogId(message: string): { text: string; logId: string | null } {
  const match = message.match(
    /·?\s*(?:追查号|日志\s*ID)\s*[：:]?\s*([A-Za-z0-9_-]+)\s*$/i,
  );
  if (!match) return { text: message, logId: null };
  return {
    text: message.slice(0, match.index).replace(/[·\s]+$/, ""),
    logId: match[1],
  };
}

function messageOf(reason: unknown): string {
  if (typeof reason === "string") return reason;
  const message = (reason as { message?: unknown } | null)?.message;
  return typeof message === "string" ? message.trim() : "";
}

function detailLogId(details: unknown): string | null {
  return stringProp(details, "logId") ?? stringProp(details, "log_id");
}

function toGlobalApiFailure(reason: unknown): GlobalApiFailure | null {
  if (!reason) return null;
  if ((reason as { name?: unknown }).name === "AbortError") return null;

  const message = messageOf(reason);
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
    text: parsed.text || "服务器处理请求失败，请稍后重试。",
    logId,
    code,
    status,
    unauthorized,
  };
}

export function GlobalApiErrorNotification() {
  const lastKeyRef = React.useRef<{ key: string; at: number } | null>(null);

  const notifyFailure = React.useCallback((reason: unknown): boolean => {
    const failure = toGlobalApiFailure(reason);
    if (!failure) return false;

    const key = `${failure.status ?? ""}:${failure.code ?? ""}:${failure.message}`;
    const now = Date.now();
    const last = lastKeyRef.current;
    if (last?.key === key && now - last.at < 800) return true;

    lastKeyRef.current = { key, at: now };

    const meta = [
      failure.status ? `HTTP ${failure.status}` : null,
      failure.code ? `错误码 ${failure.code}` : null,
      failure.logId ? `日志 ID ${failure.logId}` : null,
    ].filter(Boolean).join(" · ");

    toast.error(failure.unauthorized ? "登录状态已失效" : "请求处理失败", {
      description: meta ? `${failure.text}\n${meta}` : failure.text,
      duration: 8000,
      action: failure.logId
        ? {
            label: "复制日志 ID",
            onClick: () => {
              void navigator.clipboard?.writeText(failure.logId ?? "");
            },
          }
        : undefined,
    });

    return true;
  }, []);

  React.useEffect(() => {
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!notifyFailure(event.reason)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    const onWindowError = (event: ErrorEvent) => {
      if (!notifyFailure(event.error)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection, true);
    window.addEventListener("error", onWindowError, true);
    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection, true);
      window.removeEventListener("error", onWindowError, true);
    };
  }, [notifyFailure]);

  return null;
}
