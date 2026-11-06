"use client";
// 看大图（导演台、场景页共用，原来在 director-shared 的 ZoomableImage 里，2026-11-01 拆出来给 AI 视频编辑框里的图片标签用）。
// 用 antd 的图片预览（画布那边也是它）：滚轮、触控板、双指都能缩放，放大后拖动看各处，松手时图会弹回窗口里；
// 双击在放大和适应窗口之间切换，底部有缩小、放大和「适应窗口」，右上角关闭，点图外的暗处也关闭。
// - Esc 在捕获阶段截下，只关大图，不连带关掉外面的抽屉或弹窗（它们也在 window 上听 Esc）。
// - 触控板捏合是带 ctrlKey 的滚轮，React 的 onWheel 是被动监听拦不住，不在这里拦就会连整页一起缩放。
// 样式在 director.css（.director-image-preview / .director-preview-tools，全站都引了）。
import { useEffect } from "react";
import { Image } from "antd";
import { X, ZoomIn, ZoomOut } from "lucide-react";

/** 大图最多放大到「适应窗口」的 6 倍：资产图、分镜宫格约 2K，再大只是糊的像素。 */
export const PREVIEW_MAX_SCALE = 6;

/** 受控的大图：open 为 true 时显示 src，关掉时调 onClose。每次打开都从适应窗口开始。 */
export function ImageLightbox({ src, alt, open, onClose }: { src: string; alt: string; open: boolean; onClose: () => void }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopImmediatePropagation(); e.preventDefault(); onClose(); } };
    const onWheel = (e: WheelEvent) => { if (e.ctrlKey && e.target instanceof Element && e.target.closest(".director-image-preview")) e.preventDefault(); };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => { window.removeEventListener("keydown", onKey, true); window.removeEventListener("wheel", onWheel, true); };
  }, [open, onClose]);
  return <Image.PreviewGroup items={[{ src, alt }]} classNames={{ popup: { root: "director-image-preview" } }}
    preview={{
      open, onOpenChange: next => { if (!next) onClose(); }, zIndex: 1100, minScale: 1, maxScale: PREVIEW_MAX_SCALE,
      closeIcon: <><X size={20} aria-hidden/><span className="director-visually-hidden">关闭大图</span></>,
      actionsRender: (_, { transform, actions }) => <PreviewTools transform={transform} actions={actions}/>,
    }}/>;
}

function PreviewTools({ transform, actions }: { transform: { scale: number; x: number; y: number }; actions: { onZoomIn: () => void; onZoomOut: () => void; onReset: () => void } }) {
  const fitted = transform.scale === 1 && transform.x === 0 && transform.y === 0;
  return <div className="director-preview-tools" role="toolbar" aria-label="缩放">
    <button type="button" aria-label="缩小" title="缩小" disabled={transform.scale <= 1} onClick={actions.onZoomOut}><ZoomOut size={18}/></button>
    <span className="director-preview-scale" aria-label="当前缩放">{Math.round(transform.scale * 100)}%</span>
    <button type="button" aria-label="放大" title="放大" disabled={transform.scale >= PREVIEW_MAX_SCALE} onClick={actions.onZoomIn}><ZoomIn size={18}/></button>
    <button type="button" className="is-text" title="适应窗口" disabled={fitted} onClick={actions.onReset}>适应窗口</button>
  </div>;
}
