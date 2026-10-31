import { Suspense } from "react";
import { StudioShell } from "@/components/studio-shell";
import { StudioScenes } from "@/components/studio-scenes";

/** 运营配置 · 场景模板：AI 图片、AI 视频两页的场景（docs/studio-scene-creation.md §9）。 */
export default function ScenesPage() {
  return (
    <Suspense fallback={<div className="min-h-svh bg-[#f4f6fb]" />}>
      <StudioShell page="scenes">
        <StudioScenes />
      </StudioShell>
    </Suspense>
  );
}
