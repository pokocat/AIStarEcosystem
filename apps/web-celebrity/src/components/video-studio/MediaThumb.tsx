"use client";

// 一个素材的小方块缩略图（图片显示原图，视频 / 音频显示图标），底下压一条编号（首帧 / 图1 / 音频1…）。
// 生成记录的「输入素材」与模板卡片的「原素材」共用。地址失效时找服务端换新（onExpired）。

import * as React from "react";
import { Film, ImageIcon, Music } from "lucide-react";
import type { VideoStudioMediaType } from "@ai-star-eco/types/video-studio";
import { useStableUrl } from "./use-stable-url";

export interface MediaThumbInput {
  mediaType: VideoStudioMediaType;
  label: string;
  /** 短期签名地址；素材已删除时为 null。 */
  url: string | null;
}

export function MediaThumb({ input, onExpired }: { input: MediaThumbInput; onExpired: () => void }) {
  const [src, markBroken] = useStableUrl(input.url);
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const showImage = input.mediaType === "image" && !!src && src !== failedSrc;
  const Icon = input.mediaType === "audio" ? Music : input.mediaType === "video" ? Film : ImageIcon;
  const tile = (
    <span className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 text-zinc-400">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- 签名地址，不走 next/image 优化
        <img
          src={src ?? undefined}
          alt={input.label}
          className="h-full w-full object-cover"
          onError={() => {
            setFailedSrc(src);
            markBroken();
            onExpired();
          }}
        />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      <span className="absolute inset-x-0 bottom-0 truncate bg-zinc-900/55 px-0.5 text-center text-[9.5px] leading-[14px] text-white">
        {input.label}
      </span>
    </span>
  );
  if (!input.url) {
    return (
      <span className="opacity-60" title={`${input.label}：素材已经删除`}>
        {tile}
      </span>
    );
  }
  // data: 地址（只有演示数据会有）浏览器不让在新标签页打开，就不做成链接
  if (input.url.startsWith("data:")) {
    return <span title={input.label}>{tile}</span>;
  }
  return (
    <a href={input.url} target="_blank" rel="noreferrer" title={`${input.label}，点开看原素材`} className="rounded-md hover:opacity-90">
      {tile}
    </a>
  );
}
