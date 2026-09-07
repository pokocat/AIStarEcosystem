"use client";

// landing 的作品图集裁切器。
//
// 所有 landing 用图都在同一张图集里：**4 列 × 3 行、等格无间距、每格 1:1**。
// 这里不做任何图像处理，只用 background-size / background-position 把某一格显示出来。
//
// 图集是真实生成的作品图，不是占位。禁止用 SVG / 色块顶替（AGENTS.md §8.0）：
// 图取不到时应当露出灰底而不是伪造一张「示意图」。

import * as React from "react";

/**
 * 图集地址 —— **生产真源是 OSS 上的这个绝对地址**（AGENTS.md §4.7：资产存 OSS，仓库不放）。
 *
 * 因此 fresh clone 不需要任何本地图片就能完整跑起来。仓库里的
 * `public/landing/character-atlas.png` 只是**可选的开发回退与设计留档**，已 gitignore，
 * 且**不会被自动使用** —— 想在本地用那份，就临时把这个常量改成
 * `/landing/character-atlas.png`（没有做任何自动 fallback，别指望框架帮忙兜）。
 *
 * 换图：按同样的 4×3 网格重新导出，发一份新版本号的 OSS 对象，然后改这一行。
 */
export const ATLAS_SRC =
  "https://aiartist.oss-cn-hangzhou.aliyuncs.com/media/ipstudio/landing/character-atlas-v1.png";
export const ATLAS_COLS = 4;
export const ATLAS_ROWS = 3;

/** 图集格位（0 起，行优先）→ 内容说明。说明同时用作 aria-label 的素材。 */
export const ATLAS_FRAMES = {
  mainLook: { index: 0, alt: "IP 角色主造型：蓝色外套配黄色 T 恤与米白长裤的全身形象" },
  outdoor: { index: 1, alt: "IP 角色户外造型：军绿工装、遮阳帽与背包，手持相机" },
  suit: { index: 2, alt: "IP 角色通勤造型：米白西装外套内搭蓝色上衣的全身形象" },
  smile: { index: 3, alt: "IP 角色表情：微笑" },
  laugh: { index: 4, alt: "IP 角色表情：放声大笑" },
  surprised: { index: 5, alt: "IP 角色表情：惊讶" },
  serious: { index: 6, alt: "IP 角色表情：认真" },
  card: { index: 7, alt: "场景示意：印着 IP 角色的个人商务名片摆在桌面上" },
  drama: { index: 8, alt: "场景示意：IP 角色在咖啡馆里与人对坐交谈的短剧画面" },
  goods: { index: 9, alt: "场景示意：IP 角色手持护肤瓶做产品讲解" },
  brand: { index: 10, alt: "场景示意：印着 IP 角色的帆布袋与礼盒等联名周边" },
  /** 备用格：当前页面未使用（原「关于」段已按评审要求删除），保留登记便于换图时对位 */
  wave: { index: 11, alt: "IP 角色抬手打招呼的半身形象" },
} as const;

export type AtlasFrameKey = keyof typeof ATLAS_FRAMES;

/** 某一格的背景定位样式（列 = index % 4，行 = index / 4）。 */
export function atlasStyle(index: number): React.CSSProperties {
  const col = index % ATLAS_COLS;
  const row = Math.floor(index / ATLAS_COLS);
  return {
    backgroundImage: `url(${ATLAS_SRC})`,
    backgroundSize: `${ATLAS_COLS * 100}% ${ATLAS_ROWS * 100}%`,
    backgroundPosition: `${(col / (ATLAS_COLS - 1)) * 100}% ${(row / (ATLAS_ROWS - 1)) * 100}%`,
  };
}

interface AtlasFrameProps {
  frame: AtlasFrameKey;
  /** 追加到裁切容器上的类（圆角、尺寸由调用方给；宽高比固定 1:1） */
  className?: string;
  style?: React.CSSProperties;
  /** 覆盖默认说明（仍会进 aria-label） */
  alt?: string;
}

/**
 * 一格作品图。用 div + background 而不是 <img>，是因为要按格裁切；
 * 因此必须自己补 `role="img"` + `aria-label`，读屏才念得出来。
 */
export function AtlasFrame({ frame, className = "", style, alt }: AtlasFrameProps) {
  const meta = ATLAS_FRAMES[frame];
  return (
    <div
      role="img"
      aria-label={alt ?? meta.alt}
      className={`atlas-cell ${className}`}
      style={{ ...atlasStyle(meta.index), ...style }}
    />
  );
}

interface AtlasPortraitProps extends AtlasFrameProps {
  /** 外框宽高比（竖幅）。默认 3:4。 */
  ratio?: string;
}

/**
 * 竖幅裁切。
 *
 * 图集每格都是 **1:1**，但 landing 的人物卡是竖幅。做法是：外框按 `ratio` 立起来并
 * `overflow:hidden`，里面那一格**仍然保持 1:1**、按外框高度铺满、水平居中 —— 于是被裁掉的
 * 只有人物左右两侧的空白，**头脚完整、比例不拉伸、也不会跨到相邻格**。
 * 千万不要改成把 background-size 拉成竖幅（那会把图集撑变形并露出邻格）。
 */
export function AtlasPortrait({ frame, ratio = "3 / 4", className = "", style, alt }: AtlasPortraitProps) {
  const meta = ATLAS_FRAMES[frame];
  return (
    <div
      role="img"
      aria-label={alt ?? meta.alt}
      className={`relative overflow-hidden ${className}`}
      style={{ aspectRatio: ratio, background: "var(--surface-3)", ...style }}
    >
      <div
        aria-hidden
        className="absolute inset-y-0 left-1/2 -translate-x-1/2 h-full"
        style={{ aspectRatio: "1 / 1", backgroundRepeat: "no-repeat", ...atlasStyle(meta.index) }}
      />
    </div>
  );
}
