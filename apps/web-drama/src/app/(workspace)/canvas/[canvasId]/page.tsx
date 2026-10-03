"use client";

// /canvas/<id>：按文档停在哪一步跳过去（没拆过角色场景 → 剧本；还没有任何片段 → 角色和场景；否则逐集制作）。
// 外壳的 CanvasGate 在加载完成前只画骨架，所以这里拿到的一定是已加载的文档。
import * as React from "react";
import { useRouter } from "next/navigation";
import { canvasStep, useCanvasDoc } from "@/canvas/core";

export default function CanvasIndexPage() {
  const router = useRouter();
  const { canvasId, doc, status } = useCanvasDoc();
  React.useEffect(() => {
    if (status !== "ready" && status !== "stale") return;
    router.replace(`/canvas/${encodeURIComponent(canvasId)}/${canvasStep(doc)}`);
    // 只在打开时跳一次；之后文档变化不再跳
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, canvasId]);
  return (
    <div className="cv-page">
      <div className="cv-hint">正在打开…</div>
    </div>
  );
}
