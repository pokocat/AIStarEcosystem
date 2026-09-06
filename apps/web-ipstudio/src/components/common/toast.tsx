"use client";

// 轻量提示条 —— 替代原生 alert（AGENTS.md §8 禁止 window.alert / confirm）。
// 只做「说一句就走」的反馈；需要用户确认的走 @ai-star-eco/ui 的 AlertDialog。

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type Tone = "info" | "ok" | "warn";

interface ToastItem { id: number; message: string; tone: Tone }

interface ToastApi {
  toast: (message: string, tone?: Tone) => void;
}

const Ctx = React.createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = React.useContext(Ctx);
  // 没有 Provider 时退化为静默（不抛错破坏页面）
  return ctx ?? { toast: () => undefined };
}

const TONE_STYLE: Record<Tone, { bg: string; fg: string; Icon: typeof Info }> = {
  info: { bg: "var(--info-soft)", fg: "var(--info)", Icon: Info },
  ok: { bg: "var(--ok-soft)", fg: "var(--ok)", Icon: CheckCircle2 },
  warn: { bg: "var(--warn-soft)", fg: "var(--warn)", Icon: AlertTriangle },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const seq = React.useRef(0);

  const remove = React.useCallback((id: number) => {
    setItems((list) => list.filter((i) => i.id !== id));
  }, []);

  const toast = React.useCallback(
    (message: string, tone: Tone = "info") => {
      const id = ++seq.current;
      setItems((list) => [...list.slice(-2), { id, message, tone }]);
      setTimeout(() => remove(id), 5200);
    },
    [remove],
  );

  const api = React.useMemo(() => ({ toast }), [toast]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 pointer-events-none">
        {items.map((item) => {
          const { bg, fg, Icon } = TONE_STYLE[item.tone];
          return (
            <div
              key={item.id}
              role="status"
              className="pointer-events-auto flex items-start gap-2 max-w-[min(92vw,30rem)] px-3.5 py-2.5 rounded-xl text-[13px] leading-relaxed"
              style={{ background: bg, color: fg, border: `1px solid ${fg}33`, boxShadow: "var(--shadow-lift)" }}
            >
              <Icon className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="min-w-0">{item.message}</span>
              <button
                onClick={() => remove(item.id)}
                className="shrink-0 mt-0.5 opacity-60 transition hover:opacity-100"
                aria-label="关闭提示"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}
