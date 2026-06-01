"use client";

import * as React from "react";
import { RotateCw } from "lucide-react";

/**
 * 3D 可交互预览（任务书 §7：3D 可旋转）。
 * 不引入 three.js：用纯 CSS 3D transform 渲染可拖拽旋转的立方体，六面贴海报缩略图。
 * 接 TripoSR 真模型后可换 <model-viewer> web component。
 */
export function ModelViewer({ thumbnailUrl }: { thumbnailUrl?: string | null }) {
  const [rot, setRot] = React.useState({ x: -18, y: 24 });
  const drag = React.useRef<{ x: number; y: number } | null>(null);
  const [auto, setAuto] = React.useState(true);

  React.useEffect(() => {
    if (!auto) return;
    const t = setInterval(() => setRot((r) => ({ ...r, y: r.y + 0.6 })), 40);
    return () => clearInterval(t);
  }, [auto]);

  const hasImg = !!thumbnailUrl && !thumbnailUrl.startsWith("#");
  const face = (transform: string): React.CSSProperties => ({
    position: "absolute", width: 140, height: 140, transform,
    backgroundImage: hasImg ? `url(${thumbnailUrl})` : undefined,
    backgroundColor: "var(--bg-3)", backgroundSize: "cover", backgroundPosition: "center",
    border: "1px solid var(--brand-line)", borderRadius: 8, opacity: 0.94,
  });

  return (
    <div className="relative">
      <div
        className="flex h-56 cursor-grab items-center justify-center overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--bg-2)] active:cursor-grabbing"
        style={{ perspective: "700px" }}
        onPointerDown={(e) => { drag.current = { x: e.clientX, y: e.clientY }; setAuto(false); }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
          setRot((r) => ({ x: r.x - dy * 0.5, y: r.y + dx * 0.5 }));
          drag.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => { drag.current = null; }}
        onPointerLeave={() => { drag.current = null; }}
      >
        <div style={{ transformStyle: "preserve-3d", transform: `rotateX(${rot.x}deg) rotateY(${rot.y}deg)`, position: "relative", width: 140, height: 140 }}>
          <div style={face("rotateY(0deg) translateZ(70px)")} />
          <div style={face("rotateY(90deg) translateZ(70px)")} />
          <div style={face("rotateY(180deg) translateZ(70px)")} />
          <div style={face("rotateY(-90deg) translateZ(70px)")} />
          <div style={face("rotateX(90deg) translateZ(70px)")} />
          <div style={face("rotateX(-90deg) translateZ(70px)")} />
        </div>
      </div>
      <button onClick={() => setAuto((a) => !a)}
        className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/45 px-2 py-1 text-[11px] text-white backdrop-blur-sm hover:bg-black/60">
        <RotateCw className="h-3 w-3" /> {auto ? "暂停" : "自转"}
      </button>
      <p className="meta mt-1.5 text-center">拖拽旋转 · GLB 可下载到 model-viewer / three.js 查看</p>
    </div>
  );
}
