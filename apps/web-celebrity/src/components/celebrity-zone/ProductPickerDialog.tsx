"use client";

import * as React from "react";
import { Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@ai-star-eco/ui/ui/dialog";
import { ProductsApi } from "@/api";
import {
  PRODUCT_CATEGORIES,
  type Product,
  type ProductCategory,
} from "@ai-star-eco/types/product";
import { cn } from "@ai-star-eco/ui/ui/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@ai-star-eco/ui/ui/select";
import { CTA_SECONDARY } from "@/constants/celebrity-zone-ui";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 选中后回调 — 父组件用此填充商品表单 */
  onPick: (product: Product) => void;
}

const inputCls =
  "w-full rounded-md border border-zinc-200 bg-zinc-100 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-violet-500 focus:bg-white";

export function ProductPickerDialog({ open, onOpenChange, onPick }: Props) {
  const [list, setList] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [category, setCategory] = React.useState<"全部" | ProductCategory>("全部");
  const [q, setQ] = React.useState("");

  React.useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    ProductsApi.listProducts({ category, q })
      .then((data) => {
        if (!cancelled) setList(data);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, category, q]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-zinc-200 bg-white text-zinc-900 shadow-[var(--shadow-pop)]">
        <DialogHeader>
          <DialogTitle className="text-base font-semibold">从商品库选择</DialogTitle>
          <DialogDescription className="text-xs text-zinc-500">
            点击商品即可一键填充至当前生成表单。
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {/* Filter row */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
              <input
                className={inputCls + " pl-8"}
                placeholder="搜索商品名称 / 卖点关键词…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as "全部" | ProductCategory)}
            >
              <SelectTrigger className="h-9 w-auto min-w-[120px] rounded-md border-zinc-200 bg-white text-sm focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="全部">全部类目</SelectItem>
                {PRODUCT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* List */}
          <div className="max-h-[420px] overflow-y-auto pr-1">
            {loading ? (
              <div className="flex items-center justify-center py-12 text-sm text-zinc-500">
                加载中
              </div>
            ) : list.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200 py-12 text-center text-sm text-zinc-500">
                没有符合条件的商品
              </div>
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {list.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(p);
                        onOpenChange(false);
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-left transition",
                        "hover:border-violet-400/60 hover:bg-zinc-100 hover:shadow-[var(--shadow-soft)]",
                      )}
                    >
                      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md border border-zinc-200 bg-white">
                        {p.images[0] ? (
                          <img
                            src={p.images[0]}
                            alt={p.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-400">
                            {p.category}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="line-clamp-1 text-sm font-medium text-zinc-800">
                            {p.name}
                          </span>
                          <span className="rounded border border-violet-400/30 bg-violet-500/10 px-1 py-0.5 text-[9px] text-violet-600">
                            {p.category}
                          </span>
                        </div>
                        <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500">
                          {p.sellingPoints || "（暂无卖点描述）"}
                        </p>
                        <div className="mt-1 flex items-center gap-2 text-[10px] text-zinc-500">
                          <span>引用 {p.usageCount} 次</span>
                          {p.source === "auto-from-generation" && (
                            <span className="rounded border border-amber-400/30 bg-amber-500/10 px-1 text-amber-600">
                              自动落库
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className={CTA_SECONDARY}
          >
            关闭
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
