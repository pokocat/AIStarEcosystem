"use client";

/* ======== ArtistAvatar ========
   新创建的艺人 avatar 字段为空字符串，<img src=""> 会触发浏览器重新拉取整页
   并打印 Next dev warning。统一在缺图时回落为带姓名首字的占位块。

   size:
     - 数字：固定方形像素尺寸（如 32 / 56 / 96）
     - "full"：跟随父容器尺寸（用于 w-* h-* 包裹器内的填充场景） */

import React from "react";

interface ArtistLike {
  avatar?: string | null;
  name?: string | null;
  /** AiAvatar 数字人首要展示图（v0.60 收敛，优先于 avatar） */
  dapDisplayImageUrl?: string | null;
}

interface ArtistAvatarProps {
  artist: ArtistLike;
  size: number | "full";
  className?: string;
  alt?: string;
}

export function ArtistAvatar({ artist, size, className = "", alt }: ArtistAvatarProps) {
  const isFull = size === "full";
  const sizeStyle = isFull ? undefined : { width: size, height: size };
  const sizeClass = isFull ? "w-full h-full" : "";
  const name = artist.name ?? "";
  const altText = alt ?? name;

  const imageSrc = artist.dapDisplayImageUrl || artist.avatar;
  if (imageSrc) {
    return (
      <img
        src={imageSrc}
        alt={altText}
        style={sizeStyle}
        className={`${sizeClass} object-cover ${className}`.trim()}
      />
    );
  }

  const glyph = name.slice(0, 1) || "?";
  const fontSize = isFull ? undefined : Math.max(11, Math.round((size as number) * 0.4));
  return (
    <div
      style={{ ...sizeStyle, ...(fontSize ? { fontSize } : {}) }}
      className={`${sizeClass} flex items-center justify-center bg-secondary text-muted-foreground font-medium select-none ${
        isFull ? "text-3xl" : ""
      } ${className}`.trim()}
      aria-label={altText || undefined}
      role="img"
    >
      {glyph}
    </div>
  );
}

export default ArtistAvatar;
