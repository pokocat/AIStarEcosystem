"use client";

// 起稿中心 —— 全屏选择器，3 tab：模板库 / 爆款雷达 / AI 生成。左筛选列表 + 右预览。

import * as React from "react";
import { X, LayoutTemplate, Flame, Wand2, Check, Shuffle, ScrollText, Link2 } from "lucide-react";
import { Button } from "@/components/creator";
import { SCRIPT_ASSETS, VIRAL_HITS } from "@/mocks/material-ops";
import { TIER_META, ASSET_KIND_META, PLATFORM_RULES } from "@/constants/material-ops-ui";
import type { AssetKind, MaterialProduct, PlatformId, ScriptAsset, ScriptBlock, Tier, ViralHit } from "./types";
import { Eyebrow, Tag, Seg, FilterChip, TierBadge, MetricTile, ShotTimeline, SearchInput, MetricInline, hexA, fmtW } from "./shared";

type HubTab = "template" | "viral" | "ai";

export function DraftingHub({
  openTab = "template",
  product,
  onClose,
  onApply,
  onApplyAndPreview,
}: {
  openTab?: HubTab;
  product: MaterialProduct;
  onClose: () => void;
  onApply: (blocks: ScriptBlock[]) => void;
  onApplyAndPreview: (blocks: ScriptBlock[]) => void;
}) {
  const [tab, setTab] = React.useState<HubTab>(openTab);

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "var(--bg-overlay)", zIndex: 80, backdropFilter: "blur(4px)" }} />
      <div
        role="dialog"
        aria-modal
        style={{
          position: "fixed",
          top: "4vh",
          left: "50%",
          transform: "translateX(-50%)",
          width: "min(1280px, 94vw)",
          height: "92vh",
          zIndex: 90,
          background: "var(--bg-1)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-xl)",
          boxShadow: "var(--shadow-pop)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "16px 22px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 14, background: `linear-gradient(135deg, ${hexA("#7c5cff", "12")}, transparent 50%)` }}>
          <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", flexShrink: 0, background: hexA("#7c5cff", "1f"), color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ScrollText size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <Eyebrow>起稿中心</Eyebrow>
            <div style={{ fontSize: 16, color: "var(--fg-0)", fontWeight: 600, marginTop: 2 }}>
              为 <span style={{ color: "var(--warning)" }}>{product.emoji} {product.name}</span> 选起稿方式
            </div>
          </div>
          <Tag color="var(--extra-teal)">语料库 · 1,284 条爆款基因</Tag>
          <Button variant="icon" size="sm" onClick={onClose} style={{ width: 32, padding: 0 }}>
            <X size={15} />
          </Button>
        </div>

        <div style={{ padding: "0 22px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 4, background: "var(--bg-1)" }}>
          <HubTabBtn id="template" tab={tab} onClick={setTab} icon={<LayoutTemplate size={14} />} label="模板库" count={SCRIPT_ASSETS.length} tone="#7c5cff" />
          <HubTabBtn id="viral" tab={tab} onClick={setTab} icon={<Flame size={14} />} label="爆款雷达" count={VIRAL_HITS.length} tone="#ff5b8a" />
          <HubTabBtn id="ai" tab={tab} onClick={setTab} icon={<Wand2 size={14} />} label="AI 生成" tone="#22b59a" />
        </div>

        <div style={{ flex: 1, overflow: "hidden", display: "flex", minHeight: 0 }}>
          {tab === "template" && <TemplatePicker product={product} onApply={onApply} onApplyAndPreview={onApplyAndPreview} />}
          {tab === "viral" && <ViralPicker product={product} onApply={onApply} onApplyAndPreview={onApplyAndPreview} />}
          {tab === "ai" && <AIPicker product={product} onApply={onApply} onApplyAndPreview={onApplyAndPreview} onClose={onClose} />}
        </div>
      </div>
    </>
  );
}

function HubTabBtn({ id, tab, onClick, icon, label, count, tone }: { id: HubTab; tab: HubTab; onClick: (t: HubTab) => void; icon: React.ReactNode; label: string; count?: number; tone: string }) {
  const active = tab === id;
  return (
    <button onClick={() => onClick(id)} style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 16px", background: "transparent", border: 0, color: active ? "var(--fg-0)" : "var(--fg-2)", cursor: "pointer", position: "relative", fontSize: 13, fontWeight: active ? 600 : 500 }}>
      <span style={{ color: active ? tone : "var(--fg-3)", display: "inline-flex" }}>{icon}</span>
      {label}
      {count != null && (
        <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, padding: "1px 6px", borderRadius: "var(--radius-pill)", background: active ? hexA(tone, "1f") : "var(--bg-2)", color: active ? tone : "var(--fg-3)" }}>{count}</span>
      )}
      {active && <span style={{ position: "absolute", left: 12, right: 12, bottom: -1, height: 2, background: tone, borderRadius: "2px 2px 0 0" }} />}
    </button>
  );
}

// ── 模板库 ───────────────────────────────────────────────────────────────────
function TemplatePicker({ product, onApply, onApplyAndPreview }: { product: MaterialProduct; onApply: (b: ScriptBlock[]) => void; onApplyAndPreview: (b: ScriptBlock[]) => void }) {
  const [kind, setKind] = React.useState<AssetKind | "all">("all");
  const [tier, setTier] = React.useState<Tier | "all">("all");
  const [sort, setSort] = React.useState<"perf" | "uses" | "diversity">("perf");
  const [query, setQuery] = React.useState("");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    return SCRIPT_ASSETS.filter((a) => kind === "all" || a.kind === kind)
      .filter((a) => tier === "all" || a.tier === tier)
      .filter((a) => !query || a.name.includes(query) || a.tags.some((t) => t.includes(query)))
      .sort((a, b) => {
        if (sort === "uses") return b.metrics.uses_count - a.metrics.uses_count;
        if (sort === "diversity") return b.metrics.diversity_pct - a.metrics.diversity_pct;
        return b.metrics.ctr_pct - a.metrics.ctr_pct;
      });
  }, [kind, tier, sort, query]);

  const selected = filtered.find((a) => a.id === selectedId) ?? filtered[0];

  return (
    <>
      <div style={{ width: 440, borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
          <SearchInput value={query} onChange={setQuery} placeholder="搜索模板名 · 标签 · 钩子类型…" />
        </div>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 10 }}>
          <FilterLine label="来源">
            <FilterChip active={kind === "all"} onClick={() => setKind("all")}>全部</FilterChip>
            {(["my_script", "template", "viral_clone"] as AssetKind[]).map((k) => (
              <FilterChip key={k} active={kind === k} onClick={() => setKind(k)} color={ASSET_KIND_META[k].toneVar}>
                {ASSET_KIND_META[k].label}
              </FilterChip>
            ))}
          </FilterLine>
          <FilterLine label="分级">
            <FilterChip active={tier === "all"} onClick={() => setTier("all")}>全部</FilterChip>
            {(["S", "A", "B"] as Tier[]).map((t) => (
              <FilterChip key={t} active={tier === t} onClick={() => setTier(t)} color={TIER_META[t].toneVar}>
                <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{t}</span> {TIER_META[t].label}
              </FilterChip>
            ))}
          </FilterLine>
        </div>
        <div style={{ padding: "8px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-2)" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{filtered.length} 条命中</span>
          <Seg value={sort} onChange={setSort} size="sm" options={[{ value: "perf", label: "CTR" }, { value: "uses", label: "复用" }, { value: "diversity", label: "差异" }]} />
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {filtered.map((a) => (
            <AssetRow key={a.id} asset={a} active={selected?.id === a.id} onClick={() => setSelectedId(a.id)} />
          ))}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {selected ? <AssetPreview asset={selected} product={product} onApply={onApply} onApplyAndPreview={onApplyAndPreview} /> : <EmptyPreview />}
      </div>
    </>
  );
}

function FilterLine({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, letterSpacing: "0.14em", color: "var(--fg-3)", textTransform: "uppercase", width: 32, flexShrink: 0 }}>{label}</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, flex: 1 }}>{children}</div>
    </div>
  );
}

function AssetRow({ asset, active, onClick }: { asset: ScriptAsset; active: boolean; onClick: () => void }) {
  const kindMeta = ASSET_KIND_META[asset.kind];
  return (
    <button onClick={onClick} style={{ width: "100%", textAlign: "left", padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid var(--line)", boxShadow: active ? "inset 0 0 0 1px var(--accent)" : "none", background: active ? hexA("#7c5cff", "12") : "transparent", display: "flex", gap: 12, fontFamily: "var(--font-sans)" }}>
      <div style={{ width: 56, height: 72, borderRadius: "var(--radius-md)", flexShrink: 0, background: `linear-gradient(160deg, ${hexA(asset.cover_color, "88")}, ${hexA(asset.cover_color, "33")})`, border: "1px solid var(--line)", position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <ScrollText size={20} color="#fff" style={{ opacity: 0.7 }} />
        <span style={{ position: "absolute", top: 3, right: 3, width: 14, height: 14, borderRadius: 3, background: TIER_META[asset.tier].toneVar, color: "#fff", fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>
          {asset.tier}
        </span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <Tag color={kindMeta.toneVar} style={{ fontSize: 9, padding: "1px 5px" }}>{kindMeta.label}</Tag>
        <div style={{ fontSize: 13, color: "var(--fg-0)", fontWeight: 500, marginTop: 4, lineHeight: 1.4 }}>{asset.name}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{asset.source?.author ?? "系统"}</span>
          <span style={{ fontSize: 10, color: "var(--fg-3)" }}>·</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{asset.category}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 8 }}>
          <MetricInline label="CTR" value={`${asset.metrics.ctr_pct}%`} tone="var(--extra-teal)" />
          <MetricInline label="复用" value={asset.metrics.uses_count} tone="var(--accent)" />
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--fg-3)" }}>{asset.duration_sec}s · {asset.blocks.length} 镜</span>
        </div>
      </div>
    </button>
  );
}

function AssetPreview({ asset, product, onApply, onApplyAndPreview }: { asset: ScriptAsset; product: MaterialProduct; onApply: (b: ScriptBlock[]) => void; onApplyAndPreview: (b: ScriptBlock[]) => void }) {
  const kindMeta = ASSET_KIND_META[asset.kind];
  const blocks = asset.blocks;
  return (
    <>
      <div style={{ padding: "18px 24px", borderBottom: "1px solid var(--line)", background: `linear-gradient(135deg, ${hexA(asset.cover_color, "14")} 0%, transparent 50%)` }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
          <div style={{ width: 64, height: 84, borderRadius: "var(--radius-md)", flexShrink: 0, background: `linear-gradient(160deg, ${hexA(asset.cover_color, "88")}, ${hexA(asset.cover_color, "33")})`, border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <ScrollText size={24} color="#fff" style={{ opacity: 0.75 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
              <TierBadge tier={asset.tier} />
              <Tag color={kindMeta.toneVar}>{kindMeta.label}</Tag>
              <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>{asset.id}</span>
            </div>
            <div style={{ fontSize: 18, color: "var(--fg-0)", fontWeight: 700, letterSpacing: "-0.01em" }}>{asset.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6, fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--fg-2)", flexWrap: "wrap" }}>
              <span>{asset.source?.author}</span>
              <span>·</span>
              <span>{asset.category} · {asset.hook_type}</span>
              <span>·</span>
              <span>{asset.duration_sec}s · {asset.blocks.length} 镜</span>
              {asset.source?.cloned_from && (
                <>
                  <span>·</span>
                  <span style={{ color: "var(--accent)" }}>
                    <Link2 size={10} style={{ verticalAlign: -1, marginRight: 2 }} />克隆自 {asset.source.cloned_from}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "18px 24px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div>
          <Eyebrow style={{ marginBottom: 10 }}>实战表现</Eyebrow>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
            <MetricTile label="CTR" value={`${asset.metrics.ctr_pct}%`} tone="var(--extra-teal)" hint="点击通过率" />
            <MetricTile label="完播率" value={`${asset.metrics.completion_pct}%`} tone="var(--extra-teal)" hint="预估完播" />
            <MetricTile label="差异度" value={`${asset.metrics.diversity_pct}%`} tone="var(--accent)" hint="去重通过率" />
            <MetricTile label="复用" value={asset.metrics.uses_count} tone="var(--accent)" hint="历史使用" />
            <MetricTile label="最佳 GMV" value={asset.metrics.best_video?.gmv ?? "—"} tone="var(--warning)" hint={asset.metrics.best_video ? `${asset.metrics.best_video.plays} 播放` : ""} />
          </div>
        </div>

        <div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 10 }}>
            <Eyebrow>5 镜头结构</Eyebrow>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)" }}>总时长 {asset.duration_sec}s</span>
          </div>
          <ShotTimeline blocks={blocks} />
          <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6 }}>
            {blocks.map((b, i) => (
              <ShotRow key={i} block={b} idx={i} product={product} />
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
          <div>
            <Eyebrow style={{ marginBottom: 8 }}>受众</Eyebrow>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {asset.audience.map((a) => (
                <FilterChip key={a}>{a}</FilterChip>
              ))}
            </div>
          </div>
          <div>
            <Eyebrow style={{ marginBottom: 8 }}>标签</Eyebrow>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {asset.tags.map((t) => (
                <span key={t} style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--accent)", background: hexA("#7c5cff", "14"), padding: "3px 7px", borderRadius: "var(--radius-sm)" }}>#{t}</span>
              ))}
            </div>
          </div>
        </div>

        {process.env.NODE_ENV !== "production" && (
          <div style={{ padding: "12px 14px", borderRadius: "var(--radius-md)", background: "var(--bg-2)", border: "1px dashed var(--line-2)" }}>
            <Eyebrow style={{ marginBottom: 8 }}>脚本卡片 · 存了什么（dev）</Eyebrow>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "6px 18px", fontFamily: "var(--font-mono)", fontSize: 10, lineHeight: 1.6 }}>
              <SchemaField k="id" v={asset.id} />
              <SchemaField k="kind" v={asset.kind} />
              <SchemaField k="tier" v={asset.tier} />
              <SchemaField k="category" v={asset.category} />
              <SchemaField k="hook_type" v={asset.hook_type} />
              <SchemaField k="duration_sec" v={String(asset.duration_sec)} />
              <SchemaField k="platforms" v={asset.platforms.join(",")} />
              <SchemaField k="source.type" v={asset.source.type} />
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: "14px 24px", borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-2)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Check size={12} color="var(--extra-teal)" />
          <span style={{ fontSize: 11, color: "var(--fg-1)" }}>
            将自动替换为当前商品 <strong style={{ color: "var(--fg-0)" }}>{product.name}</strong>
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" onClick={() => onApply(toBlocks(asset, product))}>
            <Check size={13} /> 应用整套
          </Button>
          <Button variant="accent" onClick={() => onApplyAndPreview(toBlocks(asset, product))}>
            <Shuffle size={13} /> 应用并预览
          </Button>
        </div>
      </div>
    </>
  );
}

function ShotRow({ block, idx, product }: { block: ScriptBlock; idx: number; product: MaterialProduct }) {
  const tone = SHOT_TONE(block.kind);
  const text = block.kind === "product" ? block.text.replace(/精华瓶|按摩仪|产品袋|打底/g, product.name) : block.text;
  return (
    <div style={{ padding: "8px 10px", borderRadius: "var(--radius-md)", background: "var(--bg-2)", border: "1px solid var(--line)", display: "flex", alignItems: "flex-start", gap: 10 }}>
      <span style={{ width: 22, height: 22, borderRadius: "var(--radius-sm)", flexShrink: 0, background: hexA(tone, "1f"), color: tone, fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        {idx + 1}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span style={{ fontSize: 12.5, color: "var(--fg-0)", fontWeight: 500 }}>{block.label}</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)" }}>{block.dur}s</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--fg-1)", lineHeight: 1.55, marginTop: 3 }}>{text}</div>
        {block.shot && <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", marginTop: 3 }}>⟨{block.shot}⟩</div>}
      </div>
    </div>
  );
}

function SchemaField({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", gap: 6, minWidth: 0 }}>
      <span style={{ color: "var(--fg-3)", flexShrink: 0 }}>{k}:</span>
      <span style={{ color: "var(--fg-0)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{v}</span>
    </div>
  );
}

function SHOT_TONE(kind: ScriptBlock["kind"]): string {
  return { hook: "#ff5b8a", scene: "#f0a83a", emotion: "#22b59a", product: "#7c5cff", effect: "#ff8a5b", cta: "#5b3fe0" }[kind];
}

function toBlocks(asset: ScriptAsset, product: MaterialProduct): ScriptBlock[] {
  return asset.blocks.map((b) => ({
    ...b,
    text: b.kind === "product" ? b.text.replace(/精华瓶|按摩仪|产品袋|打底/g, product.name) : b.text,
  }));
}

function EmptyPreview() {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--fg-2)", padding: 40 }}>
      <LayoutTemplate size={36} color="var(--fg-3)" />
      <span style={{ fontSize: 13 }}>左侧选一个模板查看详情</span>
    </div>
  );
}

// ── 爆款雷达 tab ──────────────────────────────────────────────────────────────
function ViralPicker({ product, onApply, onApplyAndPreview }: { product: MaterialProduct; onApply: (b: ScriptBlock[]) => void; onApplyAndPreview: (b: ScriptBlock[]) => void }) {
  const [platform, setPlatform] = React.useState<PlatformId | "all">("all");
  const [selectedId, setSelectedId] = React.useState(VIRAL_HITS[2].id);
  const list = VIRAL_HITS.filter((h) => platform === "all" || h.platform === platform);
  const selected = list.find((h) => h.id === selectedId) ?? list[0];
  const asset = selected ? viralToAsset(selected) : null;

  return (
    <>
      <div style={{ width: 440, borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <FilterChip active={platform === "all"} onClick={() => setPlatform("all")}>全部 · {VIRAL_HITS.length}</FilterChip>
          {(Object.keys(PLATFORM_RULES) as PlatformId[]).map((id) => (
            <FilterChip key={id} active={platform === id} onClick={() => setPlatform(id)} color={PLATFORM_RULES[id].color}>
              {PLATFORM_RULES[id].name}
            </FilterChip>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {list.map((h) => {
            const active = selected?.id === h.id;
            return (
              <button key={h.id} onClick={() => setSelectedId(h.id)} style={{ width: "100%", textAlign: "left", padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid var(--line)", boxShadow: active ? "inset 0 0 0 1px var(--accent)" : "none", background: active ? hexA("#7c5cff", "12") : "transparent", display: "flex", gap: 12, fontFamily: "var(--font-sans)" }}>
                <div style={{ width: 56, height: 72, borderRadius: "var(--radius-md)", flexShrink: 0, background: `linear-gradient(160deg, ${hexA(h.cat_color, "88")}, ${hexA(h.cat_color, "33")})`, border: "1px solid var(--line)" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: "var(--fg-0)", lineHeight: 1.4, fontWeight: 500 }}>{h.title}</div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)", marginTop: 4 }}>{h.author} · {h.postedAt}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 7 }}>
                    <MetricInline label="播放" value={fmtW(h.plays)} tone="var(--accent)" />
                    <MetricInline label="点赞" value={fmtW(h.likes)} tone="var(--danger)" />
                    <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--extra-teal)", fontWeight: 700 }}>{h.score}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {asset ? <AssetPreview asset={asset} product={product} onApply={onApply} onApplyAndPreview={onApplyAndPreview} /> : <EmptyPreview />}
      </div>
    </>
  );
}

function viralToAsset(v: ViralHit): ScriptAsset {
  const kindMap: Record<string, ScriptBlock["kind"]> = {
    冲突钩子: "hook", 问题钩子: "hook", 人物钩子: "hook", 身材钩子: "hook", 主播喊麦: "hook",
    人物展示: "scene", 场景搭建: "scene", 场景铺垫: "scene", 紧迫氛围: "scene",
    故事铺垫: "emotion", 痛点: "emotion",
    产品引入: "product", 产品融入: "product", 产品揭示: "product", 产品上身: "product",
    效果展示: "effect", 使用展示: "effect", 使用过程: "effect", 现场体验: "effect",
    行动召唤: "cta", CTA: "cta", "价格 + CTA": "cta",
  };
  return {
    id: `asset-from-${v.id}`,
    kind: "viral_clone",
    name: `[同款] ${v.title}`,
    tier: v.score > 90 ? "S" : v.score > 80 ? "A" : "B",
    category: v.cat,
    hook_type: "情感",
    audience: ["通用"],
    platforms: [v.platform],
    duration_sec: v.duration,
    blocks: v.structure.map((s) => {
      const m = s.t.match(/(\d+)-(\d+)/);
      const dur = m ? parseInt(m[2]) - parseInt(m[1]) : 5;
      return { kind: kindMap[s.label] ?? "scene", label: s.label, dur, text: s.text, shot: s.tag };
    }),
    metrics: {
      uses_count: v.reproduces,
      ctr_pct: v.score / 10,
      diversity_pct: 50,
      completion_pct: 70,
      best_video: { script_id: v.id, plays: fmtW(v.plays), likes: fmtW(v.likes), gmv: "—" },
      last_used_at: "—",
    },
    source: { type: "viral", ref_id: v.id, original_url: "https://...", cloned_from: null, author: v.author },
    tags: v.tags,
    cover_color: v.cat_color,
  };
}

// ── AI 生成 tab ───────────────────────────────────────────────────────────────
function AIPicker({ product, onApply, onApplyAndPreview, onClose }: { product: MaterialProduct; onApply: (b: ScriptBlock[]) => void; onApplyAndPreview: (b: ScriptBlock[]) => void; onClose: () => void }) {
  const [stage, setStage] = React.useState<"config" | "results">("config");
  const [tone, setTone] = React.useState(product.suggestedAngles?.[0] ?? "情感故事");
  const [audience, setAudience] = React.useState(product.audience?.[0] ?? "女性 25-35");
  const [count, setCount] = React.useState(3);
  const [running, setRunning] = React.useState(false);
  const [candidates, setCandidates] = React.useState<ScriptAsset[]>([]);
  const [previewId, setPreviewId] = React.useState<string | null>(null);

  const run = () => {
    setRunning(true);
    setTimeout(() => {
      const next = aiCandidates(product, count);
      setCandidates(next);
      setPreviewId(next[0]?.id ?? null);
      setRunning(false);
      setStage("results");
    }, 600);
  };
  const preview = candidates.find((c) => c.id === previewId);

  if (stage === "config") {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
        <div style={{ width: 680 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
            <div style={{ width: 44, height: 44, borderRadius: "var(--radius-md)", background: hexA("#22b59a", "1f"), color: "var(--extra-teal)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Wand2 size={22} />
            </div>
            <div>
              <div style={{ fontSize: 16, color: "var(--fg-0)", fontWeight: 600 }}>AI 生成脚本</div>
              <div style={{ fontSize: 12, color: "var(--fg-2)", marginTop: 2 }}>配置参数 · 智能体起 N 稿候选 · 点击预览 / 应用</div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <Eyebrow style={{ marginBottom: 8 }}>叙事风格</Eyebrow>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {["情感故事", "产品测评", "场景剧情", "反差对比", "专业解析", "直播切片", "蓝领情感", "父女视角"].map((t) => (
                  <FilterChip key={t} active={tone === t} onClick={() => setTone(t)} color="var(--extra-teal)">{t}</FilterChip>
                ))}
              </div>
            </div>
            <div>
              <Eyebrow style={{ marginBottom: 8 }}>目标受众</Eyebrow>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(product.audience ?? []).concat(["宝妈群体", "银发族", "微胖姐妹", "打工人"]).slice(0, 7).map((a) => (
                  <FilterChip key={a} active={audience === a} onClick={() => setAudience(a)}>{a}</FilterChip>
                ))}
              </div>
            </div>
            <div>
              <Eyebrow style={{ marginBottom: 8 }}>起稿数量 · {count} 稿</Eyebrow>
              <Seg value={count} onChange={setCount} options={[2, 3, 4, 5].map((n) => ({ value: n, label: `${n} 稿` }))} />
            </div>
          </div>
          <div style={{ marginTop: 24, display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button variant="ghost" onClick={onClose}>取消</Button>
            <Button variant="accent" onClick={run} disabled={running}>
              <Wand2 size={13} /> {running ? "生成中…" : `起 ${count} 稿`}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{ width: 380, borderRight: "1px solid var(--line)", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-2)" }}>
          <Eyebrow>已生成 {candidates.length} 稿候选</Eyebrow>
          <button onClick={() => setStage("config")} style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)", background: "transparent", border: 0, cursor: "pointer" }}>重新生成</button>
        </div>
        <div style={{ flex: 1, overflowY: "auto" }}>
          {candidates.map((c, i) => {
            const isP = previewId === c.id;
            return (
              <button key={c.id} onClick={() => setPreviewId(c.id)} style={{ width: "100%", textAlign: "left", padding: "12px 16px", cursor: "pointer", borderBottom: "1px solid var(--line)", boxShadow: isP ? "inset 0 0 0 1px var(--accent)" : "none", background: isP ? hexA("#7c5cff", "12") : "transparent", fontFamily: "var(--font-sans)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ width: 22, height: 22, borderRadius: "var(--radius-sm)", background: hexA("#22b59a", "1f"), color: "var(--extra-teal)", fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                  <span style={{ fontSize: 12.5, color: "var(--fg-0)", fontWeight: 500 }}>{c.name}</span>
                  <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--extra-teal)", fontWeight: 700 }}>CTR ~{c.metrics.ctr_pct}%</span>
                </div>
                <div style={{ padding: "6px 8px", borderRadius: "var(--radius-sm)", background: hexA("#ff5b8a", "0d"), border: `1px dashed ${hexA("#ff5b8a", "44")}` }}>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--danger)", letterSpacing: "0.12em", marginBottom: 2 }}>钩子</div>
                  <div style={{ fontSize: 11.5, color: "var(--fg-0)", lineHeight: 1.5 }}>{c.blocks[0]?.text}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", minHeight: 0 }}>
        {preview && <AssetPreview asset={preview} product={product} onApply={onApply} onApplyAndPreview={onApplyAndPreview} />}
      </div>
    </>
  );
}

function aiCandidates(product: MaterialProduct, count: number): ScriptAsset[] {
  const pn = product.name;
  const POOL: { name: string; tier: Tier; tags: string[]; ctr: number; diversity: number; blocks: ScriptBlock[] }[] = [
    {
      name: "蓝领情感 · 修车老李 · v3", tier: "A", tags: ["情感", "蓝领", "送礼"], ctr: 8.7, diversity: 78,
      blocks: [
        { kind: "hook", label: "黄金 3s 钩子", dur: 3, text: `修了 30 年车，第一次给老婆买${pn}`, shot: "油污大手特写" },
        { kind: "emotion", label: "情感铺垫", dur: 9, text: "收摊回家 · 老婆在沙发上揉脖子", shot: "跟拍" },
        { kind: "product", label: "产品揭示", dur: 13, text: `从口袋拿出${pn} · 老婆惊讶反应`, shot: "怼镜 30 帧" },
        { kind: "effect", label: "效果体验", dur: 10, text: '老婆边吃饭边按 · "舒服死了"', shot: "双人对坐" },
        { kind: "cta", label: "行动召唤", dur: 6, text: '"姐妹有需要的评论区扣 1"', shot: "CTA 字幕" },
      ],
    },
    {
      name: "父女视角 · 闺女偷拍", tier: "A", tags: ["父女", "反差", "送礼"], ctr: 9.1, diversity: 82,
      blocks: [
        { kind: "hook", label: "黄金 3s 钩子", dur: 3, text: "我爸 50 岁，第一次悄悄给我妈下单了这个", shot: "手机屏幕特写" },
        { kind: "emotion", label: "情感铺垫", dur: 8, text: "闺女躲门后偷拍 · 爸爸的手指划过价格", shot: "门缝偷拍" },
        { kind: "product", label: "产品揭示", dur: 11, text: `快递到家 · 妈妈拆出${pn}愣住`, shot: "拆箱反应" },
        { kind: "effect", label: "效果体验", dur: 10, text: '妈妈戴上 · 爸爸偷笑 · 字幕"破防了"', shot: "三人同框" },
        { kind: "cta", label: "行动召唤", dur: 8, text: '"链接放评论 · 一定要给爸看一眼"', shot: "CTA" },
      ],
    },
    {
      name: "反差对比 · 价格压制", tier: "B", tags: ["价格", "反差", "测评"], ctr: 7.4, diversity: 68,
      blocks: [
        { kind: "hook", label: "黄金 3s 钩子", dur: 3, text: `别再花 800 块买同类了，${pn}才是真的`, shot: "价格对比字幕" },
        { kind: "scene", label: "场景对比", dur: 10, text: "同台展示三款不同价位 · 用户测评剪辑", shot: "三机位平铺" },
        { kind: "product", label: "产品揭示", dur: 14, text: `怼镜${pn} · 字幕"229 vs 800"`, shot: "产品 360°" },
        { kind: "effect", label: "效果体验", dur: 8, text: '体验师"用完不想脱" · 表情管理失败', shot: "反应慢镜" },
        { kind: "cta", label: "行动召唤", dur: 5, text: '"今天直播间还有 50 单 · 错过等下周"', shot: "紧迫挂车" },
      ],
    },
    {
      name: "通勤打工人 · 自救", tier: "A", tags: ["通勤", "打工人"], ctr: 7.2, diversity: 75,
      blocks: [
        { kind: "hook", label: "黄金 3s 钩子", dur: 3, text: "加班到 11 点，我决定对自己好一点", shot: "电脑反光" },
        { kind: "scene", label: "场景铺垫", dur: 8, text: "地铁视角 · 同事都在揉肩膀", shot: "通勤 vlog" },
        { kind: "product", label: "产品揭示", dur: 10, text: `下单${pn} · 第二天通勤拿出来用`, shot: "产品特写" },
        { kind: "effect", label: "效果体验", dur: 6, text: '前 vs 后 30 天对比 · 字幕"8→3"', shot: "量化字幕" },
        { kind: "cta", label: "行动召唤", dur: 3, text: '"打工人姐妹评论区扣 1"', shot: "评论引导" },
      ],
    },
    {
      name: "专业解析 · 测评博主", tier: "B", tags: ["测评", "专业"], ctr: 6.1, diversity: 84,
      blocks: [
        { kind: "hook", label: "黄金 3s 钩子", dur: 4, text: `测了 12 款 · ${pn}是 229 价位天花板`, shot: "测评台特写" },
        { kind: "product", label: "产品解构", dur: 12, text: "拆解结构 · 标注电机/温控/电池参数", shot: "微距 + 拆解图" },
        { kind: "effect", label: "体感测评", dur: 10, text: "压力传感数据 · 真人 60 分钟使用日志", shot: "数据可视化" },
        { kind: "scene", label: "横向对比", dur: 6, text: "5 款竞品对比表格 · 价格 vs 体感打分", shot: "对比表格" },
        { kind: "cta", label: "行动召唤", dur: 3, text: '"理性党姐妹直接抄作业 · 链接置顶"', shot: "CTA + 徽章" },
      ],
    },
  ];
  const palette = ["#22b59a", "#f0a83a", "#ff5b8a", "#7c5cff", "#5b3fe0"];
  return POOL.slice(0, count).map((p, i) => ({
    id: `ai-${i + 1}`,
    kind: "ai_seed",
    name: p.name,
    tier: p.tier,
    category: product.category,
    hook_type: "情感",
    audience: product.audience ?? ["通用"],
    platforms: ["douyin", "xhs"],
    duration_sec: p.blocks.reduce((s, b) => s + b.dur, 0),
    blocks: p.blocks,
    metrics: { uses_count: 0, ctr_pct: p.ctr, diversity_pct: p.diversity, completion_pct: 65 + i * 2, best_video: null, last_used_at: "—" },
    source: { type: "ai", ref_id: "agent-v3", original_url: null, cloned_from: null, author: "智能体生成" },
    tags: p.tags,
    cover_color: palette[i % palette.length],
  }));
}
