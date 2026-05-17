"use client";

import { useMemo } from "react";
import { Video, Image as ImageIcon, Type, Music, Sticker, Sparkles } from "lucide-react";
import type { Template, TemplateSlot, SlotBinding } from "./types";
import { cn } from "./lib/utils";

interface Props {
  template: Template;
  bindings?: Record<string, SlotBinding>;
  selectedSlotId?: string | null;
  onSelectSlot?: (slotId: string | null) => void;
  showSlotChrome?: boolean;
  className?: string;
  /** for output preview - pseudo-random variant offset to visualize perturbation */
  variantSeed?: number;
}

const LAYER_STYLES: Record<string, { bg: string; border: string; text: string; icon: any; label: string }> = {
  video: { bg: "bg-blue-500/15", border: "border-blue-500/60", text: "text-blue-300", icon: Video, label: "视频" },
  image: { bg: "bg-emerald-500/15", border: "border-emerald-500/60", text: "text-emerald-300", icon: ImageIcon, label: "图片" },
  sticker: { bg: "bg-amber-500/15", border: "border-amber-500/60", text: "text-amber-200", icon: Sticker, label: "贴图" },
  text: { bg: "bg-fuchsia-500/15", border: "border-fuchsia-500/60", text: "text-fuchsia-200", icon: Type, label: "文字" },
  audio: { bg: "bg-violet-500/15", border: "border-violet-500/60", text: "text-violet-300", icon: Music, label: "音频" },
  digital_human: { bg: "bg-cyan-500/15", border: "border-cyan-500/60", text: "text-cyan-200", icon: Sparkles, label: "数字人" },
};

function jitter(seed: number, slotId: string, max: number): number {
  // 用 slotId + seed 生成稳定的伪随机数
  let h = seed;
  for (let i = 0; i < slotId.length; i++) h = (h * 31 + slotId.charCodeAt(i)) | 0;
  const t = ((h % 1000) / 1000) * 2 - 1;
  return t * max;
}

export function TemplatePreview({
  template,
  bindings,
  selectedSlotId,
  onSelectSlot,
  showSlotChrome = true,
  className,
  variantSeed,
}: Props) {
  // 把音频 slot 单独拎出来,放在底部 chip 显示
  const visualSlots = useMemo(
    () => template.slots.filter((s) => s.layer_type !== "audio").sort((a, b) => a.z_index - b.z_index),
    [template]
  );
  const audioSlots = template.slots.filter((s) => s.layer_type === "audio");

  return (
    <div className={cn("relative", className)}>
      <div
        className="relative w-full aspect-[9/16] rounded-xl overflow-hidden bg-black shadow-2xl ring-1 ring-white/10"
        style={{ backgroundColor: template.canvas.background_color }}
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
              binding={bindings?.[slot.slot_id]}
              selected={selectedSlotId === slot.slot_id}
              showChrome={showSlotChrome}
              onClick={() => onSelectSlot?.(slot.slot_id === selectedSlotId ? null : slot.slot_id)}
              extraDx={dx}
              extraDy={dy}
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
  binding,
  selected,
  showChrome,
  onClick,
  extraDx,
  extraDy,
}: {
  slot: TemplateSlot;
  binding?: SlotBinding;
  selected: boolean;
  showChrome: boolean;
  onClick: () => void;
  extraDx: number;
  extraDy: number;
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
  const meta = LAYER_STYLES[slot.layer_type] || LAYER_STYLES.image;
  const Icon = meta.icon;
  const filled = !!binding && binding.source !== "fixed";

  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={cn(
        "absolute group transition-all duration-150",
        showChrome ? "cursor-pointer" : "pointer-events-none"
      )}
    >
      <div
        className={cn(
          "absolute inset-0 rounded-md border-2 transition-all",
          showChrome ? meta.border : "border-transparent",
          showChrome && !selected && "border-dashed opacity-60 group-hover:opacity-100",
          selected && "border-solid ring-2 ring-brand-500/60 ring-offset-2 ring-offset-black",
          showChrome && meta.bg
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
              style={{ textShadow: "0 1px 3px rgba(0,0,0,0.8), 0 0 8px rgba(251,44,89,0.4)" }}
            >
              {binding && binding.source === "input" ? binding.text : slot.default_value || "(主标题文案)"}
            </span>
          </div>
        )}

        {slot.layer_type === "video" && (
          <div className={cn("absolute inset-0 grid place-items-center", filled ? "" : "")}>
            {filled ? (
              <div className="absolute inset-0 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 grid place-items-center">
                <div className="text-center text-white/80">
                  <Video className="size-8 mx-auto mb-1" />
                  <div className="text-[10px] font-mono">明星片段已绑定</div>
                </div>
              </div>
            ) : (
              <div className="text-center text-white/40">
                <Video className="size-8 mx-auto mb-1" />
                <div className="text-[10px]">从素材库选择明星片段</div>
              </div>
            )}
          </div>
        )}

        {slot.layer_type === "image" && (
          <div className="absolute inset-0 grid place-items-center">
            {filled ? (
              <div className="absolute inset-2 bg-white/95 rounded grid place-items-center">
                <div className="text-center">
                  <ImageIcon className="size-7 mx-auto text-slate-400" />
                  <div className="text-[9px] mt-1 font-mono text-slate-500">商品主图</div>
                </div>
              </div>
            ) : (
              <div className="text-center text-white/40">
                <ImageIcon className="size-7 mx-auto mb-1" />
                <div className="text-[10px]">上传商品图</div>
              </div>
            )}
          </div>
        )}

        {slot.layer_type === "sticker" && (
          <div className="absolute inset-0 grid place-items-center">
            <div
              className={cn(
                "px-3 py-1 rounded text-white text-xs font-bold flex items-center gap-1",
                slot.slot_id.includes("title") && "bg-gradient-to-r from-red-500 to-orange-500",
                slot.slot_id.includes("promo") && "bg-gradient-to-r from-yellow-400 to-amber-500 text-amber-950",
                slot.slot_id.includes("brand") && "bg-gradient-to-r from-slate-800 to-slate-700 w-full justify-center",
                slot.slot_id.includes("price") && "bg-red-600",
                !slot.slot_id.includes("title") &&
                  !slot.slot_id.includes("promo") &&
                  !slot.slot_id.includes("brand") &&
                  !slot.slot_id.includes("price") && "bg-purple-500"
              )}
            >
              <Sticker className="size-3" />
              {slot.label?.slice(0, 12) || slot.slot_id}
            </div>
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
      </div>
    </button>
  );
}
