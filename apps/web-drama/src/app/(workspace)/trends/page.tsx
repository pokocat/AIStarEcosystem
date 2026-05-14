"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Compass, Plus, Sparkles } from "lucide-react";
import { Button, Card } from "@/components/premium";
import { EmptyState, SectionHeader, StatusBadge, ViewHeader } from "@/components/common";

interface Trend {
  topic: string;
  score: number;
  delta: number;
  windowLabel: string;
  industry: "urban" | "ancient" | "scifi" | "youth";
  region: "cn" | "asia" | "global";
}

const ALL_TRENDS: Trend[] = [
  { topic: "暴风女主 + 反差萌", score: 92, delta: 18, windowLabel: "7 日窗口", industry: "urban", region: "cn" },
  { topic: "古言 · 双男主 BE", score: 86, delta: 12, windowLabel: "14 日窗口", industry: "ancient", region: "cn" },
  { topic: "现代职场 · 倒霉打工人", score: 78, delta: 7, windowLabel: "30 日窗口", industry: "urban", region: "cn" },
  { topic: "悬疑 · 时间循环", score: 71, delta: 4, windowLabel: "30 日窗口", industry: "scifi", region: "asia" },
  { topic: "穿书 · 救活配角", score: 64, delta: -2, windowLabel: "30 日窗口", industry: "ancient", region: "cn" },
  { topic: "校园 · 高三日记", score: 58, delta: 5, windowLabel: "14 日窗口", industry: "youth", region: "asia" },
  { topic: "未来都市 · AI 觉醒", score: 51, delta: 9, windowLabel: "7 日窗口", industry: "scifi", region: "global" },
];

const INDUSTRIES: Array<{ value: Trend["industry"] | "all"; label: string }> = [
  { value: "all", label: "全部题材" },
  { value: "urban", label: "都市" },
  { value: "ancient", label: "古风" },
  { value: "scifi", label: "科幻" },
  { value: "youth", label: "青春" },
];

const REGIONS: Array<{ value: Trend["region"] | "all"; label: string }> = [
  { value: "all", label: "全部地区" },
  { value: "cn", label: "中文区" },
  { value: "asia", label: "亚洲" },
  { value: "global", label: "全球" },
];

export default function TrendsPage() {
  const router = useRouter();
  const [industry, setIndustry] = React.useState<Trend["industry"] | "all">("all");
  const [region, setRegion] = React.useState<Trend["region"] | "all">("all");

  React.useEffect(() => {
    const params = new URLSearchParams();
    if (industry !== "all") params.set("industry", industry);
    if (region !== "all") params.set("region", region);
    window.history.replaceState(null, "", `/trends${params.toString() ? `?${params}` : ""}`);
  }, [industry, region]);

  const filtered = ALL_TRENDS.filter((t) => {
    if (industry !== "all" && t.industry !== industry) return false;
    if (region !== "all" && t.region !== region) return false;
    return true;
  }).sort((a, b) => b.score - a.score);

  function adoptTrend(t: Trend) {
    toast.success(`已收藏「${t.topic}」`, {
      description: "可在「项目流水线」中以此为基底创建新项目。",
      action: {
        label: "去创建",
        onClick: () => router.push(`/projects?new=1`),
      },
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="内容雷达"
        title={
          <>
            趋势{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              雷达
            </span>
          </>
        }
        meta="来源 · 全网内容声量 + 站内停留 · 多筛选条件可叠加"
      />

      <Card style={{ padding: "14px 18px" }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {INDUSTRIES.map((it) => {
              const active = industry === it.value;
              return (
                <button
                  key={it.value}
                  onClick={() => setIndustry(it.value)}
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
                  {it.label}
                </button>
              );
            })}
          </div>
          <div style={{ height: 16, width: 1, background: "var(--line-2)" }} />
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {REGIONS.map((it) => {
              const active = region === it.value;
              return (
                <button
                  key={it.value}
                  onClick={() => setRegion(it.value)}
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
                  {it.label}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      <Card style={{ padding: "22px 24px" }}>
        <SectionHeader eyebrow="热门话题" title={`热门话题（${filtered.length}）`} />
        {filtered.length === 0 ? (
          <EmptyState icon={<Compass size={28} />} title="没有匹配的话题" description="清除筛选条件试试。" />
        ) : (
          <div>
            {filtered.map((t, i) => (
              <div
                key={t.topic}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 18,
                  padding: "16px 4px",
                  borderBottom: i < filtered.length - 1 ? "1px solid var(--line)" : "none",
                }}
              >
                <div className="mono" style={{ width: 28, fontSize: 11, color: "var(--fg-3)" }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 500,
                      color: "var(--fg-0)",
                      marginBottom: 4,
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    {t.topic}
                  </div>
                  <div
                    className="mono"
                    style={{ fontSize: 10.5, color: "var(--fg-3)", letterSpacing: 0.4 }}
                  >
                    {t.windowLabel}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 200,
                      height: 6,
                      background: "rgba(255,255,255,0.06)",
                      borderRadius: "var(--radius-pill)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${t.score}%`,
                        height: "100%",
                        background: "var(--gradient-gold)",
                      }}
                    />
                  </div>
                  <div className="mono" style={{ width: 38, fontSize: 12, color: "var(--accent)", textAlign: "right" }}>
                    {t.score}
                  </div>
                  <div
                    className="mono"
                    style={{
                      width: 40,
                      fontSize: 11,
                      color: t.delta < 0 ? "var(--danger)" : "var(--success)",
                    }}
                  >
                    {t.delta > 0 ? "+" : ""}
                    {t.delta}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => adoptTrend(t)}>
                  <Sparkles size={11} />
                  孵化
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
