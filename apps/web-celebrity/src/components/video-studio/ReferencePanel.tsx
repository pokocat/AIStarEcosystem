"use client";

// 全能参考的「参考素材」块：三个页签「图片 n/9」「视频 n/1」「音频 n/3」，列表里每项标编号
// （图1、图2…、视频1、音频1…，同类按顺序数，与服务端回显的叫法一致），可以上移下移、换一个、删除。
// 数量上限、单个大小、音频时长都来自模型合同。做同款带来的原素材标「模板素材」，同样能换能删。

import * as React from "react";
import { ArrowDown, ArrowUp, Film, Loader2, Music, Plus, Replace, X } from "lucide-react";
import type {
  VideoStudioMediaType,
  VideoStudioPricing,
  VideoStudioReferenceRules,
} from "@ai-star-eco/types/video-studio";
import { cn } from "@ai-star-eco/ui/ui/utils";
import {
  MEDIA_TYPE_NAME,
  MEDIA_TYPE_UNIT,
  REFERENCE_MEDIA_ORDER,
  formatFileSize,
  formatSeconds,
  limitHint,
  mediaAccept,
  referenceLabel,
  type VideoStudioFormMaterial,
} from "@/lib/video-studio";
import { IconButton } from "./parts";

export interface ReferenceItem {
  /** 本地 id（上传完成前就要能排序、删除）。 */
  id: string;
  mediaType: VideoStudioMediaType;
  name: string;
  /** 已就位的素材；第一次上传还没传完时为 null。 */
  material: VideoStudioFormMaterial | null;
  /** 正在上传（新加的，或者「换一个」换上来的那个）。 */
  uploading: boolean;
}

export type ReferenceLists = Record<VideoStudioMediaType, ReferenceItem[]>;

export const EMPTY_REFERENCE_LISTS: ReferenceLists = { image: [], video: [], audio: [] };

export interface ReferenceNotice {
  id: string;
  text: string;
}

export interface ReferenceCapacity {
  /** 这一类还能再加几个（≤ 0 = 加不了）。 */
  remaining: number;
  /** 卡住的那条规则，如「图片最多 9 张」（多选的文件没加进去时用来解释）。 */
  limit: string;
  /** 放满时按钮上的字。 */
  full: string;
}

/** 这一类还能再加几个，以及卡住的是哪条规则（数量上限 / 总数上限 / 带视频时的图片上限）。 */
export function referenceCapacity(
  rules: VideoStudioReferenceRules,
  lists: ReferenceLists,
  mediaType: VideoStudioMediaType,
): ReferenceCapacity {
  const total = lists.image.length + lists.video.length + lists.audio.length;
  const limit = rules[mediaType];
  const name = MEDIA_TYPE_NAME[mediaType];
  const unit = MEDIA_TYPE_UNIT[mediaType];
  const candidates: ReferenceCapacity[] = [
    {
      remaining: limit.maxCount - lists[mediaType].length,
      limit: `${name}最多 ${limit.maxCount} ${unit}`,
      full: `${name}已经放满（最多 ${limit.maxCount} ${unit}）`,
    },
    {
      remaining: rules.maxTotal - total,
      limit: `参考素材最多 ${rules.maxTotal} 个`,
      full: `参考素材已经放满（最多 ${rules.maxTotal} 个）`,
    },
  ];
  if (mediaType === "image" && lists.video.length > 0) {
    candidates.push({
      remaining: rules.maxImagesWithVideo - lists.image.length,
      limit: `带视频时图片最多 ${rules.maxImagesWithVideo} 张`,
      full: `带视频时图片最多 ${rules.maxImagesWithVideo} 张，已经放满`,
    });
  }
  if (mediaType === "video" && lists.image.length > rules.maxImagesWithVideo) {
    const text = `图片超过 ${rules.maxImagesWithVideo} 张时不能加视频`;
    candidates.push({ remaining: 0, limit: text, full: text });
  }
  return candidates.reduce((a, b) => (b.remaining < a.remaining ? b : a));
}

export function ReferencePanel({
  rules,
  lists,
  tab,
  pricing,
  notices,
  disabled,
  onTabChange,
  onAdd,
  onMove,
  onReplace,
  onRemove,
  onDismissNotice,
}: {
  rules: VideoStudioReferenceRules;
  lists: ReferenceLists;
  tab: VideoStudioMediaType;
  pricing: VideoStudioPricing;
  notices: ReferenceNotice[];
  disabled?: boolean;
  onTabChange: (t: VideoStudioMediaType) => void;
  onAdd: (mediaType: VideoStudioMediaType, files: File[]) => void;
  onMove: (mediaType: VideoStudioMediaType, index: number, delta: -1 | 1) => void;
  /** 换一个：位置和编号不变，换成新传的文件。 */
  onReplace: (mediaType: VideoStudioMediaType, id: string, file: File) => void;
  onRemove: (mediaType: VideoStudioMediaType, id: string) => void;
  onDismissNotice: (id: string) => void;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const replaceInputRef = React.useRef<HTMLInputElement>(null);
  const replaceTarget = React.useRef<string | null>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const tabs = REFERENCE_MEDIA_ORDER.filter((t) => rules[t].maxCount > 0);
  const active = tabs.includes(tab) ? tab : (tabs[0] ?? "image");
  const limit = rules[active];
  const items = lists[active];
  const capacity = referenceCapacity(rules, lists, active);
  const full = capacity.remaining <= 0;
  const name = MEDIA_TYPE_NAME[active];

  const add = (files: FileList | null) => {
    const list = files ? Array.from(files) : [];
    if (list.length > 0) onAdd(active, list);
  };

  const extraImageHint =
    active === "image" && pricing.extraRefImagePerSecond > 0
      ? pricing.freeRefImages > 0
        ? `前 ${pricing.freeRefImages} 张图不加价，第 ${pricing.freeRefImages + 1} 张起每张每秒加 ${pricing.extraRefImagePerSecond} 积分`
        : `每张图每秒加 ${pricing.extraRefImagePerSecond} 积分`
      : null;

  const startReplace = (id: string) => {
    replaceTarget.current = id;
    replaceInputRef.current?.click();
  };

  return (
    <div className="flex flex-col gap-2.5">
      <div role="tablist" aria-label="参考素材类型" className="grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-zinc-100 p-1">
        {tabs.map((t) => {
          const selected = t === active;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onTabChange(t)}
              className={cn(
                "min-w-0 truncate rounded-full px-2 py-1.5 text-[12px] font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-violet-500",
                selected ? "bg-white text-zinc-900 shadow-[var(--shadow-soft)]" : "text-zinc-500 hover:text-zinc-800",
              )}
            >
              {MEDIA_TYPE_NAME[t]}{" "}
              <span className="font-mono tabular-nums">
                {lists[t].length}/{rules[t].maxCount}
              </span>
            </button>
          );
        })}
      </div>

      {items.length > 0 ? (
        <ul className="flex flex-col gap-1.5" aria-label={`${name}列表`}>
          {items.map((item, i) => (
            <li
              key={item.id}
              className="flex min-w-0 items-center gap-2 rounded-[10px] border border-zinc-200 bg-white px-2 py-1.5"
            >
              <ReferenceThumb item={item} />
              <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] font-medium text-zinc-700">
                {referenceLabel(item.mediaType, i)}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className="min-w-0 truncate text-[12px] text-zinc-800" title={item.name}>
                    {item.material?.fromTemplate ? `模板里的${item.name}` : item.name}
                  </span>
                  {item.material?.fromTemplate ? (
                    <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                      模板素材
                    </span>
                  ) : null}
                </div>
                <ItemMeta item={item} />
              </div>
              <IconButton label="上移" disabled={disabled || i === 0} onClick={() => onMove(active, i, -1)}>
                <ArrowUp className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton
                label="下移"
                disabled={disabled || i === items.length - 1}
                onClick={() => onMove(active, i, 1)}
              >
                <ArrowDown className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton label="换一个" disabled={disabled || item.uploading} onClick={() => startReplace(item.id)}>
                <Replace className="h-3.5 w-3.5" />
              </IconButton>
              <IconButton label="删除" tone="danger" disabled={disabled} onClick={() => onRemove(active, item.id)}>
                <X className="h-3.5 w-3.5" />
              </IconButton>
            </li>
          ))}
        </ul>
      ) : null}

      <button
        type="button"
        disabled={disabled || full}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragOver) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled && !full) add(e.dataTransfer.files);
        }}
        title={full ? capacity.full : undefined}
        className={cn(
          "mobile-touch-target flex min-w-0 items-center justify-center gap-1.5 rounded-[10px] border border-dashed px-3 py-2.5 text-[12px] font-medium transition-colors",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-500",
          "disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-50 disabled:text-zinc-400",
          dragOver
            ? "border-violet-500 bg-violet-50 text-violet-700"
            : "border-zinc-300 bg-zinc-50 text-zinc-600 hover:border-violet-400 hover:text-violet-600",
        )}
      >
        <Plus className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{full ? capacity.full : `添加${name}`}</span>
      </button>

      <ul className="flex flex-col gap-1 text-[11px] leading-relaxed text-zinc-500">
        <li>{limitHint(limit)}</li>
        {active === "audio" ? <li>所有音频加起来最长 {rules.maxAudioTotalSec} 秒</li> : null}
        {active === "image" && rules.video.maxCount > 0 ? (
          <li>带视频时图片最多 {rules.maxImagesWithVideo} 张</li>
        ) : null}
        {extraImageHint ? <li>{extraImageHint}</li> : null}
        <li>提示词里可以写「图1」「视频1」，说明每个素材的用途</li>
      </ul>

      {notices.length > 0 ? (
        <div role="alert" className="flex flex-col gap-1">
          {notices.map((n) => (
            <div
              key={n.id}
              className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-rose-600"
            >
              <span className="min-w-0 flex-1 break-words">{n.text}</span>
              <button
                type="button"
                aria-label="关闭提示"
                title="关闭提示"
                onClick={() => onDismissNotice(n.id)}
                className="shrink-0 rounded-full p-0.5 hover:bg-rose-500/10"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <input
        ref={inputRef}
        type="file"
        multiple={limit.maxCount > 1}
        accept={mediaAccept(limit)}
        className="hidden"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      <input
        ref={replaceInputRef}
        type="file"
        accept={mediaAccept(limit)}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          const id = replaceTarget.current;
          replaceTarget.current = null;
          e.target.value = "";
          if (file && id) onReplace(active, id, file);
        }}
      />
    </div>
  );
}

/** 列表第二行：上传中 / 模板素材已删除 / 大小 · 时长（模板素材不知道大小就不写）。 */
function ItemMeta({ item }: { item: ReferenceItem }) {
  const m = item.material;
  if (item.uploading) {
    return <div className="truncate text-[10.5px] text-zinc-400">{m ? "正在换成新的…" : "上传中…"}</div>;
  }
  if (!m) return null;
  if (m.fromTemplate && m.url === null) {
    return <div className="truncate text-[10.5px] text-rose-600">模板里这个素材已经删掉了，换一个或删掉</div>;
  }
  const parts = [m.bytes != null ? formatFileSize(m.bytes) : null, m.durationSec != null ? formatSeconds(m.durationSec) : null];
  const text = parts.filter(Boolean).join(" · ");
  return text ? <div className="truncate font-mono text-[10.5px] tabular-nums text-zinc-400">{text}</div> : null;
}

function ReferenceThumb({ item }: { item: ReferenceItem }) {
  const [brokenUrl, setBrokenUrl] = React.useState<string | null>(null);
  const url = item.material?.url ?? null;
  const box = "relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-zinc-100 text-zinc-400";
  if (!item.material || item.uploading) {
    return (
      <span className={box}>
        <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
      </span>
    );
  }
  if (item.mediaType === "image" && url && url !== brokenUrl) {
    return (
      <span className={box}>
        {/* eslint-disable-next-line @next/next/no-img-element -- 签名地址，不走 next/image 优化 */}
        <img src={url} alt="" className="h-full w-full object-cover" onError={() => setBrokenUrl(url)} />
      </span>
    );
  }
  if (item.mediaType === "video" && url && url !== brokenUrl) {
    return (
      <span className={box}>
        <video
          src={url}
          muted
          playsInline
          preload="metadata"
          className="h-full w-full object-cover"
          onError={() => setBrokenUrl(url)}
        />
        <Film className="absolute h-3.5 w-3.5 text-white drop-shadow" />
      </span>
    );
  }
  return (
    <span className={box}>
      {item.mediaType === "audio" ? <Music className="h-4 w-4" /> : <Film className="h-4 w-4" />}
    </span>
  );
}
