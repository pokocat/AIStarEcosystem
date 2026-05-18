"use client";

import { useMemo, useRef } from "react";
import { Video, Image as ImageIcon, Type, Music, Sticker, Sparkles } from "lucide-react";
import type { Template, TemplateSlot, SlotBinding, Rect } from "./types";
import { cn } from "./lib/utils";
import { flatSlotsOf } from "./lib/scene-helpers";

/** 从 binding 抽出可渲染的媒体 URL（library/upload 都有 preview_url 或 file_url）。 */
function bindingMediaUrl(b?: SlotBinding): string | null {
  if (!b) return null;
  if (b.source === "upload") return b.preview_url ?? b.file_url ?? null;
  if (b.source === "library") return b.preview_url ?? null;
  return null;
}

function isVideoUrl(url: string): boolean {
  return /\.(mp4|mov|m4v|webm|mkv)(\?|$)/i.test(url);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

const MIN_SIZE = 0.02; // 防止 slot 缩到不可点

/** 8 个交互句柄(4 角 + 4 边),仅 editable + selected 时可见。 */
type Handle = "move" | "nw" | "ne" | "sw" | "se" | "n" | "s" | "w" | "e";

function applyDrag(start: Rect, handle: Handle, dx: number, dy: number): Rect {
  // dx/dy 已归一化到画布(0..1)
  switch (handle) {
    case "move":
      return {
        ...start,
        x: clamp(start.x + dx, 0, 1 - start.w),
        y: clamp(start.y + dy, 0, 1 - start.h),
      };
    case "se":
      return {
        ...start,
        w: clamp(start.w + dx, MIN_SIZE, 1 - start.x),
        h: clamp(start.h + dy, MIN_SIZE, 1 - start.y),
      };
    case "sw": {
      const newW = clamp(start.w - dx, MIN_SIZE, start.x + start.w);
      const newX = start.x + start.w - newW;
      return { ...start, x: newX, w: newW, h: clamp(start.h + dy, MIN_SIZE, 1 - start.y) };
    }
    case "ne": {
      const newH = clamp(start.h - dy, MIN_SIZE, start.y + start.h);
      const newY = start.y + start.h - newH;
      return { ...start, y: newY, h: newH, w: clamp(start.w + dx, MIN_SIZE, 1 - start.x) };
    }
    case "nw": {
      const newW = clamp(start.w - dx, MIN_SIZE, start.x + start.w);
      const newX = start.x + start.w - newW;
      const newH = clamp(start.h - dy, MIN_SIZE, start.y + start.h);
      const newY = start.y + start.h - newH;
      return { x: newX, y: newY, w: newW, h: newH };
    }
    case "n": {
      const newH = clamp(start.h - dy, MIN_SIZE, start.y + start.h);
      const newY = start.y + start.h - newH;
      return { ...start, y: newY, h: newH };
    }
    case "s":
      return { ...start, h: clamp(start.h + dy, MIN_SIZE, 1 - start.y) };
    case "w": {
      const newW = clamp(start.w - dx, MIN_SIZE, start.x + start.w);
      const newX = start.x + start.w - newW;
      return { ...start, x: newX, w: newW };
    }
    case "e":
      return { ...start, w: clamp(start.w + dx, MIN_SIZE, 1 - start.x) };
  }
}

interface Props {
  template: Template;
  bindings?: Record<string, SlotBinding>;
  selectedSlotId?: string | null;
  onSelectSlot?: (slotId: string | null) => void;
  showSlotChrome?: boolean;
  className?: string;
  /** for output preview - pseudo-random variant offset to visualize perturbation */
  variantSeed?: number;
  /** 模板编辑器开启时设为 true:body 可拖动,选中后显示 8 个 resize 句柄。 */
  editable?: boolean;
  /** editable=true 时,槽位 rect 变化的回调(归一化坐标 0..1)。 */
  onChangeSlotRect?: (slotId: string, next: Rect) => void;
}

// 中性化 layer 描边/底色:统一灰阶 + brand 高亮选中态。icon 仍按 layer 区分。
// 不再用饱和彩虹色;选中态(border-brand-500 由调用方加 ring) 是唯一强调。
const LAYER_STYLES: Record<string, { bg: string; border: string; text: string; icon: any; label: string }> = {
  video: { bg: "bg-foreground/[0.04]", border: "border-foreground/30", text: "text-foreground/70", icon: Video, label: "视频" },
  image: { bg: "bg-foreground/[0.04]", border: "border-foreground/30", text: "text-foreground/70", icon: ImageIcon, label: "图片" },
  sticker: { bg: "bg-foreground/[0.04]", border: "border-foreground/30", text: "text-foreground/70", icon: Sticker, label: "贴图" },
  text: { bg: "bg-foreground/[0.04]", border: "border-foreground/30", text: "text-foreground/70", icon: Type, label: "文字" },
  audio: { bg: "bg-foreground/[0.04]", border: "border-foreground/30", text: "text-foreground/70", icon: Music, label: "音频" },
  digital_human: { bg: "bg-foreground/[0.04]", border: "border-foreground/30", text: "text-foreground/70", icon: Sparkles, label: "数字人" },
};

function jitter(seed: number, slotId: string, max: number): number {
  // 用 slotId + seed 生成稳定的伪随机数
  let h = seed;
  for (let i = 0; i < slotId.length; i++) h = (h * 31 + slotId.charCodeAt(i)) | 0;
  const t = ((h % 1000) / 1000) * 2 - 1;
  return t * max;
}

// 贴图槽位的预览文本 —— 让 sticker 与 text 槽位保持「都显示实际/语义内容」的一致语义,
// 不把 "顶部品类标题贴图" 这种内部命名直接吐到画面上。
// 优先级: 用户填的 binding text > 槽位 default_value > library_filter.category 友好名 > 清洗后的 label。
const STICKER_CATEGORY_LABEL: Record<string, string> = {
  category_title: "品类标题",
  promo_label: "促销标签",
  brand_bar: "品牌条",
  price_tag: "价格标签",
  sub_title: "副标题",
  cta_button: "行动按钮",
  badge: "角标",
  watermark: "水印",
};

function stickerDisplayText(slot: TemplateSlot, binding?: SlotBinding): string {
  if (binding?.source === "input" && binding.text) return binding.text;
  if (slot.default_value) return slot.default_value;
  const cat = slot.library_filter?.category as string | undefined;
  if (cat && STICKER_CATEGORY_LABEL[cat]) return STICKER_CATEGORY_LABEL[cat];
  // 兜底:把 label / slot_id 里的「贴图 / 贴纸 / 条 / 栏」等冗余技术后缀剥掉,顶部 / 底部前缀也去掉
  const raw = slot.label || slot.slot_id;
  return raw
    .replace(/^顶部|^底部|^左侧|^右侧/, "")
    .replace(/贴图$|贴纸$|条$|栏$/, "")
    .trim()
    .slice(0, 8);
}

export function TemplatePreview({
  template,
  bindings,
  selectedSlotId,
  onSelectSlot,
  showSlotChrome = true,
  className,
  variantSeed,
  editable,
  onChangeSlotRect,
}: Props) {
  // 把音频 slot 单独拎出来,放在底部 chip 显示。flat 化 scenes → 渲染逐 slot。
  const allSlots = useMemo(() => flatSlotsOf(template), [template]);
  const visualSlots = useMemo(
    () => allSlots.filter((s) => s.layer_type !== "audio").sort((a, b) => a.z_index - b.z_index),
    [allSlots]
  );
  const audioSlots = allSlots.filter((s) => s.layer_type === "audio");
  const canvasRef = useRef<HTMLDivElement>(null);

  return (
    <div className={cn("relative", className)}>
      <div
        ref={canvasRef}
        className="relative w-full rounded-xl overflow-hidden bg-black shadow-2xl ring-1 ring-white/10"
        style={{
          aspectRatio: `${template.canvas.width} / ${template.canvas.height}`,
          backgroundColor: template.canvas.background_color,
        }}
      >
        {/* 静态网格底纹 */}
        <div className="absolute inset-0 opacity-[0.04]"
             style={{
               backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
               backgroundSize: "20px 20px",
             }}
        />

        {/* slot 渲染 */}
        {visualSlots.map((slot) => {
          if (!slot.rect) return null;
          const dx = variantSeed != null ? jitter(variantSeed, slot.slot_id + "x", (slot.perturbation?.position_jitter ?? 0) * 100) : 0;
          const dy = variantSeed != null ? jitter(variantSeed, slot.slot_id + "y", (slot.perturbation?.position_jitter ?? 0) * 100) : 0;
          return (
            <SlotBox
              key={slot.slot_id}
              slot={slot}
              canvas={template.canvas}
              binding={bindings?.[slot.slot_id]}
              selected={selectedSlotId === slot.slot_id}
              showChrome={showSlotChrome}
              onClick={() => onSelectSlot?.(slot.slot_id === selectedSlotId ? null : slot.slot_id)}
              extraDx={dx}
              extraDy={dy}
              editable={!!editable && !variantSeed}
              canvasRef={canvasRef}
              onChangeRect={(next) => onChangeSlotRect?.(slot.slot_id, next)}
            />
          );
        })}

        {/* 画布信息 */}
        {showSlotChrome && (
          <div className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur text-[10px] text-white/80 font-mono">
            {template.canvas.width}×{template.canvas.height} · {template.canvas.duration}s · {template.canvas.fps}fps
          </div>
        )}
        {showSlotChrome && variantSeed != null && (
          <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-brand-500/30 backdrop-blur text-[10px] text-brand-100 font-medium border border-brand-500/40">
            变体 #{variantSeed + 1}
          </div>
        )}
      </div>

      {audioSlots.length > 0 && showSlotChrome && (
        <div className="mt-3 flex flex-wrap gap-2">
          {audioSlots.map((s) => {
            const Icon = LAYER_STYLES.audio.icon;
            return (
              <button
                key={s.slot_id}
                onClick={() => onSelectSlot?.(s.slot_id)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs",
                  selectedSlotId === s.slot_id
                    ? "bg-violet-500/20 border-violet-500/60 text-violet-200"
                    : "bg-violet-500/5 border-violet-500/20 text-violet-300/80 hover:bg-violet-500/10"
                )}
              >
                <Icon className="size-3" />
                {s.label || s.slot_id}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SlotBox({
  slot,
  canvas,
  binding,
  selected,
  showChrome,
  onClick,
  extraDx,
  extraDy,
  editable,
  canvasRef,
  onChangeRect,
}: {
  slot: TemplateSlot;
  canvas: Template["canvas"];
  binding?: SlotBinding;
  selected: boolean;
  showChrome: boolean;
  onClick: () => void;
  extraDx: number;
  extraDy: number;
  editable: boolean;
  canvasRef: React.RefObject<HTMLDivElement | null>;
  onChangeRect: (next: Rect) => void;
}) {
  if (!slot.rect) return null;
  const r = slot.rect;
  const style: React.CSSProperties = {
    left: `${r.x * 100 + extraDx}%`,
    top: `${r.y * 100 + extraDy}%`,
    width: `${r.w * 100}%`,
    height: `${r.h * 100}%`,
    zIndex: slot.z_index,
  };

  // 像素坐标（用 canvas 真实分辨率换算,不是 DOM 像素）
  const pxX = Math.round(r.x * canvas.width);
  const pxY = Math.round(r.y * canvas.height);
  const pxW = Math.round(r.w * canvas.width);
  const pxH = Math.round(r.h * canvas.height);

  // 拖拽 handle:监听 pointerdown,document 上挂 move/up,实时回调
  const startDrag = (handle: Handle) => (e: React.PointerEvent) => {
    if (!editable) return;
    e.stopPropagation();
    e.preventDefault();
    const container = canvasRef.current;
    if (!container) return;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    const startX = e.clientX;
    const startY = e.clientY;
    const startRect = { ...r };

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / cw;
      const dy = (ev.clientY - startY) / ch;
      onChangeRect(applyDrag(startRect, handle, dx, dy));
    };
    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", onUp);
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onUp);
  };
  const meta = LAYER_STYLES[slot.layer_type] || LAYER_STYLES.image;
  const Icon = meta.icon;
  const filled = !!binding && binding.source !== "fixed";
  const mediaUrl = bindingMediaUrl(binding);

  return (
    <button
      type="button"
      onClick={onClick}
      onPointerDown={editable ? startDrag("move") : undefined}
      style={style}
      className={cn(
        "absolute group transition-all duration-150",
        showChrome ? "cursor-pointer" : "pointer-events-none",
        editable && "cursor-move touch-none"
      )}
    >
      <div
        className={cn(
          "absolute inset-0 rounded-md border-2 transition-all overflow-hidden",
          showChrome ? meta.border : "border-transparent",
          showChrome && !selected && "border-dashed opacity-60 group-hover:opacity-100",
          selected && "border-solid ring-2 ring-brand-500/60 ring-offset-2 ring-offset-black",
          // 已绑定真实媒体的 slot 不再用类型色背景,避免遮挡真实内容
          showChrome && !mediaUrl && meta.bg
        )}
      >
        {/* 填充预览 */}
        {slot.layer_type === "text" && (
          <div className="absolute inset-0 flex items-center justify-center px-2">
            <span
              className={cn(
                "text-center font-bold text-white truncate leading-tight",
                slot.style_preset?.includes("80px") ? "text-2xl" : slot.style_preset?.includes("60px") ? "text-lg" : "text-base"
              )}
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.85)" }}
            >
              {binding && binding.source === "input" ? binding.text : slot.default_value || "(主标题文案)"}
            </span>
          </div>
        )}

        {slot.layer_type === "video" && (
          <div className="absolute inset-0">
            {mediaUrl ? (
              isVideoUrl(mediaUrl) ? (
                <video
                  src={mediaUrl}
                  preload="metadata"
                  muted
                  playsInline
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                />
              ) : (
                <img
                  src={mediaUrl}
                  alt={slot.label || slot.slot_id}
                  className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                />
              )
            ) : filled ? (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 grid place-items-center">
                <div className="text-center text-white/80">
                  <Video className="size-8 mx-auto mb-1" />
                  <div className="text-[10px] font-mono">明星片段已绑定</div>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 grid place-items-center text-center text-white/40">
                <div>
                  <Video className="size-8 mx-auto mb-1" />
                  <div className="text-[10px]">从素材库选择明星片段</div>
                </div>
              </div>
            )}
          </div>
        )}

        {slot.layer_type === "image" && (
          <div className="absolute inset-0">
            {mediaUrl ? (
              <img
                src={mediaUrl}
                alt={slot.label || slot.slot_id}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none bg-white/95"
              />
            ) : filled ? (
              <div className="absolute inset-2 bg-white/95 rounded grid place-items-center">
                <div className="text-center">
                  <ImageIcon className="size-7 mx-auto text-slate-400" />
                  <div className="text-[9px] mt-1 font-mono text-slate-500">商品主图</div>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 grid place-items-center text-center text-white/40">
                <div>
                  <ImageIcon className="size-7 mx-auto mb-1" />
                  <div className="text-[10px]">上传商品图</div>
                </div>
              </div>
            )}
          </div>
        )}

        {slot.layer_type === "sticker" && (
          <div className="absolute inset-0 grid place-items-center">
            {mediaUrl ? (
              <img
                src={mediaUrl}
                alt={slot.label || slot.slot_id}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              />
            ) : (
              // 中性白底胶囊 + 细描边 + 轻阴影:
              // 不论 canvas 是黑/黄/红/cream 哪种背景色,都能拉出对比、字读得出来;
              // 同一卡里多个 sticker 颜色一致,扫视时不会被花花绿绿干扰。
              <div className="px-2.5 py-1 rounded-md bg-white text-slate-900 text-[11px] font-medium max-w-full truncate shadow-sm ring-1 ring-black/10">
                {stickerDisplayText(slot, binding)}
              </div>
            )}
          </div>
        )}

        {slot.layer_type === "digital_human" && (
          <div className="absolute inset-0 bg-gradient-to-br from-cyan-900/40 to-blue-900/40 grid place-items-center">
            <div className="text-center text-cyan-200">
              <Sparkles className="size-8 mx-auto mb-1" />
              <div className="text-[10px] font-mono">AI 数字人</div>
            </div>
          </div>
        )}

        {/* slot 标签角标 */}
        {showChrome && (
          <div
            className={cn(
              "absolute -top-px -left-px px-1.5 py-0.5 text-[9px] font-mono rounded-br-md rounded-tl-md backdrop-blur",
              meta.bg,
              meta.text,
              "border-r border-b",
              meta.border,
              "opacity-0 group-hover:opacity-100 transition-opacity",
              selected && "opacity-100"
            )}
          >
            <Icon className="size-2.5 inline mr-1" />
            {slot.slot_id}
            {slot.required && <span className="ml-1 text-brand-400">*</span>}
          </div>
        )}

        {/* 像素坐标角标 — 仅当前选中槽位显示。位置在槽内右上,避免堆在画布外造成混乱。 */}
        {selected && showChrome && (
          <div className="absolute top-1 right-1 px-1.5 py-0.5 text-[9px] font-mono rounded-md bg-foreground/85 text-background backdrop-blur">
            {pxW}×{pxH} @ ({pxX},{pxY})
          </div>
        )}
      </div>

      {/* 8 个 resize 句柄,仅 editable + selected 时显示 */}
      {editable && selected && (
        <>
          {(["nw", "ne", "sw", "se"] as Handle[]).map((h) => (
            <div
              key={h}
              onPointerDown={startDrag(h)}
              className={cn(
                "absolute size-3 rounded-full bg-brand-500 border-2 border-white shadow-md z-10 touch-none",
                h === "nw" && "-top-1.5 -left-1.5 cursor-nwse-resize",
                h === "ne" && "-top-1.5 -right-1.5 cursor-nesw-resize",
                h === "sw" && "-bottom-1.5 -left-1.5 cursor-nesw-resize",
                h === "se" && "-bottom-1.5 -right-1.5 cursor-nwse-resize",
              )}
            />
          ))}
          {(["n", "s", "w", "e"] as Handle[]).map((h) => (
            <div
              key={h}
              onPointerDown={startDrag(h)}
              className={cn(
                "absolute bg-brand-500 border-2 border-white shadow z-10 touch-none",
                h === "n" && "-top-1 left-1/2 -translate-x-1/2 w-4 h-2 rounded-sm cursor-ns-resize",
                h === "s" && "-bottom-1 left-1/2 -translate-x-1/2 w-4 h-2 rounded-sm cursor-ns-resize",
                h === "w" && "-left-1 top-1/2 -translate-y-1/2 h-4 w-2 rounded-sm cursor-ew-resize",
                h === "e" && "-right-1 top-1/2 -translate-y-1/2 h-4 w-2 rounded-sm cursor-ew-resize",
              )}
            />
          ))}
        </>
      )}
    </button>
  );
}
