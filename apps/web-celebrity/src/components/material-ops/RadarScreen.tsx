"use client";

// 爆款雷达 —— 候选列表 + 详情（5 镜头 AI 拆解）+ 导入工坊。换肤为 creator 风格。

import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, Heart, Copy, RefreshCw, Play, Star, Layers, ArrowRight } from "lucide-react";
import { Card } from "@/components/creator";
import { Button } from "@/components/creator";
import { PLATFORM_RULES } from "@/constants/material-ops-ui";
import { VIRAL_HITS } from "@/mocks/material-ops";
import type { PlatformId, ViralHit } from "./types";
import { Eyebrow, Tag, Seg, FilterChip, PageHeader, MetricInline, fmtW, hexA } from "./shared";

const WINDOWS = ["6h", "24h", "7d", "30d"];
const CATS = ["全部", "美妆", "服饰", "食品", "小家电", "保健"];

export function RadarScreen() {
  const router = useRouter();
  const [platform, setPlatform] = React.useState<PlatformId | "all">("all");
  const [cat, setCat] = React.useState("全部");
  const [wnd, setWnd] = React.useState("24h");
  const [selectedId, setSelectedId] = React.useState(VIRAL_HITS[2].id);

  const hits = VIRAL_HITS.filter((h) => platform === "all" || h.platform === platform);
  const selected = hits.find((h) => h.id === selectedId) ?? hits[0] ?? VIRAL_HITS[0];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 1280 }}>
      <PageHeader
        eyebrow="爆款雷达"
        title={
          <>
            实时抓取 ·{" "}
            <span style={{ fontFamily: "var(--font-mono)", color: "var(--extra-teal)" }}>{hits.length}</span>
            <span style={{ color: "var(--fg-2)", fontWeight: 400, fontSize: 15, marginLeft: 6 }}>条候选爆款</span>
          </>
        }
        right={
          <>
            <Seg value={wnd} onChange={setWnd} options={WINDOWS.map((w) => ({ value: w, label: w }))} size="sm" />
            <Button variant="secondary" size="sm">
              <RefreshCw size={13} /> 立即抓取
            </Button>
          </>
        }
      />

      {/* 筛选 */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Eyebrow style={{ marginRight: 2 }}>平台</Eyebrow>
        <FilterChip active={platform === "all"} onClick={() => setPlatform("all")}>
          全部
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

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 14, alignItems: "flex-start" }}>
        {/* 候选列表 */}
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
            <Eyebrow>候选列表 · 按爆款分排序</Eyebrow>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)" }}>{hits.length} 条</span>
          </div>
          {hits.map((h) => {
            const p = PLATFORM_RULES[h.platform];
            const active = selected.id === h.id;
            return (
              <button
                key={h.id}
                onClick={() => setSelectedId(h.id)}
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
                <div
                  style={{
                    width: 52,
                    height: 70,
                    borderRadius: 8,
                    flexShrink: 0,
                    background: `linear-gradient(160deg, ${hexA(h.cat_color, "88")}, ${hexA(h.cat_color, "33")})`,
                    position: "relative",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "1px solid var(--line)",
                  }}
                >
                  <Play size={16} color="#fff" style={{ opacity: 0.7 }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: "var(--fg-0)", lineHeight: 1.5, fontWeight: 500 }}>{h.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)" }}>{h.author}</span>
                    <span style={{ fontSize: 10, color: "var(--fg-3)" }}>·</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)" }}>{h.postedAt}</span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8 }}>
                    <MetricInline label="" value={<><Eye size={11} style={{ verticalAlign: -2 }} /> {fmtW(h.plays)}</>} tone="var(--accent)" />
                    <MetricInline label="" value={<><Heart size={11} style={{ verticalAlign: -2 }} /> {fmtW(h.likes)}</>} tone="var(--danger)" />
                    <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--extra-teal)", fontWeight: 700 }}>
                      {h.score}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </Card>

        {/* 详情 */}
        <Card style={{ padding: 0, overflow: "hidden", position: "sticky", top: 8 }}>
          <RadarDetail hit={selected} onClone={() => router.push("/material/workshop")} />
        </Card>
      </div>
    </div>
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
          <div
            style={{
              width: 96,
              height: 128,
              borderRadius: 12,
              flexShrink: 0,
              background: `linear-gradient(160deg, ${hexA(hit.cat_color, "88")}, ${hexA(hit.cat_color, "33")})`,
              border: "1px solid var(--line)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Play size={32} color="#fff" style={{ opacity: 0.75 }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
              <Tag color={p.color}>{p.name}</Tag>
              <Tag color="var(--warning)">{hit.cat}</Tag>
              <span style={{ marginLeft: "auto", fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)" }}>
                {hit.author} · {hit.postedAt}
              </span>
            </div>
            <div style={{ fontSize: 17, color: "var(--fg-0)", fontWeight: 700, lineHeight: 1.4, letterSpacing: "-0.01em" }}>
              {hit.title}
            </div>
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
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
          <Eyebrow>AI 拆解 · 5 镜头结构</Eyebrow>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-2)" }}>总时长 {hit.duration}s</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {hit.structure.map((s, i) => (
            <div
              key={i}
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
                  <Tag color="var(--accent)" style={{ fontSize: 9, padding: "1px 6px" }}>
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
