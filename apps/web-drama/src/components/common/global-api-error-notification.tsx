"use client";

import * as React from "react";
import { toast } from "sonner";
import { ApiError } from "@ai-star-eco/api-client";
import { aiErrorMessage } from "@/lib/ai-error";

// 全局兜底报错提示：没被页面自己 catch 住的接口错误，在这里弹一条 toast。
// v0.197（docs/drama-ux-copy-pass.md §3.7）：主文案只给人话 —— 能按错误码翻译的走 aiErrorMessage，
// HTTP 状态、错误码原文不再显示；需要报障时点「复制错误信息」，把问题编号、错误码、原始信息一起复制走。
const FALLBACK_TEXT = "操作没成功，请稍后再试。";

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

  // aiErrorMessage 会按 code 翻译、把技术细节换成兜底；传 Error 形态让它读得到原文
  const friendly = aiErrorMessage(Object.assign(new Error(parsed.text), { code }), FALLBACK_TEXT);

  return {
    message,
    text: friendly || FALLBACK_TEXT,
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

    // 复制给客服 / 报障用的完整信息（界面上不显示这些技术细节）
    const detail = [
      failure.logId ? `问题编号 ${failure.logId}` : null,
      failure.code ? `错误码 ${failure.code}` : null,
      failure.status ? `HTTP ${failure.status}` : null,
      failure.message && failure.message !== failure.text ? `原始信息 ${failure.message}` : null,
    ].filter(Boolean).join("\n");

    toast.error(failure.unauthorized ? "登录已过期，请重新登录" : "操作没成功", {
      // 登录过期：标题已经说清了，不再重复一遍
      description: failure.unauthorized
        ? undefined
        : failure.logId
          ? `${failure.text}\n问题编号 ${failure.logId}`
          : failure.text,
      duration: 8000,
      action: detail
        ? {
            label: "复制错误信息",
            onClick: () => {
              void navigator.clipboard?.writeText(detail);
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
