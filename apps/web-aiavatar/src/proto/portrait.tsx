"use client";
import React from "react";

// ============================================================
// Portrait — 数字人本体「占位图」
//   不再程序化绘制卡通脸；统一渲染为干净的头像占位（柔和色底 + 剪影）
//   按角色 hue 取不同柔和色调，多角度 variant 略作偏转区分。
//   保持原有 props 接口，所有调用处无需改动。
// ============================================================
const RCE : any = React.createElement;

function Portrait({ char = {}, variant = 'key', ratio = '3 / 4', radius = 0, expr = 'calm',
                    showName, dim, badge, className, style, onClick }: any) {
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
    // 柔和装饰光环
    RCE('div', { style: { position: 'absolute', width: '56%', aspectRatio: '1', top: '13%',
      borderRadius: '50%', border: `1px solid ${ring}`, opacity: .55 } }),
    RCE('div', { style: { position: 'absolute', width: '78%', aspectRatio: '1', top: '4%',
      borderRadius: '50%', border: `1px solid ${ring}`, opacity: .3 } }),
    // 人物剪影占位
    RCE('svg', { viewBox: '0 0 64 64', style: { width: '44%', position: 'relative',
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
