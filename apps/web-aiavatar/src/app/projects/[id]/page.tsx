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
  // 预览与个人画布统一占满浏览器内容区。网站导航由 AppChrome 排除，
  // 这里只保留画布自己的工具栏；设备提示和登录闸仍由 CanvasGate 管理。
  return (
    <div className="canvas-page">
      <CanvasGate projectId={id} />
    </div>
  );
}
