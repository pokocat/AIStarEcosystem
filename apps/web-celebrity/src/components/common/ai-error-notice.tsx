"use client";

// 统一的 AI/接口错误提示组件（issue 6）。
// 后端错误经 apiFetch 抛出，message 末尾通常带「· 追查号 XXXX」（GlobalExceptionHandler 追加的日志 id）。
// 这里把追查号拆出来做成可复制的 chip，方便用户报错时直接复述给运维排查。

import * as React from "react";
import { AlertTriangle, Copy, Check, RotateCw } from "lucide-react";

/** 从 ApiError 之类的异常里取可读 message。 */
export function errorMessage(e: unknown, fallback = "操作失败，请稍后重试"): string {
  if (!e) return fallback;
  if (typeof e === "string") return e;
  const msg = (e as { message?: unknown }).message;
  return typeof msg === "string" && msg.trim() ? msg : fallback;
}

/** 从 message 末尾解析「追查号 XXXX」。 */
function parseLogId(message: string): { text: string; logId: string | null } {
  const m = message.match(/·?\s*追查号\s+([A-Za-z0-9]+)\s*$/);
  if (!m) return { text: message, logId: null };
  return { text: message.slice(0, m.index).replace(/[·\s]+$/, ""), logId: m[1] };
}

export function AiErrorNotice({
  message,
  onRetry,
  tone = "danger",
  title,
}: {
  message: string;
  onRetry?: () => void;
  /** danger=红（阻塞失败）；warning=黄（降级仍可用） */
  tone?: "danger" | "warning";
  title?: string;
}) {
  const { text, logId } = parseLogId(message);
  const [copied, setCopied] = React.useState(false);

  const copy = () => {
    if (logId && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(logId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    }
  };

  return (
    <div
      role="alert"
      className={`rounded-lg border px-3 py-2.5 text-[12px] leading-relaxed ${
        tone === "warning"
          ? "border-amber-500/40 bg-amber-500/10 text-amber-700"
          : "border-rose-500/40 bg-rose-500/10 text-rose-600"
      }`}
    >
      <div className="flex items-start gap-2">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <div className="min-w-0 flex-1">
          {title && <div className="font-semibold">{title}</div>}
          <div className="break-words">{text}</div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2">
            {logId && (
              <button
                type="button"
                onClick={copy}
                title="复制追查号给运维排查"
                className="inline-flex items-center gap-1 rounded-md border border-current/30 bg-white/40 px-1.5 py-0.5 font-mono text-[10px] hover:bg-white/70"
              >
                追查号 {logId}
                {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              </button>
            )}
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="inline-flex items-center gap-1 rounded-md border border-current/30 bg-white/40 px-1.5 py-0.5 text-[10px] hover:bg-white/70"
              >
                <RotateCw className="h-3 w-3" /> 重试
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
