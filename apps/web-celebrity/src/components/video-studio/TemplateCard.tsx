"use client";

// 一个模板（docs/video-studio-plan.md §10）：封面（点了播放原作成片）、标题、「官方」/「仅自己可见」标、
// 模式与规格、提示词两行、原素材缩略图、「已做同款 N 次」、「做同款」；
// 我自己的可以「删除」，官方的由发布人或运营「撤回」。

import * as React from "react";
import { Copy, Loader2, Play, Trash2, Undo2 } from "lucide-react";
import type { VideoStudioTemplate } from "@ai-star-eco/types/video-studio";
import { formatDateTime, formatNumber } from "@ai-star-eco/api-client/format";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { USE_MOCK } from "@/api/_client";
import {
  VIDEO_STUDIO_MODE_LABEL,
  VIDEO_STUDIO_TEMPLATE_SCOPE_LABEL,
  aspectValue,
  jobSpecText,
} from "@/constants/video-studio-ui";
import { MediaThumb } from "./MediaThumb";
import { useStableUrl } from "./use-stable-url";

const MAX_URL_REFRESHES = 2;

export function TemplateCard({
  template,
  canWithdrawOfficial,
  removing,
  onUse,
  onRemove,
  onMediaExpired,
}: {
  template: VideoStudioTemplate;
  /** 当前账号是运营：官方模板都能撤回。 */
  canWithdrawOfficial: boolean;
  /** 正在删除 / 撤回这一个。 */
  removing: boolean;
  onUse: (template: VideoStudioTemplate) => void;
  onRemove: (template: VideoStudioTemplate) => void;
  onMediaExpired: (id: string) => void;
}) {
  const refreshes = React.useRef(0);
  const expired = React.useCallback(() => {
    if (refreshes.current >= MAX_URL_REFRESHES) return;
    refreshes.current += 1;
    onMediaExpired(template.id);
  }, [template.id, onMediaExpired]);

  const official = template.scope === "official";
  const removeAction = official
    ? template.mine || canWithdrawOfficial
      ? { label: "撤回", Icon: Undo2 }
      : null
    : template.mine
      ? { label: "删除", Icon: Trash2 }
      : null;
  const modeLabel = VIDEO_STUDIO_MODE_LABEL[template.mode] ?? "视频生成";
  const spec = `${modeLabel} · ${jobSpecText(template)}`;

  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-[var(--shadow-soft)] sm:flex-row">
      <TemplatePreview template={template} onExpired={expired} />
      <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
        <header className="flex min-w-0 items-center gap-2">
          <h3 className="min-w-0 truncate text-[14px] font-semibold text-zinc-900" title={template.title}>
            {template.title}
          </h3>
          <span
            className={cn(
              "shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium",
              official ? "bg-violet-50 text-violet-700" : "bg-zinc-100 text-zinc-600",
            )}
          >
            {VIDEO_STUDIO_TEMPLATE_SCOPE_LABEL[template.scope] ?? "仅自己可见"}
          </span>
          {USE_MOCK ? (
            <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-medium text-amber-700">演示</span>
          ) : null}
        </header>

        <div className="truncate font-mono text-[11px] tabular-nums text-zinc-500" title={spec}>
          {spec}
        </div>

        {template.description ? (
          <p className="line-clamp-2 break-words text-[12px] leading-relaxed text-zinc-500" title={template.description}>
            {template.description}
          </p>
        ) : null}

        <p className="line-clamp-2 break-words text-[13px] leading-relaxed text-zinc-700" title={template.prompt}>
          {template.prompt}
        </p>

        {template.materials.length > 0 ? (
          <div className="flex flex-wrap gap-1.5" aria-label="模板素材">
            {template.materials.map((m, i) => (
              <MediaThumb key={`${m.key}-${i}`} input={m} onExpired={expired} />
            ))}
          </div>
        ) : null}

        <footer className="mt-auto flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 pt-1">
          <span className="text-[11.5px] tabular-nums text-zinc-500" title={`创建于 ${formatDateTime(template.createdAt)}`}>
            已做同款 {formatNumber(template.useCount)} 次
          </span>
          <span className="ml-auto flex shrink-0 items-center gap-1.5">
            {removeAction ? (
              <button
                type="button"
                onClick={() => onRemove(template)}
                disabled={removing}
                className="mobile-touch-target inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] text-zinc-500 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              >
                {removing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <removeAction.Icon className="h-3.5 w-3.5" />}
                {removeAction.label}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => onUse(template)}
              className="mobile-touch-target inline-flex items-center gap-1 rounded-full border-b border-violet-600 bg-violet-500 px-3.5 py-1.5 text-[12.5px] font-medium text-white hover:bg-violet-600"
            >
              <Copy className="h-3.5 w-3.5" />
              做同款
            </button>
          </span>
        </footer>
      </div>
    </article>
  );
}

/** 封面：有图就显示图，点一下就地播放原作成片；没有成片就说明一句，不放打不开的播放器。 */
function TemplatePreview({ template, onExpired }: { template: VideoStudioTemplate; onExpired: () => void }) {
  const [playing, setPlaying] = React.useState(false);
  const [videoSrc, markVideoBroken] = useStableUrl(template.previewVideoUrl);
  const [thumbSrc, markThumbBroken] = useStableUrl(template.previewThumbnailUrl);
  const [thumbFailed, setThumbFailed] = React.useState<string | null>(null);
  const ratio = aspectValue(template.aspectRatio) ?? 9 / 16;
  const box = "relative flex w-full shrink-0 items-center justify-center overflow-hidden bg-zinc-100 sm:w-[168px]";

  if (playing && videoSrc) {
    return (
      <div className={cn(box, "bg-black")}>
        <video
          src={videoSrc}
          controls
          autoPlay
          playsInline
          className="block max-h-[300px] w-full sm:max-h-none"
          style={{ aspectRatio: String(ratio) }}
          onError={() => {
            markVideoBroken();
            onExpired();
          }}
        />
      </div>
    );
  }

  if (!videoSrc) {
    return (
      <div className={cn(box, "min-h-[120px] px-4 text-center text-[11.5px] leading-relaxed text-zinc-500")}>
        {USE_MOCK ? "演示模板没有真实成片" : "原作成片暂时看不了"}
      </div>
    );
  }

  const showThumb = !!thumbSrc && thumbSrc !== thumbFailed;
  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      title="播放原作成片"
      aria-label={`播放「${template.title}」的原作成片`}
      className={cn(box, "group min-h-[120px] bg-zinc-900")}
    >
      {showThumb ? (
        // eslint-disable-next-line @next/next/no-img-element -- 签名地址，不走 next/image 优化
        <img
          src={thumbSrc ?? undefined}
          alt=""
          className="block max-h-[300px] w-full object-cover sm:h-full sm:max-h-none"
          style={{ aspectRatio: String(ratio) }}
          onError={() => {
            setThumbFailed(thumbSrc);
            markThumbBroken();
            onExpired();
          }}
        />
      ) : null}
      <span className="absolute flex h-11 w-11 items-center justify-center rounded-full bg-white/90 text-zinc-900 shadow-[var(--shadow-lift)] transition-transform group-hover:scale-105">
        <Play className="ml-0.5 h-5 w-5" />
      </span>
    </button>
  );
}
