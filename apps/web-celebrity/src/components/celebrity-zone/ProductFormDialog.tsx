"use client";

import * as React from "react";
import { Loader2, Plus, Sparkles, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ai-star-eco/ui/ui/dialog";
import {
  PRODUCT_CATEGORIES,
  type Product,
  type ProductCategory,
  type ProductInput,
} from "@ai-star-eco/types/product";
import { ProductsApi } from "@/api";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/constants/celebrity-zone-ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ai-star-eco/ui/ui/select";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 编辑模式时传入；新建则为 null */
  initial: Product | null;
  /** 提交回调（保存到后端 / mock） */
  onSubmit: (input: ProductInput) => Promise<Product>;
  /** 提交完成后的处理 */
  onSaved: (saved: Product) => void;
}

const inputCls =
  "w-full rounded-md border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-violet-500 focus:bg-white";

type ParseStatus =
  | { kind: "idle" }
  | { kind: "parsing" }
  | { kind: "success"; imagesFilled: number; titleFilled: boolean }
  | { kind: "fail"; reason: string };

export function ProductFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  onSaved,
}: Props) {
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<ProductCategory>("其他");
  const [link, setLink] = React.useState("");
  const [imageInput, setImageInput] = React.useState("");
  const [images, setImages] = React.useState<string[]>([]);
  const [sellingPoints, setSellingPoints] = React.useState("");
  const [priceYuan, setPriceYuan] = React.useState("");
  const [commissionRate, setCommissionRate] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [parseStatus, setParseStatus] = React.useState<ParseStatus>({ kind: "idle" });

  React.useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setCategory(initial.category);
      setLink(initial.link ?? "");
      setImages(initial.images ?? []);
      setSellingPoints(initial.sellingPoints ?? "");
      setPriceYuan(initial.priceCents != null ? (initial.priceCents / 100).toFixed(2).replace(/\.00$/, "") : "");
      setCommissionRate(initial.commissionRate != null ? String(initial.commissionRate) : "");
    } else {
      setName("");
      setCategory("其他");
      setLink("");
      setImages([]);
      setSellingPoints("");
      setPriceYuan("");
      setCommissionRate("");
    }
    setImageInput("");
    setSubmitting(false);
    setParseStatus({ kind: "idle" });
  }, [open, initial]);

  const canSubmit = name.trim().length > 0 && !submitting;

  const addImage = () => {
    const url = imageInput.trim();
    if (!url) return;
    setImages((prev) => (prev.includes(url) ? prev : [...prev, url]));
    setImageInput("");
  };

  const removeImage = (url: string) =>
    setImages((prev) => prev.filter((x) => x !== url));

  /**
   * 抖音链接智能解析：仅覆盖空字段（已填的不动）。
   * Mock 模式由前端 parseProductLinkInBrowser 处理形态 A；
   * 真后端模式由 server handler 链路统一处理（含形态 A + 短链 B）。
   */
  const handleParseFromLink = async () => {
    const url = link.trim();
    if (!url) return;
    setParseStatus({ kind: "parsing" });
    try {
      const info = await ProductsApi.parseProductLink(url);
      if (!info) {
        setParseStatus({ kind: "fail", reason: "未识别为已支持的商品链接" });
        return;
      }
      let imagesFilled = 0;
      let titleFilled = false;
      // 仅覆盖空字段
      if (!name.trim() && info.title) {
        setName(info.title);
        titleFilled = true;
      }
      if (images.length === 0 && info.imageUrls.length > 0) {
        setImages(info.imageUrls);
        imagesFilled = info.imageUrls.length;
      }
      if (!sellingPoints.trim() && info.inferredSellingPoints) {
        setSellingPoints(info.inferredSellingPoints);
      }
      if (!priceYuan.trim() && info.minPriceCents != null) {
        setPriceYuan((info.minPriceCents / 100).toFixed(2).replace(/\.00$/, ""));
      }
      setParseStatus({ kind: "success", imagesFilled, titleFilled });
    } catch (e) {
      setParseStatus({
        kind: "fail",
        reason: e instanceof Error ? e.message : "无法识别链接",
      });
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const priceCents = priceYuan.trim()
        ? Math.round(parseFloat(priceYuan.trim()) * 100)
        : undefined;
      const commissionInt = commissionRate.trim()
        ? parseInt(commissionRate.trim().replace(/%/g, ""), 10)
        : undefined;
      const saved = await onSubmit({
        name: name.trim(),
        category,
        link: link.trim() || undefined,
        images,
        sellingPoints: sellingPoints.trim(),
        source: initial?.source ?? "manual",
        priceCents: Number.isFinite(priceCents) ? priceCents : undefined,
        commissionRate: Number.isFinite(commissionInt) ? commissionInt : undefined,
      });
      onSaved(saved);
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-zinc-200 bg-white text-zinc-900 shadow-[var(--shadow-pop)]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">
            {initial ? "编辑商品" : "新增商品"}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            录入后可在生成带货视频时复用，让重复生成更快。粘贴抖音商城链接可一键填好。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <Field label="商品名称" required>
            <input
              className={inputCls}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：玻尿酸口红 · 樱花粉"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="类目">
              <Select value={category} onValueChange={(v) => setCategory(v as ProductCategory)}>
                <SelectTrigger className="h-9 w-full rounded-md border-zinc-200 bg-white text-sm focus:ring-0">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRODUCT_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="商品链接">
              <input
                className={inputCls}
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://…（抖店 / 淘宝 / 小红书）"
              />
            </Field>
          </div>

          {/* v0.26+ 从抖音商城链接智能解析 */}
          <div className="flex flex-col gap-1.5">
            <button
              type="button"
              onClick={handleParseFromLink}
              disabled={!link.trim() || parseStatus.kind === "parsing"}
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-violet-400/40 bg-violet-500/10 px-3 py-2 text-xs text-violet-700 hover:border-violet-500 hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {parseStatus.kind === "parsing" ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> 正在提取
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" /> 📋 从抖音链接提取（仅填空项）
                </>
              )}
            </button>
            {parseStatus.kind === "success" && (
              <div className="text-[11px] text-emerald-600">
                ✓ 已提取：
                {parseStatus.titleFilled && "填好商品名 · "}
                {parseStatus.imagesFilled > 0 && `${parseStatus.imagesFilled} 张图片 · `}
                {!parseStatus.titleFilled && parseStatus.imagesFilled === 0 && "已填字段保持不变"}
              </div>
            )}
            {parseStatus.kind === "fail" && (
              <div className="text-[11px] text-pink-600">✗ {parseStatus.reason}</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="价格（元，可空）">
              <input
                type="number"
                step="0.01"
                min="0"
                className={inputCls}
                value={priceYuan}
                onChange={(e) => setPriceYuan(e.target.value)}
                placeholder="9.90"
              />
            </Field>
            <Field label="佣金率（%，可空）">
              <input
                type="number"
                step="1"
                min="0"
                max="100"
                className={inputCls}
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
                placeholder="50"
              />
            </Field>
          </div>

          <Field label="商品图片（可粘贴 URL，按回车添加）">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <input
                  className={inputCls}
                  value={imageInput}
                  onChange={(e) => setImageInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addImage();
                    }
                  }}
                  placeholder="https://example.com/image.jpg"
                />
                <button
                  type="button"
                  onClick={addImage}
                  className="shrink-0 rounded-md border border-violet-400/40 bg-violet-500/10 px-3 py-2 text-xs text-violet-600 hover:border-violet-500 hover:bg-violet-500/20"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              {images.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {images.map((url) => (
                    <div
                      key={url}
                      className="group relative h-14 w-14 overflow-hidden rounded-md border border-zinc-200"
                    >
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeImage(url)}
                        className="absolute right-0 top-0 flex h-4 w-4 items-center justify-center bg-white/85 text-zinc-900 opacity-0 transition group-hover:opacity-100"
                        aria-label="移除"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Field>

          <Field label="卖点描述">
            <textarea
              className={inputCls + " min-h-[88px] resize-none"}
              value={sellingPoints}
              onChange={(e) => setSellingPoints(e.target.value)}
              placeholder="可选；不填后续 AI 自动抽取或自由发挥…"
            />
          </Field>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={CTA_SECONDARY}
          >
            取消
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className={CTA_PRIMARY}
          >
            {submitting ? "保存中…" : initial ? "保存修改" : "保存到商品库"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-zinc-600">
        {label}
        {required && <span className="ml-0.5 text-pink-600">*</span>}
      </span>
      {children}
    </label>
  );
}
