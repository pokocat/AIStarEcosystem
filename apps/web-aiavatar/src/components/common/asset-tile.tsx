"use client";

import * as React from "react";
import type { AiAvatarAsset } from "@ai-star-eco/types/ai-avatar";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { SourceBadge } from "./source-badge";
import { STANDARD_SHOT_LABEL } from "@/constants/aiavatar-ui";

/**
 * 资产缩略瓦片：图/草稿图显示图片；视频显示海报 + 运镜 ken-burns；3D 显示可旋转预览入口。
 * fileUrl 以 data: 或 /static 提供；缺失走 .ph 占位。
 */
export function AssetTile({
  asset, selected, onClick, className, ratio = "portrait",
}: {
  asset: AiAvatarAsset; selected?: boolean; onClick?: () => void; className?: string; ratio?: "portrait" | "square";
}) {
  const url = asset.thumbnailUrl || asset.fileUrl;
  const isVideo = asset.kind === "video";
  const is3d = asset.kind === "model_3d";
  const showImg = !!url && !url.startsWith("#");

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative w-full overflow-hidden rounded-lg border text-left transition",
        ratio === "portrait" ? "aspect-[3/4]" : "aspect-square",
        selected
          ? "border-[var(--brand)] ring-2 ring-[var(--brand-soft)]"
          : "border-[var(--line)] hover:border-[var(--line-strong)]",
        !showImg && "ph",
        className,
      )}
    >
      {showImg ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={asset.kind}
          className={cn("h-full w-full object-cover", isVideo && "aiavatar-kenburns")}
          loading="lazy"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <span className="num text-[10px] text-[var(--fg-3)]">{is3d ? "GLB 3D" : "无预览"}</span>
        </div>
      )}

      {/* 顶部角标：来源 + 构图（覆盖在照片上，用深色 scrim 保持可读，与主题无关）*/}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-1.5">
        <SourceBadge engine={asset.engine} mode={asset.providerMode} />
        {asset.standardShot && (
          <span className="rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
            {STANDARD_SHOT_LABEL[asset.standardShot]}
          </span>
        )}
      </div>

      {/* 底部：视频时长 / 3D 标记 */}
      {(isVideo || is3d) && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-black/70 to-transparent p-1.5">
          <span className="num text-[10px] text-white">
            {isVideo ? `▶ ${Math.round(asset.durationSec)}s 运镜` : "⬣ 可旋转 3D"}
          </span>
        </div>
      )}
    </button>
  );
}
