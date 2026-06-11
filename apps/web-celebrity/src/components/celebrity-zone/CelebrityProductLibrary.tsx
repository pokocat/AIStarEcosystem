"use client";

import * as React from "react";
import Link from "next/link";
import {
  Edit3,
  ExternalLink,
  FileSpreadsheet,
  Images,
  LayoutGrid,
  Link2,
  List,
  Loader2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
  Trash2,
  Wand2,
} from "lucide-react";
import { ProductsApi } from "@/api";
import { useAuth } from "@ai-star-eco/api-client";
import {
  PRODUCT_CATEGORIES,
  type Product,
  type ProductCategory,
  type ProductInput,
} from "@ai-star-eco/types/product";
import { ProductFormDialog } from "./ProductFormDialog";
import { ProductBatchImportDialog } from "./ProductBatchImportDialog";
import { ProductGenerateDialog } from "./ProductGenerateDialog";
import { StarFilingDialog } from "./StarFilingDialog";
import { cn } from "@ai-star-eco/ui/ui/utils";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/constants/celebrity-zone-ui";
import { useConfirm } from "@/components/common/confirm-dialog";
import { MobileFilterSheet } from "@/components/common/MobileFilterSheet";
import { canUseOperatorTools } from "@/lib/operator-role";

const inputCls =
  "w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 outline-none focus:border-violet-500 focus:bg-white";

type ViewMode = "list" | "grid";
const VIEW_STORAGE_KEY = "aistareco.web.products.view-mode.v1";

/** 商品库主页（celebrity-zone 商品库 Tab）。
 *  v0.31+：公共商品池。普通用户只读；当前登录账号 `operatorRole` ∈
 *  {operator, super_admin} 时启用「新建 / 编辑 / 删除 / 批量录入 / 抖音链接建档
 *  / 刷新图片」全套写入入口（写操作直接调 /api/admin/products/**；
 *  server 端 hasAnyRole 兜底）。 */
export function CelebrityProductLibrary() {
  const { user } = useAuth();
  const canManage = canUseOperatorTools(user?.operatorRole);

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
  const [filingFor, setFilingFor] = React.useState<Product | null>(null);
  const [refreshing, setRefreshing] = React.useState<Set<string>>(new Set());
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

  const handleRefreshImages = async (p: Product) => {
    if (!p.link) return;
    setRefreshing((s) => new Set(s).add(p.id));
    try {
      const n = await ProductsApi.refreshProductImages(p.id);
      reload();
      if (n === 0) {
        await confirm({
          title: "未获取到新图片",
          description: "链接可能已失效，或商品页面结构有变化。",
          confirmText: "知道了",
        });
      }
    } catch (e) {
      await confirm({
        title: "商品图更新失败",
        description: e instanceof Error ? e.message : "请稍后再试",
        confirmText: "知道了",
      });
    } finally {
      setRefreshing((s) => {
        const next = new Set(s);
        next.delete(p.id);
        return next;
      });
    }
  };

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
        failed.push({ row: i, reason: e instanceof Error ? e.message : "出了点问题，请稍后再试" });
      }
    }
    reload();
    return { created, failed };
  };

  const activeFilterCount = (category !== "全部" ? 1 : 0) + (q.trim() ? 1 : 0);

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
            {canManage
              ? "你是管理员，可以新增、编辑或删除公共商品库中的商品。生成视频后会自动累计引用次数。"
              : "公共商品库由管理员维护；如需补充新商品请联系管理员。生成视频后会自动累计引用次数。"}
          </div>
        </div>
        {canManage && (
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <button type="button" onClick={() => setQuickLinkOpen(true)} className={cn(CTA_SECONDARY, "mobile-touch-target")}>
              <Link2 className="h-3.5 w-3.5" /> 从抖音链接建档
            </button>
            <button type="button" onClick={() => setBatchOpen(true)} className={cn(CTA_SECONDARY, "mobile-touch-target")}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> 批量导入
            </button>
            <button type="button" onClick={handleNew} className={cn(CTA_PRIMARY, "mobile-touch-target")}>
              <Plus className="h-3.5 w-3.5" /> 新增商品
            </button>
          </div>
        )}
      </div>

      {/* Filter + View toggle */}
      <div className="mobile-filter-surface flex flex-col gap-3 md:hidden">
        <div className="relative w-full">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            className={inputCls + " mobile-touch-target pl-9"}
            placeholder="搜索商品名称 / 卖点关键词"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <MobileFilterSheet
            title="商品筛选"
            summary={`当前匹配 ${list.length} 个商品`}
            activeCount={activeFilterCount}
          >
            <div className="space-y-5">
              <section>
                <div className="mb-2 text-xs font-semibold text-zinc-500">类目</div>
                <div className="grid grid-cols-2 gap-2">
                  {(["全部", ...PRODUCT_CATEGORIES] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={cn(
                        "mobile-touch-target rounded-lg border px-3 text-sm transition",
                        category === c
                          ? "border-violet-400/40 bg-violet-500/10 text-violet-700"
                          : "border-zinc-200 bg-white text-zinc-600",
                      )}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </section>
              <section>
                <div className="mb-2 text-xs font-semibold text-zinc-500">桌面视图</div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setViewModePersisted("list")}
                    className={cn(
                      "mobile-touch-target inline-flex items-center justify-center gap-2 rounded-lg border px-3 text-sm",
                      viewMode === "list"
                        ? "border-violet-400/40 bg-violet-500/10 text-violet-700"
                        : "border-zinc-200 bg-white text-zinc-600",
                    )}
                  >
                    <List className="h-4 w-4" /> 列表
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewModePersisted("grid")}
                    className={cn(
                      "mobile-touch-target inline-flex items-center justify-center gap-2 rounded-lg border px-3 text-sm",
                      viewMode === "grid"
                        ? "border-violet-400/40 bg-violet-500/10 text-violet-700"
                        : "border-zinc-200 bg-white text-zinc-600",
                    )}
                  >
                    <LayoutGrid className="h-4 w-4" /> 网格
                  </button>
                </div>
              </section>
            </div>
          </MobileFilterSheet>
          <div className="min-w-0 text-right text-xs text-zinc-500">
            {category !== "全部" ? category : "全部类目"} · {list.length} 个
          </div>
        </div>
      </div>

      <div className="hidden flex-wrap items-center gap-3 border-b border-zinc-200 pb-3 md:flex">
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
        <div className="py-16 text-center text-sm text-zinc-500">加载中</div>
      ) : list.length === 0 ? (
        <EmptyState
          canManage={canManage}
          onCreate={handleNew}
          onBatch={() => setBatchOpen(true)}
          onQuickLink={() => setQuickLinkOpen(true)}
        />
      ) : viewMode === "grid" ? (
        <>
          <div className="mobile-card-list md:hidden">
            {list.map((p) => (
              <ProductMobileCard
                key={p.id}
                product={p}
                canManage={canManage}
                onEdit={() => handleEdit(p)}
                onDelete={() => handleDelete(p)}
                onGenerate={() => handleGenerate(p)}
                onFile={() => setFilingFor(p)}
                onRefreshImages={() => handleRefreshImages(p)}
                isRefreshing={refreshing.has(p.id)}
              />
            ))}
          </div>
          <div className="hidden gap-4 sm:grid-cols-2 md:grid lg:grid-cols-3 xl:grid-cols-4">
            {list.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                canManage={canManage}
                onEdit={() => handleEdit(p)}
                onDelete={() => handleDelete(p)}
                onGenerate={() => handleGenerate(p)}
                onFile={() => setFilingFor(p)}
                onRefreshImages={() => handleRefreshImages(p)}
                isRefreshing={refreshing.has(p.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="mobile-card-list md:hidden">
            {list.map((p) => (
              <ProductMobileCard
                key={p.id}
                product={p}
                canManage={canManage}
                onEdit={() => handleEdit(p)}
                onDelete={() => handleDelete(p)}
                onGenerate={() => handleGenerate(p)}
                onFile={() => setFilingFor(p)}
                onRefreshImages={() => handleRefreshImages(p)}
                isRefreshing={refreshing.has(p.id)}
              />
            ))}
          </div>
          <div className="hidden md:block">
            <ProductTable
              list={list}
              canManage={canManage}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onGenerate={handleGenerate}
              onFile={setFilingFor}
              onRefreshImages={handleRefreshImages}
              refreshingIds={refreshing}
            />
          </div>
        </>
      )}

      {canManage && (
        <>
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
        </>
      )}

      <ProductGenerateDialog
        open={!!generatingFor}
        onOpenChange={(o) => !o && setGeneratingFor(null)}
        product={generatingFor}
      />

      <StarFilingDialog product={filingFor} onClose={() => setFilingFor(null)} />

      <ConfirmHost />
    </div>
  );
}

// ── 列表视图（默认） ────────────────────────────────────────────────────────
function ProductTable({
  list,
  canManage,
  onEdit,
  onDelete,
  onGenerate,
  onFile,
  onRefreshImages,
  refreshingIds,
}: {
  list: Product[];
  canManage: boolean;
  onEdit: (p: Product) => void;
  onDelete: (p: Product) => void;
  onGenerate: (p: Product) => void;
  onFile: (p: Product) => void;
  onRefreshImages: (p: Product) => void;
  refreshingIds: Set<string>;
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
            <th className="px-3 py-2 text-right font-medium whitespace-nowrap">操作</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {list.map((p) => (
            <tr key={p.id} className="hover:bg-zinc-50/60 transition-colors">
              <td className="px-3 py-2">
                <Link
                  href={`/products/${p.id}`}
                  className="block h-12 w-12 overflow-hidden rounded-md border border-zinc-200 bg-zinc-100 shrink-0 transition hover:border-violet-400/60"
                  title="查看商品详情"
                >
                  {p.images[0] ? (
                    <img src={p.images[0]} alt={p.name} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-[10px] text-zinc-400">无图</div>
                  )}
                </Link>
              </td>
              <td className="px-3 py-2">
                <Link
                  href={`/products/${p.id}`}
                  className="font-medium text-zinc-800 line-clamp-1 transition hover:text-violet-600"
                >
                  {p.name}
                </Link>
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
                  {p.sellingPoints || <span className="text-zinc-400">（未填写）</span>}
                </p>
              </td>
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1 text-xs text-zinc-700 tabular-nums">
                  <Wand2 className="h-3 w-3 text-zinc-400" /> {p.usageCount}
                </span>
              </td>
              <td className="px-3 py-2 whitespace-nowrap">
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => onGenerate(p)}
                    className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-violet-400/40 bg-violet-500/10 px-2 py-1 text-[11px] text-violet-700 hover:border-violet-500 hover:bg-violet-500/20"
                    title="为本商品生成视频"
                  >
                    <Sparkles className="h-3 w-3" /> 生成视频
                  </button>
                  <Link
                    href={`/products/${p.id}#assets`}
                    className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 hover:border-violet-400/60 hover:text-violet-700"
                    title="查看本商品详情 + 关联素材（图片 / 视频 / AI 生成）"
                  >
                    <Images className="h-3 w-3" /> 素材
                    <span className="rounded bg-zinc-100 px-1 text-[10px] tabular-nums text-zinc-700">
                      {p.images.length}
                    </span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => onFile(p)}
                    className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-amber-400/40 bg-amber-500/[0.06] px-2 py-1 text-[11px] text-amber-700 hover:border-amber-500 hover:bg-amber-500/15"
                    title="报备给已授权明星，进入明星端商品入库流程"
                  >
                    <Send className="h-3 w-3" /> 报备
                  </button>
                  {canManage && p.link && (
                    <button
                      type="button"
                      onClick={() => onRefreshImages(p)}
                      disabled={refreshingIds.has(p.id)}
                      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
                      title="从链接重新抓取商品图（不会删除旧图，只追加）"
                    >
                      {refreshingIds.has(p.id) ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3 w-3" />
                      )}
                      刷新图片
                    </button>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => onEdit(p)}
                      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
                    >
                      <Edit3 className="h-3 w-3" /> 编辑
                    </button>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => onDelete(p)}
                      className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-md border border-pink-400/30 bg-pink-500/[0.06] px-2 py-1 text-[11px] text-pink-600 hover:border-pink-500 hover:bg-pink-500/15"
                    >
                      <Trash2 className="h-3 w-3" /> 删除
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ProductMobileCard({
  product,
  canManage,
  onEdit,
  onDelete,
  onGenerate,
  onFile,
  onRefreshImages,
  isRefreshing,
}: {
  product: Product;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onGenerate: () => void;
  onFile: () => void;
  onRefreshImages: () => void;
  isRefreshing: boolean;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-3 shadow-[var(--shadow-soft)]">
      <div className="flex gap-3">
        <Link
          href={`/products/${product.id}`}
          className="block h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-100"
          title="查看商品详情"
        >
          {product.images[0] ? (
            <img src={product.images[0]} alt={product.name} loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-zinc-400">无图</div>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <Link
              href={`/products/${product.id}`}
              className="line-clamp-2 flex-1 text-sm font-semibold leading-snug text-zinc-900"
              style={{ minHeight: 40 }}
            >
              {product.name}
            </Link>
            <span className="shrink-0 rounded border border-violet-400/30 bg-violet-500/10 px-1.5 py-0.5 text-[10px] text-violet-700">
              {product.category}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-zinc-500">
            <span className="font-mono text-zinc-800">
              {product.priceCents != null ? formatYuan(product.priceCents) : "未标价"}
            </span>
            {product.commissionRate != null && <span>佣金 {product.commissionRate}%</span>}
            <span>引用 {product.usageCount} 次</span>
          </div>
          <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
            {product.sellingPoints || "还未填写卖点"}
          </p>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onGenerate}
          className="mobile-touch-target inline-flex items-center justify-center gap-1 rounded-xl border border-violet-400/40 bg-violet-500/10 px-3 text-xs font-medium text-violet-700"
        >
          <Sparkles className="h-3.5 w-3.5" /> 生成视频
        </button>
        <Link
          href={`/products/${product.id}#assets`}
          className="mobile-touch-target inline-flex items-center justify-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700"
          title="查看本商品详情 + 关联素材"
        >
          <Images className="h-3.5 w-3.5" /> 素材 {product.images.length}
        </Link>
        <button
          type="button"
          onClick={onFile}
          className="mobile-touch-target inline-flex items-center justify-center gap-1 rounded-xl border border-amber-400/40 bg-amber-500/[0.06] px-3 text-xs font-medium text-amber-700"
          title="报备给已授权明星"
        >
          <Send className="h-3.5 w-3.5" /> 报备明星
        </button>
        {canManage && product.link && (
          <button
            type="button"
            onClick={onRefreshImages}
            disabled={isRefreshing}
            className="mobile-touch-target inline-flex items-center justify-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700 disabled:opacity-50"
          >
            {isRefreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            刷新图片
          </button>
        )}
        {canManage && (
          <button
            type="button"
            onClick={onEdit}
            className="mobile-touch-target inline-flex items-center justify-center gap-1 rounded-xl border border-zinc-200 bg-white px-3 text-xs font-medium text-zinc-700"
          >
            <Edit3 className="h-3.5 w-3.5" /> 编辑
          </button>
        )}
        {canManage && (
          <button
            type="button"
            onClick={onDelete}
            className="mobile-touch-target inline-flex items-center justify-center gap-1 rounded-xl border border-pink-400/30 bg-pink-500/[0.06] px-3 text-xs font-medium text-pink-600"
          >
            <Trash2 className="h-3.5 w-3.5" /> 删除
          </button>
        )}
      </div>
    </div>
  );
}

function ProductCard({
  product,
  canManage,
  onEdit,
  onDelete,
  onGenerate,
  onFile,
  onRefreshImages,
  isRefreshing,
}: {
  product: Product;
  canManage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onGenerate: () => void;
  onFile: () => void;
  onRefreshImages: () => void;
  isRefreshing: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-3 transition hover:-translate-y-0.5 hover:border-violet-400/60 hover:shadow-[var(--shadow-lift)]">
      <Link
        href={`/products/${product.id}`}
        className="relative block aspect-square overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100"
        title="查看商品详情"
      >
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
      </Link>
      <div>
        <div className="flex items-start gap-1.5">
          <Link
            href={`/products/${product.id}`}
            className="line-clamp-1 flex-1 text-sm font-semibold text-zinc-800 transition hover:text-violet-600"
          >
            {product.name}
          </Link>
          <span className="rounded border border-violet-400/30 bg-violet-500/10 px-1 py-0.5 text-[10px] text-violet-600">
            {product.category}
          </span>
        </div>
        <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-zinc-500">
          {product.sellingPoints || "（还未填写卖点）"}
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
        <Link
          href={`/products/${product.id}#assets`}
          className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 hover:border-violet-400/60 hover:text-violet-700"
          title="查看本商品详情 + 关联素材"
        >
          <Images className="h-3 w-3" /> 素材
          <span className="rounded bg-zinc-100 px-1 text-[10px] tabular-nums text-zinc-700">
            {product.images.length}
          </span>
        </Link>
        <button
          type="button"
          onClick={onFile}
          className="inline-flex items-center gap-1 rounded-md border border-amber-400/40 bg-amber-500/[0.06] px-2 py-1 text-[11px] text-amber-700 hover:border-amber-500 hover:bg-amber-500/15"
          title="报备给已授权明星，进入明星端商品入库流程"
        >
          <Send className="h-3 w-3" /> 报备
        </button>
        {canManage && product.link && (
          <button
            type="button"
            onClick={onRefreshImages}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 hover:border-zinc-300 hover:text-zinc-900 disabled:opacity-50 disabled:cursor-not-allowed"
            title="从链接重新抓取商品图"
          >
            {isRefreshing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            刷新图片
          </button>
        )}
        {canManage && (
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 hover:border-zinc-300 hover:text-zinc-900"
          >
            <Edit3 className="h-3 w-3" /> 编辑
          </button>
        )}
        {canManage && (
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 rounded-md border border-pink-400/30 bg-pink-500/[0.06] px-2 py-1 text-[11px] text-pink-600 hover:border-pink-500 hover:bg-pink-500/15"
          >
            <Trash2 className="h-3 w-3" /> 删除
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  canManage,
  onCreate,
  onBatch,
  onQuickLink,
}: {
  canManage: boolean;
  onCreate: () => void;
  onBatch: () => void;
  onQuickLink: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border-2 border-violet-500/30 bg-gradient-to-br from-violet-500/15 to-violet-500/[0.04]">
        <Package className="h-6 w-6 text-violet-600" />
      </div>
      <h3 className="text-base font-semibold text-zinc-800">
        {canManage ? "还没有商品" : "公共商品池暂未上架商品"}
      </h3>
      <p className="mt-1 max-w-md text-sm text-zinc-500">
        {canManage
          ? "粘贴抖音商城链接一键建档，或快速录入常带商品。"
          : "商品库由运营在管理后台统一维护；如需补充新品，请联系运营。"}
      </p>
      {canManage && (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={onQuickLink} className={CTA_PRIMARY}>
            <Link2 className="h-3.5 w-3.5" /> 从抖音链接建档
          </button>
          <button type="button" onClick={onCreate} className={CTA_SECONDARY}>
            <Plus className="h-3.5 w-3.5" /> 逐项填写
          </button>
          <button type="button" onClick={onBatch} className={CTA_SECONDARY}>
            <FileSpreadsheet className="h-3.5 w-3.5" /> 批量导入
          </button>
        </div>
      )}
    </div>
  );
}

// ── 顶部快捷入口：粘贴链接即建档（运营专用，仅 canManage 时渲染父级） ──
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
      setError(e instanceof Error ? e.message : "无法识别链接，请用「逐项填写」手动录入");
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
          支持「分享长链」和「PC 选品库短链」两种形式，系统会自动提取商品名、图片和价格。
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
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> 正在提取
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" /> 提取并建档
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
