"use client";
// 「AI 视频」：按场景填信息、放素材，交给画布里的创作助手出方案。规则见 docs/studio-scene-creation.md。
import { Suspense } from "react";
import { SceneVideoStudio } from "@/ip/scenes/scene-video-studio";

export default function VideoPage() {
  // 场景页读地址参数（useSearchParams），静态构建要求外面有一层 Suspense。
  return <Suspense fallback={null}><SceneVideoStudio /></Suspense>;
}
