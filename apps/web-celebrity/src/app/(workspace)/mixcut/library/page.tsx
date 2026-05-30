"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Search,
  Video,
  Image as ImageIcon,
  Music,
  Sticker as StickerIcon,
  Upload,
  Trash2,
  Plus,
  Loader2,
  AlertCircle,
  Play,
  Sparkles,
  Package,
  ExternalLink,
} from "lucide-react";
import { Card, CardContent } from "@/components/mixcut-zone/ui/card";
import { Button } from "@/components/mixcut-zone/ui/button";
import { Badge } from "@/components/mixcut-zone/ui/badge";
import { Input } from "@/components/mixcut-zone/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/mixcut-zone/ui/tabs";
import { MixcutApi, ProductsApi } from "@/api";
import type {
  MixcutAsset,
  MixcutAssetKind,
} from "@/components/mixcut-zone/types";
import type { Product } from "@ai-star-eco/types/product";
import { formatDuration, relativeTime, formatBytes } from "@/components/mixcut-zone/lib/utils";
import { useConfirm } from "@/components/common/confirm-dialog";

type TopTab = "assets" | "products" | "official";

// 混剪素材库：只放制作素材，不放成片视频。
//   - assets   我的素材  ← 自己上传的视频 / 商品图 / 贴图 / 背景音乐
//   - products 商品素材  ← 按商品分组列 relatedProductId 非空的 MixcutAsset
//   - official 官方明星片段  ← 后台运营上传的直播切片等（只读消费）
// 成片视频（混剪成片）已迁到一级「视频库」(/library?source=mixcut)；?tab=videos 旧链自动跳转。
export default function MixcutLibraryPage() {
  return (
    <Suspense
      fallback={
        <div className="px-6 lg:px-8 py-12 max-w-[1600px] mx-auto text-center text-muted-foreground text-sm">
          加载中
        </div>
      }
    >
      <LibraryShell />
    </Suspense>
  );
}

function LibraryShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams?.get("tab");

  // 旧深链兼容：成片视频已迁到一级「视频库」。?tab=videos → 跳转。
  useEffect(() => {
    if (rawTab === "videos") {
      router.replace("/library?source=mixcut");
    }
  }, [rawTab, router]);

  const initialTab: TopTab =
    rawTab === "official" || rawTab === "products" ? rawTab : "assets";
  const [topTab, setTopTab] = useState<TopTab>(initialTab);

  const handleTabChange = (v: TopTab) => {
    setTopTab(v);
    // 软同步 URL（不刷新页面），便于深链分享
    const url = new URL(window.location.href);
    if (v === "assets") url.searchParams.delete("tab");
    else url.searchParams.set("tab", v);
    router.replace(`${url.pathname}${url.search}`, { scroll: false });
  };

  return (
    <div className="px-6 lg:px-8 py-6 space-y-6 max-w-[1600px] mx-auto">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">混剪素材库</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          管理自己上传的素材、商品素材，以及平台提供的官方明星片段。
          <Link href="/library?source=mixcut" className="ml-1 text-violet-600 hover:underline">
            找已生成的成片？前往视频库 →
          </Link>
        </p>
      </div>

      <Tabs value={topTab} onValueChange={(v) => handleTabChange(v as TopTab)}>
        <TabsList>
          <TabsTrigger value="assets">我的素材</TabsTrigger>
          <TabsTrigger value="products">商品素材</TabsTrigger>
          <TabsTrigger value="official">官方明星片段</TabsTrigger>
        </TabsList>

        <TabsContent value="assets">
          <AssetsTab />
        </TabsContent>
        <TabsContent value="products">
          <ProductAssetsTab />
        </TabsContent>
        <TabsContent value="official">
          <OfficialClipsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── 我的素材 tab：原有 4 个 sub-tab（视频 / 商品图 / 贴图 / 背景音乐） ───────────

type SubTab = "video" | "image" | "sticker" | "bgm";

const TAB_LABEL: Record<SubTab, string> = {
  video: "明星片段 / 视频",
  image: "商品图",
  sticker: "贴图",
  bgm: "背景音乐",
};

const ACCEPT_MIME: Record<SubTab, string> = {
  video: "video/*",
  image: "image/*",
  sticker: "image/*",
  bgm: "audio/*",
};

function AssetsTab() {
  const [sub, setSub] = useState<SubTab>("video");
  const [assets, setAssets] = useState<Record<SubTab, MixcutAsset[] | null>>({
    video: null,
    image: null,
    sticker: null,
    bgm: null,
  });
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { confirm, ConfirmHost } = useConfirm();

  useEffect(() => {
    if (assets[sub] === null) {
      MixcutApi.listAssets({ kind: sub })
        .then((list) => setAssets((s) => ({ ...s, [sub]: list })))
        .catch(() => setAssets((s) => ({ ...s, [sub]: [] })));
    }
  }, [sub, assets]);

  const handleUpload = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const created = await MixcutApi.uploadAsset({
        file,
        kind: sub,
        name: file.name,
      });
      setAssets((s) => ({ ...s, [sub]: [created, ...(s[sub] ?? [])] }));
    } catch (e: any) {
      setError(e?.message ?? "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "删除该素材？",
      description: "已使用此素材的历史任务不受影响，仅影响后续新任务。",
      confirmText: "删除",
      tone: "danger",
    });
    if (!ok) return;
    try {
      await MixcutApi.deleteAsset(id);
      setAssets((s) => ({ ...s, [sub]: (s[sub] ?? []).filter((a) => a.id !== id) }));
    } catch (e: any) {
      setError(e?.message ?? "删除失败");
    }
  };

  const filterFn = (a: MixcutAsset) => {
    if (!search) return true;
    return `${a.name} ${a.original_name ?? ""} ${a.tags ?? ""}`.includes(search);
  };

  const current = assets[sub];
  const filtered = (current ?? []).filter(filterFn);

  return (
    <div className="space-y-5 mt-4">
      <div className="flex items-center justify-end gap-3">
        <Button
          variant="gradient"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          上传到「{TAB_LABEL[sub]}」
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT_MIME[sub]}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleUpload(f);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <Card className="border-red-500/30 bg-red-500/[0.04]">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-red-500">
            <AlertCircle className="size-4 shrink-0" /> {error}
          </CardContent>
        </Card>
      )}

      <Tabs value={sub} onValueChange={(v) => setSub(v as SubTab)}>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <TabsList>
            <TabsTrigger value="video" className="gap-1">
              <Video className="size-3" />
              视频
              <Badge variant="muted" className="ml-1 text-[10px]">
                {assets.video?.length ?? "…"}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="image" className="gap-1">
              <ImageIcon className="size-3" />
              商品图
              <Badge variant="muted" className="ml-1 text-[10px]">
                {assets.image?.length ?? "…"}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="sticker" className="gap-1">
              <StickerIcon className="size-3" />
              贴图
              <Badge variant="muted" className="ml-1 text-[10px]">
                {assets.sticker?.length ?? "…"}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="bgm" className="gap-1">
              <Music className="size-3" />
              背景音乐
              <Badge variant="muted" className="ml-1 text-[10px]">
                {assets.bgm?.length ?? "…"}
              </Badge>
            </TabsTrigger>
          </TabsList>
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="搜索素材名 / 标签…"
              className="pl-9 h-9"
            />
          </div>
        </div>

        {(["video", "image", "sticker", "bgm"] as SubTab[]).map((k) => (
          <TabsContent key={k} value={k}>
            <AssetGrid
              assets={current}
              filtered={filtered}
              kind={k as MixcutAssetKind}
              onDelete={handleDelete}
              onUploadClick={() => inputRef.current?.click()}
            />
          </TabsContent>
        ))}
      </Tabs>
      <ConfirmHost />
    </div>
  );
}

function AssetGrid({
  assets,
  filtered,
  kind,
  onDelete,
  onUploadClick,
}: {
  assets: MixcutAsset[] | null;
  filtered: MixcutAsset[];
  kind: MixcutAssetKind;
  onDelete: (id: string) => void;
  onUploadClick: () => void;
}) {
  if (assets === null) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground text-sm">
          <Loader2 className="size-6 animate-spin mx-auto mb-2 text-violet-500" />
          加载中…
        </CardContent>
      </Card>
    );
  }

  if (assets.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="p-12 text-center text-muted-foreground text-sm">
          <Upload className="size-8 mx-auto mb-3" />
          <div className="mb-3">还没有「{TAB_LABEL[kind as SubTab]}」素材</div>
          <Button variant="outline" size="sm" onClick={onUploadClick}>
            <Plus className="size-3" /> 上传第一个
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (filtered.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center text-muted-foreground text-sm">
          没有匹配的素材，试试调整搜索关键词
        </CardContent>
      </Card>
    );
  }

  const isMedia = kind === "video";
  const isImage = kind === "image" || kind === "sticker";
  const isAudio = kind === "bgm";

  return (
    <div
      className={
        isMedia
          ? "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4"
          : isImage
            ? "grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4"
            : "grid grid-cols-1 md:grid-cols-2 gap-3"
      }
    >
      {filtered.map((a) => (
        <Card key={a.id} className="overflow-hidden group hover:border-foreground/30 transition-colors">
          {isMedia && <VideoThumb asset={a} />}
          {isImage && (
            <div className="aspect-square bg-secondary/30 grid place-items-center overflow-hidden">
              <img src={a.file_url} alt={a.name} className="w-full h-full object-cover" />
            </div>
          )}
          {isAudio && (
            <CardContent className="p-4 flex items-center gap-3">
              <div className="size-12 rounded-lg bg-violet-500 grid place-items-center shrink-0">
                <Music className="size-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{a.name}</div>
                <div className="text-[10px] text-muted-foreground">
                  {a.duration > 0 ? formatDuration(a.duration) : ""} · {formatBytes(a.file_size)}
                </div>
                <audio src={a.file_url} controls className="mt-2 w-full h-7" />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="size-8 shrink-0"
                onClick={() => onDelete(a.id)}
              >
                <Trash2 className="size-3.5 text-muted-foreground" />
              </Button>
            </CardContent>
          )}

          {!isAudio && (
            <CardContent className="p-3 space-y-1.5">
              <div className="flex items-start gap-2">
                <div className="text-sm font-medium line-clamp-1 flex-1">{a.name}</div>
                <button
                  onClick={() => onDelete(a.id)}
                  className="size-6 rounded grid place-items-center text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                  title="删除"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="muted" className="text-[10px]">{TAB_LABEL[a.kind as SubTab] ?? a.kind}</Badge>
                {a.tags && <span className="text-[10px] text-muted-foreground">#{a.tags}</span>}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {formatBytes(a.file_size)} · {relativeTime(a.uploaded_at)}
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}

// 视频缩略图（保持原行为：点击激活 controls + 中心裁切预览）
function VideoThumb({ asset }: { asset: MixcutAsset }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activated, setActivated] = useState(false);

  const handleActivate = () => {
    setActivated(true);
    requestAnimationFrame(() => {
      videoRef.current?.play().catch(() => {});
    });
  };

  return (
    <div className="aspect-video bg-black relative overflow-hidden">
      <video
        ref={videoRef}
        src={asset.file_url}
        className={`w-full h-full transition-[object-fit] ${activated ? "object-contain" : "object-cover"}`}
        playsInline
        preload="metadata"
        controls={activated}
        onPlay={() => setActivated(true)}
      />
      {!activated && (
        <>
          <button
            type="button"
            onClick={handleActivate}
            className="absolute inset-0 grid place-items-center bg-gradient-to-t from-black/40 via-transparent to-black/10 hover:from-black/60 hover:to-black/20 transition-colors"
            aria-label="播放预览"
          >
            <span className="size-11 rounded-full bg-white/95 grid place-items-center shadow-lg transition-transform group-hover:scale-105">
              <Play className="size-4 text-black translate-x-0.5" fill="currentColor" />
            </span>
          </button>
          {asset.duration > 0 && (
            <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-[10px] text-white font-mono pointer-events-none">
              {formatDuration(asset.duration)}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── 商品素材 tab：按 product 分组列 relatedProductId 非空的 MixcutAsset ──────

function ProductAssetsTab() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [assetsByProduct, setAssetsByProduct] = useState<Record<string, MixcutAsset[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await ProductsApi.listProducts({});
        if (cancelled) return;
        setProducts(list);
        // 并行拉每个商品的素材（10s 之内对 6-30 商品规模没问题；规模上去再换 batch endpoint）
        const map: Record<string, MixcutAsset[]> = {};
        await Promise.all(
          list.map(async (p) => {
            try {
              const assets = await MixcutApi.listAssets({ relatedProductId: p.id });
              map[p.id] = assets ?? [];
            } catch {
              map[p.id] = [];
            }
          }),
        );
        if (!cancelled) setAssetsByProduct(map);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "加载失败");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (products === null && !error) {
    return (
      <Card className="mt-4">
        <CardContent className="p-12 text-center text-muted-foreground text-sm">
          <Loader2 className="size-6 animate-spin mx-auto mb-2 text-violet-500" />
          加载商品 + 素材中…
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="mt-4 border-red-500/30 bg-red-500/[0.04]">
        <CardContent className="p-3 flex items-center gap-2 text-sm text-red-500">
          <AlertCircle className="size-4 shrink-0" /> {error}
        </CardContent>
      </Card>
    );
  }

  // 只展示有关联素材的商品；空商品列在底部小字提示
  const productsWithAssets = (products ?? []).filter(
    (p) => (assetsByProduct[p.id] ?? []).length > 0,
  );
  const productsEmpty = (products ?? []).filter(
    (p) => (assetsByProduct[p.id] ?? []).length === 0,
  );

  const totalAssets = productsWithAssets.reduce(
    (sum, p) => sum + (assetsByProduct[p.id]?.length ?? 0),
    0,
  );

  const ql = search.trim().toLowerCase();
  const filtered = !ql
    ? productsWithAssets
    : productsWithAssets.filter(
        (p) =>
          p.name.toLowerCase().includes(ql) ||
          (assetsByProduct[p.id] ?? []).some((a) =>
            `${a.name} ${a.tags ?? ""}`.toLowerCase().includes(ql),
          ),
      );

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-muted-foreground">
          按商品分组的关联素材（来源：抖音链接解析 / 用户上传 / 未来 AI 生成）。
          共 <span className="font-mono text-foreground">{productsWithAssets.length}</span> 个商品 ·
          <span className="font-mono text-foreground">{totalAssets}</span> 项素材。
        </div>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索商品名 / 素材名…"
            className="pl-9 h-9"
          />
        </div>
      </div>

      {productsWithAssets.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center text-muted-foreground text-sm space-y-2">
            <Package className="size-6 mx-auto text-zinc-400" />
            <p>还没有商品关联素材。</p>
            <p className="text-[11px]">
              到{" "}
              <Link href="/products" className="text-violet-600 hover:underline">
                商品库
              </Link>{" "}
              粘贴抖音商城链接快速建档，server 会自动抓图并按商品归档。
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((p) => (
            <ProductAssetSection key={p.id} product={p} assets={assetsByProduct[p.id] ?? []} />
          ))}
          {filtered.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="p-8 text-center text-muted-foreground text-sm">
                没有匹配的商品或素材。
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {productsEmpty.length > 0 && (
        <Card className="border-dashed">
          <CardContent className="p-4 text-xs text-muted-foreground">
            还有 <span className="font-mono text-foreground">{productsEmpty.length}</span> 个商品还没有关联素材，
            到商品库逐条点击「刷新图片」可自动抓取抖音商品图。
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const PRODUCT_SUBKIND_LABEL: Record<string, string> = {
  "product-photo": "商品图",
  "product-video": "商品视频",
  "ai-marketing-video": "AI 带货视频",
  "user-upload": "手动上传",
};

function ProductAssetSection({ product, assets }: { product: Product; assets: MixcutAsset[] }) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* 商品头 */}
        <div className="flex items-center gap-3 border-b border-border p-3">
          <Link
            href={`/products/${product.id}`}
            className="size-12 shrink-0 overflow-hidden rounded-md border border-border bg-secondary/30"
          >
            {product.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.images[0]} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-zinc-400">
                <Package className="size-4" />
              </div>
            )}
          </Link>
          <div className="min-w-0 flex-1">
            <Link
              href={`/products/${product.id}`}
              className="line-clamp-1 text-sm font-medium text-foreground hover:text-violet-600"
            >
              {product.name}
            </Link>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
              <Badge variant="muted" className="text-[10px]">{product.category}</Badge>
              {product.priceCents != null && (
                <span className="tabular-nums">
                  ¥{(product.priceCents / 100).toFixed(2).replace(/\.00$/, "")}
                </span>
              )}
              <span>· {assets.length} 项素材</span>
            </div>
          </div>
          <Link
            href={`/products/${product.id}#assets`}
            className="inline-flex items-center gap-1 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] text-zinc-600 hover:border-violet-400/60 hover:text-violet-700"
            title="去商品详情页"
          >
            <ExternalLink className="size-3" /> 详情
          </Link>
        </div>
        {/* 素材网格 */}
        <div className="grid grid-cols-3 gap-2 p-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8">
          {assets.map((a) => {
            const subkind = a.subkind ?? "user-upload";
            const label = PRODUCT_SUBKIND_LABEL[subkind] ?? subkind;
            const thumb = a.preview_url || a.thumbnail_url || a.file_url;
            return (
              <div
                key={a.id}
                className="group overflow-hidden rounded-md border border-border bg-secondary/20"
                title={a.name}
              >
                <div className="aspect-square overflow-hidden bg-secondary/30">
                  {a.kind === "video" ? (
                    <video
                      src={a.file_url}
                      poster={thumb ?? undefined}
                      muted
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  ) : thumb ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumb} alt={a.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-zinc-400">
                      <ImageIcon className="size-4" />
                    </div>
                  )}
                </div>
                <div className="p-1.5 text-[10px] text-muted-foreground">
                  <span className="rounded bg-violet-500/10 px-1 text-violet-600">{label}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ── 官方明星片段 tab：运营后台上传，用户只读消费 ─────────────────────────────

function OfficialClipsTab() {
  const [clips, setClips] = useState<MixcutAsset[] | null>(null);
  const [category, setCategory] = useState<string>("全部");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    MixcutApi.listOfficialClips()
      .then((list) => setClips(list ?? []))
      .catch((e: any) => {
        setError(e?.message ?? "加载失败");
        setClips([]);
      });
  }, []);

  const allCategories = (() => {
    const set = new Set<string>();
    for (const a of clips ?? []) {
      if (a.official_category) set.add(a.official_category);
    }
    return ["全部", ...Array.from(set).sort()];
  })();

  const filtered = (clips ?? []).filter(
    (a) => category === "全部" || a.official_category === category,
  );

  if (clips === null && !error) {
    return (
      <Card className="mt-4">
        <CardContent className="p-12 text-center text-muted-foreground text-sm">
          <Loader2 className="size-6 animate-spin mx-auto mb-2 text-violet-500" />
          加载中…
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="text-xs text-muted-foreground">
          由平台运营整理的明星直播切片 / 综艺 / 访谈片段，可直接用作混剪素材
        </div>
      </div>

      {allCategories.length > 1 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {allCategories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={
                "px-3 py-1 rounded-full text-xs transition-colors border " +
                (category === c
                  ? "bg-foreground text-background border-foreground"
                  : "bg-transparent text-muted-foreground border-border hover:border-foreground")
              }
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {error && (
        <Card className="border-red-500/30 bg-red-500/[0.04]">
          <CardContent className="p-3 flex items-center gap-2 text-sm text-red-500">
            <AlertCircle className="size-4 shrink-0" /> {error}
          </CardContent>
        </Card>
      )}

      {filtered.length === 0 && !error ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center text-muted-foreground text-sm space-y-2">
            <Sparkles className="size-6 mx-auto text-violet-500" />
            <p>还没有官方片段，首批内容正在准备中，敬请期待。</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((a) => (
            <Card key={a.id} className="overflow-hidden hover:border-foreground/30 transition-colors">
              <div className="aspect-video bg-black relative overflow-hidden">
                <VideoThumb asset={a} />
              </div>
              <CardContent className="p-3 space-y-1.5">
                <div className="text-sm font-medium line-clamp-1" title={a.name}>{a.name}</div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {a.official_category && (
                    <Badge variant="muted" className="text-[10px]">{a.official_category}</Badge>
                  )}
                  {a.tags && <span className="text-[10px] text-muted-foreground">#{a.tags}</span>}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {a.duration > 0 ? formatDuration(a.duration) : ""} · {formatBytes(a.file_size)}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
