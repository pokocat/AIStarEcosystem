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
  // 高度交给 CSS 类，不写死也不在这儿算：手机形态没有桌面顶栏，
  // 却照样减 52px 的话，画布下面会空出一条（此前手机进不来画布，所以没露出来）。
  // 见 globals.css 的 .canvas-page（顶栏高度是 token，顶栏改高度这里自动跟着走）。
  return (
    <div className="canvas-page">
      <CanvasGate projectId={id} />
    </div>
  );
}
