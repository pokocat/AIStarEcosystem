"use client";

import * as React from "react";
import type { SocialPlatform } from "@/types/social-account";
import { cn } from "@/lib/utils";
import { PUBLISH_PLATFORM_LABEL } from "@/types/publish-job";

const PLATFORM_ICON_URL: Record<string, string> = {
  douyin: "https://www.douyin.com/favicon.ico",
  kuaishou: "https://www.kuaishou.com/favicon.ico",
  xiaohongshu: "https://www.xiaohongshu.com/favicon.ico",
  shipinhao: "https://channels.weixin.qq.com/favicon.ico",
  bilibili: "https://www.bilibili.com/favicon.ico",
  tiktok: "https://www.tiktok.com/favicon.ico",
  youtube: "https://www.youtube.com/favicon.ico",
  baijiahao: "https://baijiahao.baidu.com/favicon.ico",
};

const PLATFORM_FALLBACK_CLASS: Record<string, string> = {
  douyin: "bg-zinc-950 text-white",
  kuaishou: "bg-orange-500 text-white",
  xiaohongshu: "bg-red-500 text-white",
  shipinhao: "bg-emerald-500 text-white",
  bilibili: "bg-sky-500 text-white",
  tiktok: "bg-zinc-950 text-white",
  youtube: "bg-red-600 text-white",
  baijiahao: "bg-blue-600 text-white",
};

interface Props {
  platform: SocialPlatform | string;
  className?: string;
}

export function SocialPlatformLogo({ platform, className }: Props) {
  const [failed, setFailed] = React.useState(false);
  const label = (PUBLISH_PLATFORM_LABEL as Record<string, string>)[platform] ?? platform;
  const src = PLATFORM_ICON_URL[platform];

  React.useEffect(() => {
    setFailed(false);
  }, [platform, src]);

  return (
    <span
      className={cn(
        "inline-grid h-5 w-5 shrink-0 place-items-center overflow-hidden rounded-full border bg-white text-[10px] shadow-sm",
        className,
      )}
      title={label}
      aria-label={label}
    >
      {src && !failed ? (
        <img
          src={src}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
        />
      ) : (
        <span
          className={cn(
            "grid h-full w-full place-items-center font-semibold",
            PLATFORM_FALLBACK_CLASS[platform] ?? "bg-muted text-muted-foreground",
          )}
        >
          {label.slice(0, 1)}
        </span>
      )}
    </span>
  );
}
