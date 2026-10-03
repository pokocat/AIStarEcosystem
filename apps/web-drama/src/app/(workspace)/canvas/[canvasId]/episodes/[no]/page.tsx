"use client";

// 单集编辑器（v0.198，docs/drama-canvas-plan.md §2.6）：按片段出首帧和视频，合成成片。
// Next 16：params 是 Promise，客户端组件用 React.use() 取。集号不是正整数时编辑器自己显示「剧本里没有这一集」。
import * as React from "react";
import { EpisodeEditor } from "@/canvas/episodes";

export default function CanvasEpisodeEditorPage({ params }: { params: Promise<{ canvasId: string; no: string }> }) {
  const { no } = React.use(params);
  const n = /^\d+$/.test(no) ? Number(no) : NaN;
  return <EpisodeEditor key={no} no={n} />;
}
