"use client";
import React from "react";

// ============================================================
// Portrait — 数字人形象图
//   优先级：显式 src > 按 variant 映射的标准图集 > 定妆主图 imageUrl > 占位画像。
//   占位画像 = 柔和色底 + 剪影（真实图片生成前 / mock 数据）。
//   保持原有 props 接口，所有调用处无需改动。
// ============================================================
const RCE : any = React.createElement;

/** Portrait variant → 标准图集 shotKey 映射（live 模式多角度真实图）。 */
const VARIANT_SHOT: Record<string, string> = {
  key: "front-half",
  front: "front-full",
  side: "left",
  threeq: "right",
  look: "expr",
};

function realSrcFor(char: any, variant: string, src?: string): string | null {
  if (src) return src;
  if (!char) return null;
  const shots = char.shotImages;
  if (shots && typeof shots === "object") {
    const mapped = shots[VARIANT_SHOT[variant] || ""];
    if (mapped) return mapped;
  }
  if (char.imageUrl) return char.imageUrl;
  // 尚未挑选定妆图（proofing 待挑选）→ 用候选图做预览，避免“生成完了却看不到图”
  const variants = char.variantImages;
  if (Array.isArray(variants) && variants.length) {
    const idx = { key: 0, front: 0, threeq: 1, side: 2, look: 3 }[variant] ?? 0;
    return variants[Math.min(idx, variants.length - 1)] || variants[0];
  }
  return null;
}

function Portrait({ char = {}, variant = 'key', ratio = '3 / 4', radius = 0, expr = 'calm',
                    showName, dim, badge, className, style, src, imgFit = 'cover', onClick }: any) {
  const real = realSrcFor(char, variant, src);
  const hue = (char.hue != null ? char.hue : 250);
  const bg1  = `hsl(${hue} 20% 94%)`;
  const bg2  = `hsl(${hue} 18% 86%)`;
  const fg   = `hsl(${hue} 14% 64%)`;
  const ring = `hsl(${hue} 16% 80%)`;
  // 多角度：轻微偏转 / 镜像，区分 正面 / 侧面 / 四分之三 / 回眸
  const turn = { key: 0, front: 0, side: -13, threeq: -7, back: 0, look: 8 }[variant] || 0;
  const flip = variant === 'side' ? ' scaleX(.92)' : '';

  return RCE('div', { className, onClick, style: {
      position: 'relative', aspectRatio: ratio, borderRadius: radius, overflow: 'hidden',
      cursor: onClick ? 'pointer' : 'default', display: 'grid', placeItems: 'center',
      background: `linear-gradient(155deg, ${bg1}, ${bg2})`, ...style } },
    // 真实图片（生成后）
    real && RCE('img', { src: real, alt: char.name || '', loading: 'lazy', draggable: false, style: {
      position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: imgFit, display: 'block' } }),
    // 占位画像（无真实图时）
    !real && RCE('div', { style: { position: 'absolute', width: '56%', aspectRatio: '1', top: '13%',
      borderRadius: '50%', border: `1px solid ${ring}`, opacity: .55 } }),
    !real && RCE('div', { style: { position: 'absolute', width: '78%', aspectRatio: '1', top: '4%',
      borderRadius: '50%', border: `1px solid ${ring}`, opacity: .3 } }),
    !real && RCE('svg', { viewBox: '0 0 64 64', style: { width: '44%', position: 'relative',
        transform: `rotate(${turn}deg)${flip}`, color: fg } },
      RCE('circle', { cx: 32, cy: 22.5, r: 12.5, fill: 'currentColor' }),
      RCE('path', { d: 'M9 60c0-13.2 10.3-21 23-21s23 7.8 23 21z', fill: 'currentColor' })),
    dim && RCE('div', { style: { position: 'absolute', inset: 0, background: 'rgba(40,40,55,.3)' } }),
    badge && RCE('div', { style: { position: 'absolute', top: 10, left: 10, display: 'flex', gap: 6 } }, badge),
    showName && RCE('div', { style: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: '24px 14px 12px',
        background: 'linear-gradient(transparent, rgba(20,16,30,.6))', color: '#fff' } },
      RCE('div', { style: { fontWeight: 700, fontSize: 16, letterSpacing: '-.01em' } }, char.name),
      char.codename && RCE('div', { className: 'mono', style: { fontSize: 10.5, opacity: .85, marginTop: 2 } }, char.codename)));
}

export { Portrait };
