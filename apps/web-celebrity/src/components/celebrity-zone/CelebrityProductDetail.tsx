"use client";

// 商品详情页主体（路由 /products/[id]）。
// 顶部 breadcrumb-back + 名称 + 类目/来源 chip；主区两列（图 / 信息 + 单行操作条）；
// 末尾「关联素材」section（v0.26+ subkind=product-photo 等，USE_MOCK 下自然为空）。
//
// 设计基线：
//   - 用 white + zinc + violet 的 Restrained 调色（product register 默认）。
//   - 价格 / 佣金不做 hero-metric 大字块（avoid 模板感）；走 inline 行 + tabular-nums。
//   - 操作条单行；删除按钮 ml-auto 锚右；CTA 复用 CTA_PRIMARY / CTA_SECONDARY。
//   - 编辑 / 生成视频走既有 dialog（无新组件）；删除走 useConfirm + 回退商品库。

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Edit3,
  ExternalLink,
  Image as ImageIcon,
  Loader2,
  Package,
  Sparkles,
  Tag,
  Trash2,
  Wand2,
} from "lucide-react";
import type { Product } from "@ai-star-eco/types/product";
import type { MixcutAsset } from "@/components/mixcut-zone/types";
import { MixcutApi, ProductsApi } from "@/api";
import { ProductFormDialog } from "./ProductFormDialog";
import { ProductGenerateDialog } from "./ProductGenerateDialog";
import { useConfirm } from "@/components/common/confirm-dialog";
import { CTA_PRIMARY, CTA_SECONDARY } from "@/constants/celebrity-zone-ui";

interface Props {
  productId: string;
}

const SOURCE_META: Record<Product["source"], { label: string; tone: string }> = {
  manual: {
    label: "手动录入",
    tone: "border-zinc-200 bg-zinc-50 text-zinc-600",
  },
  "auto-from-generation": {
    label: "生成时自动建档",
    tone: "border-amber-400/30 bg-amber-500/10 text-amber-700",
  },
};

export function CelebrityProductDetail({ productId }: Props) {
  const router = useRouter();
  const [product, setProduct] = React.useState<Product | null>(null);
  const [assets, setAssets] = React.useState<MixcutAsset[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeImage, setActiveImage] = React.useState(0);
  const [editOpen, setEditOpen] = React.useState(false);
  const [generateOpen, setGenerateOpen] = React.useState(false);
  const { confirm, ConfirmHost } = useConfirm();

  const reload = React.useCallback(() => {
    setLoading(true);
    ProductsApi.getProduct(productId)
      .then((p) => {
        setProduct(p);
        setActiveImage(0);
      })
      .finally(() => setLoading(false));
    MixcutApi.listAssets({ relatedProductId: productId })
      .then(setAssets)
      .catch(() => setAssets([]));
  }, [productId]);

  React.useEffect(() => {
    reload();
  }, [reload]);

  const handleDelete = async () => {
    if (!product) return;
    const ok = await confirm({
      title: `删除商品：${product.name}`,
      description: "该操作不可撤销。",
      confirmText: "删除",
      tone: "danger",
    });
    if (!ok) return;
    await ProductsApi.deleteProduct(product.id);
    router.push("/products");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-zinc-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载中…
      </div>
    );
  }

  if (!product) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-white px-6 py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-zinc-200 bg-zinc-50">
          <Package className="h-5 w-5 text-zinc-400" />
        </div>
        <h2 className="text-base font-semibold text-zinc-800">商品不存在或已删除</h2>
        <p className="mt-1 text-sm text-zinc-500">请返回商品库重新选择。</p>
        <Link href="/products" className={`mt-5 ${CTA_PRIMARY}`}>
          <ArrowLeft className="h-3.5 w-3.5" /> 返回商品库
        </Link>
      </div>
    );
  }

  const source = SOURCE_META[product.source];
  const mainImage = product.images[activeImage] ?? product.images[0];

  return (
    <div className="flex flex-col gap-5">
      {/* 顶部：返回 + 标题 + chips */}
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href="/products"
          className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs text-zinc-600 transition hover:border-zinc-300 hover:text-zinc-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 商品库
        </Link>
        <h1 className="ml-1 text-lg font-semibold text-zinc-900">{product.name}</h1>
        <span className="inline-flex items-center gap-1 rounded border border-violet-400/30 bg-violet-500/10 px-1.5 py-0.5 text-[11px] text-violet-600">
          <Tag className="h-3 w-3" /> {product.category}
        </span>
        <span className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] ${source.tone}`}>
          {source.label}
        </span>
      </div>

      {/* 主体：左图 / 右文 */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* 左：图片 */}
        <div className="flex flex-col gap-3">
          <div className="aspect-square overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-[var(--shadow-soft)]">
            {mainImage ? (
              <img
                src={mainImage}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-400">
                <ImageIcon className="h-7 w-7" />
                <span className="text-xs">尚未上传商品图</span>
              </div>
            )}
          </div>
          {product.images.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {product.images.slice(0, 10).map((src, i) => (
                <button
                  key={`${src}-${i}`}
                  type="button"
                  onClick={() => setActiveImage(i)}
                  className={`aspect-square overflow-hidden rounded-md border bg-zinc-100 transition ${
                    activeImage === i
                      ? "border-violet-500 ring-2 ring-violet-400/40"
                      : "border-zinc-200 hover:border-violet-400/60"
                  }`}
                  title={`图片 ${i + 1}`}
                >
                  <img
                    src={src}
                    alt={`${product.name} 图 ${i + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 右：信息 + 操作 */}
        <div className="flex flex-col gap-4">
          {/* 价格 + 佣金 + 引用 —— 一行 inline 而非 hero-metric */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)]">
            <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3">
              <PricePill label="售价" value={product.priceCents != null ? formatYuan(product.priceCents) : null} accent />
              <PricePill label="佣金" value={product.commissionRate != null ? `${product.commissionRate}%` : null} />
              <div className="ml-auto inline-flex items-center gap-1.5 self-center rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-700">
                <Wand2 className="h-3 w-3" />
                已被引用 {product.usageCount} 次
              </div>
            </div>
          </div>

          {/* 卖点 */}
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)]">
            <div className="text-xs font-medium text-zinc-500">卖点描述</div>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-zinc-800">
              {product.sellingPoints || (
                <span className="text-zinc-400">
                  尚未填写。生成视频时会作为商品标题 / 卖点的提示填入对应槽位。
                </span>
              )}
            </p>
          </div>

          {/* 元数据 */}
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-2xl border border-zinc-200 bg-white p-4 text-xs shadow-[var(--shadow-soft)] sm:grid-cols-2">
            <MetaRow label="商品 ID">
              <span className="font-mono text-[11px] text-zinc-600">{product.id}</span>
            </MetaRow>
            <MetaRow label="商品链接">
              {product.link ? (
                <a
                  href={product.link}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex max-w-full items-center gap-1 text-violet-600 hover:underline"
                  title={product.link}
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{product.link}</span>
                </a>
              ) : (
                <span className="text-zinc-400">—</span>
              )}
            </MetaRow>
            <MetaRow label="创建时间">
              <span className="text-zinc-700 tabular-nums">{product.createdAt}</span>
            </MetaRow>
            <MetaRow label="更新时间">
              <span className="text-zinc-700 tabular-nums">{product.updatedAt}</span>
            </MetaRow>
          </dl>

          {/* 操作条：单行（删除靠右） */}
          <div className="flex flex-nowrap items-center gap-2 overflow-x-auto pt-1">
            <button
              type="button"
              onClick={() => setGenerateOpen(true)}
              className={`${CTA_PRIMARY} whitespace-nowrap`}
            >
              <Sparkles className="h-3.5 w-3.5" /> 生成视频
            </button>
            <button
              type="button"
              onClick={() => setEditOpen(true)}
              className={`${CTA_SECONDARY} whitespace-nowrap`}
            >
              <Edit3 className="h-3.5 w-3.5" /> 编辑商品
            </button>
            {product.link && (
              <a
                href={product.link}
                target="_blank"
                rel="noreferrer"
                className={`${CTA_SECONDARY} whitespace-nowrap`}
              >
                <ExternalLink className="h-3.5 w-3.5" /> 打开外链
              </a>
            )}
            <button
              type="button"
              onClick={handleDelete}
              className="ml-auto inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-pink-400/40 bg-pink-500/[0.06] px-4 py-2 text-sm font-medium text-pink-600 transition hover:border-pink-500 hover:bg-pink-500/15"
            >
              <Trash2 className="h-3.5 w-3.5" /> 删除
            </button>
          </div>
        </div>
      </div>

      {/* 关联素材（有则显示；mock 模式下 listAssets 为 [] → 整段隐藏） */}
      {assets.length > 0 && <RelatedAssets assets={assets} />}

      <ProductFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        initial={product}
        onSubmit={(input) => ProductsApi.updateProduct(product.id, input)}
        onSaved={() => reload()}
      />

      <ProductGenerateDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        product={product}
      />

      <ConfirmHost />
    </div>
  );
}

// ── 局部组件 ────────────────────────────────────────────────────────────────

function PricePill({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string | null;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col">
      <span className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</span>
      <span
        className={`mt-0.5 text-xl font-semibold tabular-nums ${
          value == null ? "text-zinc-300" : accent ? "text-zinc-900" : "text-zinc-700"
        }`}
      >
        {value ?? "未填写"}
      </span>
    </div>
  );
}

function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="w-20 shrink-0 pt-0.5 text-zinc-500">{label}</dt>
      <dd className="min-w-0 flex-1 text-zinc-800">{children}</dd>
    </div>
  );
}

function RelatedAssets({ assets }: { assets: MixcutAsset[] }) {
  const SUBKIND_LABEL: Record<string, string> = {
    "product-photo": "商品图",
    "product-video": "商品视频",
    "ai-marketing-video": "AI 带货视频",
    "user-upload": "用户上传",
  };
  return (
    <section id="assets" className="flex flex-col gap-3 scroll-mt-20 rounded-2xl border border-zinc-200 bg-white p-4 shadow-[var(--shadow-soft)]">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-800">关联素材</h2>
        <span className="text-xs text-zinc-500">{assets.length} 个</span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {assets.map((a) => (
          <div
            key={a.id}
            className="flex flex-col overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 transition hover:border-violet-400/60"
          >
            <div className="aspect-square overflow-hidden bg-zinc-100">
              {a.kind === "video" ? (
                <video
                  src={a.file_url}
                  poster={a.thumbnail_url ?? a.preview_url}
                  className="h-full w-full object-cover"
                  muted
                  preload="metadata"
                />
              ) : (
                <img
                  src={a.preview_url ?? a.thumbnail_url ?? a.file_url}
                  alt={a.name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            <div className="px-2 py-1.5">
              <div className="line-clamp-1 text-[11px] text-zinc-700" title={a.name}>
                {a.name}
              </div>
              <div className="mt-0.5 text-[10px] text-zinc-500">
                {SUBKIND_LABEL[a.subkind ?? ""] ?? a.subkind ?? a.kind}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function formatYuan(cents: number): string {
  const yuan = Math.floor(cents / 100);
  const cs = cents % 100;
  if (cs === 0) return `¥${yuan}`;
  return `¥${yuan}.${String(cs).padStart(2, "0")}`;
}
