// 画布页 —— server 外壳只负责 await params（Next 16：params 是 Promise）。
// 设备闸与画布本体都在客户端组件里（见 ip/canvas-gate.tsx 的头注释：
// 手机永远不会下载那 15k 行画布的 chunk）。

import { CanvasGate } from "@/ip/canvas-gate";

export default async function ProjectCanvasPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // 顶栏高度是 token，不写死 —— 原来这里是 calc(100dvh - 52px)，
  // 顶栏一改高度画布就会溢出，而且没人会想到来这里改。
  return (
    <div style={{ height: "calc(100dvh - var(--desktop-bar-h, 52px))" }}>
      <CanvasGate projectId={id} />
    </div>
  );
}
