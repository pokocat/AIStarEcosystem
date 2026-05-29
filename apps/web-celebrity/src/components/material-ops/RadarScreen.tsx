"use client";

// 爆款雷达 —— 用户主动提交单条链接，解析视频后交给 AI 拆解。

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Copy, ExternalLink, Eye, Heart, Layers, Link2, Loader2, Play, ShieldCheck, Sparkles, Star } from "lucide-react";
import { MaterialOpsApi } from "@/api";
import { Card } from "@/components/creator";
import { Button } from "@/components/creator";
import { PLATFORM_RULES } from "@/constants/material-ops-ui";
import type { PlatformId, ViralHit } from "./types";
import { EmptyState, Eyebrow, FilterChip, MetricInline, PageHeader, Tag, fmtW, hexA } from "./shared";

const CATS = ["全部", "日用百货", "美妆", "服饰", "食品", "小家电", "保健", "其他"];

export function RadarScreen() {
  const router = useRouter();
  const [platform, setPlatform] = React.useState<PlatformId | "all">("all");
  const [cat, setCat] = React.useState("全部");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [hits, setHits] = React.useState<ViralHit[]>([]);
  const [urlInput, setUrlInput] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [analyzing, setAnalyzing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    setLoading(true);
    MaterialOpsApi.listViralHits()
      .then((items) => {
        if (!alive) return;
        const sorted = sortHits(items);
        setHits(sorted);
        setSelectedId((cur) => cur ?? sorted[0]?.id ?? null);
      })
      .catch((err: unknown) => {
        if (alive) setError(errorMessage(err, "爆款分析结果加载失败"));
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const filteredHits = React.useMemo(
    () => hits.filter((h) => (platform === "all" || h.platform === platform) && (cat === "全部" || h.cat === cat)),
    [cat, hits, platform],
  );
  const selected = filteredHits.find((h) => h.id === selectedId) ?? filteredHits[0] ?? hits.find((h) => h.id === selectedId) ?? null;

  async function handleAnalyze(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const raw = urlInput.trim();
    if (!raw) {
      setError("请先填入要分析的视频链接");
      return;
    }
    setAnalyzing(true);
    setError(null);
    try {
      const next = await MaterialOpsApi.analyzeViralUrl({
        url: raw,
        platform: platform === "all" ? undefined : platform,
      });
      setHits((cur) => sortHits([next, ...cur.filter((h) => h.id !== next.id)]));
      setSelectedId(next.id);
      setCat("全部");
      setUrlInput("");
    } catch (err) {
      setError(errorMessage(err, "链接解析或 AI 分析失败"));
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1280 }}>
      <PageHeader
        eyebrow="爆款雷达"
        title={
          <>
            链接解析 ·{" "}
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--extra-teal)" }}>{filteredHits.length}</span>
            <span style={{ color: "var(--fg-2)", fontWeight: 400, fontSize: 15, marginLeft: 6 }}>条视频样本</span>
          </>
        }
        sub="仅分析主动提交的单条链接，避免平台批量抓取带来的风控风险。"
        right={
          <Tag color="#22b59a">
            <ShieldCheck size={12} /> 手动提交
          </Tag>
        }
      />

      <Card style={{ padding: 16 }}>
        <form onSubmit={handleAnalyze} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) auto", gap: 10, alignItems: "center" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              minWidth: 0,
              border: "1px solid var(--line-2)",
              borderRadius: "var(--radius-md)",
              background: "var(--bg-1)",
              padding: "0 12px",
              height: 42,
            }}
          >
            <Link2 size={16} color="var(--fg-3)" style={{ flexShrink: 0 }} />
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="粘贴抖音 / 小红书 / 视频号链接，或 mp4 直链"
              disabled={analyzing}
              style={{
                width: "100%",
                minWidth: 0,
                border: 0,
                outline: 0,
                background: "transparent",
                color: "var(--fg-0)",
                fontSize: 14,
                fontFamily: "var(--font-sans)",
              }}
            />
          </label>
          <Button type="submit" variant="accent" size="lg" disabled={analyzing} style={{ opacity: analyzing ? 0.72 : 1 }}>
            {analyzing ? <Loader2 size={14} style={{ animation: "spin 900ms linear infinite" }} /> : <Sparkles size={14} />}
            {analyzing ? "分析中" : "解析并 AI 分析"}
          </Button>
        </form>
        {error && (
          <div
            style={{
              marginTop: 10,
              padding: "9px 11px",
              borderRadius: "var(--radius-md)",
              border: `1px solid ${hexA("#ff5b8a", "55")}`,
              background: hexA("#ff5b8a", "12"),
              color: "var(--danger)",
              fontSize: 12,
              lineHeight: 1.6,
            }}
          >
            {error}
          </div>
        )}
      </Card>

      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Eyebrow style={{ marginRight: 2 }}>平台提示</Eyebrow>
        <FilterChip active={platform === "all"} onClick={() => setPlatform("all")}>
          自动识别
        </FilterChip>
        {(Object.keys(PLATFORM_RULES) as PlatformId[]).map((id) => (
          <FilterChip key={id} active={platform === id} onClick={() => setPlatform(id)} color={PLATFORM_RULES[id].color}>
            {PLATFORM_RULES[id].name}
          </FilterChip>
        ))}
        <span style={{ width: 1, height: 16, background: "var(--line-2)", margin: "0 4px" }} />
        <Eyebrow style={{ marginRight: 2 }}>类目</Eyebrow>
        {CATS.map((c) => (
          <FilterChip key={c} active={cat === c} onClick={() => setCat(c)}>
            {c}
          </FilterChip>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))", gap: 14, alignItems: "flex-start" }}>
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div
            style={{
              padding: "11px 14px",
              borderBottom: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--bg-2)",
            }}
          >
            <Eyebrow>分析结果 · 按爆款分排序</Eyebrow>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)" }}>{filteredHits.length} 条</span>
          </div>
          {loading ? (
            <EmptyState compact icon={<Loader2 size={18} color="var(--accent)" />} title="正在加载分析结果" />
          ) : filteredHits.length === 0 ? (
            <EmptyState compact icon={<Link2 size={18} color="var(--accent)" />} title="暂无匹配的视频样本" hint="提交一个链接后会出现在这里。" />
          ) : (
            filteredHits.map((h) => <RadarListItem key={h.id} hit={h} active={selected?.id === h.id} onSelect={() => setSelectedId(h.id)} />)
          )}
        </Card>

        <Card style={{ padding: 0, overflow: "hidden", position: "sticky", top: 8 }}>
          {selected ? (
            <RadarDetail hit={selected} onClone={() => router.push("/material/workshop")} />
          ) : (
            <EmptyState compact icon={<Play size={18} color="var(--accent)" />} title="选择一个视频查看拆解" />
          )}
        </Card>
      </div>
    </div>
  );
}

function RadarListItem({ hit, active, onSelect }: { hit: ViralHit; active: boolean; onSelect: () => void }) {
  const p = PLATFORM_RULES[hit.platform];
  return (
    <button
      onClick={onSelect}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "12px 14px",
        borderBottom: "1px solid var(--line)",
        cursor: "pointer",
        background: active ? hexA("#7c5cff", "12") : "transparent",
        boxShadow: active ? "inset 0 0 0 1px var(--accent)" : "none",
        display: "flex",
        gap: 12,
        fontFamily: "var(--font-sans)",
      }}
    >
      <VideoPreview hit={hit} compact />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: "var(--fg-0)", lineHeight: 1.5, fontWeight: 500 }}>{hit.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" }}>
          <Tag color={p.color} style={{ fontSize: 9, padding: "1px 6px" }}>
            {p.name}
          </Tag>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)" }}>{hit.author}</span>
          <span style={{ fontSize: 10, color: "var(--fg-3)" }}>·</span>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)" }}>{hit.postedAt}</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
          <MetricInline label="" value={<><Eye size={11} style={{ verticalAlign: -2 }} /> {fmtW(hit.plays)}</>} tone="var(--accent)" />
          <MetricInline label="" value={<><Heart size={11} style={{ verticalAlign: -2 }} /> {fmtW(hit.likes)}</>} tone="var(--danger)" />
          <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--extra-teal)", fontWeight: 700 }}>
            {hit.score}
          </span>
        </div>
      </div>
    </button>
  );
}

function RadarDetail({ hit, onClone }: { hit: ViralHit; onClone: () => void }) {
  const p = PLATFORM_RULES[hit.platform];
  return (
    <div>
      <div
        style={{
          padding: "20px 22px",
          background: `linear-gradient(135deg, ${hexA(hit.cat_color, "1f")} 0%, transparent 60%)`,
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
          <VideoPreview hit={hit} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              <Tag color={p.color}>{p.name}</Tag>
              <Tag color="#f0a83a">{hit.cat}</Tag>
              <Tag color={hit.analysis_mode === "manual_link_ai" ? "#22b59a" : "#7a6f5d"}>
                {hit.analysis_mode === "manual_link_ai" ? "手动链接" : "种子样本"}
              </Tag>
              <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)" }}>
                {hit.author} · {hit.postedAt}
              </span>
            </div>
            <div style={{ fontSize: 17, color: "var(--fg-0)", fontWeight: 700, lineHeight: 1.4 }}>
              {hit.title}
            </div>
            {hit.source_url && (
              <a
                href={hit.source_url}
                target="_blank"
                rel="noreferrer"
                style={{
                  marginTop: 9,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  maxWidth: "100%",
                  color: "var(--fg-2)",
                  fontSize: 11,
                  textDecoration: "none",
                }}
              >
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{hit.source_url}</span>
                <ExternalLink size={11} style={{ flexShrink: 0 }} />
              </a>
            )}
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 8 }}>
              <BigStat label="播放" value={fmtW(hit.plays)} tone="var(--accent)" />
              <BigStat label="点赞" value={fmtW(hit.likes)} tone="var(--danger)" />
              <BigStat label="爆款分" value={String(hit.score)} tone="var(--extra-teal)" />
              <BigStat label="已复制" value={String(hit.reproduces)} tone="var(--extra-teal)" />
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "16px 22px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <Eyebrow>AI 分析 · 镜头结构</Eyebrow>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)" }}>总时长 {hit.duration}s</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {hit.structure.map((s, i) => (
            <div
              key={`${s.t}-${i}`}
              style={{
                padding: "10px 12px",
                display: "flex",
                alignItems: "flex-start",
                gap: 10,
                background: i % 2 ? "var(--bg-2)" : "transparent",
                borderRadius: 8,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--extra-teal)",
                  background: hexA("#22b59a", "1f"),
                  padding: "3px 8px",
                  borderRadius: 6,
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {s.t}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 12.5, color: "var(--fg-0)", fontWeight: 500 }}>{s.label}</span>
                  <Tag color="#7c5cff" style={{ fontSize: 9, padding: "1px 6px" }}>
                    {s.tag}
                  </Tag>
                </div>
                <div style={{ fontSize: 12, color: "var(--fg-1)", marginTop: 4, lineHeight: 1.6 }}>{s.text}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          <Eyebrow style={{ marginRight: 4 }}>命中标签</Eyebrow>
          {hit.tags.map((t) => (
            <span
              key={t}
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                color: "var(--accent)",
                background: hexA("#7c5cff", "14"),
                padding: "3px 8px",
                borderRadius: 6,
              }}
            >
              #{t}
            </span>
          ))}
        </div>
      </div>

      <div style={{ padding: "14px 22px", borderTop: "1px solid var(--line)", display: "flex", gap: 8, background: "var(--bg-2)" }}>
        <Button variant="accent" style={{ flex: 1 }} onClick={onClone}>
          <Copy size={13} /> 导入工坊 · 替换商品同款 <ArrowRight size={13} />
        </Button>
        <Button variant="secondary" size="md">
          <Layers size={13} /> 存为模板
        </Button>
        <Button variant="icon" size="md" title="收藏" style={{ width: 36, padding: 0 }}>
          <Star size={13} />
        </Button>
      </div>
    </div>
  );
}

function VideoPreview({ hit, compact }: { hit: ViralHit; compact?: boolean }) {
  const size = compact ? { width: 52, height: 70, radius: 8, icon: 16 } : { width: 96, height: 128, radius: 12, icon: 32 };
  const common: React.CSSProperties = {
    width: size.width,
    height: size.height,
    borderRadius: size.radius,
    flexShrink: 0,
    border: "1px solid var(--line)",
    background: `linear-gradient(160deg, ${hexA(hit.cat_color, "88")}, ${hexA(hit.cat_color, "33")})`,
  };
  if (hit.video_url) {
    return (
      <video
        src={hit.video_url}
        controls={!compact}
        muted
        playsInline
        preload="metadata"
        style={{
          ...common,
          objectFit: "cover",
          display: "block",
        }}
      />
    );
  }
  return (
    <div
      style={{
        ...common,
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Play size={size.icon} color="#fff" style={{ opacity: 0.75 }} />
    </div>
  );
}

function BigStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div style={{ padding: "8px 10px", borderRadius: "var(--radius-md)", background: "var(--bg-2)", border: "1px solid var(--line)" }}>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: 16, fontWeight: 700, color: tone, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </div>
      <div style={{ fontSize: 10, color: "var(--fg-2)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

function sortHits(items: ViralHit[]): ViralHit[] {
  return [...items].sort((a, b) => Number(b.score ?? 0) - Number(a.score ?? 0));
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}
