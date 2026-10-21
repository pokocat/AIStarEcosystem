"use client";
import { useEffect, useState } from "react";
import { Button } from "antd";
import type { CanvasNodeData } from "@/canvas/types/canvas";
import { studioFrameCropNotice } from "@/canvas-bridge/studio-composer-spec";

/**
 * The picture's real size: what the canvas recorded (the card records what it shows), else measured once from its address.
 * Undefined while unknown; then no hint is shown rather than a guess.
 */
export function useStudioImageSize(node: CanvasNodeData | undefined): { width: number; height: number } | undefined {
  const width = node?.metadata?.naturalWidth || 0, height = node?.metadata?.naturalHeight || 0;
  const key = node?.metadata?.storageKey, src = node?.metadata?.content;
  const [measured, setMeasured] = useState<{ key?: string; width: number; height: number }>();
  useEffect(() => {
    if ((width > 0 && height > 0) || !src) return;
    let alive = true;
    const image = new Image();
    image.onload = () => { if (alive && image.naturalWidth > 0) setMeasured({ key, width: image.naturalWidth, height: image.naturalHeight }); };
    image.src = src;
    return () => { alive = false; };
  }, [width, height, key, src]);
  if (width > 0 && height > 0) return { width, height };
  return measured && measured.key === key ? measured : undefined;
}

/** 「首帧图是 1:1，会按 9:16 居中裁剪」 + 「改成 1:1」 when the model can do it. Does not block sending (§6.2). */
export function StudioFrameCropHint({ frame, ratio, ratios, onFix }: { frame: CanvasNodeData | undefined; ratio: string; ratios: string[]; onFix: (ratio: string) => void }) {
  const size = useStudioImageSize(frame);
  const notice = studioFrameCropNotice(size, ratio, ratios);
  if (!notice) return null;
  return <p className="studio-composer-validation studio-frame-crop-hint" role="status">{notice.text}
    {notice.fix && <Button type="link" size="small" onClick={() => onFix(notice.fix!)}>改成 {notice.fix}</Button>}</p>;
}
