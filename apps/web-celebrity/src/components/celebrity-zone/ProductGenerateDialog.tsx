"use client";

// 从商品库点「生成视频」→ 弹本对话框。
// 第一步：选生成方式 —— ✨ 脚本生成（AI 分镜创作，进素材运营脚本工坊）/ 🎬 模板生成（混剪）。
//   · 脚本生成 → 跳 /material/workshop?compose=<productId>，自动锚定该商品建草稿进编辑。
//   · 模板生成 → 选模板 → 跳 /mixcut/create/{tplId}?product_id=X（进 create 页自动填 slot）。

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles, ScrollText, Clapperboard, ChevronLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ai-star-eco/ui/ui/dialog";
import { MixcutApi } from "@/api";
import type { Product } from "@ai-star-eco/types/product";
import type { Template } from "@/components/mixcut-zone/types";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/constants/celebrity-zone-ui";
import { cn } from "@ai-star-eco/ui/ui/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product | null;
}

type Stage = "mode" | "template";

export function ProductGenerateDialog({ open, onOpenChange, product }: Props) {
  const router = useRouter();
  const [stage, setStage] = React.useState<Stage>("mode");
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) setStage("mode");
  }, [open]);

  // 进入「模板生成」步骤时再拉模板，避免脚本生成路径白拉一次。
  React.useEffect(() => {
    if (!open || stage !== "template") return;
    setSelectedId(null);
    setLoading(true);
    MixcutApi.listTemplates()
      .then((list) => {
        setTemplates(list);
        if (list.length > 0) setSelectedId(list[0].template_id);
      })
      .finally(() => setLoading(false));
  }, [open, stage]);

  const goScript = () => {
    if (!product) return;
    router.push(`/material/workshop?compose=${encodeURIComponent(product.id)}`);
    onOpenChange(false);
  };

  const handleStart = () => {
    if (!selectedId || !product) return;
    router.push(`/mixcut/create/${selectedId}?product_id=${encodeURIComponent(product.id)}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "border-zinc-200 bg-white text-zinc-900 shadow-[var(--shadow-pop)]",
          stage === "template" ? "max-w-3xl" : "max-w-lg",
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-600" />
            为商品生成视频
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            {stage === "mode"
              ? "选择生成方式：脚本生成（AI 分镜创作）或模板生成（素材混剪）。"
              : "选择模板后跳转混剪工作台，商品信息（图片 / 名称 / 卖点）会自动填充到模板槽位。"}
          </DialogDescription>
        </DialogHeader>

        {/* 商品卡 */}
        {product && (
          <div className="flex items-start gap-3 rounded-lg border border-violet-400/30 bg-violet-500/[0.04] p-3">
            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100">
              {product.images[0] ? (
                <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-400">无图</div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="line-clamp-1 text-sm font-medium text-zinc-800">{product.name}</div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
                <span className="rounded border border-violet-400/30 bg-violet-500/10 px-1.5 py-0.5 text-violet-600">
                  {product.category}
                </span>
                {product.priceCents != null && (
                  <span>¥{(product.priceCents / 100).toFixed(2).replace(/\.00$/, "")}</span>
                )}
                {product.commissionRate != null && (
                  <span>佣金 {product.commissionRate}%</span>
                )}
                {product.images.length > 0 && <span>· 已有 {product.images.length} 张图</span>}
              </div>
            </div>
          </div>
        )}

        {/* 第一步：模式选择 */}
        {stage === "mode" && (
          <div className="my-1 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={goScript}
              className="group flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-violet-400/60 hover:shadow-[var(--shadow-lift)]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-violet-400/40 bg-violet-500/10 text-violet-600">
                <ScrollText className="h-5 w-5" />
              </span>
              <div className="text-sm font-semibold text-zinc-900">脚本生成</div>
              <p className="text-xs leading-relaxed text-zinc-500">
                进素材运营脚本工坊，AI 按 5 镜头分镜创作脚本，自动锚定本商品 → 预览 → 渲染。
              </p>
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-violet-600">
                去创作脚本 →
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStage("template")}
              className="group flex flex-col gap-2 rounded-xl border border-zinc-200 bg-white p-4 text-left transition hover:-translate-y-0.5 hover:border-emerald-400/60 hover:shadow-[var(--shadow-lift)]"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-emerald-400/40 bg-emerald-500/10 text-emerald-600">
                <Clapperboard className="h-5 w-5" />
              </span>
              <div className="text-sm font-semibold text-zinc-900">模板生成</div>
              <p className="text-xs leading-relaxed text-zinc-500">
                用混剪模板拼接已有素材 + 防同质化扰动，商品图 / 名称 / 卖点自动填入槽位。
              </p>
              <span className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600">
                选模板 →
              </span>
            </button>
          </div>
        )}

        {/* 第二步：模板 grid */}
        {stage === "template" && (
          <div className="my-2">
            {loading ? (
              <div className="flex items-center justify-center py-10 text-sm text-zinc-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载模板
              </div>
            ) : templates.length === 0 ? (
              <div className="py-10 text-center text-sm text-zinc-500">还没有可用模板</div>
            ) : (
              <div className="grid max-h-[420px] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
                {templates.map((t) => (
                  <button
                    key={t.template_id}
                    type="button"
                    onClick={() => setSelectedId(t.template_id)}
                    className={cn(
                      "group flex flex-col gap-2 rounded-xl border bg-white p-2 text-left transition",
                      selectedId === t.template_id
                        ? "border-violet-500 ring-2 ring-violet-400/40 shadow-[var(--shadow-lift)]"
                        : "border-zinc-200 hover:border-violet-400/60 hover:shadow-[var(--shadow-soft)]"
                    )}
                  >
                    <div className="aspect-[3/4] w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
                      {t.metadata.thumbnail_url ? (
                        <img
                          src={t.metadata.thumbnail_url}
                          alt={t.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
                          无封面
                        </div>
                      )}
                    </div>
                    <div className="px-0.5">
                      <div className="line-clamp-1 text-xs font-medium text-zinc-800">{t.name}</div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[10px] text-zinc-500">
                        <span>{t.scenes.length} 场景</span>
                        <span>·</span>
                        <span>{t.canvas.duration}s</span>
                        {t.metadata.required_tier !== "trial" && (
                          <span className="rounded border border-amber-400/30 bg-amber-500/10 px-1 text-amber-700">
                            {t.metadata.required_tier}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {stage === "template" ? (
            <button type="button" onClick={() => setStage("mode")} className={CTA_SECONDARY}>
              <ChevronLeft className="h-3.5 w-3.5" /> 返回
            </button>
          ) : (
            <button type="button" onClick={() => onOpenChange(false)} className={CTA_SECONDARY}>
              取消
            </button>
          )}
          {stage === "template" && (
            <button type="button" onClick={handleStart} disabled={!selectedId || !product} className={CTA_PRIMARY}>
              <Sparkles className="h-3.5 w-3.5" /> 开始制作
            </button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

