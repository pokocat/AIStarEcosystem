"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastTone = "info" | "success" | "warning" | "danger";

interface Toast {
  id: number;
  title: string;
  description?: string;
  tone: ToastTone;
  duration: number;
}

interface ToastInput {
  title: string;
  description?: string;
  duration?: number;
}

interface ToastApi {
  info: (t: ToastInput) => number;
  success: (t: ToastInput) => number;
  warning: (t: ToastInput) => number;
  danger: (t: ToastInput) => number;
  dismiss: (id: number) => void;
}

const ToastContext = React.createContext<ToastApi | null>(null);

const TONE_META: Record<ToastTone, { icon: typeof Info; ring: string; text: string; iconText: string }> = {
  info: {
    icon: Info,
    ring: "ring-info/25",
    text: "text-foreground",
    iconText: "text-info",
  },
  success: {
    icon: CheckCircle2,
    ring: "ring-success/25",
    text: "text-foreground",
    iconText: "text-success",
  },
  warning: {
    icon: AlertCircle,
    ring: "ring-warning/35",
    text: "text-foreground",
    iconText: "text-warning",
  },
  danger: {
    icon: AlertCircle,
    ring: "ring-destructive/30",
    text: "text-foreground",
    iconText: "text-destructive",
  },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const idRef = React.useRef(0);

  const dismiss = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = React.useCallback(
    (tone: ToastTone, input: ToastInput) => {
      const id = ++idRef.current;
      const duration = input.duration ?? (tone === "danger" ? 5500 : 3200);
      setToasts((prev) => [...prev.slice(-3), { id, tone, duration, title: input.title, description: input.description }]);
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss]
  );

  const api = React.useMemo<ToastApi>(
    () => ({
      info: (t) => push("info", t),
      success: (t) => push("success", t),
      warning: (t) => push("warning", t),
      danger: (t) => push("danger", t),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:items-end sm:right-4 sm:left-auto sm:bottom-4"
      >
        {toasts.map((t) => {
          const meta = TONE_META[t.tone];
          const Icon = meta.icon;
          return (
            <div
              key={t.id}
              role={t.tone === "danger" || t.tone === "warning" ? "alert" : "status"}
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-border bg-surface px-3.5 py-3 shadow-lg ring-1",
                meta.ring,
                "animate-in fade-in slide-in-from-bottom-2 duration-150"
              )}
            >
              <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", meta.iconText)} />
              <div className="flex-1 min-w-0">
                <div className={cn("text-sm font-medium leading-5", meta.text)}>{t.title}</div>
                {t.description && (
                  <div className="mt-0.5 text-xs leading-5 text-muted-foreground whitespace-pre-wrap break-words">
                    {t.description}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="关闭提示"
                className="-mr-1 -mt-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
