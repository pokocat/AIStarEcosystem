"use client";

import * as React from "react";
import { Library, Sparkles } from "lucide-react";
import type { CelebrityProductInput } from "@/types/celebrity-zone";
import { ProductsApi } from "@/api";
import { ProductPickerDialog } from "./ProductPickerDialog";
import { cn } from "@/components/ui/utils";

interface Props {
  value: CelebrityProductInput;
  onChange: (next: CelebrityProductInput) => void;
  /** 卖点描述是否选填 */
  sellingPointsOptional?: boolean;
  /** 标题文案，默认「商品信息」；盲盒模式可传「商品信息（必填）」 */
  title?: string;
}

const inputCls =
  "w-full rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-white/25 outline-none transition focus:border-cyan-400/60 focus:bg-white/[0.05]";

/** 商品信息表单（模板/盲盒共用）。 */
export function CelebrityProductForm({
  value,
  onChange,
  sellingPointsOptional,
  title = "商品信息",
}: Props) {
  const set = (patch: Partial<CelebrityProductInput>) =>
    onChange({ ...value, ...patch });

  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [extracting, setExtracting] = React.useState(false);

  const trimmedName = value.name.trim();
  const trimmedLink = value.link?.trim() ?? "";
  const canExtract =
    trimmedName.length > 0 && trimmedLink.length > 0 && !extracting;

  const onExtract = async () => {
    if (!canExtract) return;
    setExtracting(true);
    try {
      const { sellingPoints } = await ProductsApi.extractSellingPoints({
        name: trimmedName,
        link: trimmedLink,
      });
      onChange({ ...value, sellingPoints });
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-white/70">{title}</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-[11px] text-purple-200 transition hover:border-purple-400 hover:text-white"
          >
            <Library className="h-3 w-3" /> 从商品库选择
          </button>
          <button
            type="button"
            disabled={!canExtract}
            title={
              !canExtract
                ? "请先填写商品名称和商品链接"
                : "调用 AI 抽取卖点（基于商品名 + 链接）"
            }
            onClick={onExtract}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] transition",
              canExtract
                ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200 hover:border-cyan-400 hover:text-white"
                : "cursor-not-allowed border-white/10 bg-white/[0.02] text-white/30",
            )}
          >
            <Sparkles className="h-3 w-3" /> {extracting ? "AI 抽取中…" : "AI 提取卖点"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <input
          className={inputCls}
          placeholder="商品名称…"
          value={value.name}
          onChange={(e) => set({ name: e.target.value })}
        />
        <input
          className={inputCls}
          placeholder="商品链接 / 上传图片…"
          value={value.link ?? ""}
          onChange={(e) => set({ link: e.target.value })}
        />
        <textarea
          className={inputCls + " min-h-[72px] resize-none"}
          placeholder={
            sellingPointsOptional
              ? "卖点描述（选填，不填 AI 自行发挥）…"
              : "卖点描述…"
          }
          value={value.sellingPoints}
          onChange={(e) => set({ sellingPoints: e.target.value })}
        />
        {!canExtract && !extracting && (
          <p className="text-[11px] text-white/35">
            💡 想用 AI 自动抽卖点？请先填好商品名称和商品链接 →
          </p>
        )}
      </div>

      <ProductPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(p) =>
          onChange({
            ...value,
            name: p.name,
            link: p.link ?? value.link,
            images: p.images?.length ? p.images : value.images,
            sellingPoints: p.sellingPoints || value.sellingPoints,
          })
        }
      />
    </div>
  );
}
