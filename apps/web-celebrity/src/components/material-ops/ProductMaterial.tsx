"use client";

// 商品素材库 —— 视频为主（全局历史视频库）+ 商品作为筛选条件。
// 选中某商品时浮出该商品 hero（价格 / 佣金 / 卖点 / AI 提取）。视图：全部 / 按商品分组 / 按脚本分组。
// 点开单条视频 → 视频详情 + AI 维度 + 派生。

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw, Plus, ChevronRight, ChevronDown, PlayCircle, Loader2,
  Link2, ScrollText, Shuffle, Lock, FlaskConical, TriangleAlert, Sparkles, Package, Check,
} from "lucide-react";
import { useAuth } from "@ai-star-eco/api-client";
import { AiErrorNotice, errorMessage } from "@/components/common/ai-error-notice";
import { AiThinking } from "@/components/common/ai-thinking";
import { Card, Button } from "@/components/creator";
import { MaterialOpsApi, ProductsApi } from "@/api";
import { MATERIAL_PRODUCTS, getScript, getProduct, toMaterialProduct } from "@/mocks/material-ops";
import { VARIANT_AXES } from "@/constants/material-ops-ui";
import { canUseOperatorTools } from "@/lib/operator-role";
import type { MaterialProduct, MaterialVideo, ScriptAsset, VariantAxisKey } from "./types";
import { VideoGenDialog } from "./VideoGenDialog";
import { Eyebrow, Tag, Seg, PageHeader, MetricTile, SearchInput, EmptyState, ProductThumb, fmtWan, parsePlays, hexA } from "./shared";

type ViewMode = "flat" | "by-product" | "by-script";
type StatusFilter = "all" | "published" | "ready" | "rendering" | "failed";
type SortMode = "recent" | "plays" | "ctr";

/** 商品筛选特殊值。 */
const ALL = "all";
const UNASSIGNED = "__unassigned__";

/** 解析一条视频归属的商品 id（优先视频自带 product_id，回退脚本的 product_id）。 */
function resolvePid(v: MaterialVideo): string | null {
  return v.product_id ?? getScript(v.script_id)?.product_id ?? null;
}

// 仅用于「点开一条孤儿视频（其商品已在商品库删除）的详情」时给 VideoDetail 一个最小商品上下文。
// 注意：不会进入任何列表 / 筛选项 —— 商品库仍是目录的唯一真源，已删除商品不会冒充存在。
function fallbackProduct(id: string): MaterialProduct {
  return {
    id: id || "unknown",
    name: id ? `未关联商品 ${id.slice(0, 8)}` : "未关联商品",
    category: "其他",
    images: [],
    sellingPoints: "",
    usageCount: 0,
    source: "manual",
    createdAt: "",
    updatedAt: "",
    sellingPointList: [],
    audience: [],
    suggestedAngles: [],
  };
}

function VideoPoster({ video }: { video: MaterialVideo }) {
  const ref = React.useRef<HTMLVideoElement>(null);

  if (video.thumbnail_url) {
    return (
      <img
        src={video.thumbnail_url}
        alt=""
        loading="lazy"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
      />
    );
  }

  if (!video.video_url) return null;

  return (
    <video
      ref={ref}
      src={video.video_url}
      muted
      playsInline
      preload="metadata"
      onLoadedMetadata={() => {
        const el = ref.current;
        if (!el || !Number.isFinite(el.duration)) return;
        try {
          el.currentTime = Math.min(0.75, Math.max(0, el.duration - 0.1));
        } catch {
          /* Some browsers may reject early seeks; keep the first decoded frame. */
        }
      }}
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", pointerEvents: "none", background: "#000" }}
    />
  );
}

export function ProductMaterial({ initialProductId }: { initialProductId?: string } = {}) {
  const router = useRouter();
  const [videos, setVideos] = React.useState<MaterialVideo[]>([]);
  const [products, setProducts] = React.useState<MaterialProduct[]>([]);
  const [loadError, setLoadError] = React.useState(false);
  const [selectedVideoId, setSelectedVideoId] = React.useState<string | null>(null);
  const [videoGen, setVideoGen] = React.useState<{ mode: "baseline" | "variant"; baseline: MaterialVideo | null; script: ScriptAsset; product: MaterialProduct } | null>(null);

  // 全局筛选状态（视频为主；商品只是其中一个维度）。
  const [productFilter, setProductFilter] = React.useState<string>(initialProductId ?? ALL);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [viewMode, setViewMode] = React.useState<ViewMode>("flat");
  const [vidQuery, setVidQuery] = React.useState("");
  const [sort, setSort] = React.useState<SortMode>("recent");

  const load = React.useCallback(() => {
    MaterialOpsApi.listVideos()
      .then((v) => {
        setVideos(v);
        setLoadError(false);
      })
      .catch(() => setLoadError(true));
  }, []);

  // 商品目录直读系统商品库（/api/products）；映射成展示用 MaterialProduct。拉取失败回退本地 mock。
  const loadProducts = React.useCallback(() => {
    ProductsApi.listProducts()
      .then((list) => setProducts(list.map(toMaterialProduct)))
      .catch(() => setProducts(MATERIAL_PRODUCTS));
  }, []);

  React.useEffect(() => {
    load();
    loadProducts();
  }, [load, loadProducts]);

  // 渲染中任务推进：mock 模式由 advanceRenderTasks 模拟进度；live 模式 advanceRenderTasks 为空，
  // 靠 load() 重新拉取真实任务进度（视频生成慢，3s 轮询足够）。
  const hasRendering = videos.some((v) => v.status === "rendering");
  React.useEffect(() => {
    if (!hasRendering) return;
    const t = setInterval(() => {
      MaterialOpsApi.advanceRenderTasks().then(() => load());
    }, 3000);
    return () => clearInterval(t);
  }, [hasRendering, load]);

  // 可筛选的商品 = 系统商品库 ∪「被视频引用、且随仓打包的本地富数据商品」。
  // 已在商品库删除的商品不会进来（其孤儿视频归入「未关联」）。
  const productList = products.length > 0 ? products : MATERIAL_PRODUCTS;
  const knownIds = React.useMemo(() => new Set(productList.map((p) => p.id)), [productList]);
  const filterableProducts = React.useMemo(() => {
    const refIds = new Set<string>();
    videos.forEach((v) => {
      const pid = resolvePid(v);
      if (pid) refIds.add(pid);
    });
    const demoExtras = [...refIds]
      .filter((id) => !knownIds.has(id))
      .map((id) => getProduct(id))
      .filter((p): p is MaterialProduct => !!p);
    return [...productList, ...demoExtras];
  }, [videos, productList, knownIds]);

  const productById = React.useMemo(
    () => new Map(filterableProducts.map((p) => [p.id, p])),
    [filterableProducts],
  );

  const isUnassigned = React.useCallback(
    (v: MaterialVideo) => {
      const pid = resolvePid(v);
      return !pid || !productById.has(pid);
    },
    [productById],
  );

  const countsByProduct = React.useMemo(() => {
    const m = new Map<string, number>();
    videos.forEach((v) => {
      const pid = resolvePid(v);
      if (pid && productById.has(pid)) m.set(pid, (m.get(pid) ?? 0) + 1);
    });
    return m;
  }, [videos, productById]);

  const unassignedCount = React.useMemo(() => videos.filter(isUnassigned).length, [videos, isUnassigned]);
  const coveredCount = React.useMemo(
    () => new Set(videos.map(resolvePid).filter((pid) => pid && productById.has(pid))).size,
    [videos, productById],
  );

  // 当前商品筛选作用域内的视频
  const scopedVideos = React.useMemo(() => {
    if (productFilter === ALL) return videos;
    if (productFilter === UNASSIGNED) return videos.filter(isUnassigned);
    return videos.filter((v) => resolvePid(v) === productFilter);
  }, [videos, productFilter, isUnassigned]);

  const selectedProduct =
    productFilter !== ALL && productFilter !== UNASSIGNED ? productById.get(productFilter) ?? null : null;

  const selectedVideo = selectedVideoId ? videos.find((v) => v.id === selectedVideoId) ?? null : null;

  // 「派生新视频」入口：拉真实脚本 + 解析真实关联商品（mock getScript 只认 6 个内置脚本，
  // 用户脚本走 MaterialOpsApi.getScript），再开派生弹窗。
  const openDerive = React.useCallback(async (video: MaterialVideo) => {
    const script = await MaterialOpsApi.getScript(video.script_id);
    if (!script) return;
    const product = await MaterialOpsApi.resolveProductForScript(script);
    setVideoGen({ mode: "variant", baseline: video, script, product });
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader
        eyebrow="商品素材库"
        title={
          <>
            历史视频资产
            <span style={{ color: "var(--fg-2)", fontWeight: 400, fontSize: 15, marginLeft: 12 }}>
              {videos.length} 条视频 · 覆盖 {coveredCount} 个商品
            </span>
          </>
        }
        right={
          <>
            <Button variant="secondary" size="sm" onClick={() => { load(); loadProducts(); }}>
              <RefreshCw size={13} /> 同步最新
            </Button>
            <Button variant="accent" size="sm" onClick={() => router.push("/material/workshop")}>
              <Plus size={13} /> 新建脚本
            </Button>
          </>
        }
      />

      {loadError && (
        <Card style={{ padding: 16, display: "flex", alignItems: "center", gap: 12, border: "1px solid var(--danger)" }}>
          <TriangleAlert size={18} color="var(--danger)" style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, color: "var(--fg-0)", fontWeight: 600 }}>视频库加载失败</div>
            <div style={{ fontSize: 12, color: "var(--fg-2)", marginTop: 2 }}>网络异常或服务暂不可用，请重试。</div>
          </div>
          <Button variant="secondary" size="sm" onClick={load}>
            <RefreshCw size={13} /> 重试
          </Button>
        </Card>
      )}

      {selectedVideo ? (
        <VideoDetail
          video={selectedVideo}
          product={productById.get(resolvePid(selectedVideo) ?? "") ?? fallbackProduct(resolvePid(selectedVideo) ?? "")}
          allVideos={videos}
          onBack={() => setSelectedVideoId(null)}
          onSelectVideo={setSelectedVideoId}
          onOpenScript={(sid) => router.push(`/material/workshop/${sid}`)}
          onDerive={openDerive}
        />
      ) : (
        <GlobalVideoLibrary
          videos={scopedVideos}
          productById={productById}
          filterableProducts={filterableProducts}
          countsByProduct={countsByProduct}
          totalVideoCount={videos.length}
          unassignedCount={unassignedCount}
          productFilter={productFilter}
          setProductFilter={setProductFilter}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          viewMode={viewMode}
          setViewMode={setViewMode}
          query={vidQuery}
          setQuery={setVidQuery}
          sort={sort}
          setSort={setSort}
          selectedProduct={selectedProduct}
          onSelectVideo={setSelectedVideoId}
          onOpenScript={(sid) => router.push(`/material/workshop/${sid}`)}
          onRetry={load}
        />
      )}

      {videoGen && (
        <VideoGenDialog
          script={videoGen.script}
          product={videoGen.product}
          mode={videoGen.mode}
          baseline={videoGen.baseline}
          onClose={() => setVideoGen(null)}
          onSubmitted={load}
          onViewLibrary={() => setVideoGen(null)}
        />
      )}
    </div>
  );
}

// ── 商品筛选下拉（可搜索） ─────────────────────────────────────────────────────
function ProductFilter({
  products, value, onChange, counts, totalCount, unassignedCount,
}: {
  products: MaterialProduct[];
  value: string;
  onChange: (v: string) => void;
  counts: Map<string, number>;
  totalCount: number;
  unassignedCount: number;
}) {
  const [open, setOpen] = React.useState(false);
  const [q, setQ] = React.useState("");
  const label =
    value === ALL ? "全部商品" : value === UNASSIGNED ? "未关联 / 已删除商品" : products.find((p) => p.id === value)?.name ?? "未知商品";
  const filtered = React.useMemo(
    () => products.filter((p) => !q.trim() || p.name.includes(q.trim()) || p.category.includes(q.trim())),
    [products, q],
  );
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, maxWidth: 260,
          padding: "6px 10px", borderRadius: "var(--radius-md)", cursor: "pointer",
          background: value === ALL ? "var(--bg-2)" : hexA("#7c5cff", "14"),
          border: `1px solid ${value === ALL ? "var(--line)" : hexA("#7c5cff", "55")}`,
          color: "var(--fg-0)", fontSize: 12.5, fontFamily: "var(--font-sans)",
        }}
      >
        <Package size={13} color="var(--accent)" style={{ flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <ChevronDown size={13} style={{ flexShrink: 0, opacity: 0.6, transform: open ? "rotate(180deg)" : "none", transition: "transform 140ms" }} />
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 30 }} />
          <div
            style={{
              position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 31, width: 300, maxWidth: "95vw",
              background: "var(--bg-1)", border: "1px solid var(--line)", borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-pop)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: 360,
            }}
          >
            <div style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
              <SearchInput value={q} onChange={setQ} placeholder="搜商品名 / 类目" />
            </div>
            <div style={{ overflowY: "auto", padding: 4 }}>
              <ProductFilterRow label="全部商品" sub="所有历史视频" count={totalCount} active={value === ALL} onClick={() => { onChange(ALL); setOpen(false); }} />
              {unassignedCount > 0 && (
                <ProductFilterRow label="未关联 / 已删除商品" sub="商品已删除或未绑定" count={unassignedCount} active={value === UNASSIGNED} onClick={() => { onChange(UNASSIGNED); setOpen(false); }} />
              )}
              {filtered.map((p) => (
                <ProductFilterRow key={p.id} label={p.name} sub={p.category} count={counts.get(p.id) ?? 0} active={value === p.id} onClick={() => { onChange(p.id); setOpen(false); }} />
              ))}
              {filtered.length === 0 && <div style={{ padding: "10px 12px", fontSize: 12, color: "var(--fg-3)" }}>没有匹配的商品</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function ProductFilterRow({ label, sub, count, active, onClick }: { label: string; sub?: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left", display: "flex", alignItems: "center", gap: 8,
        padding: "8px 10px", borderRadius: "var(--radius-sm)", cursor: "pointer",
        background: active ? hexA("#7c5cff", "14") : "transparent", border: 0, fontFamily: "var(--font-sans)",
      }}
    >
      <span style={{ width: 14, flexShrink: 0, color: "var(--accent)" }}>{active && <Check size={13} />}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, color: "var(--fg-0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</div>
        {sub && <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)" }}>{sub}</div>}
      </div>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)", flexShrink: 0 }}>{count}</span>
    </button>
  );
}

// ── 全局视频库 ───────────────────────────────────────────────────────────────
function GlobalVideoLibrary({
  videos, productById, filterableProducts, countsByProduct, totalVideoCount, unassignedCount,
  productFilter, setProductFilter, statusFilter, setStatusFilter, viewMode, setViewMode,
  query, setQuery, sort, setSort, selectedProduct, onSelectVideo, onOpenScript, onRetry,
}: {
  videos: MaterialVideo[];
  productById: Map<string, MaterialProduct>;
  filterableProducts: MaterialProduct[];
  countsByProduct: Map<string, number>;
  totalVideoCount: number;
  unassignedCount: number;
  productFilter: string;
  setProductFilter: (v: string) => void;
  statusFilter: StatusFilter;
  setStatusFilter: (v: StatusFilter) => void;
  viewMode: ViewMode;
  setViewMode: (v: ViewMode) => void;
  query: string;
  setQuery: (v: string) => void;
  sort: SortMode;
  setSort: (v: SortMode) => void;
  selectedProduct: MaterialProduct | null;
  onSelectVideo: (id: string) => void;
  onOpenScript: (scriptId: string) => void;
  onRetry?: () => void;
}) {
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  const filtered = React.useMemo(() => {
    return videos
      .filter(
        (v) =>
          statusFilter === "all" ||
          (statusFilter === "ready" && v.status === "ready" && !v.metrics) ||
          (statusFilter === "rendering" && v.status === "rendering") ||
          (statusFilter === "failed" && v.status === "failed") ||
          (statusFilter === "published" && !!v.metrics),
      )
      .filter((v) => !query.trim() || v.name.includes(query.trim()))
      .sort((a, b) => {
        if (sort === "recent") return new Date(b.generated_at || b.created_at || 0).getTime() - new Date(a.generated_at || a.created_at || 0).getTime();
        if (sort === "plays") return parsePlays(b.metrics?.plays) - parsePlays(a.metrics?.plays);
        if (sort === "ctr") return (b.metrics?.ctr_pct ?? 0) - (a.metrics?.ctr_pct ?? 0);
        return 0;
      });
  }, [videos, statusFilter, query, sort]);

  const showProductOnCard = !selectedProduct; // 跨商品视图才在卡片上标商品名

  const scriptGroups = React.useMemo(() => {
    const m = new Map<string, MaterialVideo[]>();
    filtered.forEach((v) => {
      if (!m.has(v.script_id)) m.set(v.script_id, []);
      m.get(v.script_id)!.push(v);
    });
    return Array.from(m.entries()).map(([scriptId, vids]) => ({ scriptId, script: getScript(scriptId), videos: vids }));
  }, [filtered]);

  const productGroups = React.useMemo(() => {
    const m = new Map<string, MaterialVideo[]>();
    filtered.forEach((v) => {
      const pid = resolvePid(v);
      const key = pid && productById.has(pid) ? pid : UNASSIGNED;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(v);
    });
    return Array.from(m.entries())
      .map(([pid, vids]) => ({ pid, product: pid === UNASSIGNED ? null : productById.get(pid) ?? null, videos: vids }))
      .sort((a, b) => b.videos.length - a.videos.length);
  }, [filtered, productById]);

  return (
    <>
      {selectedProduct ? (
        <ProductHero product={selectedProduct} videos={filtered} />
      ) : (
        <StatBar videos={filtered} />
      )}

      {/* toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderRadius: "var(--radius-md)", background: "var(--bg-2)", border: "1px solid var(--line)" }}>
        <ProductFilter
          products={filterableProducts}
          value={productFilter}
          onChange={setProductFilter}
          counts={countsByProduct}
          totalCount={totalVideoCount}
          unassignedCount={unassignedCount}
        />
        <span style={{ width: 1, height: 20, background: "var(--line-2)" }} />
        <Seg
          value={viewMode}
          onChange={setViewMode}
          size="sm"
          options={[{ value: "flat", label: "全部" }, { value: "by-product", label: "按商品" }, { value: "by-script", label: "按脚本" }]}
        />
        <Seg
          value={statusFilter}
          onChange={setStatusFilter}
          size="sm"
          options={[{ value: "all", label: "全部状态" }, { value: "published", label: "已发布" }, { value: "ready", label: "未发布" }, { value: "rendering", label: "渲染中" }, { value: "failed", label: "失败" }]}
        />
        <div style={{ minWidth: 160, flex: 1, maxWidth: 260 }}>
          <SearchInput value={query} onChange={setQuery} placeholder="搜视频名…" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>排序</span>
          <Seg value={sort} onChange={setSort} size="sm" options={[{ value: "recent", label: "最新" }, { value: "plays", label: "播放" }, { value: "ctr", label: "CTR" }]} />
        </div>
      </div>

      {filtered.length === 0 && (
        <Card>
          <EmptyState icon={<PlayCircle size={26} />} title="没有匹配的视频" hint="换个筛选条件，或去新建脚本生成第一条视频。" />
        </Card>
      )}

      {viewMode === "flat" && filtered.length > 0 && (
        <Card style={{ padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {filtered.map((v) => {
              const pid = resolvePid(v);
              const pname = showProductOnCard ? (pid && productById.get(pid)?.name) || "未关联商品" : undefined;
              return (
                <VideoCard key={v.id} video={v} productName={pname} showParent={!!v.parent_video_id} onClick={() => onSelectVideo(v.id)} onRetry={onRetry} />
              );
            })}
          </div>
        </Card>
      )}

      {viewMode === "by-product" && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ padding: "4px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)" }}>
            <span>共 {productGroups.length} 个商品 · {filtered.length} 条视频</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setCollapsed({})} style={ghostLink}>全部展开</button>
              <span style={{ color: "var(--fg-3)" }}>·</span>
              <button onClick={() => setCollapsed(Object.fromEntries(productGroups.map((g) => [g.pid, true])))} style={ghostLink}>全部折叠</button>
            </div>
          </div>
          {productGroups.map((g) => (
            <ProductGroupCard
              key={g.pid}
              product={g.product}
              videos={g.videos}
              collapsed={!!collapsed[g.pid]}
              onToggle={() => setCollapsed({ ...collapsed, [g.pid]: !collapsed[g.pid] })}
              onViewProduct={g.product ? () => setProductFilter(g.pid) : undefined}
              onSelectVideo={onSelectVideo}
              onRetry={onRetry}
            />
          ))}
        </div>
      )}

      {viewMode === "by-script" && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ padding: "4px 6px", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)" }}>
            <span>共 {scriptGroups.length} 个脚本 · {filtered.length} 条视频</span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setCollapsed({})} style={ghostLink}>全部展开</button>
              <span style={{ color: "var(--fg-3)" }}>·</span>
              <button onClick={() => setCollapsed(Object.fromEntries(scriptGroups.map((g) => [g.scriptId, true])))} style={ghostLink}>全部折叠</button>
            </div>
          </div>
          {scriptGroups.map((g) => (
            <ScriptGroupCard
              key={g.scriptId}
              scriptId={g.scriptId}
              script={g.script}
              videos={g.videos}
              collapsed={!!collapsed[g.scriptId]}
              onToggle={() => setCollapsed({ ...collapsed, [g.scriptId]: !collapsed[g.scriptId] })}
              onSelectVideo={onSelectVideo}
              onOpenScript={onOpenScript}
              onRetry={onRetry}
            />
          ))}
        </div>
      )}
    </>
  );
}

const ghostLink: React.CSSProperties = { background: "transparent", border: 0, color: "var(--fg-2)", fontSize: 11, cursor: "pointer", fontFamily: "var(--font-mono)", padding: 0 };

// ── 商品 hero（选中某商品时浮出） ─────────────────────────────────────────────
function ProductHero({ product, videos }: { product: MaterialProduct; videos: MaterialVideo[] }) {
  const { user } = useAuth();
  const canExtract = canUseOperatorTools(user?.operatorRole);
  const [sellingPoints, setSellingPoints] = React.useState(product.sellingPoints ?? "");
  const [extracting, setExtracting] = React.useState(false);
  const [extractError, setExtractError] = React.useState<string | null>(null);
  React.useEffect(() => {
    setSellingPoints(product.sellingPoints ?? "");
    setExtractError(null);
  }, [product.id, product.sellingPoints]);

  const extractSelling = async () => {
    if (!product.link?.trim()) {
      setExtractError("该商品缺少链接，无法 AI 提取卖点（请先在商品库补充链接）");
      return;
    }
    setExtracting(true);
    setExtractError(null);
    try {
      const { sellingPoints: sp } = await ProductsApi.extractSellingPoints({ name: product.name, link: product.link });
      await ProductsApi.updateProduct(product.id, { sellingPoints: sp });
      setSellingPoints(sp);
    } catch (e) {
      setExtractError(errorMessage(e, "AI 提取卖点失败，请稍后重试"));
    } finally {
      setExtracting(false);
    }
  };

  const totalPlays = videos.reduce((s, v) => s + parsePlays(v.metrics?.plays), 0);

  return (
    <Card style={{ padding: 0, overflow: "hidden", background: `linear-gradient(110deg, ${hexA(product.accentColor ?? "#7c5cff", "1f")} 0%, transparent 40%), var(--bg-1)`, border: `1px solid ${hexA(product.accentColor ?? "#7c5cff", "44")}` }}>
      <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
        <ProductThumb name={product.name} image={product.images?.[0]} color={product.accentColor} size={48} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16, color: "var(--fg-0)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{product.name}</span>
            <Tag color="var(--fg-2)">{product.category}</Tag>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 3, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)" }}>
            <span style={{ color: "var(--extra-teal)" }}>{product.priceCents ? `¥${(product.priceCents / 100).toFixed(0)}` : "—"}</span>
            <span>·</span>
            <span>佣金 {product.commissionRate ?? "—"}%</span>
            <span>·</span>
            <span>库存 {product.stock?.toLocaleString() ?? "—"}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <HeroStat label="视频" value={String(videos.length)} tone="var(--accent)" />
          <HeroStat label="渲染中" value={String(videos.filter((v) => v.status === "rendering").length)} tone="var(--extra-teal)" />
          <HeroStat label="已发布" value={String(videos.filter((v) => v.metrics).length)} tone="var(--extra-teal)" />
          <HeroStat label="总播放" value={fmtWan(totalPlays)} tone="var(--warning)" />
        </div>
      </div>
      <div style={{ padding: "10px 18px 14px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Eyebrow style={{ marginBottom: 4 }}>商品卖点</Eyebrow>
          <div style={{ fontSize: 12, color: sellingPoints ? "var(--fg-1)" : "var(--fg-3)", lineHeight: 1.6, wordBreak: "break-word" }}>
            {sellingPoints || "暂无卖点 · 可用 AI 根据商品名 + 链接自动提炼"}
          </div>
        </div>
        {canExtract && (
          extracting ? (
            <div style={{ flexShrink: 0 }}>
              <AiThinking compact stages={["读取商品信息…", "提炼卖点…", "整理输出…"]} />
            </div>
          ) : (
            <Button variant="secondary" size="sm" onClick={extractSelling} style={{ flexShrink: 0 }}>
              <Sparkles size={12} /> AI 提取卖点
            </Button>
          )
        )}
      </div>
      {extractError && (
        <div style={{ padding: "0 18px 14px" }}>
          <AiErrorNotice title="AI 提取卖点失败" message={extractError} onRetry={extractSelling} />
        </div>
      )}
    </Card>
  );
}

// 跨商品视图下的聚合数据条（全部 / 未关联）。
function StatBar({ videos }: { videos: MaterialVideo[] }) {
  const totalPlays = videos.reduce((s, v) => s + parsePlays(v.metrics?.plays), 0);
  return (
    <Card style={{ padding: "12px 18px", display: "flex", alignItems: "center", gap: 18 }}>
      <Eyebrow>全部视频</Eyebrow>
      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 18 }}>
        <HeroStat label="视频" value={String(videos.length)} tone="var(--accent)" />
        <HeroStat label="渲染中" value={String(videos.filter((v) => v.status === "rendering").length)} tone="var(--extra-teal)" />
        <HeroStat label="已发布" value={String(videos.filter((v) => v.metrics).length)} tone="var(--extra-teal)" />
        <HeroStat label="总播放" value={fmtWan(totalPlays)} tone="var(--warning)" />
      </div>
    </Card>
  );
}

function HeroStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: tone, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--fg-3)" }}>{label}</div>
    </div>
  );
}

// ── 按商品分组卡 ──────────────────────────────────────────────────────────────
function ProductGroupCard({
  product, videos, collapsed, onToggle, onViewProduct, onSelectVideo, onRetry,
}: {
  product: MaterialProduct | null;
  videos: MaterialVideo[];
  collapsed: boolean;
  onToggle: () => void;
  onViewProduct?: () => void;
  onSelectVideo: (id: string) => void;
  onRetry?: () => void;
}) {
  const totalPlays = videos.reduce((s, v) => s + parsePlays(v.metrics?.plays), 0);
  const name = product?.name ?? "未关联 / 已删除商品";
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div onClick={onToggle} style={{ padding: "11px 16px", display: "flex", alignItems: "center", gap: 12, background: "var(--bg-2)", borderBottom: collapsed ? 0 : "1px solid var(--line)", cursor: "pointer" }}>
        <span style={{ width: 22, height: 22, borderRadius: "var(--radius-sm)", background: "var(--bg-3)", color: "var(--fg-1)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <ChevronRight size={11} style={{ transform: collapsed ? "none" : "rotate(90deg)", transition: "transform 140ms" }} />
        </span>
        <ProductThumb name={name} image={product?.images?.[0]} color={product?.accentColor} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, color: "var(--fg-0)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", marginTop: 3 }}>
            {product?.category ?? "—"} · {videos.length} 条视频
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          <GroupStat label="视频" value={String(videos.length)} tone="var(--accent)" />
          <GroupStat label="总播放" value={fmtWan(totalPlays)} tone="var(--warning)" />
        </div>
        {onViewProduct && (
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onViewProduct(); }}>
            <Package size={11} /> 只看该商品
          </Button>
        )}
      </div>
      {!collapsed && (
        <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12 }}>
          {videos.map((v) => (
            <VideoCard key={v.id} video={v} showParent={!!v.parent_video_id} onClick={() => onSelectVideo(v.id)} onRetry={onRetry} />
          ))}
        </div>
      )}
    </Card>
  );
}

// ── 按脚本分组卡 ──────────────────────────────────────────────────────────────
function ScriptGroupCard({
  scriptId, script, videos, collapsed, onToggle, onSelectVideo, onOpenScript, onRetry,
}: {
  scriptId: string;
  script?: import("./types").ScriptAsset;
  videos: MaterialVideo[];
  collapsed: boolean;
  onToggle: () => void;
  onSelectVideo: (id: string) => void;
  onOpenScript: (id: string) => void;
  onRetry?: () => void;
}) {
  const totalPlays = videos.reduce((s, v) => s + parsePlays(v.metrics?.plays), 0);
  const bestCtr = Math.max(0, ...videos.map((v) => v.metrics?.ctr_pct ?? 0));
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div onClick={onToggle} style={{ padding: "11px 16px", display: "flex", alignItems: "center", gap: 12, background: "var(--bg-2)", borderBottom: collapsed ? 0 : "1px solid var(--line)", cursor: "pointer" }}>
        <span style={{ width: 22, height: 22, borderRadius: "var(--radius-sm)", background: "var(--bg-3)", color: "var(--fg-1)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <ChevronRight size={11} style={{ transform: collapsed ? "none" : "rotate(90deg)", transition: "transform 140ms" }} />
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, color: "var(--fg-0)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{script?.name ?? "未关联脚本"}</span>
          </div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", marginTop: 3 }}>
            {script?.hook_type} · {script?.duration_sec}s · {scriptId}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14, flexShrink: 0 }}>
          <GroupStat label="视频" value={String(videos.length)} tone="var(--accent)" />
          <GroupStat label="总播放" value={fmtWan(totalPlays)} tone="var(--warning)" />
          <GroupStat label="最佳 CTR" value={bestCtr > 0 ? `${bestCtr.toFixed(1)}%` : "—"} tone="var(--extra-teal)" />
        </div>
        {script && (
          <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); onOpenScript(scriptId); }}>
            <ScrollText size={11} /> 查看脚本
          </Button>
        )}
      </div>
      {!collapsed && (
        <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: 12 }}>
          {videos.map((v) => (
            <VideoCard key={v.id} video={v} showParent={!!v.parent_video_id} onClick={() => onSelectVideo(v.id)} onRetry={onRetry} />
          ))}
        </div>
      )}
    </Card>
  );
}

function GroupStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: tone, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: 9, color: "var(--fg-3)" }}>{label}</div>
    </div>
  );
}

function VideoCard({ video, onClick, onRetry, showParent, productName }: { video: MaterialVideo; onClick: () => void; onRetry?: () => void; showParent?: boolean; productName?: string }) {
  const isRendering = video.status === "rendering";
  const isFailed = video.status === "failed";
  const published = !!video.metrics;
  return (
    <button
      onClick={isFailed && onRetry ? onRetry : onClick}
      title={isFailed ? "生成失败 · 点击重试" : undefined}
      className="mo-card"
      style={{ textAlign: "left", borderRadius: "var(--radius-md)", overflow: "hidden", cursor: "pointer", border: `1px solid ${isFailed ? "var(--danger)" : "var(--line)"}`, background: "var(--bg-1)", padding: 0, fontFamily: "var(--font-sans)" }}
    >
      <div style={{ aspectRatio: "9 / 14", position: "relative", background: isFailed ? "var(--bg-2)" : `linear-gradient(135deg, ${hexA(video.cover_color, "99")}, ${hexA(video.cover_color, "33")})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        {!isFailed && !isRendering && <VideoPoster video={video} />}
        {!isFailed && !isRendering && (video.thumbnail_url || video.video_url) && (
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.34))", pointerEvents: "none" }} />
        )}
        {isFailed ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, padding: 12, textAlign: "center" }}>
            <TriangleAlert size={24} color="var(--danger)" />
            <span style={{ fontSize: 11, color: "var(--danger)", fontWeight: 600 }}>生成失败</span>
            {onRetry && (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--accent)" }}>
                <RefreshCw size={11} /> 点击重试
              </span>
            )}
          </div>
        ) : null}
        {!isRendering && !isFailed && <PlayCircle size={26} color="#fff" style={{ position: "absolute", opacity: 0.85 }} />}
        {isRendering && (
          <>
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)" }} />
            <Loader2 size={22} color="#fff" className="animate-spin" style={{ position: "absolute" }} />
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 3, background: "rgba(255,255,255,0.2)" }}>
              <div style={{ height: "100%", width: `${video.progress_pct ?? 0}%`, background: "var(--extra-teal)" }} />
            </div>
          </>
        )}
        {published && <span style={{ position: "absolute", top: 5, left: 6, fontFamily: "var(--font-mono)", fontSize: 9, color: "#fff", background: "rgba(34,181,154,0.9)", padding: "2px 6px", borderRadius: 3 }}>已发布</span>}
        {!published && !isRendering && !isFailed && <span style={{ position: "absolute", top: 5, left: 6, fontFamily: "var(--font-mono)", fontSize: 9, color: "#fff", background: "rgba(0,0,0,0.5)", padding: "2px 6px", borderRadius: 3 }}>未发布</span>}
        {showParent && !isRendering && !isFailed && (
          <span style={{ position: "absolute", top: 5, right: 6, display: "inline-flex", alignItems: "center", gap: 3, fontFamily: "var(--font-mono)", fontSize: 9, color: "#fff", background: "rgba(0,0,0,0.5)", padding: "2px 6px", borderRadius: 3 }}>
            <Link2 size={9} /> 派生
          </span>
        )}
        <span style={{ position: "absolute", bottom: 5, right: 6, fontFamily: "var(--font-mono)", fontSize: 9, color: "#fff", background: "rgba(0,0,0,0.5)", padding: "2px 5px", borderRadius: 3 }}>{video.duration_sec}s</span>
      </div>
      <div style={{ padding: "8px 10px" }}>
        {productName && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 3, fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            <Package size={9} style={{ flexShrink: 0 }} /> {productName}
          </div>
        )}
        <div style={{ fontSize: 12, color: "var(--fg-0)", fontWeight: 500, lineHeight: 1.4, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", minHeight: 32 }}>
          {video.name}
        </div>
        {video.metrics ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 5, fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-2)" }}>
            {video.metrics.plays}
            <span style={{ color: "var(--extra-teal)" }}>· {video.metrics.ctr_pct}%</span>
            <span style={{ color: "var(--warning)" }}>· {video.metrics.gmv}</span>
          </div>
        ) : (
          <div style={{ marginTop: 5, fontFamily: "var(--font-mono)", fontSize: 9, color: isFailed ? "var(--danger)" : isRendering ? "var(--extra-teal)" : "var(--fg-3)" }}>
            {isFailed ? "生成失败 · 可重试" : isRendering ? `${video.stage} · ${video.progress_pct ?? 0}%` : video.generated_at ? `生成于 ${(video.generated_at || "").slice(5, 10)}` : "未发布"}
          </div>
        )}
      </div>
    </button>
  );
}

// ── 视频详情 ─────────────────────────────────────────────────────────────────
function VideoDetail({
  video, product, allVideos, onBack, onSelectVideo, onOpenScript, onDerive,
}: {
  video: MaterialVideo;
  product: MaterialProduct;
  allVideos: MaterialVideo[];
  onBack: () => void;
  onSelectVideo: (id: string) => void;
  onOpenScript: (id: string) => void;
  onDerive: (v: MaterialVideo) => void;
}) {
  const script = getScript(video.script_id);
  const derived = allVideos.filter((v) => v.parent_video_id === video.id);
  const parent = video.parent_video_id ? allVideos.find((v) => v.id === video.parent_video_id) : null;
  const [hoveredAxis, setHoveredAxis] = React.useState<string | null>(null);

  const axes = (Object.entries(video.variant_config) as [VariantAxisKey, string][])
    .map(([key, optId]) => ({ key, axis: VARIANT_AXES[key], opt: VARIANT_AXES[key]?.options.find((o) => o.id === optId) }))
    .filter((x) => x.axis && x.opt);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <Button variant="ghost" onClick={onBack}>
          <ChevronRight size={13} style={{ transform: "rotate(180deg)" }} /> 返回视频库
        </Button>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {script && (
            <Button variant="secondary" size="md" onClick={() => onOpenScript(video.script_id)}>
              <ScrollText size={13} /> 查看脚本
            </Button>
          )}
          <Button variant="accent" size="md" onClick={() => onDerive(video)}>
            <Shuffle size={13} /> 派生新视频
          </Button>
        </div>
      </div>

      <div className="stack-mobile" style={{ display: "grid", gridTemplateColumns: "300px minmax(0, 1fr)", gap: 16, alignItems: "flex-start" }}>
        {/* 视频帧 */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ aspectRatio: "9 / 16", background: `linear-gradient(135deg, ${hexA(video.cover_color, "99")}, ${hexA(video.cover_color, "33")})`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            {video.video_url ? (
              <video
                src={video.video_url}
                controls
                playsInline
                preload="metadata"
                poster={video.thumbnail_url ?? undefined}
                style={{ width: "100%", height: "100%", objectFit: "cover", background: "#000" }}
              />
            ) : (
              <>
                <PlayCircle size={56} color="#fff" style={{ position: "absolute", opacity: 0.85 }} />
                <span style={{ position: "absolute", left: 12, right: 12, bottom: 40, textAlign: "center", fontSize: 11, color: "rgba(255,255,255,0.82)", lineHeight: 1.5 }}>
                  暂无可播放源
                </span>
              </>
            )}
            <span style={{ position: "absolute", bottom: 10, right: 10, fontFamily: "var(--font-mono)", fontSize: 10, color: "#fff", background: "rgba(0,0,0,0.45)", padding: "3px 8px", borderRadius: 4, pointerEvents: "none" }}>
              {video.duration_sec}s · {video.aspect_ratio}
            </span>
          </div>
          {video.metrics && (
            <div className="stack-mobile-2" style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, background: "var(--bg-2)" }}>
              <MetricTile label="播放" value={video.metrics.plays} tone="var(--accent)" />
              <MetricTile label="CTR" value={`${video.metrics.ctr_pct}%`} tone="var(--extra-teal)" />
              <MetricTile label="完播" value={`${video.metrics.completion_pct}%`} tone="var(--extra-teal)" />
              <MetricTile label="GMV" value={video.metrics.gmv} tone="var(--warning)" />
            </div>
          )}
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* 标题 + meta */}
          <Card style={{ padding: "18px 22px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Eyebrow>视频资产</Eyebrow>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{video.id}</span>
            </div>
            <h2 style={{ fontFamily: "var(--font-display)", fontSize: 22, color: "var(--fg-0)", fontWeight: 700, margin: 0, letterSpacing: "-0.01em" }}>{video.name}</h2>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)", flexWrap: "wrap" }}>
              <span>
                <Link2 size={11} style={{ verticalAlign: -2, marginRight: 3 }} />
                关联脚本{" "}
                <button onClick={() => onOpenScript(video.script_id)} style={{ background: "transparent", border: 0, padding: 0, color: "var(--accent)", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>
                  {video.script_id}
                </button>
              </span>
              <span>·</span>
              <span>
                <Package size={11} style={{ verticalAlign: -2, marginRight: 3 }} />
                {product.name}
              </span>
              {parent && (
                <>
                  <span>·</span>
                  <span>
                    派生自{" "}
                    <button onClick={() => onSelectVideo(parent.id)} style={{ background: "transparent", border: 0, padding: 0, color: "var(--accent-strong)", cursor: "pointer", fontFamily: "inherit", fontSize: "inherit" }}>
                      {parent.name}
                    </button>
                  </span>
                </>
              )}
              <span>·</span>
              <span>{video.model} · 渲染 {video.render_cost_sec ?? "—"}s</span>
            </div>
          </Card>

          {/* AI 维度 */}
          <Card style={{ padding: 0, overflow: "hidden", background: `linear-gradient(135deg, ${hexA("#22b59a", "0d")} 0%, transparent 50%), var(--bg-1)`, border: `1px solid ${hexA("#22b59a", "44")}` }}>
            <div style={{ padding: "14px 22px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 24, height: 24, borderRadius: "var(--radius-sm)", background: hexA("#22b59a", "1f"), color: "var(--extra-teal)", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <FlaskConical size={13} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13.5, color: "var(--fg-0)", fontWeight: 600 }}>AI 看了这条视频</div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)", marginTop: 2 }}>
                  脚本保持原样 · 推荐在这 <strong style={{ color: "var(--extra-teal)" }}>{axes.length}</strong> 个方面变一变
                </div>
              </div>
              <Tag color="var(--extra-teal)">已分析</Tag>
            </div>
            <div className="stack-mobile" style={{ padding: "14px 22px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {axes.map(({ key, axis, opt }) => (
                <AxisChip key={key} axis={axis!} current={opt!} hovered={hoveredAxis === key} onHover={() => setHoveredAxis(key)} onLeave={() => setHoveredAxis(null)} />
              ))}
            </div>
            <div style={{ padding: "12px 22px 14px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-2)" }}>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)" }}>
                <Lock size={11} style={{ verticalAlign: -2, marginRight: 4 }} /> 脚本结构 / 文案保持不变
              </span>
              <Button variant="accent" onClick={() => onDerive(video)}>
                <Shuffle size={13} /> 派生新视频 · 选维度生成
              </Button>
            </div>
          </Card>

          {/* 派生视频 */}
          {derived.length > 0 && (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <Eyebrow>从这条派生的视频 · {derived.length} 条</Eyebrow>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)" }}>在视频库中可见</span>
              </div>
              <div style={{ padding: 14, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 10 }}>
                {derived.map((v) => (
                  <VideoCard key={v.id} video={v} onClick={() => onSelectVideo(v.id)} />
                ))}
              </div>
            </Card>
          )}

          {/* schema —— 工程排障视图，仅 dev 暴露（运营无需看原始字段 / 外键） */}
          {process.env.NODE_ENV !== "production" && (
            <Card style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "12px 18px", borderBottom: "1px solid var(--line)" }}>
                <Eyebrow>视频卡片 · 存了什么（dev）</Eyebrow>
              </div>
              <div className="stack-mobile" style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px", fontFamily: "var(--font-mono)", fontSize: 10, lineHeight: 1.7 }}>
                <SchemaLine k="id" v={video.id} />
                <SchemaLine k="script_id" v={video.script_id} />
                <SchemaLine k="product_id" v={product.id} />
                {video.parent_video_id && <SchemaLine k="parent_video_id" v={video.parent_video_id} />}
                <SchemaLine k="status" v={video.status} />
                <SchemaLine k="duration_sec" v={String(video.duration_sec)} />
                <SchemaLine k="aspect_ratio" v={video.aspect_ratio} />
                <SchemaLine k="model" v={video.model} />
                {video.video_url && <SchemaLine k="video_url" v={video.video_url} />}
              </div>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function AxisChip({
  axis, current, hovered, onHover, onLeave,
}: {
  axis: import("./types").VariantAxis;
  current: import("./types").VariantAxisOption;
  hovered: boolean;
  onHover: () => void;
  onLeave: () => void;
}) {
  const alts = axis.options.filter((o) => o.id !== current.id).slice(0, 3);
  return (
    <div
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{ padding: "10px 12px", borderRadius: "var(--radius-md)", background: hovered ? hexA(axis.toneVar, "14") : "var(--bg-2)", border: `1px solid ${hovered ? axis.toneVar : "var(--line)"}`, cursor: "pointer", transition: "all 140ms" }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
        <span style={{ width: 5, height: 5, borderRadius: 99, background: axis.toneVar }} />
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: axis.toneVar, letterSpacing: "0.1em", textTransform: "uppercase" }}>{axis.label}</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 12.5, color: "var(--fg-0)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{current.label}</div>
          {current.sub && <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)", marginTop: 2 }}>{current.sub}</div>}
        </div>
      </div>
      {hovered && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${hexA(axis.toneVar, "44")}` }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-2)", marginBottom: 5 }}>
            <Shuffle size={9} color={axis.toneVar} style={{ verticalAlign: -1, marginRight: 3 }} /> AI 可替换为：
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {alts.map((o) => (
              <div key={o.id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "var(--fg-1)" }}>
                <span style={{ width: 3, height: 3, borderRadius: 99, background: hexA(axis.toneVar, "88"), flexShrink: 0 }} />
                <span>{o.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function SchemaLine({ k, v, tone }: { k: string; v: string; tone?: string }) {
  return (
    <div style={{ display: "flex", gap: 6, minWidth: 0 }}>
      <span style={{ color: "var(--fg-3)", flexShrink: 0 }}>{k}:</span>
      <span style={{ color: tone ?? "var(--fg-0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
    </div>
  );
}
