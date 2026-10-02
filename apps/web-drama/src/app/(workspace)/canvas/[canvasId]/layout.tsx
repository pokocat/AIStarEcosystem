// 一张画布的外壳（v0.198，docs/drama-canvas-plan.md §6）：竖条 + 顶栏 + CanvasDocProvider / CanvasRunsProvider + CanvasGate。
// 四屏（剧本 / 角色和场景 / 逐集制作 / 单集编辑器）共用一份文档，切步骤不重新加载。
// 全站侧栏 / 顶栏由 (workspace)/layout.tsx 对 /canvas/<id> 收起（沉浸态）。
// Next 16：params 是 Promise，要 await。
import type { ReactNode } from "react";
import { CanvasShell } from "@/canvas/shell/canvas-shell";

export default async function CanvasLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ canvasId: string }>;
}) {
  const { canvasId } = await params;
  return <CanvasShell canvasId={canvasId}>{children}</CanvasShell>;
}
