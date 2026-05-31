"use client";

import * as React from "react";
import { cn } from "@ai-star-eco/ui/ui/utils";

/**
 * 图片加载失败时优雅降级为 .ph 占位（深色琥珀斜纹），不显示浏览器破图标。
 * 用于封面 / 资产缩略 —— mock 用 /samples/*.svg 与上传的 dataURL，live 用 /static 资产。
 */
export function SafeImg({
  src, alt, className, imgClassName,
}: {
  src?: string | null; alt?: string; className?: string; imgClassName?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => { setFailed(false); }, [src]);

  if (!src || src.startsWith("#") || failed) {
    return <div className={cn("ph", className)} aria-label={alt} />;
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt ?? ""}
      loading="lazy"
      onError={() => setFailed(true)}
      className={cn(imgClassName, className)}
    />
  );
}
