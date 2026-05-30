"use client";

import * as React from "react";
import { Library, Sparkles } from "lucide-react";
import type { CelebrityProductInput } from "@ai-star-eco/types/celebrity-zone";
import { ProductsApi } from "@/api";
import { ProductPickerDialog } from "./ProductPickerDialog";
import { AiErrorNotice, errorMessage } from "@/components/common/ai-error-notice";
import { cn } from "@ai-star-eco/ui/ui/utils";

interface Props {
  value: CelebrityProductInput;
  onChange: (next: CelebrityProductInput) => void;
  /** 卖点描述是否选填 */
  sellingPointsOptional?: boolean;
  /** 标题文案，默认「商品信息」；盲盒模式可传「商品信息（必填）」 */
  title?: string;
}

const inputCls =
  "w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none transition focus:border-violet-500 focus:bg-white";

/** 商品信息表单（模板 / 盲盒共用），仅做「per-generation 字段收集」。
 *
 * v0.42+ 「AI 提取卖点」只返回文本、不写商品库；普通登录用户也可用于当前生成流。
 */
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
  // 卖点提取失败不静默：把后端明确报错（token 未配 / prompt 未配 / 模型异常）展示出来。
  const [extractError, setExtractError] = React.useState<string | null>(null);

  const trimmedName = value.name.trim();
  const trimmedLink = value.link?.trim() ?? "";
  const canExtract =
    trimmedName.length > 0 &&
    trimmedLink.length > 0 &&
    !extracting;

  const onExtract = async () => {
    if (!canExtract) return;
    setExtracting(true);
    setExtractError(null);
    try {
      const { sellingPoints } = await ProductsApi.extractSellingPoints({
        name: trimmedName,
        link: trimmedLink,
      });
      onChange({ ...value, sellingPoints });
    } catch (e) {
      setExtractError(errorMessage(e, "AI 提取卖点失败，请稍后重试"));
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)]">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-zinc-700">{title}</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            className="inline-flex items-center gap-1 rounded-md border border-violet-500/30 bg-violet-500/10 px-2.5 py-1 text-[11px] text-violet-600 transition hover:border-violet-500 hover:bg-violet-500/20"
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
                ? "border-violet-500/30 bg-violet-500/10 text-violet-600 hover:border-violet-500 hover:bg-violet-500/20"
                : "cursor-not-allowed border-zinc-200 bg-zinc-50 text-zinc-400",
            )}
          >
            <Sparkles className="h-3 w-3" /> {extracting ? "提取中" : "AI 提取卖点"}
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
        {!canExtract && !extracting && !extractError && (
          <p className="text-[11px] text-zinc-500">
            💡 想用 AI 自动抽卖点？请先填好商品名称和商品链接 →
          </p>
        )}
        {extractError && (
          <AiErrorNotice title="AI 提取卖点失败" message={extractError} onRetry={onExtract} />
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
