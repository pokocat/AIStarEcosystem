"use client";

// 画布 · 剧本（v0.198，docs/drama-canvas-plan.md §2.3）。外壳（竖条、顶栏、文档 Provider、打开前的闸）在
// [canvasId]/layout.tsx；这里拿到的一定是已加载的文档。页面本体在 canvas/script。
import { ScriptPage } from "@/canvas/script";

export default function CanvasScriptPage() {
  return <ScriptPage />;
}
