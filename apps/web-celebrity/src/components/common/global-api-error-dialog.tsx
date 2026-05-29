"use client";

import * as React from "react";
import { AlertTriangle, Check, Copy } from "lucide-react";
import { ApiError } from "@ai-star-eco/api-client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@ai-star-eco/ui/ui/alert-dialog";
import { errorMessage, parseLogId } from "./ai-error-notice";

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

function detailLogId(details: unknown): string | null {
  return stringProp(details, "logId") ?? stringProp(details, "log_id");
}

function toGlobalApiFailure(reason: unknown): GlobalApiFailure | null {
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
    unauthorized,
  };
}

export function GlobalApiErrorDialog() {
  const [failure, setFailure] = React.useState<GlobalApiFailure | null>(null);
  const [copied, setCopied] = React.useState(false);
  const lastKeyRef = React.useRef<{ key: string; at: number } | null>(null);

  const openFailure = React.useCallback((reason: unknown): boolean => {
    const next = toGlobalApiFailure(reason);
    if (!next) return false;

    const key = `${next.status ?? ""}:${next.code ?? ""}:${next.message}`;
    const now = Date.now();
    const last = lastKeyRef.current;
    if (last?.key === key && now - last.at < 600) return true;

    lastKeyRef.current = { key, at: now };
    setCopied(false);
    setFailure(next);
    return true;
  }, []);

  React.useEffect(() => {
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

    window.addEventListener("unhandledrejection", onUnhandledRejection, true);
    window.addEventListener("error", onWindowError, true);
    return () => {
      window.removeEventListener("unhandledrejection", onUnhandledRejection, true);
      window.removeEventListener("error", onWindowError, true);
    };
  }, [openFailure]);

  const close = () => setFailure(null);

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

  return (
    <AlertDialog open={Boolean(failure)} onOpenChange={(open) => !open && close()}>
      <AlertDialogContent
        className="z-[220] max-w-md border-zinc-200 bg-white text-zinc-950 shadow-[var(--shadow-pop)]"
        overlayClassName="z-[220]"
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <AlertTriangle className="h-4 w-4" />
            </span>
            {failure?.unauthorized ? "登录状态已失效" : "请求处理失败"}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3 text-left text-sm leading-6 text-zinc-600">
              <p className="break-words">{failure?.text || "服务器处理请求失败，请稍后重试。"}</p>
              {failure?.logId ? (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-rose-700">
                  <span className="font-medium">日志 ID：</span>
                  <span className="font-mono">{failure.logId}</span>
                </div>
              ) : failure?.unauthorized ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                  登录状态已清除，请重新登录后继续操作。
                </div>
              ) : (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                  本次响应未返回日志 ID，请把错误码和时间一并反馈给运维。
                </div>
              )}
              {(failure?.code || failure?.status) && (
                <div className="text-xs text-zinc-500">
                  {failure.status ? `HTTP ${failure.status}` : null}
                  {failure.status && failure.code ? " · " : null}
                  {failure.code ? `错误码 ${failure.code}` : null}
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={close}>关闭</AlertDialogCancel>
          {failure?.logId && (
            <button
              type="button"
              onClick={copyLogId}
              className={[
                "inline-flex h-9 items-center justify-center gap-2 rounded-md border border-zinc-200",
                "bg-white px-4 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300",
              ].join(" ")}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              复制日志 ID
            </button>
          )}
          <AlertDialogAction onClick={close} className="bg-zinc-950 text-white hover:bg-zinc-800">
            知道了
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
