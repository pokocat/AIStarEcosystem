"use client";

// 商品素材库 —— 左商品目录 / 右视频库（平铺·按脚本分组）/ 视频详情 + AI 维度 + 派生。

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  RefreshCw, Plus, Search, X, ChevronRight, ChevronDown, Play, PlayCircle, Loader2,
  Link2, ScrollText, Shuffle, Lock, FlaskConical, TriangleAlert, Sparkles,
} from "lucide-react";
import { useAuth } from "@ai-star-eco/api-client";
import { AiErrorNotice, errorMessage } from "@/components/common/ai-error-notice";
import { AiThinking } from "@/components/common/ai-thinking";
import { Card, Button } from "@/components/creator";
import { MaterialOpsApi, ProductsApi } from "@/api";
import { MATERIAL_PRODUCTS, getScript, getProduct, toMaterialProduct } from "@/mocks/material-ops";
import { VARIANT_AXES } from "@/constants/material-ops-ui";
import type { MaterialProduct, MaterialVideo, VariantAxisKey } from "./types";
import { VideoGenDialog } from "./VideoGenDialog";
import { Eyebrow, Tag, Seg, FilterChip, PageHeader, MetricTile, SearchInput, EmptyState, ProductThumb, fmtWan, parsePlays, hexA } from "./shared";

interface Group {
  product: MaterialProduct;
  videos: MaterialVideo[];
}

export function ProductMaterial({ initialProductId }: { initialProductId?: string } = {}) {
  const router = useRouter();
  const [videos, setVideos] = React.useState<MaterialVideo[]>([]);
  const [query, setQuery] = React.useState("");
  const [catFilter, setCatFilter] = React.useState("all");
  const [sortProducts, setSortProducts] = React.useState<"videos" | "name" | "price">("videos");
  const [selectedProductId, setSelectedProductId] = React.useState<string | undefined>(initialProductId ?? "p4");
  const [selectedVideoId, setSelectedVideoId] = React.useState<string | null>(null);
  const [videoGen, setVideoGen] = React.useState<{ mode: "baseline" | "variant"; baseline: MaterialVideo | null; scriptId: string } | null>(null);
  const [loadError, setLoadError] = React.useState(false);

  // 商品目录直接读系统商品库（/api/products）→ 映射成展示用 MaterialProduct（含真实图 / 价格 / 佣金）。
  // 这样素材库左侧与商品库严格对齐：商品库新增 / 删除即时反映。拉取失败回退本地 mock，保证视频库仍可用。
  const [products, setProducts] = React.useState<MaterialProduct[]>([]);

  const load = React.useCallback(() => {
    MaterialOpsApi.listVideos()
      .then((v) => {
        setVideos(v);
        setLoadError(false);
      })
      .catch(() => setLoadError(true));
  }, []);

  const loadProducts = React.useCallback(() => {
    ProductsApi.listProducts()
      .then((list) => setProducts(list.map(toMaterialProduct)))
      .catch(() => setProducts(MATERIAL_PRODUCTS)); // 商品库拉取失败 → 回退 mock，不阻断视频库
  }, []);

  React.useEffect(() => {
    load();
    loadProducts();
  }, [load, loadProducts]);

  // 渲染中任务推进
  const hasRendering = videos.some((v) => v.status === "rendering");
  React.useEffect(() => {
    if (!hasRendering) return;
    const t = setInterval(() => {
      MaterialOpsApi.advanceRenderTasks().then(() => load());
    }, 1600);
    return () => clearInterval(t);
  }, [hasRendering, load]);

  const groups: Group[] = React.useMemo(() => {
    const byProduct = new Map<string, MaterialVideo[]>();
    videos.forEach((v) => {
      const pid = v.product_id ?? getScript(v.script_id)?.product_id;
      if (!pid) return;
      if (!byProduct.has(pid)) byProduct.set(pid, []);
      byProduct.get(pid)!.push(v);
    });
    const base = products.length > 0 ? products : MATERIAL_PRODUCTS;
    const known = new Set(base.map((p) => p.id));
    // 仅「随仓打包的本地演示商品」(p1–p6，getProduct 命中) 才补一行，保住 mock demo 视频可见。
    // 其它在商品库里查不到的 product_id（典型：已在商品库删除、但旧视频仍引用的商品）一律不补 ——
    // 商品库是唯一真源，删了就不该在素材库目录里出现。
    const extras: MaterialProduct[] = [];
    byProduct.forEach((_, pid) => {
      if (known.has(pid)) return;
      const demo = getProduct(pid);
      if (demo) extras.push(demo);
    });
    return [...base, ...extras].map((product) => ({ product, videos: byProduct.get(product.id) ?? [] }));
  }, [videos, products]);

  const filteredProducts = React.useMemo(() => {
    return groups
      .filter((g) => catFilter === "all" || g.product.category === catFilter)
      .filter((g) => !query || g.product.name.includes(query) || g.product.category.includes(query))
      .sort((a, b) => {
        if (sortProducts === "videos") return b.videos.length - a.videos.length;
        if (sortProducts === "name") return a.product.name.localeCompare(b.product.name);
        if (sortProducts === "price") return (b.product.priceCents ?? 0) - (a.product.priceCents ?? 0);
        return 0;
      });
  }, [groups, catFilter, query, sortProducts]);

  const selectedGroup = groups.find((g) => g.product.id === selectedProductId) ?? filteredProducts[0];
  const groupVideos = selectedGroup?.videos ?? [];
  const selectedVideo = groupVideos.find((v) => v.id === selectedVideoId) ?? null;
  const cats = ["all", ...Array.from(new Set(groups.map((g) => g.product.category)))];
  const totalVideos = videos.length;

  const onComplete = (made: MaterialVideo[]) => {
    MaterialOpsApi.addVideos(made).then(() => {
      setVideoGen(null);
      load();
    });
  };
  const onSubmitAsync = (payload: { names: string[]; configs: import("./types").VariantConfig[] }) => {
    if (!videoGen) return;
    const script = getScript(videoGen.scriptId);
    if (!script) return;
    const tasks = payload.names.map((name, i) => ({
      id: `task-${Date.now()}-${i}`,
      script_id: script.id,
      product_id: script.product_id,
      parent_video_id: videoGen.mode === "variant" ? videoGen.baseline?.id ?? null : null,
      kind: videoGen.mode === "variant" ? ("variant" as const) : ("baseline" as const),
      name,
      status: "pending" as const,
      submitted_at: new Date(Date.now() + i * 100).toISOString(),
      eta_sec: 90,
      progress_pct: 0,
      stage: "已入队",
      variant_config: payload.configs[i] ?? payload.configs[0],
    }));
    MaterialOpsApi.enqueueRenderTasks(tasks).then(() => {
      setVideoGen(null);
      load();
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <PageHeader
        eyebrow="商品素材库"
        title={
          <>
            视频资产 · 以商品为索引
            <span style={{ color: "var(--fg-2)", fontWeight: 400, fontSize: 15, marginLeft: 12 }}>
              {totalVideos} 条视频 · 覆盖 {groups.filter((g) => g.videos.length > 0).length} 个商品
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

      <div style={{ display: "grid", gridTemplateColumns: "280px minmax(0, 1fr)", gap: 16, alignItems: "flex-start" }}>
        <ProductDirectory
          products={filteredProducts}
          allCount={groups.length}
          query={query}
          setQuery={setQuery}
          catFilter={catFilter}
          setCatFilter={setCatFilter}
          cats={cats}
          sort={sortProducts}
          setSort={setSortProducts}
          selectedId={selectedGroup?.product.id}
          onSelect={(id) => {
            setSelectedProductId(id);
            setSelectedVideoId(null);
          }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
          {!selectedGroup && (
            <Card>
              <EmptyState icon={<Search size={26} />} title="没有匹配的商品" hint="换个关键词或类目，看看其它商品的视频素材。" />
            </Card>
          )}
          {selectedGroup && !selectedVideo && (
            <VideoLibraryView
              product={selectedGroup.product}
              videos={groupVideos}
              onSelectVideo={setSelectedVideoId}
              onOpenScript={(sid) => router.push(`/material/workshop/${sid}`)}
              onRetry={load}
            />
          )}
          {selectedGroup && selectedVideo && (
            <VideoDetail
              video={selectedVideo}
              product={selectedGroup.product}
              allVideos={groupVideos}
              onBack={() => setSelectedVideoId(null)}
              onSelectVideo={setSelectedVideoId}
              onOpenScript={(sid) => router.push(`/material/workshop/${sid}`)}
              onDerive={(v) => setVideoGen({ mode: "variant", baseline: v, scriptId: v.script_id })}
            />
          )}
        </div>
      </div>

      {videoGen && getScript(videoGen.scriptId) && (
        <VideoGenDialog
          script={{ ...getScript(videoGen.scriptId)!, product: MATERIAL_PRODUCTS.find((p) => p.id === getScript(videoGen.scriptId)!.product_id) }}
          mode={videoGen.mode}
          baseline={videoGen.baseline}
          onClose={() => setVideoGen(null)}
          onComplete={onComplete}
          onSubmitAsync={onSubmitAsync}
        />
      )}
    </div>
  );
}

// ── 商品目录 ─────────────────────────────────────────────────────────────────
function ProductDirectory({
  products, allCount, query, setQuery, catFilter, setCatFilter, cats, sort, setSort, selectedId, onSelect,
}: {
  products: Group[];
  allCount: number;
  query: string;
  setQuery: (v: string) => void;
  catFilter: string;
  setCatFilter: (v: string) => void;
  cats: string[];
  sort: "videos" | "name" | "price";
  setSort: (v: "videos" | "name" | "price") => void;
  selectedId?: string;
  onSelect: (id: string) => void;
}) {
  return (
    <Card style={{ padding: 0, overflow: "hidden", position: "sticky", top: 8 }}>
      <div style={{ padding: "12px 14px", borderBottom: "1px solid var(--line)", background: "var(--bg-2)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <Eyebrow>商品</Eyebrow>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)" }}>
            {products.length}/{allCount}
          </span>
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder="搜商品名 / 类目" />
      </div>
      <div style={{ padding: "10px 14px 8px", borderBottom: "1px solid var(--line)", display: "flex", flexWrap: "wrap", gap: 4 }}>
        {cats.slice(0, 8).map((c) => (
          <FilterChip key={c} active={catFilter === c} onClick={() => setCatFilter(c)}>
            {c === "all" ? "全部" : c}
          </FilterChip>
        ))}
      </div>
      <div style={{ padding: "8px 14px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-2)" }}>
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>排序</span>
        <Seg value={sort} onChange={setSort} size="sm" options={[{ value: "videos", label: "视频多" }, { value: "name", label: "名称" }, { value: "price", label: "价格" }]} />
      </div>
      <div style={{ maxHeight: "calc(100vh - 280px)", overflowY: "auto" }}>
        {products.length === 0 && <EmptyState compact title="没有匹配的商品" hint="换个关键词或类目试试。" />}
        {products.map((g) => {
          const active = g.product.id === selectedId;
          const rendering = g.videos.filter((v) => v.status === "rendering").length;
          return (
            <button
              key={g.product.id}
              onClick={() => onSelect(g.product.id)}
              className="mo-row"
              style={{
                width: "100%",
                textAlign: "left",
                padding: "10px 14px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                boxShadow: active ? "inset 0 0 0 1px var(--accent)" : "none",
                background: active ? hexA("#7c5cff", "12") : undefined,
                borderBottom: "1px solid var(--line)",
                fontFamily: "var(--font-sans)",
              }}
            >
              <ProductThumb name={g.product.name} image={g.product.images?.[0]} color={g.product.accentColor} size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12.5, color: "var(--fg-0)", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{g.product.name}</span>
                  {rendering > 0 && <span title={`${rendering} 条渲染中`} style={{ width: 6, height: 6, borderRadius: 99, background: "var(--extra-teal)", flexShrink: 0 }} />}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3 }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{g.product.category}</span>
                  <span style={{ fontSize: 10, color: "var(--fg-3)" }}>·</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)" }}>{g.videos.length} 条视频</span>
                </div>
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: active ? "var(--accent)" : "var(--fg-2)", background: active ? hexA("#7c5cff", "1f") : "var(--bg-2)", padding: "2px 7px", borderRadius: "var(--radius-pill)", flexShrink: 0 }}>
                {g.videos.length}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

// ── 视频库 ───────────────────────────────────────────────────────────────────
function VideoLibraryView({
  product, videos, onSelectVideo, onOpenScript, onRetry,
}: {
  product: MaterialProduct;
  videos: MaterialVideo[];
  onSelectVideo: (id: string) => void;
  onOpenScript: (scriptId: string) => void;
  onRetry?: () => void;
}) {
  const [viewMode, setViewMode] = React.useState<"flat" | "by-script">("flat");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "published" | "ready" | "rendering">("all");
  const [vidQuery, setVidQuery] = React.useState("");
  const [sort, setSort] = React.useState<"recent" | "plays" | "ctr">("recent");
  const [collapsed, setCollapsed] = React.useState<Record<string, boolean>>({});

  // 商品详情 · AI 提取卖点（issue 4：给一个主动触发入口）。仅运营角色可见；提取后落库 + 即时展示。
  const { user } = useAuth();
  const canExtract = !!user?.operatorRole;
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

  const filtered = React.useMemo(() => {
    return videos
      .filter(
        (v) =>
          statusFilter === "all" ||
          (statusFilter === "ready" && v.status === "ready" && !v.metrics) ||
          (statusFilter === "rendering" && v.status === "rendering") ||
          (statusFilter === "published" && !!v.metrics),
      )
      .filter((v) => !vidQuery || v.name.includes(vidQuery))
      .sort((a, b) => {
        if (sort === "recent") return new Date(b.generated_at || b.created_at || 0).getTime() - new Date(a.generated_at || a.created_at || 0).getTime();
        if (sort === "plays") return parsePlays(b.metrics?.plays) - parsePlays(a.metrics?.plays);
        if (sort === "ctr") return (b.metrics?.ctr_pct ?? 0) - (a.metrics?.ctr_pct ?? 0);
        return 0;
      });
  }, [videos, statusFilter, vidQuery, sort]);

  const scriptGroups = React.useMemo(() => {
    const m = new Map<string, MaterialVideo[]>();
    filtered.forEach((v) => {
      if (!m.has(v.script_id)) m.set(v.script_id, []);
      m.get(v.script_id)!.push(v);
    });
    return Array.from(m.entries()).map(([scriptId, vids]) => ({ scriptId, script: getScript(scriptId), videos: vids }));
  }, [filtered]);

  const totalPlays = videos.reduce((s, v) => s + parsePlays(v.metrics?.plays), 0);

  return (
    <>
      {/* hero */}
      <Card style={{ padding: 0, overflow: "hidden", background: `linear-gradient(110deg, ${hexA(product.accentColor ?? "#7c5cff", "1f")} 0%, transparent 40%), var(--bg-1)`, border: `1px solid ${hexA(product.accentColor ?? "#7c5cff", "44")}` }}>
        <div style={{ padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
          <ProductThumb name={product.name} image={product.images?.[0]} color={product.accentColor} size={48} />
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 16, color: "var(--fg-0)", fontWeight: 600 }}>{product.name}</span>
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
        {/* 卖点 + AI 提取入口（issue 4） */}
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

      {/* toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "10px 14px", borderRadius: "var(--radius-md)", background: "var(--bg-2)", border: "1px solid var(--line)" }}>
        <Seg value={viewMode} onChange={setViewMode} size="sm" options={[{ value: "flat", label: "全部视频" }, { value: "by-script", label: "按脚本分组" }]} />
        <span style={{ width: 1, height: 20, background: "var(--line-2)" }} />
        <Seg
          value={statusFilter}
          onChange={setStatusFilter}
          size="sm"
          options={[{ value: "all", label: `全部 ${videos.length}` }, { value: "published", label: "已发布" }, { value: "ready", label: "未发布" }, { value: "rendering", label: "渲染中" }]}
        />
        <div style={{ minWidth: 180, flex: 1, maxWidth: 280 }}>
          <SearchInput value={vidQuery} onChange={setVidQuery} placeholder="搜视频名…" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>排序</span>
          <Seg value={sort} onChange={setSort} size="sm" options={[{ value: "recent", label: "最新" }, { value: "plays", label: "播放" }, { value: "ctr", label: "CTR" }]} />
        </div>
      </div>

      {filtered.length === 0 && (
        <Card>
          <EmptyState icon={<PlayCircle size={26} />} title="没有匹配的视频" hint="换个筛选条件，或为该商品生成新的视频。" />
        </Card>
      )}

      {viewMode === "flat" && filtered.length > 0 && (
        <Card style={{ padding: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {filtered.map((v) => (
              <VideoCard key={v.id} video={v} showParent={!!v.parent_video_id} onClick={() => onSelectVideo(v.id)} onRetry={onRetry} />
            ))}
          </div>
        </Card>
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

function HeroStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: tone, fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: 10, color: "var(--fg-3)" }}>{label}</div>
    </div>
  );
}

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

function VideoCard({ video, onClick, onRetry, showParent }: { video: MaterialVideo; onClick: () => void; onRetry?: () => void; showParent?: boolean }) {
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
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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

      <div style={{ display: "grid", gridTemplateColumns: "300px minmax(0, 1fr)", gap: 16, alignItems: "flex-start" }}>
        {/* 视频帧 */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ aspectRatio: "9 / 16", background: `linear-gradient(135deg, ${hexA(video.cover_color, "99")}, ${hexA(video.cover_color, "33")})`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
            <PlayCircle size={56} color="#fff" style={{ position: "absolute", opacity: 0.85 }} />
            <span style={{ position: "absolute", bottom: 10, right: 10, fontFamily: "var(--font-mono)", fontSize: 10, color: "#fff", background: "rgba(0,0,0,0.45)", padding: "3px 8px", borderRadius: 4 }}>
              {video.duration_sec}s · {video.aspect_ratio}
            </span>
          </div>
          {video.metrics && (
            <div style={{ padding: 12, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6, background: "var(--bg-2)" }}>
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
            <div style={{ padding: "14px 22px", display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
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
              <div style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 24px", fontFamily: "var(--font-mono)", fontSize: 10, lineHeight: 1.7 }}>
                <SchemaLine k="id" v={video.id} />
                <SchemaLine k="script_id" v={video.script_id} />
                <SchemaLine k="product_id" v={product.id} />
                {video.parent_video_id && <SchemaLine k="parent_video_id" v={video.parent_video_id} />}
                <SchemaLine k="status" v={video.status} />
                <SchemaLine k="duration_sec" v={String(video.duration_sec)} />
                <SchemaLine k="aspect_ratio" v={video.aspect_ratio} />
                <SchemaLine k="model" v={video.model} />
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
