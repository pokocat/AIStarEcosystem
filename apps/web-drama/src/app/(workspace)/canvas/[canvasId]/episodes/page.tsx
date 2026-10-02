"use client";

// 逐集制作（v0.198，docs/drama-canvas-plan.md §2.5）：每集一张横卡，生成分镜脚本、进单集编辑器、预览 / 下载成片。
// 文档由 [canvasId]/layout.tsx 的 CanvasShell 加载好（CanvasGate 挡住加载中），这里拿到的一定是已加载的文档。
import { EpisodeListView } from "@/canvas/episodes";

export default function CanvasEpisodesPage() {
  return <EpisodeListView />;
}
