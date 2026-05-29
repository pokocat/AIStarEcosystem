"use client";

// 脚本工坊入口 —— 脚本库列表（全部/我的脚本/官方模板/爆款同款）+ 新建（强制选商品）。

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, ChevronRight, ScrollText, LayoutTemplate, Flame, Wand2, Video, Loader2 } from "lucide-react";
import { Card, Button } from "@/components/creator";
import { useAuth } from "@ai-star-eco/api-client";
import { MaterialOpsApi, ProductsApi } from "@/api";
import { SCRIPT_ASSETS, getProduct, toMaterialProduct } from "@/mocks/material-ops";
import { TIER_META, ASSET_KIND_META } from "@/constants/material-ops-ui";
import type { AssetKind, MaterialProduct, ScriptAsset, Tier } from "./types";
import { ProductPickerDialog } from "./ProductPickerDialog";
import { Eyebrow, Tag, Seg, FilterChip, PageHeader, SearchInput, TierBadge, CoverTile, EmptyState, ProductThumb, formatLastUsed, hexA } from "./shared";

const KIND_ICON: Record<AssetKind, React.ComponentType<{ size?: number; color?: string }>> = {
  my_script: ScrollText,
  template: LayoutTemplate,
  viral_clone: Flame,
  ai_seed: Wand2,
};

const COLS = "40px 1.6fr 1.1fr 0.9fr 0.6fr 0.6fr 0.8fr 24px";

export function ScriptLibrary({ composeProductId }: { composeProductId?: string } = {}) {
  const router = useRouter();
  const [scripts, setScripts] = React.useState<ScriptAsset[]>(SCRIPT_ASSETS);
  const [tab, setTab] = React.useState<AssetKind | "all">("all");
  const [cat, setCat] = React.useState("all");
  const [tier, setTier] = React.useState<Tier | "all">("all");
  const [query, setQuery] = React.useState("");
  const [sort, setSort] = React.useState<"recent" | "perf" | "uses">("recent");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const { user } = useAuth();
  const owner = React.useMemo(
    () => ({ id: user?.id, name: user?.displayName ?? user?.username }),
    [user?.id, user?.displayName, user?.username],
  );

  // 全部系统商品 → id 映射，供「关联商品」列展示（覆盖商品库里任意商品，不止素材运营 6 个）。
  const [productById, setProductById] = React.useState<Map<string, MaterialProduct>>(new Map());
  React.useEffect(() => {
    ProductsApi.listProducts().then((list) => {
      setProductById(new Map(list.map((p) => [p.id, toMaterialProduct(p)])));
    });
  }, []);

  React.useEffect(() => {
    MaterialOpsApi.listScripts().then(setScripts);
  }, []);

  // 商品库「脚本生成」深链：?compose=<productId> → 自动锚定该商品建草稿，跳进编辑。
  // composing 用 state 驱动过渡态（ref 防 StrictMode 双跑）；商品找不到则退回普通脚本库。
  const [composing, setComposing] = React.useState<boolean>(!!composeProductId);
  const composedRef = React.useRef(false);
  React.useEffect(() => {
    if (!composeProductId || composedRef.current) return;
    composedRef.current = true;
    (async () => {
      let mp: MaterialProduct | undefined = getProduct(composeProductId);
      if (!mp) {
        const p = await ProductsApi.getProduct(composeProductId);
        if (p) mp = toMaterialProduct(p);
      }
      if (!mp) {
        setComposing(false); // 商品没找到，退回普通脚本库
        return;
      }
      const draft = blankDraft(mp, owner);
      await MaterialOpsApi.saveScript(draft);
      router.replace(`/material/workshop/${draft.id}/edit`);
    })();
  }, [composeProductId, router, owner]);

  if (composing) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: 80, color: "var(--fg-2)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
        <Loader2 size={16} className="animate-spin" /> 正在为该商品创建脚本…
      </div>
    );
  }

  const filtered = React.useMemo(() => {
    return scripts
      .filter((a) => tab === "all" || a.kind === tab)
      .filter((a) => cat === "all" || a.category === cat)
      .filter((a) => tier === "all" || a.tier === tier)
      .filter((a) => !query || a.name.includes(query) || a.tags.some((t) => t.includes(query)))
      .sort((a, b) => {
        if (sort === "perf") return b.metrics.ctr_pct - a.metrics.ctr_pct;
        if (sort === "uses") return b.metrics.uses_count - a.metrics.uses_count;
        return new Date(b.metrics.last_used_at).getTime() - new Date(a.metrics.last_used_at).getTime();
      });
  }, [scripts, tab, cat, tier, query, sort]);

  const cats = ["all", ...Array.from(new Set(scripts.map((a) => a.category)))];
  const counts = {
    all: scripts.length,
    my_script: scripts.filter((a) => a.kind === "my_script").length,
    template: scripts.filter((a) => a.kind === "template").length,
    viral_clone: scripts.filter((a) => a.kind === "viral_clone").length,
  };

  const onNewProductPicked = async (product: MaterialProduct) => {
    const draft = blankDraft(product, owner);
    await MaterialOpsApi.saveScript(draft);
    setPickerOpen(false);
    router.push(`/material/workshop/${draft.id}/edit`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1280 }}>
      <PageHeader
        eyebrow="脚本库"
        title={
          <>
            脚本工坊 ·{" "}
            <span style={{ color: "var(--fg-2)", fontWeight: 400, fontSize: 15 }}>
              {counts.all} 条脚本 · {counts.my_script} 条来自团队
            </span>
          </>
        }
        right={
          <Button variant="accent" size="md" onClick={() => setPickerOpen(true)}>
            <Plus size={13} /> 新建脚本
          </Button>
        }
      />

      {/* tabs + search */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Seg
          value={tab}
          onChange={setTab}
          options={[
            { value: "all", label: `全部 ${counts.all}` },
            { value: "my_script", label: `我的脚本 ${counts.my_script}` },
            { value: "template", label: `官方模板 ${counts.template}` },
            { value: "viral_clone", label: `爆款同款 ${counts.viral_clone}` },
          ]}
        />
        <div style={{ marginLeft: "auto", width: 260 }}>
          <SearchInput value={query} onChange={setQuery} placeholder="搜索脚本名 · 标签 · 商品…" />
        </div>
      </div>

      {/* filters */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Eyebrow style={{ marginRight: 2 }}>类目</Eyebrow>
        {cats.slice(0, 6).map((c) => (
          <FilterChip key={c} active={cat === c} onClick={() => setCat(c)}>
            {c === "all" ? "全部" : c}
          </FilterChip>
        ))}
        <span style={{ width: 1, height: 16, background: "var(--line-2)" }} />
        <Eyebrow style={{ marginRight: 2 }}>分级</Eyebrow>
        <FilterChip active={tier === "all"} onClick={() => setTier("all")}>
          全部
        </FilterChip>
        {(["S", "A", "B"] as Tier[]).map((t) => (
          <FilterChip key={t} active={tier === t} onClick={() => setTier(t)} color={TIER_META[t].toneVar}>
            <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{t}</span> {TIER_META[t].label}
          </FilterChip>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>排序</span>
          <Seg value={sort} onChange={setSort} size="sm" options={[{ value: "recent", label: "最近" }, { value: "perf", label: "CTR" }, { value: "uses", label: "复用" }]} />
        </div>
      </div>

      {/* table */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ padding: "10px 18px", display: "grid", gridTemplateColumns: COLS, gap: 14, fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.12em", color: "var(--fg-3)", textTransform: "uppercase", borderBottom: "1px solid var(--line)", background: "var(--bg-2)" }}>
          <span />
          <span>脚本名 / ID</span>
          <span>关联商品</span>
          <span>所属</span>
          <span>CTR</span>
          <span>复用</span>
          <span>最近使用</span>
          <span />
        </div>
        {filtered.length === 0 && (
          <EmptyState
            icon={<ScrollText size={26} />}
            title="没有匹配的脚本"
            hint="调整筛选条件，或新建一个脚本开始创作。"
            action={
              <Button variant="accent" size="sm" onClick={() => setPickerOpen(true)}>
                <Plus size={13} /> 新建脚本
              </Button>
            }
          />
        )}
        {filtered.map((a) => {
          const KindIcon = KIND_ICON[a.kind];
          const kindMeta = ASSET_KIND_META[a.kind];
          const product = (a.product_id ? productById.get(a.product_id) : undefined) ?? getProduct(a.product_id);
          return (
            <div
              key={a.id}
              role="button"
              tabIndex={0}
              className="mo-row"
              onClick={() => router.push(`/material/workshop/${a.id}`)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push(`/material/workshop/${a.id}`);
                }
              }}
              style={{ padding: "14px 18px", display: "grid", gridTemplateColumns: COLS, gap: 14, alignItems: "center", cursor: "pointer", borderBottom: "1px solid var(--line)", fontFamily: "var(--font-sans)" }}
            >
              <div style={{ position: "relative" }}>
                <CoverTile color={a.cover_color} icon={<KindIcon size={13} color="#fff" />} />
                <span style={{ position: "absolute", top: -3, right: -3, width: 13, height: 13, borderRadius: 3, background: TIER_META[a.tier].toneVar, color: "#fff", fontFamily: "var(--font-mono)", fontSize: 8, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {a.tier}
                </span>
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, color: "var(--fg-0)", fontWeight: 500 }}>{a.name}</span>
                  <Tag color={kindMeta.toneVar} style={{ fontSize: 9, padding: "1px 5px" }}>
                    {kindMeta.label}
                  </Tag>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4, fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>
                  <span>{a.id}</span>
                  <span>·</span>
                  <span>{a.hook_type} · {a.duration_sec}s · {a.blocks.length} 镜</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                <ProductThumb name={product?.name ?? "—"} image={product?.images?.[0]} color={product?.accentColor} size={22} radius={6} monoScale={0.5} />
                {product ? (
                  <>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/products/${product.id}`);
                      }}
                      title="查看商品详情"
                      style={{ fontSize: 12, color: "var(--accent)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", cursor: "pointer", textDecorationLine: "underline", textDecorationColor: "var(--line-2)", textUnderlineOffset: 2 }}
                    >
                      {product.name}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/material/assets?product=${product.id}`);
                      }}
                      title="查看该商品的视频素材"
                      style={{ flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 3, padding: "1px 7px", borderRadius: "var(--radius-pill)", fontSize: 9, fontFamily: "var(--font-mono)", color: "var(--accent)", background: hexA("#7c5cff", "14"), border: `1px solid ${hexA("#7c5cff", "33")}`, cursor: "pointer" }}
                    >
                      <Video size={9} /> 素材
                    </button>
                  </>
                ) : (
                  <span style={{ fontSize: 12, color: "var(--fg-2)" }}>—</span>
                )}
              </div>
              <span style={{ fontSize: 12, color: "var(--fg-1)" }}>{a.source?.author}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, fontWeight: 700, color: "var(--extra-teal)", fontVariantNumeric: "tabular-nums" }}>{a.metrics.ctr_pct}%</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--fg-1)", fontVariantNumeric: "tabular-nums" }}>{a.metrics.uses_count}</span>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)" }}>{formatLastUsed(a.metrics.last_used_at)}</span>
              <ChevronRight size={14} color="var(--fg-3)" />
            </div>
          );
        })}
      </Card>

      {pickerOpen && <ProductPickerDialog onClose={() => setPickerOpen(false)} onPick={onNewProductPicked} />}
    </div>
  );
}

function blankDraft(product: MaterialProduct, owner: { id?: string; name?: string }): ScriptAsset {
  const id = `asset-${Math.floor(Math.random() * 9000 + 1000)}-new`;
  const now = new Date().toISOString();
  return {
    id,
    kind: "my_script",
    name: `${product.name} · 新脚本`,
    title: `${product.name} · 新脚本`,
    tier: "D",
    category: product.category,
    hook_type: "情感",
    audience: product.audience ?? ["女性 25-35"],
    platforms: ["douyin", "xhs"],
    duration_sec: 0,
    product_id: product.id,
    cart: true,
    cover_color: product.accentColor ?? "#7c5cff",
    blocks: [
      { kind: "hook", label: "黄金 3s 钩子", dur: 3, text: "", shot: "" },
      { kind: "emotion", label: "情感铺垫", dur: 8, text: "", shot: "" },
      { kind: "product", label: "产品揭示", dur: 10, text: "", shot: "" },
      { kind: "effect", label: "效果体验", dur: 8, text: "", shot: "" },
      { kind: "cta", label: "行动召唤", dur: 5, text: "", shot: "" },
    ],
    metrics: { uses_count: 0, ctr_pct: 0, diversity_pct: 0, completion_pct: 0, best_video: null, last_used_at: now },
    source: { type: "user", ref_id: owner.id ?? null, author: owner.name ?? "我" },
    tags: [],
    created_by: owner.id ?? "self",
    workspace_id: "mcn-001",
  };
}
