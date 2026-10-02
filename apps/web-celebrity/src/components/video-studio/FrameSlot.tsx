"use client";

// 首帧 / 尾帧上传位：空 → 点击或拖进来上传；上传中 → 转圈；有图 → 预览 + 更换 / 删除。
// 大小按当前模式的帧图上限（H3 为 16 MB）在本地先判，超了不上传：上传接口本身放行到 30 MB，
// 真传上去要到提交时才被拒，白等一次。
// 做同款带来的原图标「模板素材」：不知道大小，同样可以换成自己的、或者删掉。

import * as React from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import type { VideoStudioMediaLimit } from "@ai-star-eco/types/video-studio";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { aspectValue } from "@/constants/video-studio-ui";
import { formatFileSize, limitHint, mediaAccept, type VideoStudioFormMaterial } from "@/lib/video-studio";

export interface FrameSlotState {
  /** 已就位的图（自己上传的，或做同款带来的模板素材）。 */
  material: VideoStudioFormMaterial | null;
  uploading: boolean;
  /** 正在上传的文件名（上传中显示）。 */
  uploadingName: string | null;
  error: string | null;
}

export const EMPTY_FRAME_SLOT: FrameSlotState = { material: null, uploading: false, uploadingName: null, error: null };

export function FrameSlot({
  label,
  state,
  limit,
  targetAspect,
  disabled,
  onPick,
  onRemove,
}: {
  /** 「首帧」/「尾帧」 */
  label: string;
  state: FrameSlotState;
  limit: VideoStudioMediaLimit | null;
  /** 当前选的画面比例（如 "9:16"），用来提示图片方向不一致。 */
  targetAspect: string;
  disabled?: boolean;
  onPick: (file: File) => void;
  onRemove: () => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  // 记住加载失败的那个地址（签名过期等）：换了新地址自然重新显示，不用额外重置
  const [brokenUrl, setBrokenUrl] = React.useState<string | null>(null);
  const { material, uploading, uploadingName, error } = state;

  const openPicker = () => {
    if (!disabled && !uploading) inputRef.current?.click();
  };

  const onFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) onPick(file);
  };

  const mismatch = material ? orientationMismatch(material, targetAspect) : null;

  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 items-center gap-2">
        <span className="shrink-0 text-[12px] font-medium text-zinc-700">{label}图</span>
        {material?.fromTemplate ? (
          <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10.5px] font-medium text-zinc-600">模板素材</span>
        ) : null}
        {material && material.bytes != null ? (
          <span className="ml-auto min-w-0 truncate font-mono text-[10.5px] tabular-nums text-zinc-400">
            {material.width && material.height ? `${material.width}×${material.height} · ` : ""}
            {formatFileSize(material.bytes)}
          </span>
        ) : null}
      </div>

      {material ? (
        <>
          <div className="relative aspect-[4/3] overflow-hidden rounded-[10px] border border-zinc-200 bg-zinc-100">
            {material.url === null ? (
              <div className="flex h-full items-center justify-center px-3 text-center text-[11px] leading-relaxed text-rose-600">
                模板里的这张图已经删掉了，请换一张
              </div>
            ) : material.url !== brokenUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- 签名地址，不走 next/image 优化
              <img
                src={material.url}
                alt={`${label}图预览`}
                className="h-full w-full object-contain"
                onError={() => setBrokenUrl(material.url)}
              />
            ) : (
              <div className="flex h-full items-center justify-center px-3 text-center text-[11px] leading-relaxed text-zinc-500">
                预览地址已过期，不影响生成
              </div>
            )}
            {uploading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-white/75 text-[11px] text-zinc-600">
                <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                上传中…
              </div>
            ) : null}
          </div>
          <div className="flex min-w-0 items-center gap-1">
            <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-500" title={material.name}>
              {material.fromTemplate ? `模板里的${label}图` : material.name}
            </span>
            <button
              type="button"
              onClick={openPicker}
              disabled={disabled || uploading}
              className="mobile-touch-target shrink-0 rounded-full px-2 py-0.5 text-[11.5px] text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40"
            >
              更换
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              className="mobile-touch-target shrink-0 rounded-full px-2 py-0.5 text-[11.5px] text-zinc-600 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
            >
              删除
            </button>
          </div>
          {mismatch ? <p className="text-[11px] leading-relaxed text-amber-700">{mismatch}</p> : null}
        </>
      ) : (
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled || uploading}
          onDragOver={(e) => {
            e.preventDefault();
            if (!dragOver) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (!disabled && !uploading) onFiles(e.dataTransfer.files);
          }}
          className={cn(
            "flex aspect-[4/3] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[10px] border border-dashed px-2 text-center transition-colors",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500 disabled:cursor-not-allowed",
            dragOver
              ? "border-violet-500 bg-violet-50 text-violet-700"
              : "border-zinc-300 bg-zinc-50 text-zinc-500 hover:border-violet-400 hover:text-violet-600",
          )}
        >
          {uploading ? <Loader2 className="h-5 w-5 animate-spin text-violet-500" /> : <ImagePlus className="h-5 w-5" />}
          <span className="text-[12px] font-medium">{uploading ? "上传中…" : `上传${label}图`}</span>
          {uploading && uploadingName ? (
            <span className="w-full truncate text-[10.5px] text-zinc-500" title={uploadingName}>
              {uploadingName}
            </span>
          ) : limit ? (
            <span className="text-[10.5px] leading-snug text-zinc-400">{limitHint(limit)}</span>
          ) : null}
        </button>
      )}

      {error ? (
        <p role="alert" className="break-words text-[11.5px] leading-relaxed text-rose-600">
          {error}
        </p>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        accept={limit ? mediaAccept(limit) : "image/*"}
        className="hidden"
        onChange={(e) => {
          onFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}

/** 图片方向和所选画面比例明显不一样时给一句提醒（不拦提交，厂商怎么处理由它决定）。 */
function orientationMismatch(material: VideoStudioFormMaterial, targetAspect: string): string | null {
  if (!material.width || !material.height) return null;
  const target = aspectValue(targetAspect);
  if (!target) return null;
  const ratio = material.width / material.height;
  if (Math.abs(Math.log(ratio / target)) < 0.25) return null;
  return `这张图的比例和所选的 ${targetAspect} 差得比较多，建议换一张，或者改一下画面比例`;
}
