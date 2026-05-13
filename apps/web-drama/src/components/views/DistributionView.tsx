"use client";

// 多平台分发面板 · cinematic 布局：
//   顶部 KPI 概览（4 张：触达 / 完播 / 转化 / 在投渠道）
//   左 2 / 右 1：左渠道矩阵（卡片网格，每个渠道带 KPI mini + 状态）
//                右近期投放快讯（按日期倒序，含投放剧集 + 渠道 + 状态）
//   底部：剧集 × 渠道 矩阵（绿点表示已上线、黄点制作中、灰点未投放）

import * as React from "react";
import {
  Activity,
  ArrowUpRight,
  CheckCircle2,
  CircleDashed,
  Clock,
  Eye,
  Filter,
  Layers,
  Plus,
  Radio,
  Share2,
  Sparkles,
  TrendingUp,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { Drama } from "@ai-star-eco/types/film";
import { Button, Card, Chip, KpiCard } from "@/components/premium";

interface Props {
  dramas: Drama[];
}

interface Channel {
  id: string;
  name: string;
  shortLabel: string;
  icon: LucideIcon;
  reach30d: number;
  retention: number;
  conv: number;
  state: "在投" | "预热" | "测试" | "已撤";
  tone: "success" | "accent" | "info" | "neutral";
  audienceTag: string;
}

const CHANNELS: Channel[] = [
  { id: "douyin",   name: "抖音 · 短剧站",       shortLabel: "抖音", icon: Activity,    reach30d: 32_600_000, retention: 68, conv: 1.86, state: "在投",  tone: "success", audienceTag: "20–35 岁 · 全国" },
  { id: "kuaishou", name: "快手 · 剧集号",       shortLabel: "快手", icon: Zap,         reach30d: 21_400_000, retention: 62, conv: 1.42, state: "在投",  tone: "success", audienceTag: "下沉 + 30–45 岁" },
  { id: "weibo",    name: "微博 · 话题页",       shortLabel: "微博", icon: TrendingUp,  reach30d:  8_900_000, retention: 41, conv: 0.78, state: "预热",  tone: "accent",  audienceTag: "意见领袖 + 粉丝聚集" },
  { id: "bilibili", name: "B 站 · 短剧专区",     shortLabel: "B 站", icon: Layers,      reach30d:  6_200_000, retention: 54, conv: 1.12, state: "在投",  tone: "success", audienceTag: "16–28 岁 · 二次元" },
  { id: "rednote",  name: "小红书 · 安利向",     shortLabel: "小红书", icon: Sparkles,  reach30d:  4_700_000, retention: 47, conv: 0.95, state: "测试",  tone: "info",    audienceTag: "都市女性 · 强分享" },
  { id: "wechat",   name: "视频号 · 朋友圈分发", shortLabel: "视频号", icon: Share2,    reach30d:  3_400_000, retention: 39, conv: 0.62, state: "测试",  tone: "info",    audienceTag: "熟人传播 · 30+ 岁" },
];

interface NewsItem {
  id: string;
  date: string;
  drama: string;
  channel: string;
  action: string;
  tone: "success" | "info" | "accent" | "violet";
}

const NEWS: NewsItem[] = [
  { id: "n1", date: "今天 09:24", drama: "暮色未央",     channel: "抖音",   action: "EP08 上线 · 首日播放破 280 万", tone: "success" },
  { id: "n2", date: "今天 02:10", drama: "摩天与月光",   channel: "微博",   action: "话题 #摩天与月光 登热搜 #14",   tone: "accent" },
  { id: "n3", date: "昨天 18:42", drama: "盛夏来信",     channel: "B 站",   action: "EP06 切片合集进入热门",        tone: "success" },
  { id: "n4", date: "昨天 11:08", drama: "暮色未央",     channel: "快手",   action: "EP07 完播率 71% · 高于平均",   tone: "info" },
  { id: "n5", date: "2 天前",     drama: "摩天与月光",   channel: "小红书", action: "首映 30 秒 teaser 启动测试",   tone: "violet" },
  { id: "n6", date: "3 天前",     drama: "雾隐 · 1992", channel: "B 站",   action: "试播 第 1 场 · 评论数破 1k",   tone: "info" },
];

interface MatrixCell {
  state: "live" | "scheduled" | "off";
}

function buildMatrix(dramas: Drama[]): { dramas: Drama[]; matrix: Record<string, Record<string, MatrixCell>> } {
  const list = dramas.filter((d) => d.id.startsWith("d-"));
  const m: Record<string, Record<string, MatrixCell>> = {};
  for (const d of list) {
    m[d.id] = {};
    for (const c of CHANNELS) {
      // 简化规则：released 在头部 4 渠道全部上线，post-production 仅微博/小红书预热，其余未投放
      let state: MatrixCell["state"] = "off";
      if (d.status === "released") {
        if (["douyin", "kuaishou", "bilibili", "weibo"].includes(c.id)) state = "live";
        else if (["rednote", "wechat"].includes(c.id)) state = "scheduled";
      } else if (d.status === "post-production") {
        if (["weibo", "rednote"].includes(c.id)) state = "scheduled";
      } else if (d.status === "filming") {
        if (c.id === "weibo") state = "scheduled";
      }
      m[d.id][c.id] = { state };
    }
  }
  return { dramas: list, matrix: m };
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function DistributionView({ dramas }: Props) {
  const [filter, setFilter] = React.useState<"all" | Channel["state"]>("all");

  const filtered = React.useMemo(() => {
    if (filter === "all") return CHANNELS;
    return CHANNELS.filter((c) => c.state === filter);
  }, [filter]);

  const totalReach = CHANNELS.reduce((s, c) => s + c.reach30d, 0);
  const liveCount = CHANNELS.filter((c) => c.state === "在投").length;
  const avgRetention = Math.round(
    CHANNELS.reduce((s, c) => s + c.retention, 0) / CHANNELS.length,
  );
  const avgConv = (
    CHANNELS.reduce((s, c) => s + c.conv, 0) / CHANNELS.length
  ).toFixed(2);

  const { dramas: matrixDramas, matrix } = React.useMemo(() => buildMatrix(dramas), [dramas]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
        }}
      >
        <div>
          <div className="eyebrow">分发矩阵 · 6 平台</div>
          <h1
            style={{
              fontSize: 36,
              fontWeight: 700,
              letterSpacing: "var(--tracking-tight)",
              fontFamily: "var(--font-display)",
              margin: "10px 0 8px",
              lineHeight: 1.05,
            }}
          >
            多平台{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              分发
            </span>
          </h1>
          <div style={{ fontSize: 13.5, color: "var(--fg-2)" }}>
            6 条渠道 · 4 在投 · 1 预热 · 2 测试 — 数据周期 30 日
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" size="md">
            <Filter size={14} /> 高级筛选
          </Button>
          <Button variant="primary" size="md">
            <Plus size={14} /> 新增渠道
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <KpiCard label="30 日触达" value={compact(totalReach)} delta="6 平台合计" tone="accent" spark={[42, 45, 50, 55, 60, 68, 72]} />
        <KpiCard label="完播率均值" value={`${avgRetention}%`} delta="+3.2 pp vs 上月" tone="success" spark={[38, 42, 45, 48, 52, 54, 55]} />
        <KpiCard label="转化率均值" value={`${avgConv}%`} delta="+0.18 pp vs 上月" tone="violet" spark={[28, 30, 32, 38, 40, 42, 45]} />
        <KpiCard label="在投渠道" value={`${liveCount}`} delta={`总 ${CHANNELS.length} 条`} tone="info" />
      </div>

      {/* 主体两列 */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 18 }}>
        {/* 左：渠道矩阵 */}
        <Card style={{ padding: "22px 24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: 16,
            }}
          >
            <div>
              <div className="eyebrow">渠道矩阵</div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  fontFamily: "var(--font-display)",
                  marginTop: 6,
                }}
              >
                {filtered.length} 条 · 按状态过滤
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {(["all", "在投", "预热", "测试", "已撤"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilter(s as "all" | Channel["state"])}
                  style={pillBtn(filter === s)}
                >
                  {s === "all" ? "全部" : s}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
            {filtered.map((c) => {
              const Icon = c.icon;
              return (
                <div
                  key={c.id}
                  style={{
                    padding: "18px 20px",
                    borderRadius: "var(--radius-md)",
                    background: "rgba(255,255,255,0.02)",
                    border: "1px solid var(--line)",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                    <div
                      style={{
                        width: 38,
                        height: 38,
                        borderRadius: "var(--radius-md)",
                        background: "color-mix(in srgb, var(--accent) 14%, transparent)",
                        border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Icon size={18} color="var(--accent)" />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          fontFamily: "var(--font-display)",
                          color: "var(--fg-0)",
                        }}
                      >
                        {c.name}
                      </div>
                      <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-3)", marginTop: 2 }}>
                        {c.audienceTag}
                      </div>
                    </div>
                    <Chip tone={c.tone}>● {c.state}</Chip>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: 12,
                      paddingTop: 10,
                      borderTop: "1px solid var(--line)",
                    }}
                  >
                    <Stat label="触达" value={compact(c.reach30d)} />
                    <Stat
                      label="完播"
                      value={`${c.retention}%`}
                      bar={{ value: c.retention, color: "var(--success)" }}
                    />
                    <Stat label="转化" value={`${c.conv}%`} accent />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 右：投放快讯 */}
        <Card glass style={{ padding: "22px 22px" }}>
          <div className="eyebrow" style={{ marginBottom: 14 }}>投放快讯</div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {NEWS.map((n, i) => (
              <div
                key={n.id}
                style={{
                  display: "flex",
                  gap: 12,
                  padding: "12px 0",
                  borderBottom: i < NEWS.length - 1 ? "1px solid var(--line)" : "none",
                }}
              >
                <div
                  className="mono"
                  style={{
                    width: 56,
                    fontSize: 10,
                    color: "var(--fg-3)",
                    letterSpacing: 0.4,
                    flexShrink: 0,
                    paddingTop: 2,
                  }}
                >
                  {n.date}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: "var(--fg-0)",
                        fontFamily: "var(--font-display)",
                      }}
                    >
                      《{n.drama}》
                    </div>
                    <Chip tone={n.tone}>{n.channel}</Chip>
                  </div>
                  <div style={{ fontSize: 12, color: "var(--fg-2)", lineHeight: 1.5 }}>
                    {n.action}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 底部：剧集 × 渠道 矩阵 */}
      <Card style={{ padding: "22px 24px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 16,
          }}
        >
          <div>
            <div className="eyebrow">剧集 × 渠道 投放矩阵</div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 600,
                fontFamily: "var(--font-display)",
                marginTop: 6,
              }}
            >
              {matrixDramas.length} 部剧集 × {CHANNELS.length} 平台
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--fg-2)" }}>
            <Legend color="var(--success)" label="已上线" />
            <Legend color="var(--accent)" label="预热 / 投放计划" />
            <Legend color="var(--fg-3)" label="未投放" />
          </div>
        </div>

        <div style={{ overflow: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th
                  style={{
                    textAlign: "left",
                    padding: "10px 14px",
                    color: "var(--fg-3)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    fontWeight: 500,
                    borderBottom: "1px solid var(--line)",
                    minWidth: 160,
                  }}
                >
                  剧集
                </th>
                {CHANNELS.map((c) => (
                  <th
                    key={c.id}
                    style={{
                      padding: "10px 8px",
                      color: "var(--fg-3)",
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      letterSpacing: 0.5,
                      fontWeight: 500,
                      borderBottom: "1px solid var(--line)",
                      textAlign: "center",
                    }}
                  >
                    {c.shortLabel}
                  </th>
                ))}
                <th
                  style={{
                    padding: "10px 14px",
                    color: "var(--fg-3)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 10,
                    letterSpacing: 0.5,
                    textTransform: "uppercase",
                    fontWeight: 500,
                    borderBottom: "1px solid var(--line)",
                    textAlign: "right",
                  }}
                >
                  覆盖率
                </th>
              </tr>
            </thead>
            <tbody>
              {matrixDramas.map((d) => {
                const cells = matrix[d.id];
                const liveCount = Object.values(cells).filter((c) => c.state === "live").length;
                const coverage = Math.round((liveCount / CHANNELS.length) * 100);
                return (
                  <tr key={d.id} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td
                      style={{
                        padding: "14px",
                        color: "var(--fg-0)",
                        fontWeight: 500,
                        fontFamily: "var(--font-display)",
                      }}
                    >
                      {d.title}
                      <div className="mono" style={{ fontSize: 10, color: "var(--fg-3)", letterSpacing: 0.3, marginTop: 2 }}>
                        {d.genre}
                      </div>
                    </td>
                    {CHANNELS.map((c) => {
                      const cell = cells[c.id];
                      const Icon =
                        cell.state === "live" ? CheckCircle2 :
                        cell.state === "scheduled" ? Clock :
                        CircleDashed;
                      const color =
                        cell.state === "live" ? "var(--success)" :
                        cell.state === "scheduled" ? "var(--accent)" :
                        "var(--fg-3)";
                      return (
                        <td key={c.id} style={{ padding: "14px 8px", textAlign: "center" }}>
                          <Icon size={14} color={color} />
                        </td>
                      );
                    })}
                    <td
                      style={{
                        padding: "14px",
                        textAlign: "right",
                        fontFamily: "var(--font-mono)",
                        fontSize: 12,
                        color: coverage > 50 ? "var(--accent)" : "var(--fg-2)",
                        fontWeight: 600,
                      }}
                    >
                      {coverage}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  bar,
  accent,
}: {
  label: string;
  value: string;
  bar?: { value: number; color: string };
  accent?: boolean;
}) {
  return (
    <div>
      <div className="eyebrow" style={{ fontSize: 9.5, marginBottom: 4 }}>{label}</div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 600,
          fontFamily: "var(--font-display)",
          color: accent ? "var(--accent)" : "var(--fg-0)",
        }}
      >
        {value}
      </div>
      {bar && (
        <div
          style={{
            height: 3,
            background: "rgba(255,255,255,0.06)",
            borderRadius: 2,
            overflow: "hidden",
            marginTop: 4,
          }}
        >
          <div
            style={{
              width: `${bar.value}%`,
              height: "100%",
              background: bar.color,
            }}
          />
        </div>
      )}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: color,
          boxShadow: `0 0 6px ${color}`,
        }}
      />
      {label}
    </span>
  );
}

function pillBtn(active: boolean): React.CSSProperties {
  return {
    padding: "6px 12px",
    borderRadius: "var(--radius-pill)",
    fontSize: 11,
    background: active
      ? "color-mix(in srgb, var(--accent) 14%, transparent)"
      : "transparent",
    border: active
      ? "1px solid color-mix(in srgb, var(--accent) 50%, transparent)"
      : "1px solid var(--line-2)",
    color: active ? "var(--accent)" : "var(--fg-1)",
    cursor: "pointer",
    fontFamily: "var(--font-sans)",
    transition: "background 160ms, border-color 160ms",
  };
}
