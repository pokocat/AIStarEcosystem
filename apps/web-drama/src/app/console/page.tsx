"use client";

import { ArrowUpRight, Clock, Film, PlayCircle, Sparkles, Wand2 } from "lucide-react";
import { Button, Card, Chip, KpiCard, Meter } from "@/components/premium";

// drama 工作台总览 —— Premium cinematic 风。
// 当前 Phase 4b 重点是 celebrity 业务页迁移，drama 仍是设计样板（mocks 内联），
// 业务页接入会在后续 Phase；这里用 mock 数据真实呈现 premium 视觉语言。

const CAST = [
  {
    id: "drama-act-001",
    name: "苏念",
    role: "都市悬疑女主 · A 类",
    fidelity: 94,
    series: 6,
    plays: "32.4M",
    revenue: "¥2.18M",
    tone: "accent" as const,
    gradient: "linear-gradient(135deg, rgba(212,175,106,0.5), rgba(164,76,255,0.3))",
  },
  {
    id: "drama-act-002",
    name: "陆烬",
    role: "古风偏暗黑 · A 类",
    fidelity: 92,
    series: 4,
    plays: "24.8M",
    revenue: "¥1.62M",
    tone: "violet" as const,
    gradient: "linear-gradient(135deg, rgba(164,76,255,0.5), rgba(61,224,255,0.3))",
  },
  {
    id: "drama-act-003",
    name: "林晓",
    role: "青春治愈 · B 类",
    fidelity: 88,
    series: 5,
    plays: "18.2M",
    revenue: "¥980K",
    tone: "info" as const,
    gradient: "linear-gradient(135deg, rgba(61,224,255,0.5), rgba(255,61,138,0.3))",
  },
  {
    id: "drama-act-004",
    name: "Aiko",
    role: "悬疑短剧 · A 类（训练中）",
    fidelity: 72,
    series: 1,
    plays: "—",
    revenue: "—",
    tone: "danger" as const,
    gradient: "linear-gradient(135deg, rgba(255,61,138,0.5), rgba(212,175,106,0.3))",
  },
];

const PROJECTS = [
  {
    title: "暮色未央",
    genre: "都市悬疑",
    episodes: "12 / 16",
    cast: "苏念 + 陆烬",
    status: "在线" as const,
    sched: "EP08 已上线",
    tone: "success" as const,
  },
  {
    title: "盛夏来信",
    genre: "青春治愈",
    episodes: "8 / 14",
    cast: "林晓",
    status: "制作中" as const,
    sched: "EP09 拍摄",
    tone: "info" as const,
  },
  {
    title: "摩天与月光",
    genre: "商战 + 爱情",
    episodes: "0 / 20",
    cast: "苏念 + 陆烬",
    status: "首映 T-3" as const,
    sched: "倒计时 3 天",
    tone: "accent" as const,
  },
  {
    title: "雾隐 · 1992",
    genre: "悬疑短剧",
    episodes: "3 / 10",
    cast: "Aiko (训练中)",
    status: "脚本" as const,
    sched: "脚本工坊 v3",
    tone: "violet" as const,
  },
  {
    title: "拾月",
    genre: "古风言情",
    episodes: "—",
    cast: "陆烬",
    status: "立项" as const,
    sched: "等待审批",
    tone: "neutral" as const,
  },
];

const SCRIPT_DRAFTS = [
  {
    title: "《暮色未央》EP09 · 剧情转折",
    suggestion: "建议在第 3 场加入回忆镜头，强化女主动机",
    progress: 82,
  },
  {
    title: "《盛夏来信》EP10 · 角色弧光",
    suggestion: "AI 建议合并 EP10/EP11 的次线索",
    progress: 64,
  },
  {
    title: "《摩天与月光》宣传 · 30s 切片",
    suggestion: "已生成 4 版分镜，待选定主版本",
    progress: 95,
  },
];

export default function DramaConsoleOverview() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {/* hero header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
        }}
      >
        <div>
          <div className="eyebrow">AI Short Drama · Production</div>
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
            今天的{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              片场
            </span>
          </h1>
          <div style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55 }}>
            5 部在产剧集 · 4 个演员 IP 在线 · 3 份脚本待审 — 同步于 2 分钟前
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" size="md">
            <Clock size={14} />
            排期日历
          </Button>
          <Button variant="primary" size="md">
            <Sparkles size={14} />
            创建新项目
          </Button>
        </div>
      </div>

      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <KpiCard
          label="演员 IP · 在线"
          value="12"
          delta="+2 / 月"
          tone="accent"
          spark={[42, 50, 48, 60, 68, 70, 84]}
        />
        <KpiCard
          label="在产剧集"
          value="5"
          delta="3 在线 · 2 制作"
          tone="violet"
          spark={[22, 26, 30, 36, 38, 44, 48]}
        />
        <KpiCard
          label="30 日累计播放"
          value="84.6M"
          delta="+14.2% vs 上月"
          tone="info"
          spark={[30, 38, 42, 48, 56, 64, 72]}
        />
        <KpiCard
          label="30 日营收"
          value="¥7.42M"
          delta="+9.6% vs 上月"
          tone="success"
          spark={[28, 30, 36, 40, 48, 54, 62]}
        />
      </div>

      {/* 两栏：演员 IP 阵容 + 系统健康 */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        {/* cast */}
        <Card style={{ padding: "22px 24px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              marginBottom: 18,
            }}
          >
            <div>
              <div className="eyebrow">cast & roster</div>
              <div
                style={{
                  fontSize: 17,
                  fontWeight: 600,
                  fontFamily: "var(--font-display)",
                  marginTop: 6,
                }}
              >
                演员 IP 阵容
              </div>
            </div>
            <a
              href="/console?tab=cast"
              style={{
                fontSize: 12,
                color: "var(--accent)",
                fontFamily: "var(--font-mono)",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              查看全部 <ArrowUpRight size={12} />
            </a>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
            {CAST.map((c) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  gap: 14,
                  padding: 14,
                  borderRadius: "var(--radius-md)",
                  background: "rgba(255,255,255,0.02)",
                  border: "1px solid var(--line)",
                }}
              >
                <div
                  style={{
                    width: 60,
                    height: 80,
                    borderRadius: "var(--radius-sm)",
                    background: c.gradient,
                    flexShrink: 0,
                    position: "relative",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.4))",
                    }}
                  />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        color: "var(--fg-0)",
                        fontFamily: "var(--font-display)",
                      }}
                    >
                      {c.name}
                    </div>
                    <Chip tone={c.tone}>{c.fidelity}</Chip>
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: "var(--fg-2)",
                      marginBottom: 10,
                      lineHeight: 1.4,
                    }}
                  >
                    {c.role}
                  </div>
                  <div
                    className="mono"
                    style={{
                      display: "flex",
                      gap: 12,
                      fontSize: 10.5,
                      color: "var(--fg-3)",
                      letterSpacing: 0.3,
                    }}
                  >
                    <span>{c.series} 部剧集</span>
                    <span style={{ color: "var(--fg-2)" }}>{c.plays}</span>
                    <span style={{ color: "var(--accent)" }}>{c.revenue}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* system health */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ padding: "22px 22px" }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>system pulse</div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "var(--font-display)",
                marginBottom: 18,
              }}
            >
              工作台状态
            </div>
            <Meter label="渲染队列利用" value={62} tone="accent" hint="GPU · 渲染剧集 · 02 上线" />
            <Meter label="形象保真度" value={88} tone="success" hint="平均 · 全部 A 类演员" />
            <Meter label="授权额度" value={34} tone="warning" hint="≈ 22 天剩余" />
            <Meter label="脚本审稿" value={76} tone="info" hint="本周 18 / 24 已审" />
          </Card>

          <Card glass style={{ padding: "22px 22px" }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>quick draw</div>
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                fontFamily: "var(--font-display)",
                marginBottom: 14,
              }}
            >
              快速动作
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Button variant="primary" size="md" style={{ width: "100%" }}>
                <Wand2 size={14} />
                启动新剧集
              </Button>
              <Button variant="secondary" size="md" style={{ width: "100%" }}>
                <Film size={14} />
                导入剧本素材
              </Button>
              <Button variant="ghost" size="md" style={{ width: "100%" }}>
                <PlayCircle size={14} />
                查看授权台账
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* 项目流水线表格 */}
      <Card style={{ padding: "22px 24px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            marginBottom: 18,
          }}
        >
          <div>
            <div className="eyebrow">project pipeline</div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 600,
                fontFamily: "var(--font-display)",
                marginTop: 6,
              }}
            >
              项目流水线
            </div>
          </div>
          <Button variant="ghost" size="sm">
            ⇣ 导出 CSV
          </Button>
        </div>

        <div style={{ overflow: "hidden", borderRadius: "var(--radius-md)", border: "1px solid var(--line)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                {["剧名", "类型", "集数进度", "主演", "状态", "排期"].map((h) => (
                  <th
                    key={h}
                    className="eyebrow"
                    style={{
                      textAlign: "left",
                      padding: "12px 16px",
                      borderBottom: "1px solid var(--line)",
                      color: "var(--fg-2)",
                      fontWeight: 500,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PROJECTS.map((p, i) => (
                <tr
                  key={p.title}
                  style={{
                    borderBottom: i < PROJECTS.length - 1 ? "1px solid var(--line)" : "none",
                  }}
                >
                  <td style={{ padding: "14px 16px", color: "var(--fg-0)", fontWeight: 500, fontFamily: "var(--font-display)" }}>
                    {p.title}
                  </td>
                  <td style={{ padding: "14px 16px", color: "var(--fg-1)" }}>{p.genre}</td>
                  <td className="mono" style={{ padding: "14px 16px", color: "var(--fg-1)", fontSize: 12 }}>
                    {p.episodes}
                  </td>
                  <td style={{ padding: "14px 16px", color: "var(--fg-1)" }}>{p.cast}</td>
                  <td style={{ padding: "14px 16px" }}>
                    <Chip tone={p.tone}>● {p.status}</Chip>
                  </td>
                  <td className="mono" style={{ padding: "14px 16px", color: "var(--fg-2)", fontSize: 12 }}>
                    {p.sched}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* 脚本工坊 */}
      <Card glass style={{ padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
          <div>
            <div className="eyebrow">script forge · ai assist</div>
            <div
              style={{
                fontSize: 17,
                fontWeight: 600,
                fontFamily: "var(--font-display)",
                marginTop: 6,
              }}
            >
              脚本工坊
            </div>
          </div>
          <Button variant="secondary" size="sm">
            <Wand2 size={13} />
            新建脚本
          </Button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
          {SCRIPT_DRAFTS.map((s, i) => (
            <div
              key={s.title}
              style={{
                padding: "16px 18px",
                borderRadius: "var(--radius-md)",
                background: "rgba(255,255,255,0.03)",
                border: "1px solid var(--line)",
              }}
            >
              <div className="mono" style={{ fontSize: 10, color: "var(--fg-3)", letterSpacing: 0.6, marginBottom: 8 }}>
                DRAFT · {String(i + 1).padStart(2, "0")}
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 500,
                  color: "var(--fg-0)",
                  marginBottom: 10,
                  lineHeight: 1.4,
                  fontFamily: "var(--font-display)",
                }}
              >
                {s.title}
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--fg-2)",
                  lineHeight: 1.55,
                  marginBottom: 14,
                  fontStyle: "italic",
                  fontFamily: "var(--font-serif)",
                }}
              >
                "{s.suggestion}"
              </div>
              <div
                style={{
                  height: 4,
                  background: "rgba(255,255,255,0.06)",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${s.progress}%`,
                    height: "100%",
                    background: "var(--gradient-gold)",
                  }}
                />
              </div>
              <div
                className="mono"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 10.5,
                  color: "var(--fg-3)",
                  marginTop: 8,
                  letterSpacing: 0.3,
                }}
              >
                <span>完成度</span>
                <span style={{ color: "var(--accent)" }}>{s.progress}%</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
