"use client";

import * as React from "react";
import {
  GLOBAL_ERROR_EVENT,
  type GlobalErrorDetail,
  errorDetailFromUnknown,
} from "@/lib/global-errors";
import { useToast } from "./Toaster";

const DEDUPE_MS = 1500;

export function GlobalErrorNotifier() {
  const toast = useToast();
  const recent = React.useRef(new Map<string, number>());

  const notify = React.useCallback(
    (detail: GlobalErrorDetail) => {
      const fingerprint =
        detail.fingerprint ?? `${detail.title}:${detail.description ?? ""}:${detail.source ?? ""}`;
      const now = Date.now();
      const last = recent.current.get(fingerprint);
      if (last && now - last < DEDUPE_MS) return;
      recent.current.set(fingerprint, now);

      toast.danger({
        title: detail.title,
        description: [detail.description, detail.source ? `来源：${detail.source}` : null]
          .filter(Boolean)
          .join("\n"),
      });

      window.setTimeout(() => {
        if (recent.current.get(fingerprint) === now) {
          recent.current.delete(fingerprint);
        }
      }, DEDUPE_MS);
    },
    [toast],
  );

  React.useEffect(() => {
    const onGlobalError = (event: Event) => {
      notify((event as CustomEvent<GlobalErrorDetail>).detail);
    };
    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      notify(errorDetailFromUnknown(event.reason, "未处理的异步错误"));
    };
    const onWindowError = (event: ErrorEvent) => {
      notify({
        title: "页面脚本错误",
        description: event.message || event.error?.message || "脚本运行失败",
        source: event.filename ? `${event.filename}:${event.lineno}:${event.colno}` : undefined,
        fingerprint: `${event.message}:${event.filename}:${event.lineno}:${event.colno}`,
      });
    };

    window.addEventListener(GLOBAL_ERROR_EVENT, onGlobalError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    window.addEventListener("error", onWindowError);
    return () => {
      window.removeEventListener(GLOBAL_ERROR_EVENT, onGlobalError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      window.removeEventListener("error", onWindowError);
    };
  }, [notify]);

  return null;
}
