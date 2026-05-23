"use client";

import * as React from "react";
import {
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  Package,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { ProductsApi } from "@/api";
import {
  PRODUCT_CATEGORIES,
  type Product,
  type ProductCategory,
  type ProductInput,
} from "@ai-star-eco/types/product";
import { ProductFormDialog } from "./ProductFormDialog";
import { ProductBatchImportDialog } from "./ProductBatchImportDialog";
import { ProductGenerateDialog } from "./ProductGenerateDialog";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/constants/celebrity-zone-ui";
import { useConfirm } from "@/components/common/confirm-dialog";

const inputCls =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-violet-500 focus:bg-white";

type ViewMode = "list" | "grid";
const VIEW_STORAGE_KEY = "aistareco.web.products.view-mode.v1";

/** 商品库主页（celebrity-zone 商品库 Tab）。
 *  v0.22+: 视图切换（列表 / 网格） + 批量录入（手动 / 粘贴 / 文件）。
 *  v0.26+: 顶部「📋 从抖音链接快速建档」+ 行「生成视频」按钮 + 价格 / 佣金 列。 */
export function CelebrityProductLibrary() {
  const [list, setList] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [category, setCategory] = React.useState<"全部" | ProductCategory>("全部");
  const [q, setQ] = React.useState("");
  const [editing, setEditing] = React.useState<Product | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [batchOpen, setBatchOpen] = React.useState(false);
  const [viewMode, setViewMode] = React.useState<ViewMode>("list");
  const [quickLinkOpen, setQuickLinkOpen] = React.useState(false);
  const [generatingFor, setGeneratingFor] = React.useState<Product | null>(null);
  const { confirm, ConfirmHost } = useConfirm();

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem(VIEW_STORAGE_KEY);
      if (saved === "grid" || saved === "list") setViewMode(saved);
    } catch {
      /* 隐私模式 */
    }
  }, []);
  const setViewModePersisted = (m: ViewMode) => {
    setViewMode(m);
    if (typeof window === "undefined") return;
    try { window.localStorage.setItem(VIEW_STORAGE_KEY, m); } catch { /* 静默 */ }
  };

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
    const ok = await confirm({
      title: `删除商品：${p.name}`,
      description: "该操作不可撤销。",
      confirmText: "删除",
      tone: "danger",
    });
    if (!ok) return;
    await ProductsApi.deleteProduct(p.id);
    reload();
  };

  const handleGenerate = (p: Product) => {
    setGeneratingFor(p);
  };

  /** 批量提交：逐条 createProduct，单条失败不影响其他；返回 created + failed 明细。 */
  const handleBatchSubmit = async (
    rows: ProductInput[],
  ): Promise<{ created: Product[]; failed: { row: number; reason: string }[] }> => {
    const created: Product[] = [];
    const failed: { row: number; reason: string }[] = [];
    for (let i = 0; i < rows.length; i++) {
      try {
        const p = await ProductsApi.createProduct(rows[i]);
        created.push(p);
      } catch (e) {
        failed.push({ row: i, reason: e instanceof Error ? e.message : "未知错误" });
      }
    }
    reload();
    return { created, failed };
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 shadow-[var(--shadow-soft)]">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-violet-400/30 bg-violet-500/10">
          <Package className="h-5 w-5 text-violet-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-base font-semibold text-zinc-800">
            商品库 · {list.length} 个
          </div>
          <div className="text-xs text-zinc-500">
            录入后可在生成视频时一键复用；视频生成时自动落库新商品。
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setQuickLinkOpen(true)} className={CTA_SECONDARY}>
            <Link2 className="h-3.5 w-3.5" /> 从抖音链接快速建档
          </button>
          <button type="button" onClick={() => setBatchOpen(true)} className={CTA_SECONDARY}>
            <FileSpreadsheet className="h-3.5 w-3.5" /> 批量录入
          </button>
          <button type="button" onClick={handleNew} className={CTA_PRIMARY}>
            <Plus className="h-3.5 w-3.5" /> 快速录入
          </button>
        </div>
      </div>

      {/* Filter + View toggle */}
      <div className="flex flex-wrap items-center gap-3 border-b border-zinc-200 pb-3">
        <div className="flex flex-wrap gap-1">
          {(["全部", ...PRODUCT_CATEGORIES] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs transition",
                category === c
                  ? "border-violet-400/40 bg-violet-500/10 text-violet-600"
                  : "border-zinc-200 bg-white text-zinc-500 hover:border-zinc-300 hover:text-zinc-800",
              )}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
            <input
              className={inputCls + " pl-8"}
              placeholder="搜索商品名称 / 卖点关键词…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <div className="flex items-center rounded-md border border-zinc-200 bg-white p-0.5 shrink-0">
            <button
              type="button"
              onClick={() => setViewModePersisted("list")}
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] transition",
                viewMode === "list"
                  ? "bg-violet-500/10 text-violet-600"
                  : "text-zinc-500 hover:text-zinc-800",
              )}
              title="列表视图"
            >
              <List className="h-3.5 w-3.5" /> 列表
            </button>
            <button
              type="button"
              onClick={() => setViewModePersisted("grid")}
              className={cn(
                "inline-flex items-center gap-1 rounded px-2 py-1 text-[11px] transition",
                viewMode === "grid"
                  ? "bg-violet-500/10 text-violet-600"
                  : "text-zinc-500 hover:text-zinc-800",
              )}
              title="网格视图"
            >
              <LayoutGrid className="h-3.5 w-3.5" /> 网格
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="py-16 text-center text-sm text-zinc-500">加载中…</div>
      ) : list.length === 0 ? (
        <EmptyState onCreate={handleNew} onBatch={() => setBatchOpen(true)} onQuickLink={() => setQuickLinkOpen(true)} />
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={() => handleEdit(p)}
              onDelete={() => handleDelete(p)}
              onGenerate={() => handleGenerate(p)}
            />
          ))}
        </div>
      ) : (
        <ProductTable list={list} onEdit={handleEdit} onDelete={handleDelete} onGenerate={handleGenerate} />
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

      <ProductBatchImportDialog
        open={batchOpen}
        onOpenChange={setBatchOpen}
        onSubmit={handleBatchSubmit}
        onSaved={() => reload()}
      />

      <QuickLinkDialog
        open={quickLinkOpen}
        onOpenChange={setQuickLinkOpen}
        onCreated={() => {
          setQuickLinkOpen(false);
          reload();
        }}
      />

      <ProductGenerateDialog
        open={!!generatingFor}
        onOpenChange={(o) => !o && setGeneratingFor(null)}
        product={generatingFor}
      />

      <ConfirmHost />
    </div>
  );
}

// ── 列表视图（默认） ────────────────────────────────────────────────────────
function ProductTable({
  list,
  onEdit,
  onDelete,
  onGenerate,
}: {
  list: Product[];
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
  onGenerate: (p: Product) => void;
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-xs text-zinc-500">
          <tr>
            <th className="px-3 py-2 text-left font-medium w-16">图片</th>
            <th className="px-3 py-2 text-left font-medium">商品名称</th>
            <th className="px-3 py-2 text-left font-medium w-24">类目</th>
            <th className="px-3 py-2 text-left font-medium w-20">价格</th>
            <th className="px-3 py-2 text-left font-medium w-16">佣金</th>
            <th className="px-3 py-2 text-left font-medium">卖点描述</th>
            <th className="px-3 py-2 text-left font-medium w-16">引用</th>
            <th className="px-3 py-2 text-left font-medium w-48">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {list.map((p) => (
            <tr key={p.id} className="hover:bg-zinc-50/60 transition-colors">
              <td className="px-3 py-2">
                <div className="h-12 w-12 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 shrink-0">
                  {p.images[0] ? (
                    <img src={p.images[0]} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-400">无图</div>
                  )}
                </div>
              </td>
              <td className="px-3 py-2">
                <div className="font-medium text-zinc-800 line-clamp-1">{p.name}</div>
                {p.link && (
                  <a href={p.link} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[11px] text-zinc-500 hover:text-violet-600">
                    <ExternalLink className="h-3 w-3" /> 商品链接
                  </a>
                )}
              </td>
              <td className="px-3 py-2">
                <span className="rounded border border-violet-400/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-600 whitespace-nowrap">
                  {p.category}
                </span>
              </td>
              <td className="px-3 py-2 text-xs text-zinc-700 tabular-nums">
                {p.priceCents != null ? formatYuan(p.priceCents) : <span className="text-zinc-400">—</span>}
              </td>
              <td className="px-3 py-2 text-xs text-zinc-700 tabular-nums">
                {p.commissionRate != null ? `${p.commissionRate}%` : <span className="text-zinc-400">—</span>}
              </td>
              <td className="px-3 py-2">
                <p className="line-clamp-2 text-[11px] leading-relaxed text-zinc-600">
                  {p.sellingPoints || <span className="text-zinc-400">（暂无）</span>}
                </p>
              </td>
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1 text-xs text-zinc-700 tabular-nums">
                  <Wand2 className="h-3 w-3 text-zinc-400" /> {p.usageCount}
                </span>
              </td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onGenerate(p)}
                    className="inline-flex items-center gap-1 rounded-md border border-violet-400/40 bg-violet-500/10 px-2 py-1 text-[11px] text-violet-700 hover:border-violet-500 hover:bg-violet-500/20"
                    title="为本商品生成视频"
                  >
                    <Sparkles className="h-3 w-3" /> 生成视频
                  </button>
                  <button
                    type="button"
                    onClick={() => onEdit(p)}
                    className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
                  >
                    <Edit3 className="h-3 w-3" /> 编辑
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(p)}
                    className="inline-flex items-center gap-1 rounded-md border border-pink-400/30 bg-pink-500/[0.06] px-2 py-1 text-[11px] text-pink-600 hover:border-pink-500 hover:bg-pink-500/15"
                  >
                    <Trash2 className="h-3 w-3" /> 删除
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductCard({
  product,
  onEdit,
  onDelete,
  onGenerate,
}: {
  product: Product;
  onEdit: () => void;
  onDelete: () => void;
  onGenerate: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-violet-400/60 hover:shadow-[var(--shadow-lift)]">
      <div className="relative aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100">
        {product.images[0] ? (
          <img
            src={product.images[0]}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">
            无图
          </div>
        )}
        {product.priceCents != null && (
          <span className="absolute right-1.5 top-1.5 rounded bg-zinc-900/70 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
            {formatYuan(product.priceCents)}
          </span>
        )}
      </div>
      <div>
        <div className="flex items-start gap-1.5">
          <span className="line-clamp-1 flex-1 text-sm font-semibold text-zinc-800">
            {product.name}
          </span>
          <span className="rounded border border-violet-400/30 bg-violet-500/10 px-1 py-0.5 text-[10px] text-violet-600">
            {product.category}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
          {product.sellingPoints || "（暂无卖点描述）"}
        </p>
      </div>
      <div className="flex items-center justify-between text-[10px] text-zinc-500">
        <span>引用 {product.usageCount} 次</span>
        {product.commissionRate != null && (
          <span className="rounded border border-emerald-400/30 bg-emerald-500/10 px-1 text-emerald-700">
            佣金 {product.commissionRate}%
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={onGenerate}
          className="inline-flex items-center gap-1 rounded-md border border-violet-400/40 bg-violet-500/10 px-2 py-1 text-[11px] text-violet-700 hover:border-violet-500 hover:bg-violet-500/20"
        >
          <Sparkles className="h-3 w-3" /> 生成视频
        </button>
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
        >
          <Edit3 className="h-3 w-3" /> 编辑
        </button>
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex items-center gap-1 rounded-md border border-pink-400/30 bg-pink-500/[0.06] px-2 py-1 text-[11px] text-pink-600 hover:border-pink-500 hover:bg-pink-500/15"
        >
          <Trash2 className="h-3 w-3" /> 删除
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onCreate, onBatch, onQuickLink }: { onCreate: () => void; onBatch: () => void; onQuickLink: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-violet-500/30 bg-gradient-to-br from-violet-500/15 to-violet-500/[0.04]">
        <Package className="h-6 w-6 text-violet-600" />
      </div>
      <h3 className="text-base font-semibold text-zinc-800">还没有商品</h3>
      <p className="mt-1 max-w-md text-sm text-zinc-500">
        粘贴抖音商城链接一键建档，或快速录入常带商品。下次生成视频可直接选择，无需重复填写。
      </p>
      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={onQuickLink} className={CTA_PRIMARY}>
          <Link2 className="h-3.5 w-3.5" /> 从抖音链接建档
        </button>
        <button type="button" onClick={onCreate} className={CTA_SECONDARY}>
          <Plus className="h-3.5 w-3.5" /> 手动录入
        </button>
        <button type="button" onClick={onBatch} className={CTA_SECONDARY}>
          <FileSpreadsheet className="h-3.5 w-3.5" /> 批量 / 文件导入
        </button>
      </div>
    </div>
  );
}

// ── 顶部快捷入口：粘贴链接即建档 ───────────────────────────────────────────
function QuickLinkDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreated: (p: Product) => void;
}) {
  const [url, setUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setUrl("");
      setBusy(false);
      setError(null);
    }
  }, [open]);

  if (!open) return null;
  const handleSubmit = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    try {
      const created = await ProductsApi.parseAndCreateProduct(trimmed);
      onCreated(created);
    } catch (e) {
      setError(e instanceof Error ? e.message : "解析失败，请改用「快速录入」手动填");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-900/40 p-4" onClick={() => !busy && onOpenChange(false)}>
      <div
        className="w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-5 shadow-[var(--shadow-pop)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-800">
          <Link2 className="h-4 w-4 text-violet-600" /> 从抖音链接快速建档
        </h3>
        <p className="mt-1 text-xs text-zinc-500">
          支持「分享长链」和「PC 选品库短链」两种形态；后端会自动抽取商品名 / 图片 / 价格。
        </p>
        <textarea
          className="mt-3 min-h-[88px] w-full rounded-md border border-zinc-200 bg-zinc-100 px-3 py-2 text-xs text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-violet-500 focus:bg-white"
          placeholder="粘贴抖音商城链接，例如 https://haohuo.jinritemai.com/...?id=..."
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          disabled={busy}
        />
        {error && <div className="mt-2 text-xs text-pink-600">{error}</div>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={() => onOpenChange(false)} disabled={busy} className={CTA_SECONDARY}>
            取消
          </button>
          <button type="button" onClick={handleSubmit} disabled={busy || !url.trim()} className={CTA_PRIMARY}>
            {busy ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> 解析中…
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" /> 解析并建档
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatYuan(cents: number): string {
  const yuan = Math.floor(cents / 100);
  const cs = cents % 100;
  if (cs === 0) return `¥${yuan}`;
  return `¥${yuan}.${String(cs).padStart(2, "0")}`;
}
