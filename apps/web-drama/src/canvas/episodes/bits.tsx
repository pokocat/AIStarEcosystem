"use client";

// 逐集两屏共用的小件：积分数（钻石 + 数字）、价格文案、成片预览弹窗、下载成片。
import * as React from "react";
import { Download, Gem, X } from "lucide-react";
import { formatDateTime } from "@ai-star-eco/api-client";
import type { CanvasAssembled, DramaCanvasRatio } from "@ai-star-eco/types/drama-canvas";
import { CanvasVideo, resignCanvasAsset } from "@/canvas/shell";
import { toast } from "@/lib/toast";
import { useModalA11y } from "@/lib/use-modal-a11y";
import { formatClock, priceText, type PricePart } from "./derive";

/** 按钮 / 文案里的积分：钻石 + 数字。n=null = 价格还没读到，显示「…」（不先给一个回退数字再跳）。 */
export function Credits({ n, className }: { n: number | null; className?: string }) {
  return (
    <span className={["cve-credits", className].filter(Boolean).join(" ")} aria-label={n == null ? "价格读取中" : `${n} 积分`}>
      <Gem size={12} aria-hidden />
      <span className="num">{n == null ? "…" : n}</span>
    </span>
  );
}

/** 价格文案：字符串照写，积分段画成钻石 + 数字。title / 读屏用纯文字版。 */
export function PriceLine({ parts, className }: { parts: PricePart[]; className?: string }) {
  const plain = priceText(parts).replace(/✦(\d+)/g, "$1 积分");
  return (
    <span className={className} title={plain}>
      {parts.map((p, i) => (typeof p === "string" ? <React.Fragment key={i}>{p}</React.Fragment> : <Credits key={i} n={p.credits} />))}
    </span>
  );
}

/** 下载成片：先按 key 换一个新地址（签名 1 小时过期），换不到再用手上的。 */
export async function downloadAssembled(canvasId: string, assembled: CanvasAssembled, filename: string): Promise<void> {
  let url: string | undefined;
  try {
    url = (await resignCanvasAsset(canvasId, assembled.key)) ?? assembled.url;
  } catch {
    url = assembled.url;
  }
  if (!url) {
    toast.error("成片地址没拿到", { description: "请稍后再试。" });
    return;
  }
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.target = "_blank";
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function assembledFilename(canvasTitle: string, no: number): string {
  const base = `${canvasTitle || "画布"}-第${no}集`.replace(/[\\/:*?"<>|\s]+/g, "-");
  return `${base}.mp4`;
}

export interface AssembledDialogProps {
  open: boolean;
  onClose: () => void;
  canvasId: string;
  title: string;
  ratio: DramaCanvasRatio;
  assembled?: CanvasAssembled;
  stale?: boolean;
  filename: string;
  /** 成片是旧的时给一个「重新合成」（弹窗在单集编辑器里时才传）。 */
  onReassemble?: () => void;
  reassembleDisabled?: boolean;
}

export function AssembledDialog({ open, onClose, canvasId, title, ratio, assembled, stale, filename, onReassemble, reassembleDisabled }: AssembledDialogProps) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const titleId = React.useId();
  useModalA11y(panelRef, onClose, open);
  if (!open || !assembled) return null;
  return (
    <div className="overlay" onClick={onClose}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`card pop-in cve-film-dialog cve-film-${ratio === "16:9" ? "wide" : "tall"}`}
        onClick={(e) => e.stopPropagation()}
        data-testid="cve-film-dialog"
      >
        <div className="cve-film-head">
          <div className="cve-film-copy">
            <div id={titleId} className="cve-film-title cv-ellipsis" title={title}>
              {title}
            </div>
            <div className="cv-hint">
              成片 <span className="num">{formatClock(assembled.durationSec)}</span> · 合成于 {formatDateTime(assembled.at)}
            </div>
          </div>
          <button type="button" className="btn btn-icon btn-ghost btn-sm tap-target" aria-label="关闭" title="关闭" onClick={onClose}>
            <X size={15} />
          </button>
        </div>
        <div className="cve-film-stage">
          <CanvasVideo version={assembled} className="cve-film-video" />
        </div>
        {stale && <div className="cve-film-stale">成片是旧的：有片段换过视频版本，重新合成才会用上。</div>}
        <div className="cve-film-foot">
          {stale && onReassemble && (
            <button type="button" className="btn btn-line btn-sm" disabled={reassembleDisabled} onClick={onReassemble}>
              重新合成
            </button>
          )}
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void downloadAssembled(canvasId, assembled, filename)}>
            <Download size={14} /> 下载成片
          </button>
        </div>
      </div>
    </div>
  );
}
