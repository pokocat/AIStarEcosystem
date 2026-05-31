"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button, Card, KpiCard } from "@/components/premium";
import { SectionHeader, StatusBadge, ViewHeader } from "@/components/common";
import { useAsync } from "@/lib/drama-query";
import { FilmApi } from "@/api";
import type { Drama } from "@ai-star-eco/types/film";

type Range = "7d" | "30d" | "90d" | "365d";
type Dim = "channel" | "actor" | "genre";

const RANGES: Array<{ value: Range; label: string }> = [
  { value: "7d", label: "近 7 日" },
  { value: "30d", label: "近 30 日" },
  { value: "90d", label: "近 90 日" },
  { value: "365d", label: "近 1 年" },
];

const DIMS: Array<{ value: Dim; label: string }> = [
  { value: "channel", label: "按平台" },
  { value: "actor", label: "按演员" },
  { value: "genre", label: "按类型" },
];

export default function InsightsPage() {
  const [range, setRange] = React.useState<Range>("30d");
  const [dim, setDim] = React.useState<Dim>("channel");

  React.useEffect(() => {
    const params = new URLSearchParams();
    if (range !== "30d") params.set("range", range);
    if (dim !== "channel") params.set("dim", dim);
    window.history.replaceState(null, "", `/insights${params.toString() ? `?${params}` : ""}`);
  }, [range, dim]);

  const dramasQ = useAsync<Drama[]>("/film/dramas", () => FilmApi.listDramas());
  const dramas = dramasQ.data ?? [];
  const mainline = dramas.filter((d) => d.id.startsWith("d-"));

  const totalViews = mainline.reduce((s, d) => s + d.views, 0);
  const totalRevenue = mainline.reduce((s, d) => s + d.revenue, 0);
  const completion = 58.4;

  // 按当前短剧线的模拟经营口径切片。
  const slices: Array<{ name: string; value: number; color: string }> = React.useMemo(() => {
    if (dim === "channel")
      return [
        { name: "抖音", value: 38, color: "var(--accent)" },
        { name: "快手", value: 24, color: "var(--extra-violet)" },
        { name: "B 站", value: 16, color: "var(--info)" },
        { name: "微博", value: 12, color: "var(--success)" },
        { name: "小红书", value: 10, color: "var(--danger)" },
      ];
    if (dim === "actor")
      return [
        { name: "苏念", value: 36, color: "var(--accent)" },
        { name: "陆烬", value: 28, color: "var(--extra-violet)" },
        { name: "Aiko", value: 18, color: "var(--info)" },
        { name: "林晓", value: 18, color: "var(--success)" },
      ];
    return [
      { name: "都市悬疑", value: 32, color: "var(--accent)" },
      { name: "青春治愈", value: 22, color: "var(--extra-violet)" },
	        { name: "都市情感", value: 20, color: "var(--info)" },
	        { name: "年代悬疑", value: 16, color: "var(--success)" },
	        { name: "古风轻喜", value: 10, color: "var(--danger)" },
    ];
  }, [dim]);

  function exportReport() {
    const lines = [
      `数据洞察 · ${range}`,
      `维度：${DIMS.find((d) => d.value === dim)?.label}`,
      "",
      ...slices.map((s) => `${s.name}\t${s.value}%`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `insights-${range}-${dim}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("已导出报表");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="数据洞察"
        title={
          <>
            数据{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              洞察
            </span>
          </>
        }
        meta="同步于 2 分钟前 · 时间窗 + 维度可切换"
        action={
          <Button variant="secondary" size="md" onClick={exportReport}>
            <Download size={13} />
            导出报表
          </Button>
        }
      />

      {/* 时间窗 + 维度 */}
      <Card style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div className="eyebrow">window</div>
          <div style={{ display: "flex", gap: 6 }}>
            {RANGES.map((r) => {
              const active = range === r.value;
              return (
                <button
                  key={r.value}
                  onClick={() => setRange(r.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--radius-pill)",
                    border: active
                      ? "1px solid color-mix(in srgb, var(--accent) 50%, transparent)"
                      : "1px solid var(--line-2)",
                    background: active ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "transparent",
                    color: active ? "var(--accent)" : "var(--fg-1)",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
          <div style={{ flex: 1 }} />
          <div className="eyebrow">dimension</div>
          <div style={{ display: "flex", gap: 6 }}>
            {DIMS.map((d) => {
              const active = dim === d.value;
              return (
                <button
                  key={d.value}
                  onClick={() => setDim(d.value)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "var(--radius-pill)",
                    border: active
                      ? "1px solid color-mix(in srgb, var(--extra-violet) 50%, transparent)"
                      : "1px solid var(--line-2)",
                    background: active ? "color-mix(in srgb, var(--extra-violet) 12%, transparent)" : "transparent",
                    color: active ? "var(--extra-violet)" : "var(--fg-1)",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {d.label}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KpiCard label="完播率" value={`${completion}%`} delta="+3.2 pp" tone="success" />
        <KpiCard
          label="累计播放"
          value={totalViews > 0 ? `${(totalViews / 1_000_000).toFixed(1)}M` : "—"}
          tone="info"
        />
        <KpiCard
          label="累计营收"
          value={totalRevenue > 0 ? `¥${(totalRevenue / 10_000).toFixed(1)}万` : "—"}
          tone="accent"
        />
        <KpiCard label="ARPDAU" value="¥0.41" tone="violet" delta="+8.4%" />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <Card style={{ padding: "26px 28px" }}>
          <SectionHeader eyebrow={`时间序列 · ${range}`} title="播放与营收趋势" />
          <div style={{ height: 240, display: "flex", alignItems: "flex-end", gap: 6 }}>
            {Array.from({ length: range === "7d" ? 7 : range === "30d" ? 30 : range === "90d" ? 36 : 52 }).map(
              (_, i, arr) => {
                const h1 = 30 + Math.sin(i / 3) * 25 + (i / arr.length) * 60;
                const h2 = 22 + Math.cos(i / 2.5) * 20 + (i / arr.length) * 48;
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "flex-end",
                      gap: 2,
                    }}
                  >
                    <div style={{ height: `${h1}%`, background: "var(--accent)", borderRadius: 2, opacity: 0.85 }} />
                    <div
                      style={{
                        height: `${h2}%`,
                        background: "var(--extra-violet)",
                        borderRadius: 2,
                        opacity: 0.55,
                      }}
                    />
                  </div>
                );
              },
            )}
          </div>
          <div
            style={{
              display: "flex",
              gap: 18,
              marginTop: 14,
              fontSize: 11,
              color: "var(--fg-2)",
              fontFamily: "var(--font-mono)",
            }}
          >
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, background: "var(--accent)" }} /> 播放（百万次）
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 10, height: 10, background: "var(--extra-violet)" }} /> 营收（万 ¥）
            </span>
          </div>
        </Card>

        <Card style={{ padding: "26px 28px" }}>
          <SectionHeader eyebrow="结构拆解" title={DIMS.find((d) => d.value === dim)?.label ?? ""} />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {slices.map((s) => (
              <div key={s.name}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    marginBottom: 4,
                  }}
                >
                  <span>{s.name}</span>
                  <span className="mono" style={{ color: s.color }}>
                    {s.value}%
                  </span>
                </div>
                <div
                  style={{
                    height: 6,
                    background: "var(--track)",
                    borderRadius: "var(--radius-pill)",
                    overflow: "hidden",
                  }}
                >
                  <div style={{ width: `${s.value}%`, height: "100%", background: s.color }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card style={{ padding: "22px 24px" }}>
        <SectionHeader
          eyebrow="主线剧集"
          title="按剧集表现"
          right={<StatusBadge tone="accent">{mainline.length} 部</StatusBadge>}
        />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1fr 1fr 1fr",
            gap: 6,
            fontSize: 12,
          }}
        >
          {["剧名", "播放", "营收", "评分"].map((h) => (
            <div key={h} className="eyebrow" style={{ padding: "6px 8px" }}>
              {h}
            </div>
          ))}
          {mainline.map((d) => (
            <React.Fragment key={d.id}>
              <div style={{ padding: "10px 8px", color: "var(--fg-0)", fontFamily: "var(--font-display)" }}>{d.title}</div>
              <div className="mono" style={{ padding: "10px 8px", color: "var(--fg-1)" }}>
                {d.views > 0 ? `${(d.views / 1_000_000).toFixed(2)}M` : "—"}
              </div>
              <div className="mono" style={{ padding: "10px 8px", color: "var(--accent)" }}>
                {d.revenue > 0 ? `¥${(d.revenue / 10_000).toFixed(1)}万` : "—"}
              </div>
              <div className="mono" style={{ padding: "10px 8px", color: "var(--fg-1)" }}>
                {d.rating > 0 ? d.rating.toFixed(1) : "—"}
              </div>
            </React.Fragment>
          ))}
        </div>
      </Card>
    </div>
  );
}
