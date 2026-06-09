"use client";

// v0.57+: 编排后「预览效果」—— 纯前端时间轴播放器。
//
// 用户在 create 页填好各场景素材后，渲染前先在浏览器里把整片顺序播一遍：
// 按 scene 顺序串行播放，每段渲染本段 visual slot（视频/图片/文字/贴图）按 rect 定位、
// 按 z_index 叠层；BGM 音频 slot 作为整片配音横跨播放。
//
// 这是「验证编排」级预览（顺序 / 布局 / 内容 / 时长一眼可见），刻意不还原扰动算子
// （变速 / 调色 / 镜像 / 抖动 / 贴图池）—— 那些是渲染期每变体随机微调，预览阶段无意义。
// 文字渲染也与 ffmpeg drawtext 不完全一致（字体 / 抗锯齿差异），仅作示意。
//
// 数据全部来自已加载的 template + 用户填充的 bindings，零网络、零成本、即时。

import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Volume2, VolumeX, Video as VideoIcon, Image as ImageIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@ai-star-eco/ui/ui/dialog";
import type { Template, TemplateSlot, SlotBinding } from "./types";
import { flatSlotsOf, resolveFit } from "./lib/scene-helpers";
import { cn } from "./lib/utils";

/** 从 binding 抽出可渲染的媒体 URL（与 template-preview 同口径）。 */
function bindingMediaUrl(b?: SlotBinding): string | null {
  if (!b) return null;
  if (b.source === "upload") return b.preview_url ?? b.file_url ?? null;
  if (b.source === "library") return b.preview_url ?? null;
  if (b.source === "picgen") return b.preview_url ?? null;
  return null;
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|m4v|webm|mkv)(\?|$)/i.test(url);
}

function isStickerSlot(slot: TemplateSlot): boolean {
  return slot.layer_type === "image" && slot.library_filter?.asset_type === "sticker";
}

function slotText(slot: TemplateSlot, binding?: SlotBinding): string {
  if (binding?.source === "input" && binding.text) return binding.text;
  if (binding?.source === "picgen" && binding.title) return binding.title;
  return slot.default_value ?? slot.label ?? "";
}

function fmt(t: number): string {
  const s = Math.max(0, t);
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

interface SceneSpan {
  index: number;
  label: string;
  start: number;
  end: number;
  duration: number;
}

interface Props {
  template: Template;
  bindings: Record<string, SlotBinding>;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TimelinePreviewDialog({ template, bindings, open, onOpenChange }: Props) {
  // scene 偏移表 + 总时长
  const { spans, total } = useMemo(() => {
    let offset = 0;
    const out: SceneSpan[] = template.scenes.map((sc, i) => {
      const start = offset;
      const duration = Math.max(0.1, sc.duration);
      offset += duration;
      return { index: i, label: sc.label, start, end: offset, duration };
    });
    return { spans: out, total: offset };
  }, [template]);

  // 整片 BGM —— 第一个有媒体的 audio slot，横跨全片播放。
  const bgmUrl = useMemo(() => {
    for (const s of flatSlotsOf(template)) {
      if (s.layer_type === "audio") {
        const url = bindingMediaUrl(bindings[s.slot_id]);
        if (url) return url;
      }
    }
    return null;
  }, [template, bindings]);

  const [elapsed, setElapsed] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);

  const elapsedRef = useRef(0);
  const playingRef = useRef(false);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  // 当前活动场景的 video 元素，键为 slot_id —— 每帧据主时钟纠偏。
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 当前场景
  const current = useMemo(() => {
    if (elapsed >= total) return spans[spans.length - 1];
    return spans.find((s) => elapsed >= s.start && elapsed < s.end) ?? spans[0];
  }, [elapsed, spans, total]);
  const localTime = current ? elapsed - current.start : 0;

  // 打开 / 关闭时复位
  useEffect(() => {
    if (open) {
      elapsedRef.current = 0;
      setElapsed(0);
      // 自动从头播放（muted 下浏览器允许 autoplay）
      playingRef.current = true;
      setPlaying(true);
    } else {
      playingRef.current = false;
      setPlaying(false);
      videoRefs.current.clear();
    }
  }, [open]);

  // 主时钟 + video 纠偏（单个 rAF 循环，全程用 ref 取最新值避免闭包陈旧）
  useEffect(() => {
    if (!open) return;
    const tick = (ts: number) => {
      const last = lastTsRef.current;
      if (last != null && playingRef.current) {
        const dt = (ts - last) / 1000;
        let next = elapsedRef.current + dt;
        if (next >= total) {
          next = total;
          playingRef.current = false;
          setPlaying(false);
        }
        elapsedRef.current = next;
        setElapsed(next);
      }
      lastTsRef.current = ts;

      // video 纠偏：让活动场景内每个 video 的 currentTime 贴近本段局部时间。
      const span = spans.find((s) => elapsedRef.current >= s.start && elapsedRef.current < s.end)
        ?? spans[spans.length - 1];
      const lt = elapsedRef.current - (span?.start ?? 0);
      videoRefs.current.forEach((v) => {
        if (!v || !v.duration || Number.isNaN(v.duration)) return;
        const want = v.duration > 0 ? lt % v.duration : lt;
        if (Math.abs(v.currentTime - want) > 0.3) {
          try { v.currentTime = want; } catch { /* seek 偶发失败忽略 */ }
        }
        if (playingRef.current && v.paused) v.play().catch(() => {});
        if (!playingRef.current && !v.paused) v.pause();
      });

      // BGM 同步
      const a = audioRef.current;
      if (a) {
        if (a.duration && !Number.isNaN(a.duration)) {
          const want = a.duration > 0 ? elapsedRef.current % a.duration : elapsedRef.current;
          if (Math.abs(a.currentTime - want) > 0.35) {
            try { a.currentTime = want; } catch { /* ignore */ }
          }
        }
        if (playingRef.current && a.paused) a.play().catch(() => {});
        if (!playingRef.current && !a.paused) a.pause();
      }

      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    };
  }, [open, spans, total]);

  const togglePlay = () => {
    const next = !playingRef.current;
    // 播完后再点 = 从头重播
    if (next && elapsedRef.current >= total) {
      elapsedRef.current = 0;
      setElapsed(0);
    }
    playingRef.current = next;
    setPlaying(next);
  };

  const restart = () => {
    elapsedRef.current = 0;
    setElapsed(0);
    playingRef.current = true;
    setPlaying(true);
  };

  const seek = (t: number) => {
    const clamped = Math.max(0, Math.min(total, t));
    elapsedRef.current = clamped;
    setElapsed(clamped);
  };

  const onScrub = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    seek(ratio * total);
  };

  // 当前场景的 visual slots（按 z_index 叠层）
  const visualSlots = current
    ? template.scenes[current.index].slots
        .filter((s) => s.layer_type !== "audio")
        .sort((a, b) => a.z_index - b.z_index)
    : [];

  const aspect = `${template.canvas.width} / ${template.canvas.height}`;
  const atEnd = elapsed >= total && !playing;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] max-h-[94dvh] overflow-y-auto gap-3 p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            预览效果
            <span className="text-[11px] font-normal text-muted-foreground">
              共 {spans.length} 段 · {total.toFixed(0)} 秒
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* 播放画布 —— 按高度约束（而非占满宽度），避免竖屏 9:16 在手机上撑爆视口、
            把弹窗顶部的关闭按钮顶出屏幕。height 驱动 + w-auto 让宽度按真实画布比例派生。 */}
        <div
          className="relative h-[44dvh] max-h-[460px] w-auto justify-self-center overflow-hidden rounded-xl bg-black ring-1 ring-white/10 sm:h-[52dvh]"
          style={{ aspectRatio: aspect }}
        >
          {visualSlots.map((slot) => (
            <SlotLayer
              key={`${current?.index}::${slot.slot_id}`}
              slot={slot}
              binding={bindings[slot.slot_id]}
              localTime={localTime}
              muted={muted}
              registerVideo={(el) => {
                if (el) videoRefs.current.set(slot.slot_id, el);
                else videoRefs.current.delete(slot.slot_id);
              }}
            />
          ))}

          {/* 段落角标 */}
          <div className="absolute left-2 top-2 rounded-md bg-black/55 px-2 py-1 text-[10px] font-medium text-white/90 backdrop-blur">
            {spans.length > 1 ? `第 ${(current?.index ?? 0) + 1}/${spans.length} 段` : "全片"}
            {current?.label ? ` · ${current.label}` : ""}
          </div>

          {/* 结束遮罩 */}
          {atEnd && (
            <button
              type="button"
              onClick={restart}
              className="absolute inset-0 z-10 grid place-items-center bg-black/45 text-white backdrop-blur-[1px]"
            >
              <span className="flex flex-col items-center gap-1.5">
                <RotateCcw className="size-7" />
                <span className="text-xs">重新播放</span>
              </span>
            </button>
          )}

          {/* 中央大播放键（暂停态） */}
          {!playing && !atEnd && (
            <button
              type="button"
              onClick={togglePlay}
              className="absolute inset-0 z-10 grid place-items-center bg-black/20"
            >
              <span className="grid size-14 place-items-center rounded-full bg-white/90 text-black shadow-lg">
                <Play className="size-6 translate-x-0.5" />
              </span>
            </button>
          )}
        </div>

        {/* 进度条 */}
        <div
          className="group relative h-2.5 w-full cursor-pointer rounded-full bg-secondary"
          onPointerDown={onScrub}
        >
          {/* 段分隔刻度 */}
          {spans.length > 1 &&
            spans.slice(1).map((s) => (
              <span
                key={s.index}
                className="absolute top-0 h-full w-px bg-background/70"
                style={{ left: `${(s.start / total) * 100}%` }}
              />
            ))}
          <span
            className="absolute left-0 top-0 h-full rounded-full bg-violet-500"
            style={{ width: `${total > 0 ? (elapsed / total) * 100 : 0}%` }}
          />
          <span
            className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-violet-600 shadow ring-2 ring-white"
            style={{ left: `${total > 0 ? (elapsed / total) * 100 : 0}%` }}
          />
        </div>

        {/* 控制条 */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={togglePlay}
            className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-background"
            aria-label={playing ? "暂停" : "播放"}
          >
            {playing ? <Pause className="size-4" /> : <Play className="size-4 translate-x-px" />}
          </button>
          <button
            type="button"
            onClick={restart}
            className="grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground"
            aria-label="从头播放"
          >
            <RotateCcw className="size-3.5" />
          </button>
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {fmt(elapsed)} / {fmt(total)}
          </span>
          <button
            type="button"
            onClick={() => setMuted((m) => !m)}
            className="ml-auto grid size-8 shrink-0 place-items-center rounded-full border border-border text-muted-foreground hover:text-foreground"
            aria-label={muted ? "取消静音" : "静音"}
            title={muted ? "点击试听（视频原声 / BGM）" : "静音"}
          >
            {muted ? <VolumeX className="size-3.5" /> : <Volume2 className="size-3.5" />}
          </button>
        </div>

        <p className="text-[10px] leading-relaxed text-muted-foreground">
          这是编排预览，按场景顺序播放你填的素材，用来核对顺序 / 画面位置 / 文案。
          最终成片由服务器渲染，会再叠加差异化处理（变速 / 调色 / 镜像 / 抖动贴图），与此预览略有不同。
        </p>

        {/* BGM —— 不渲染 UI，仅作整片配音 */}
        {bgmUrl && (
          <audio
            ref={audioRef}
            src={bgmUrl}
            muted={muted}
            loop
            preload="auto"
            className="hidden"
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function SlotLayer({
  slot,
  binding,
  localTime,
  muted,
  registerVideo,
}: {
  slot: TemplateSlot;
  binding?: SlotBinding;
  localTime: number;
  muted: boolean;
  registerVideo: (el: HTMLVideoElement | null) => void;
}) {
  if (!slot.rect) return null;
  const r = slot.rect;
  // 仅在本 slot 的 time_range 时段内显示（与渲染器 enable=between 对齐）。
  const [ts, te] = slot.time_range ?? [0, Infinity];
  const visible = localTime >= ts - 0.001 && localTime <= te + 0.001;
  if (!visible) return null;

  const style: React.CSSProperties = {
    left: `${r.x * 100}%`,
    top: `${r.y * 100}%`,
    width: `${r.w * 100}%`,
    height: `${r.h * 100}%`,
    zIndex: slot.z_index,
  };

  const mediaUrl = bindingMediaUrl(binding);
  const fit = resolveFit(slot);
  const objectFit = fit === "cover" ? "object-cover" : "object-contain";

  // 文字层
  if (slot.layer_type === "text") {
    const text = slotText(slot, binding);
    if (!text) return null;
    const big = slot.style_preset?.includes("80px");
    const mid = slot.style_preset?.includes("60px");
    return (
      <div style={style} className="absolute flex items-center justify-center px-2">
        <span
          className={cn(
            "text-center font-bold leading-tight text-white",
            big ? "text-2xl" : mid ? "text-lg" : "text-base",
          )}
          style={{ textShadow: "0 1px 3px rgba(0,0,0,0.9)" }}
        >
          {text}
        </span>
      </div>
    );
  }

  // 贴图层
  if (isStickerSlot(slot)) {
    return (
      <div style={style} className="absolute grid place-items-center">
        {mediaUrl ? (
          <img src={mediaUrl} alt="" className="absolute inset-0 h-full w-full object-contain" />
        ) : (
          <div className="max-w-full truncate rounded-md bg-white px-2 py-1 text-[11px] font-medium text-slate-900 shadow-sm ring-1 ring-black/10">
            {slotText(slot, binding) || "贴图"}
          </div>
        )}
      </div>
    );
  }

  // 视频层
  if (slot.layer_type === "video") {
    if (mediaUrl && isVideoUrl(mediaUrl)) {
      return (
        <div style={style} className="absolute overflow-hidden">
          <video
            ref={registerVideo}
            src={mediaUrl}
            muted={muted}
            loop
            playsInline
            preload="auto"
            className={cn("absolute inset-0 h-full w-full", objectFit)}
          />
        </div>
      );
    }
    if (mediaUrl) {
      return (
        <div style={style} className="absolute overflow-hidden">
          <img src={mediaUrl} alt="" className={cn("absolute inset-0 h-full w-full", objectFit)} />
        </div>
      );
    }
    return <PlaceholderLayer style={style} icon="video" />;
  }

  // 图片层
  if (slot.layer_type === "image") {
    if (mediaUrl) {
      return (
        <div style={style} className="absolute overflow-hidden">
          <img src={mediaUrl} alt="" className={cn("absolute inset-0 h-full w-full", objectFit)} />
        </div>
      );
    }
    return <PlaceholderLayer style={style} icon="image" />;
  }

  return null;
}

function PlaceholderLayer({ style, icon }: { style: React.CSSProperties; icon: "video" | "image" }) {
  const Icon = icon === "video" ? VideoIcon : ImageIcon;
  return (
    <div
      style={style}
      className="absolute grid place-items-center bg-white/[0.06] text-white/40 ring-1 ring-inset ring-white/15"
    >
      <div className="text-center">
        <Icon className="mx-auto mb-1 size-6" />
        <div className="text-[10px]">未填素材</div>
      </div>
    </div>
  );
}
