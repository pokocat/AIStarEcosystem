"use client";

// useModalA11y — 弹层无障碍行为的单一来源（v0.67 / D-7）。
// 给任意「自渲染遮罩」的弹层补齐键盘 / 读屏可用性，被 common/Dialog 与
// common/ModalShell 共用，避免每个弹层各写一份（且常漏写）。
//
// 覆盖：ESC 关闭 · body 滚动锁 · 打开时焦点移入弹层 · 关闭时焦点还原到触发元素 ·
//      Tab / Shift+Tab 焦点陷阱（不让键盘焦点逃到背景内容）。
//
// onClose 经 ref 透传，effect 仅在 enabled 翻转时重跑 —— 父组件普通重渲染
// 不会打断用户正在进行的输入 / 焦点。

import * as React from "react";

// 弹窗栈（模块级）：多个弹层叠加时（如全屏分镜表内又弹全局二次确认），Esc / Tab 焦点陷阱
// 只允许「栈顶」实例响应 —— 否则每个启用实例都在 document 挂 keydown，一次 Esc 会关掉所有叠层，
// 焦点陷阱也互相抢焦点。启用时 push 本次 effect 的唯一标识，清理时移除；非栈顶实例的处理直接 return。
// 单弹窗场景栈内仅一个元素，isTop 恒真，行为与改造前完全一致。
const modalStack: symbol[] = [];

/** 取容器内当前可聚焦元素（焦点陷阱 + 初始聚焦用）。 */
export function focusableWithin(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ),
  ).filter((el) => el.offsetParent !== null || el === document.activeElement);
}

export function useModalA11y(
  panelRef: React.RefObject<HTMLElement | null>,
  onClose: () => void,
  enabled = true,
): void {
  const onCloseRef = React.useRef(onClose);
  onCloseRef.current = onClose;

  React.useEffect(() => {
    if (!enabled) return;
    // 本次启用在弹窗栈中的唯一标识 —— 用于「仅栈顶实例响应键盘」的圈定。
    const token = Symbol("modal-a11y");
    modalStack.push(token);
    const isTop = () => modalStack[modalStack.length - 1] === token;

    const panel = panelRef.current;
    // 打开前记住触发元素，关闭后还原焦点（避免焦点丢回 <body>）
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const onKey = (e: KeyboardEvent) => {
      // 非栈顶弹层不响应 Esc / Tab（只作用于最上层叠加弹窗）。
      if (!isTop()) return;
      if (e.key === "Escape") {
        onCloseRef.current();
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const items = focusableWithin(panelRef.current);
        if (items.length === 0) {
          e.preventDefault();
          panelRef.current.focus();
          return;
        }
        const first = items[0];
        const last = items[items.length - 1];
        const active = document.activeElement as HTMLElement | null;
        if (e.shiftKey && (active === first || !panelRef.current.contains(active))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // 初始焦点移入弹层（优先首个可聚焦控件，否则面板自身）
    if (panel) {
      const items = focusableWithin(panel);
      (items[0] ?? panel).focus();
    }

    return () => {
      document.removeEventListener("keydown", onKey);
      const idx = modalStack.lastIndexOf(token);
      if (idx !== -1) modalStack.splice(idx, 1);
      document.body.style.overflow = prevOverflow;
      if (previouslyFocused && document.contains(previouslyFocused)) {
        previouslyFocused.focus();
      }
    };
  }, [enabled, panelRef]);
}
