"use client";

// v0.16: picgen 文字转图 slot 子组件。
//
// 模板里把 image slot 的 fill_strategy 设为 "picgen_text" 后，用户在 create 页填
// 主标题/副标题/标签。点「生成预览」 → 后端调 pic-gen 服务出图 → 写入 binding.preview_url。
//
// 注意：预览图只是参考。提交渲染时，后端会以 (jobId, variantIndex, slotId) 为 seed
// 重新调 pic-gen，每条变体独立选模板/配色/字体，所以最终成片与预览必有差异。这点必须
// 在 UI 上明确告诉用户，避免「为什么和预览不一样」的支持工单。

import { useState } from "react";
import { Sparkles, Loader2, AlertCircle, RefreshCw, Wand2 } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { MixcutApi } from "@/api";
import type { TemplateSlot, SlotBinding } from "./types";

interface Props {
  slot: TemplateSlot;
  binding?: SlotBinding;
  onChange: (binding: SlotBinding | undefined) => void;
  /** 用于把 slot.rect 折算成实际像素尺寸传给 pic-gen。 */
  canvasWidth?: number;
  canvasHeight?: number;
}

function resolveSize(slot: TemplateSlot, canvasW?: number, canvasH?: number): { width: number; height: number } {
  // 取 slot.rect 在 canvas 上的实际像素；上限 1920，下限 200，保证 puppeteer 截图体感合理
  const cw = canvasW ?? 1080;
  const ch = canvasH ?? 1920;
  const rw = slot.rect?.w ?? 0.9;
  const rh = slot.rect?.h ?? 0.2;
  const width = Math.max(200, Math.min(1920, Math.round(cw * rw)));
  const height = Math.max(120, Math.min(1080, Math.round(ch * rh)));
  return { width, height };
}

export function PicgenSlotInput({ slot, binding, onChange, canvasWidth, canvasHeight }: Props) {
  const current = binding?.source === "picgen" ? binding : null;
  const title = current?.title ?? "";
  const subtitle = current?.subtitle ?? "";
  const tag = current?.tag ?? "";
  const previewUrl = current?.preview_url ?? null;

  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (patch: Partial<{ title: string; subtitle: string; tag: string; preview_url: string | undefined }>) => {
    const next: SlotBinding = {
      source: "picgen",
      title: patch.title !== undefined ? patch.title : title,
      subtitle: patch.subtitle !== undefined ? patch.subtitle : subtitle || undefined,
      tag: patch.tag !== undefined ? patch.tag : tag || undefined,
      preview_url: patch.preview_url !== undefined ? patch.preview_url : previewUrl ?? undefined,
    };
    // 文字改了之后 preview_url 失效（除非这次更新本身就是更新 preview_url）
    if (
      (patch.title !== undefined && patch.title !== title) ||
      (patch.subtitle !== undefined && patch.subtitle !== subtitle) ||
      (patch.tag !== undefined && patch.tag !== tag)
    ) {
      if (patch.preview_url === undefined) next.preview_url = undefined;
    }
    onChange(next);
  };

  const handlePreview = async () => {
    if (!title.trim()) {
      setError("先填一个主标题");
      return;
    }
    setError(null);
    setPreviewing(true);
    try {
      const { width, height } = resolveSize(slot, canvasWidth, canvasHeight);
      const res = await MixcutApi.picgenPreview({
        title: title.trim(),
        subtitle: subtitle.trim() || undefined,
        tag: tag.trim() || undefined,
        width,
        height,
      });
      update({ preview_url: res.preview_url });
    } catch (e: any) {
      setError(e?.message ?? "生成预览失败，请稍后重试");
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="rounded-lg bg-gradient-to-br from-fuchsia-500/10 to-violet-500/10 border border-fuchsia-500/30 p-3">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="size-4 text-fuchsia-400" />
          <span className="text-sm font-medium">AI 文字图 · 每条自动换版式</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          填一段文字，下面可以点生成预览看看大致效果。提交批量生成时，每条变体会随机换字体、配色和版式，
          所以正式视频里的样子和预览不会完全一样 —— 这是有意为之的差异化机制。
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <div>
          <Label className="text-xs">
            主标题 <span className="text-red-500">*</span>
          </Label>
          <Input
            value={title}
            onChange={(e) => update({ title: e.target.value })}
            placeholder="例如：年终大促 闭眼冲"
            maxLength={20}
            className="h-9 mt-1"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div>
          <Label className="text-xs">副标题（可选）</Label>
          <Input
            value={subtitle}
            onChange={(e) => update({ subtitle: e.target.value })}
            placeholder="例如：今日特价 仅限今天"
            maxLength={20}
            className="h-9 mt-1"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div>
          <Label className="text-xs">小标签（可选）</Label>
          <Input
            value={tag}
            onChange={(e) => update({ tag: e.target.value })}
            placeholder="例如：限时 / 新品 / 包邮"
            maxLength={8}
            className="h-9 mt-1"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          size="sm"
          variant={previewUrl ? "outline" : "default"}
          disabled={previewing || !title.trim()}
          onClick={(e) => {
            e.stopPropagation();
            handlePreview();
          }}
        >
          {previewing ? (
            <Loader2 className="size-3 animate-spin" />
          ) : previewUrl ? (
            <RefreshCw className="size-3" />
          ) : (
            <Wand2 className="size-3" />
          )}
          {previewing ? "生成中…" : previewUrl ? "换一张预览" : "生成预览"}
        </Button>
        {previewUrl && (
          <span className="text-[10px] text-muted-foreground">
            ⓘ 仅为示意；正式渲染时每条会再随机一次
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-1.5 text-xs text-red-500">
          <AlertCircle className="size-3 mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {previewUrl && (
        <div className="rounded-lg overflow-hidden border border-border bg-black/5">
          <img src={previewUrl} alt="picgen 预览" className="w-full object-contain" />
        </div>
      )}
    </div>
  );
}
