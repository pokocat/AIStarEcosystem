"use client";

// AI 创作 → 视频生成（v0.199）：把视频模型原生的几种生成模式直接开放出来
// （当前对标 MiniMax H3：文生视频 / 首帧生视频 / 首尾帧生视频 / 全能参考）。
// 设计真源：docs/video-studio-plan.md；页面主体在 components/video-studio。

import { VideoStudio } from "@/components/video-studio";

export default function VideoStudioPage() {
  return <VideoStudio />;
}
