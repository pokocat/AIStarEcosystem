"use client";
// 「AI 图片」：按场景一步出图。规则见 docs/studio-scene-creation.md。
import { Suspense } from "react";
import { SceneImageStudio } from "@/ip/scenes/scene-image-studio";

export default function ImagePage() {
  // 场景页读地址参数（useSearchParams），静态构建要求外面有一层 Suspense。
  return <Suspense fallback={null}><SceneImageStudio /></Suspense>;
}
