"use client";

import * as React from "react";
import { Download } from "lucide-react";
import type { AiAvatarAsset } from "@ai-star-eco/types/ai-avatar";
import { AssetTile } from "@/components/common/asset-tile";
import { fileSize, dateTime } from "@/lib/format";
import { ModelViewer } from "@/components/common/model-viewer";

/** 图集 / 3D / 视频 Tab：网格 + 选中查看（3D 可旋转，视频运镜预览）。 */
export function AssetsTab({ assets, empty, ratio = "portrait" }: {
  assets: AiAvatarAsset[]; empty?: string; ratio?: "portrait" | "square";
}) {
  const [sel, setSel] = React.useState<AiAvatarAsset | null>(null);
  React.useEffect(() => { setSel(assets[0] ?? null); }, [assets]);

  if (assets.length === 0) {
    return <div className="rounded-xl border border-dashed border-zinc-700 py-14 text-center text-sm text-zinc-500">{empty ?? "尚无资产"}</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
      {/* 网格 */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
        {assets.map((a) => (
          <AssetTile key={a.id} asset={a} ratio={ratio} selected={sel?.id === a.id} onClick={() => setSel(a)} />
        ))}
      </div>

      {/* 详情面板 */}
      {sel && (
        <aside className="space-y-3 rounded-xl border border-zinc-800 bg-[var(--bg-1)] p-3">
          {sel.kind === "model_3d" ? (
            <ModelViewer thumbnailUrl={sel.thumbnailUrl} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={sel.fileUrl} alt={sel.kind} className={sel.kind === "video" ? "w-full rounded-lg aiavatar-kenburns" : "w-full rounded-lg"} />
          )}
          <dl className="space-y-1.5 text-xs">
            <Row k="类型" v={sel.kind} />
            {sel.standardShot && <Row k="构图" v={sel.standardShot} />}
            {(sel.width > 0) && <Row k="尺寸" v={`${sel.width}×${sel.height}`} />}
            {sel.format3d && <Row k="格式" v={sel.format3d} />}
            {sel.durationSec > 0 && <Row k="时长" v={`${Math.round(sel.durationSec)}s`} />}
            <Row k="大小" v={fileSize(sel.fileSize)} />
            <Row k="来源" v={sel.engine ?? "MOCK"} />
            <Row k="生成" v={dateTime(sel.createdAt)} />
          </dl>
          <a href={sel.fileUrl} download
            className="flex items-center justify-center gap-1.5 rounded-lg border border-zinc-700 py-2 text-sm text-zinc-200 hover:border-zinc-500">
            <Download className="h-4 w-4" /> 下载{sel.kind === "model_3d" ? " GLB" : ""}
          </a>
        </aside>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-zinc-500">{k}</dt>
      <dd className="font-mono text-zinc-300">{v}</dd>
    </div>
  );
}
