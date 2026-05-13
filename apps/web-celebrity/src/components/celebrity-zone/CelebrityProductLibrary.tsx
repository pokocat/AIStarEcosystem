"use client";

import * as React from "react";
import { Edit3, Package, Plus, Search, Trash2, Wand2 } from "lucide-react";
import { ProductsApi } from "@/api";
import {
  PRODUCT_CATEGORIES,
  type Product,
  type ProductCategory,
} from "@ai-star-eco/types/product";
import { ProductFormDialog } from "./ProductFormDialog";
import { cn } from "@ai-star-eco/ui/ui/utils";

const inputCls =
  "w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-300 outline-none focus:border-violet-400/60 focus:bg-zinc-100";

/** 商品库主页（celebrity-zone 商品库 Tab）。 */
export function CelebrityProductLibrary() {
  const [list, setList] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [category, setCategory] = React.useState<"全部" | ProductCategory>("全部");
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  const reload = React.useCallback(() => {
    setLoading(true);
    ProductsApi.listProducts({ category, q })
      .then(setList)
      .finally(() => setLoading(false));
  }, [category, q]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  const handleNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const handleEdit = (p: Product) => {
    setEditing(p);
    setDialogOpen(true);
  };

  const handleDelete = async (p: Product) => {
    if (!window.confirm(`确认删除「${p.name}」？该操作不可撤销。`)) return;
    await ProductsApi.deleteProduct(p.id);
    reload();
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-500/10">
          <Package className="h-5 w-5 text-violet-300" />
        </div>
        <div className="flex-1">
          <div className="text-base font-semibold text-zinc-800">
            商品库 · {list.length} 个
          </div>
          <div className="text-xs text-zinc-400">
            录入后可在生成视频时一键复用；视频生成时自动落库新商品。
          </div>
        </div>
        <button
          type="button"
          onClick={handleNew}
          className="inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-500 to-violet-500 px-4 py-2 text-sm font-semibold text-zinc-900 shadow-[0_0_20px_rgba(6,182,212,0.25)] transition hover:shadow-[0_0_30px_rgba(168,85,247,0.4)]"
        >
          <Plus className="h-3.5 w-3.5" /> 快速录入
        </button>
      </div>

      {/* Filter */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-100 pb-3">
        <div className="flex flex-wrap gap-1">
          {(["全部", ...PRODUCT_CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs transition",
                category === c
                  ? "border-violet-400/40 bg-violet-500/10 text-violet-200"
                  : "border-zinc-200 text-zinc-400 hover:border-zinc-200 hover:text-zinc-700",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="ml-auto relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            className={inputCls + " pl-8"}
            placeholder="搜索商品名称 / 卖点关键词…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="py-16 text-center text-sm text-zinc-400">加载中…</div>
      ) : list.length === 0 ? (
        <EmptyState onCreate={handleNew} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={() => handleEdit(p)}
              onDelete={() => handleDelete(p)}
            />
          ))}
        </div>
      )}

      <ProductFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        onSubmit={(input) =>
          editing
            ? ProductsApi.updateProduct(editing.id, input)
            : ProductsApi.createProduct(input)
        }
        onSaved={() => reload()}
      />
    </div>
  );
}

function ProductCard({
  product,
  onEdit,
  onDelete,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3 transition hover:border-violet-500/30 hover:bg-zinc-100">
      <div className="aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-white">
        {product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-300">
            无图
          </div>
        )}
      </div>
      <div>
        <div className="flex items-start gap-1.5">
          <span className="line-clamp-1 flex-1 text-sm font-semibold text-zinc-800">
            {product.name}
          </span>
          <span className="rounded border border-violet-400/30 bg-violet-500/10 px-1 py-0.5 text-[10px] text-violet-200">
            {product.category}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-400">
          {product.sellingPoints || "（暂无卖点描述）"}
        </p>
      </div>
      <div className="flex items-center justify-between text-[10px] text-zinc-400">
        <span>引用 {product.usageCount} 次</span>
        {product.source === "auto-from-generation" && (
          <span className="rounded border border-amber-400/30 bg-amber-500/10 px-1 text-amber-200">
            自动落库
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2 py-1 text-[11px] text-zinc-500 hover:border-zinc-300 hover:text-zinc-900"
        >
          <Edit3 className="h-3 w-3" /> 编辑
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1 rounded-md border border-pink-400/30 bg-pink-500/[0.06] px-2 py-1 text-[11px] text-pink-200/80 hover:border-pink-300 hover:bg-pink-500/15"
        >
          <Trash2 className="h-3 w-3" /> 删除
        </button>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] text-zinc-300">
          <Wand2 className="h-3 w-3" /> 可在生成时插入
        </span>
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-violet-500/30 bg-gradient-to-br from-violet-500/15 to-violet-500/15">
        <Package className="h-6 w-6 text-violet-300" />
      </div>
      <h3 className="text-base font-semibold text-zinc-700">还没有商品</h3>
      <p className="mt-1 max-w-md text-sm text-zinc-400">
        快速录入常带的商品，下次生成视频可直接选择，无需重复填写。
      </p>
      <button
        type="button"
        onClick={onCreate}
        className="mt-5 inline-flex items-center gap-1 rounded-lg bg-gradient-to-r from-violet-500 to-violet-500 px-4 py-2 text-sm font-semibold text-zinc-900"
      >
        <Plus className="h-3.5 w-3.5" /> 立即录入
      </button>
    </div>
  );
}
