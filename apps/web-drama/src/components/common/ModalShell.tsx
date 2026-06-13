"use client";

// ModalShell — 命令式弹层的无障碍遮罩容器（v0.67 / D-7）。
// 给「父组件条件渲染 + onClose 命令式」这类弹层（短剧切片 / 快速开剧 / 预览等）
// 提供统一的 .overlay 遮罩 + role=dialog + 焦点陷阱 + ESC + 焦点还原，
// 替代各自手写的裸 `<div className="overlay" onClick={onClose}>`（普遍漏 a11y）。
//
// 用法：把原来的
//   <div className="overlay" onClick={onClose}>
//     <div className="card pop-in col" style={…} onClick={stopPropagation}>…</div>
//   </div>
// 换成
//   <ModalShell onClose={onClose} label="弹层标题" className="card pop-in col" style={…}>…</ModalShell>

import * as React from "react";
import { useModalA11y } from "@/lib/use-modal-a11y";

interface Props {
  onClose: () => void;
  /** 读屏标题（aria-label）。弹层内已有可见标题文本时传同一字符串即可。 */
  label: string;
  /** 面板容器 class（沿用各 modal 原有的 card / pop-in / col 等）。 */
  className?: string;
  style?: React.CSSProperties;
  /** 遮罩层 z-index（个别弹层需压过其它浮层，如 preview 用 90）。 */
  overlayZIndex?: number;
  children?: React.ReactNode;
}

export function ModalShell({ onClose, label, className, style, overlayZIndex, children }: Props) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  useModalA11y(panelRef, onClose, true);

  return (
    <div
      className="overlay"
      onClick={onClose}
      style={overlayZIndex != null ? { zIndex: overlayZIndex } : undefined}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={className}
        style={style}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
