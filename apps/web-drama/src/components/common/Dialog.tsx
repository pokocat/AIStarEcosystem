"use client";

// Premium 风的 Dialog 容器。直接在原生 dialog 模式上做，避免 next-themes 依赖。
// 提供 <Dialog open onOpenChange title> 接口，类似 shadcn 但更轻。
//
// a11y（v0.67 / D-7）：ESC 关闭 + body 滚动锁 + 打开时焦点移入 + 关闭时焦点还原 +
//   Tab 焦点陷阱（键盘用户不会 Tab 逃到背景）+ aria-labelledby/-describedby 关联标题与描述。
//   设计上不直接换 packages/ui 的 shadcn dialog —— 那套是亮色 token，会破坏 drama 的
//   暗色 premium 玻璃视觉；强化这个共享容器即可让所有调用方一处受益。
//
// v0.197 评审后：面板改成纵向三段 —— 标题 / 中间内容 / 底部按钮栏。只有中间那段滚动，
//   按钮栏始终贴在面板底边。之前整个面板一起滚，内容长的弹窗（如「换封面图」）要先滚到底
//   才点得到主按钮。内容短时中间段就是内容本身的高度（不撑高）；视口矮到连标题 + 按钮栏都
//   放不下时，面板本身仍可滚动。

import * as React from "react";
import { X } from "lucide-react";
import { useModalA11y } from "@/lib/use-modal-a11y";

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  footer?: React.ReactNode;
  width?: number;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  width = 480,
}: Props) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const titleId = React.useId();
  const descId = React.useId();
  // ESC / 焦点陷阱 / 初始 + 还原焦点 / body 锁，统一走共享 hook（见 lib/use-modal-a11y）
  const close = React.useCallback(() => onOpenChange(false), [onOpenChange]);
  useModalA11y(panelRef, close, open);

  if (!open) return null;

  return (
    <div
      onClick={() => onOpenChange(false)}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(8, 6, 14, 0.74)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(12px, 4vw, 24px)",
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: width,
          maxHeight: "90dvh",
          display: "flex",
          flexDirection: "column",
          overflow: "auto",
          background: "var(--bg-1)",
          border: "1px solid var(--line-2)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
          padding: "clamp(20px, 5vw, 26px) clamp(16px, 5vw, 28px)",
          position: "relative",
          color: "var(--fg-0)",
          fontFamily: "var(--font-sans)",
          outline: "none",
        }}
      >
        <button
          onClick={() => onOpenChange(false)}
          aria-label="关闭"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 28,
            height: 28,
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--line)",
            background: "rgba(255,255,255,0.03)",
            color: "var(--fg-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <X size={14} />
        </button>
        <div style={{ marginBottom: 6, flex: "none" }}>
          <h2
            id={titleId}
            style={{
              fontSize: 19,
              fontWeight: 600,
              fontFamily: "var(--font-display)",
              letterSpacing: -0.2,
              margin: 0,
              paddingRight: 32,
            }}
          >
            {title}
          </h2>
        </div>
        {description && (
          <div id={descId} style={{ fontSize: 13, color: "var(--fg-2)", marginBottom: 16, lineHeight: 1.55, flex: "none" }}>
            {description}
          </div>
        )}
        {/* 只有这一段滚动。左右各让出 4px 再用负边距补回，输入框的聚焦描边不会被滚动区裁掉。 */}
        <div
          className="dialog-body"
          style={{
            flex: "1 1 auto",
            minHeight: 0,
            overflowY: "auto",
            overscrollBehavior: "contain",
            margin: `${description ? 0 : 14}px -4px 0`,
            padding: "2px 4px",
          }}
        >
          {children}
        </div>
        {footer && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "flex-end",
              gap: 10,
              flex: "none",
              marginTop: 18,
              paddingTop: 16,
              borderTop: "1px solid var(--line)",
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
