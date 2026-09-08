"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 宿主往画布顶栏里放东西的插槽。
//
// 「保存状态」和「发布」是本仓加的，不属于搬来的画布。v0.159 把它们做成绝对定位
// 浮在画布右上角 —— 结果直接压在画布自己的「配置 / 快捷键 / Agent」上面，
// 那三个按钮点不到。浮层永远猜不准下面有什么，所以改成进同一行由 flex 排。
//
// 用 zustand 而不是 React context：画布顶栏在 src/canvas 深处，
// 从 CanvasHost 一路把 props 传下去要动一串上游文件，日后跟上游合并全是冲突。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { create } from "zustand";

type HostActionsStore = {
  node: React.ReactNode | null;
  setNode: (node: React.ReactNode | null) => void;
};

const useHostActionsStore = create<HostActionsStore>((set) => ({
  node: null,
  setNode: (node) => set({ node }),
}));

/** 画布顶栏里的落点。没内容时什么也不渲染（连间距都不占）。 */
export function HostActionsSlot() {
  const node = useHostActionsStore((s) => s.node);
  if (!node) return null;
  return <div className="flex items-center gap-2">{node}</div>;
}

/** 宿主侧：把一段 UI 放进画布顶栏，组件卸载时自动撤走。 */
export function useHostActions(node: React.ReactNode) {
  const setNode = useHostActionsStore((s) => s.setNode);
  React.useEffect(() => {
    setNode(node);
    return () => setNode(null);
  }, [node, setNode]);
}
