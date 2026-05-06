"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import type { CelebrityProductInput } from "@/types/celebrity-zone";

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
  const set = (patch: Partial<CelebrityProductInput>) => onChange({ ...value, ...patch });
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-medium text-white/70">{title}</span>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-1 text-[11px] text-cyan-200 transition hover:border-cyan-400 hover:text-white"
        >
          <Sparkles className="h-3 w-3" /> AI 提取卖点
        </button>
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
      </div>
    </div>
  );
}
