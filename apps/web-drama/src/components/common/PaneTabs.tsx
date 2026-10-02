"use client";

// 窄屏两栏切换（v0.197）：桌面上左右并排的两栏（对话 | 分镜、对话 | 大纲），在手机和平板上
// 放不下，改成顶部一个分段按钮、一次只显示一栏。
//
// 这个组件只负责画按钮和报告选中项；「什么宽度下出现、哪一栏隐藏」由页面自己的 CSS 决定
// （src/styles/pages/*.css），组件本身在桌面上用 className 藏起来即可：
//   <PaneTabs className="mk-pane-tabs" ... />   +   .mk-pane-tabs { display: none }
//   @media (max-width: 1024px) { .mk-pane-tabs { display: flex } }
import * as React from "react";

export interface PaneTab<K extends string> {
  key: K;
  label: React.ReactNode;
  /** 右上角小圆点：这一栏有新内容（如大纲刚生成好）但用户还没看 */
  dot?: boolean;
  disabled?: boolean;
}

export interface PaneTabsProps<K extends string> {
  tabs: PaneTab<K>[];
  value: K;
  onChange: (key: K) => void;
  className?: string;
  style?: React.CSSProperties;
  /** 给读屏用的整组名称，如「切换对话和分镜」 */
  ariaLabel?: string;
}

export function PaneTabs<K extends string>({ tabs, value, onChange, className, style, ariaLabel }: PaneTabsProps<K>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={["pane-tabs", className].filter(Boolean).join(" ")}
      style={{
        gap: 4,
        padding: 4,
        borderRadius: 12,
        background: "var(--surface-2)",
        flex: "none",
        ...style,
      }}
    >
      {tabs.map((t) => {
        const active = t.key === value;
        return (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={t.disabled}
            onClick={() => onChange(t.key)}
            style={{
              position: "relative",
              flex: 1,
              minHeight: 36,
              padding: "0 12px",
              border: "none",
              borderRadius: 9,
              background: active ? "var(--surface)" : "transparent",
              boxShadow: active ? "var(--shadow-sm)" : "none",
              color: active ? "var(--ink)" : "var(--ink-3)",
              fontSize: 13,
              fontWeight: active ? 700 : 600,
              cursor: t.disabled ? "not-allowed" : "pointer",
              opacity: t.disabled ? 0.5 : 1,
              whiteSpace: "nowrap",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
            }}
          >
            {t.label}
            {t.dot && !active && (
              <span
                aria-hidden
                style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--accent)", flex: "none" }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
