"use client";

// 渐变缩略图 — 竖屏 9:16 / 横屏 16:9 / 16:7 类型卡 等场景的视觉主角。
// 视觉真源：styles.css `.thumb` + `.thumb-stripes` + `.thumb-label`。
import * as React from "react";

export interface ThumbProps {
  from: string;
  to: string;
  /** 真实画面 URL（如分镜首帧）。设置后覆盖渐变背景，cover 填充。 */
  src?: string;
  /** 默认 "9/16" 竖屏；可写 "16/9" "16/10" "16/7" "3/2" "3/4" 等 */
  ratio?: string;
  w?: number | string;
  h?: number | string;
  radius?: number | string;
  /** 右下角条带纹理，默认 true（关键画面更"有质感"） */
  stripes?: boolean;
  /** 右上角浮签（默认渲染居中） */
  label?: React.ReactNode;
  children?: React.ReactNode;
  style?: React.CSSProperties;
  className?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  title?: string;
}

export function Thumb({
  from,
  to,
  src,
  ratio = "9/16",
  w,
  h,
  radius,
  stripes = true,
  label,
  children,
  style,
  className,
  onClick,
  title,
}: ThumbProps) {
  return (
    <div
      onClick={onClick}
      title={title}
      className={["thumb", stripes && !src ? "thumb-stripes" : "", className].filter(Boolean).join(" ")}
      style={{
        aspectRatio: w ? undefined : ratio,
        width: w,
        height: h,
        borderRadius: radius,
        background: src
          ? `url(${JSON.stringify(src)}) center/cover no-repeat, linear-gradient(150deg, ${from}, ${to})`
          : `linear-gradient(150deg, ${from}, ${to})`,
        ...style,
      }}
    >
      {label != null && <span className="thumb-label">{label}</span>}
      {children}
    </div>
  );
}
