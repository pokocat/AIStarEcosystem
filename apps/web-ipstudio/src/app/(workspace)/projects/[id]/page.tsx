// 画布页 —— server 外壳只负责 await params（Next 16：params 是 Promise），
// 真正的画布是客户端组件。

import { CanvasShell } from "@/components/canvas/canvas-shell";

export default async function ProjectCanvasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // 顶栏 52px，剩下的高度全给画布（画布内部自己再分工作栏 / 三栏）
  return (
    <div style={{ height: "calc(100dvh - 52px)" }}>
      <CanvasShell projectId={id} />
    </div>
  );
}
