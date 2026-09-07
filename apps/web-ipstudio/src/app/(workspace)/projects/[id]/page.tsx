// 画布页 —— server 外壳只负责 await params（Next 16：params 是 Promise），
// 画布本体是客户端组件。

import { CanvasHost } from "@/components/canvas-host";

export default async function ProjectCanvasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // 顶栏 52px，剩下的高度全给画布
  return (
    <div style={{ height: "calc(100dvh - 52px)" }}>
      <CanvasHost projectId={id} />
    </div>
  );
}
