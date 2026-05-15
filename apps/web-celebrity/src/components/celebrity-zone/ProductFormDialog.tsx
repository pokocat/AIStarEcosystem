"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
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
import { CTA_PRIMARY, CTA_SECONDARY } from "@/constants/celebrity-zone-ui";

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
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setCategory(initial.category);
      setLink(initial.link ?? "");
      setImages(initial.images ?? []);
      setSellingPoints(initial.sellingPoints ?? "");
    } else {
      setName("");
      setCategory("其他");
      setLink("");
      setImages([]);
      setSellingPoints("");
    }
    setImageInput("");
    setSubmitting(false);
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

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const saved = await onSubmit({
        name: name.trim(),
        category,
        link: link.trim() || undefined,
        images,
        sellingPoints: sellingPoints.trim(),
        source: initial?.source ?? "manual",
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
            {initial ? "编辑商品" : "快速录入商品"}
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            录入后可在生成带货视频时复用，提升二次生成效率。
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
              <select
                className={inputCls}
                value={category}
                onChange={(e) => setCategory(e.target.value as ProductCategory)}
              >
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="商品链接">
              <input
                className={inputCls}
                value={link}
                onChange={(e) => setLink(e.target.value)}
                placeholder="https://…（淘宝 / 抖店 / 小红书）"
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
