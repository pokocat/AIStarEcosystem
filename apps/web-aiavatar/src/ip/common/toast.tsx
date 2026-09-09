"use client";

// ============================================================
// 通知卡片（右上角浮层）—— 替代原生 alert（AGENTS.md §8 禁止 window.alert / confirm）。
//
// ⚠️ **样式必须自给自足，不能用 .ip-surface 作用域里的令牌。**
// 这个容器是 fixed 挂在 Provider 下的，渲染位置在 `.ip-surface` **之外**；
// 而 `--info-soft` / `--ok-soft` / `--warn-soft` / `--shadow-lift` 只在
// ip-desktop.css 的作用域里有定义 —— 在外面解析为空值，
// `background: var(--info-soft)` 整条声明失效，于是**通知看起来完全没有样式**
// （用户实测报的就是这个）。所以这里的颜色全部写实值，只对两个全局都有的
// （--surface / --ink）留 var() 并带回退。
//
// 位置在右上角而不是底部居中：底部容易压住页面主操作（保存/发布那一排），
// 而右上角是通知的惯例位置，也不挡内容。
// ============================================================

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, X } from "lucide-react";

type Tone = "info" | "ok" | "warn";

interface ToastItem { id: number; message: string; tone: Tone; leaving?: boolean }

interface ToastApi {
  toast: (message: string, tone?: Tone) => void;
}

const Ctx = React.createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = React.useContext(Ctx);
  // 没有 Provider 时退化为静默（不抛错破坏页面）
  return ctx ?? { toast: () => undefined };
}

/** 写实值：见文件头 —— 这些卡片渲染在令牌作用域之外。 */
const TONE: Record<Tone, { accent: string; tint: string; label: string; Icon: typeof Info }> = {
  info: { accent: "#3B6CB7", tint: "#EEF3FB", label: "提示", Icon: Info },
  ok:   { accent: "#12A150", tint: "#ECF8F1", label: "完成", Icon: CheckCircle2 },
  warn: { accent: "#C2410C", tint: "#FDF1EA", label: "没成功", Icon: AlertTriangle },
};

const SHOW_MS = 5200;
const LEAVE_MS = 180;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([]);
  const seq = React.useRef(0);

  const remove = React.useCallback((id: number) => {
    // 先标记退场再移除，让离开动画有时间跑完
    setItems((list) => list.map((i) => (i.id === id ? { ...i, leaving: true } : i)));
    setTimeout(() => setItems((list) => list.filter((i) => i.id !== id)), LEAVE_MS);
  }, []);

  const toast = React.useCallback(
    (message: string, tone: Tone = "info") => {
      const id = ++seq.current;
      // 最多同时留 3 条：再多就是刷屏，用户只会去看最新那条
      setItems((list) => [...list.slice(-2), { id, message, tone }]);
      setTimeout(() => remove(id), SHOW_MS);
    },
    [remove],
  );

  const api = React.useMemo(() => ({ toast }), [toast]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        style={{
          position: "fixed",
          // 桌面顶栏 52px 之下；没有顶栏的页面也不会顶到边上
          top: "calc(var(--desktop-bar-h, 52px) + 14px)",
          right: 16,
          zIndex: 1300,   // 高于 antd Modal(1000) 与它的气泡(1200)
          display: "flex",
          flexDirection: "column",
          gap: 10,
          pointerEvents: "none",
          maxWidth: "min(92vw, 26rem)",
        }}
      >
        {items.map((item) => {
          const { accent, tint, label, Icon } = TONE[item.tone];
          return (
            <div
              key={item.id}
              role="status"
              style={{
                pointerEvents: "auto",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                padding: "12px 12px 12px 14px",
                borderRadius: 12,
                background: "var(--surface, #ffffff)",
                border: "1px solid rgba(20,32,43,.10)",
                // 左侧一道彩条给出语义，卡片本体保持白底 —— 整块染色在浅色界面上太吵
                borderLeft: `3px solid ${accent}`,
                boxShadow: "0 2px 6px rgba(20,32,43,.06), 0 14px 32px -12px rgba(20,32,43,.22)",
                opacity: item.leaving ? 0 : 1,
                transform: item.leaving ? "translateX(8px)" : "translateX(0)",
                transition: `opacity ${LEAVE_MS}ms ease, transform ${LEAVE_MS}ms ease`,
                animation: "ip-toast-in .22s cubic-bezier(.2,.8,.2,1)",
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 22, height: 22, borderRadius: 7, flexShrink: 0,
                  display: "grid", placeItems: "center",
                  background: tint, color: accent, marginTop: 1,
                }}
              >
                <Icon style={{ width: 13, height: 13 }} />
              </span>

              <span style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: 2 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: accent, letterSpacing: ".02em" }}>
                  {label}
                </span>
                <span
                  style={{
                    fontSize: 13, lineHeight: 1.65,
                    color: "var(--ink, #14202B)",
                    overflowWrap: "anywhere",
                  }}
                >
                  {item.message}
                </span>
              </span>

              <button
                onClick={() => remove(item.id)}
                aria-label="关闭提示"
                style={{
                  flexShrink: 0, border: "none", background: "transparent", cursor: "pointer",
                  padding: 2, lineHeight: 0, color: "rgba(20,32,43,.38)", marginTop: 1,
                }}
              >
                <X style={{ width: 13, height: 13 }} />
              </button>
            </div>
          );
        })}
      </div>

      {/* 动画写在这儿而不是 globals.css：这个组件要能被任何页面直接用，
          不该再依赖别处有没有定义这个 keyframes。 */}
      <style>{`
        @keyframes ip-toast-in {
          from { opacity: 0; transform: translateX(12px) scale(.98); }
          to   { opacity: 1; transform: translateX(0)   scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          @keyframes ip-toast-in { from { opacity: 0 } to { opacity: 1 } }
        }
      `}</style>
    </Ctx.Provider>
  );
}
