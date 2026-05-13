// console/page.tsx 是 Server Component（需要 await searchParams.tab）。
// 子视图都是纯 JSX；交互组件 Button / Card / Chip / KpiCard / Meter 各自带
// "use client"，Next 自动建 client boundary。layout.tsx 是 client（sidebar
// 要 usePathname + useSearchParams 判 active）。
//
// 数据契约：演员 IP 用共享 @ai-star-eco/types/artist 的 Artist 类型，
// mock 数据放 mocks/artists.ts（按 ArtistType 过滤到 drama 相关）。
// 展示侧（fidelity/tone/gradient/plays/revenue 字符串）由 deriveCastView()
// 从 Artist 实时派生，避免 UI 字段污染领域模型。

import * as React from "react";
import {
  ArrowUpRight,
  BarChart3,
  Compass,
  Clock,
  Film,
  PenTool,
  PlayCircle,
  Settings,
  Share2,
  Sparkles,
  Users,
  Wand2,
} from "lucide-react";
import type { Artist } from "@ai-star-eco/types/artist";
import type { Drama, DramaStatus } from "@ai-star-eco/types/film";
import { Button, Card, Chip, KpiCard, Meter } from "@/components/premium";
import { MOCK_ARTISTS } from "@/mocks/artists";
import { DRAMAS } from "@/mocks/film";

// drama 工作台 —— 按 ?tab=xxx 切多视图，sidebar 控制。
// 数据全为 mock，待后续 Phase 接入真实 service / api。
// Phase 4b 重点是 celebrity 业务页迁移，drama 仍是设计样板：把"工业流"具象成可点的工作台。

type TabId =
  | "overview"
  | "cast"
  | "scripts"
  | "projects"
  | "distribution"
  | "insights"
  | "trends"
  | "settings";

function resolveTab(raw?: string): TabId {
  switch (raw) {
    case "cast":
    case "scripts":
    case "projects":
    case "distribution":
    case "insights":
    case "trends":
    case "settings":
      return raw;
    default:
      return "overview";
  }
}

// 派生 CastView 显示字段。
// fidelity 选 max(acting, popularity)（演员主线看 acting 与人气）；
// tone / gradient 按 quality 映射，让 6 个等级在视觉上能区分；
// plays / revenue 用 formatCompactNumber 风格输出。
type CastTone = "accent" | "success" | "warning" | "danger" | "info" | "violet" | "neutral";

interface CastView {
  id: string;
  name: string;
  role: string;
  fidelity: number;
  series: number;
  plays: string;
  revenue: string;
  tone: CastTone;
  gradient: string;
}

const QUALITY_TONE: Record<Artist["quality"], CastTone> = {
  legendary: "accent",
  epic: "violet",
  rare: "info",
  common: "neutral",
};

const QUALITY_GRADIENT: Record<Artist["quality"], string> = {
  legendary: "linear-gradient(135deg, rgba(212,175,106,0.55), rgba(234,215,168,0.3))",
  epic: "linear-gradient(135deg, rgba(164,76,255,0.5), rgba(61,224,255,0.3))",
  rare: "linear-gradient(135deg, rgba(61,224,255,0.5), rgba(76,224,160,0.3))",
  common: "linear-gradient(135deg, rgba(86,81,106,0.6), rgba(38,31,54,0.4))",
};

const QUALITY_LABEL: Record<Artist["quality"], string> = {
  legendary: "S 类",
  epic: "A 类",
  rare: "B 类",
  common: "C 类",
};

const STATUS_HINT: Record<Artist["status"], string> = {
  active: "",
  trainee: "（训练中）",
  debut: "（出道期）",
  rest: "（休养）",
  retired: "（退役）",
};

function formatCompact(n: number): string {
  if (n <= 0) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCny(n: number): string {
  if (n <= 0) return "—";
  if (n >= 1_000_000) return `¥${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `¥${Math.round(n / 1_000)}K`;
  return `¥${n}`;
}

// role 取 bio 第一句，如果已经含"类"字（drama 专属人物 bio 直接写了"A 类"），
// 不再追加 QUALITY_LABEL，否则补一节作为 quality 标识。
function deriveRole(a: Artist): string {
  const firstClause = a.bio.split(/[，,。.;；]/)[0].trim();
  const rawHint = STATUS_HINT[a.status] ?? "";
  const statusHint = rawHint && !firstClause.includes(rawHint) ? rawHint : "";
  if (/[A-Z]\s*类|S\s*类|[一二三四五六七八九十]\s*类/.test(firstClause)) {
    return `${firstClause}${statusHint}`;
  }
  return `${firstClause}${statusHint} · ${QUALITY_LABEL[a.quality]}`;
}

function deriveCastView(a: Artist): CastView {
  return {
    id: a.id,
    name: a.name,
    role: deriveRole(a),
    fidelity: Math.max(a.talents.acting, Math.min(a.stats.popularity, 95)),
    series: a.stats.dramas,
    plays: formatCompact(a.stats.fans * 200), // mock：粉丝 × 200 ≈ 累计播放（待真实 plays 字段）
    revenue: formatCny(a.stats.revenue),
    tone: QUALITY_TONE[a.quality],
    gradient: QUALITY_GRADIENT[a.quality],
  };
}

const CAST: CastView[] = MOCK_ARTISTS.map(deriveCastView);

// PROJECTS 派生自 mocks/film.ts 的 Drama[]，按 DramaStatus 映射状态标签 + tone。
// Drama 类型当前没有"已上线 / 总集数"双字段，episodes 是总集数；后续在 spec
// 加 airedEpisodes / nextEpisodeAt 真实进度后替换。
type ProjectTone = "accent" | "success" | "warning" | "danger" | "info" | "violet" | "neutral";

interface ProjectView {
  title: string;
  genre: string;
  episodes: string;
  cast: string;
  status: string;
  sched: string;
  tone: ProjectTone;
}

const DRAMA_STATUS_LABEL: Record<DramaStatus, string> = {
  released: "在线",
  filming: "制作中",
  "post-production": "首映 T-3",
  casting: "选角",
};

const DRAMA_STATUS_TONE: Record<DramaStatus, ProjectTone> = {
  released: "success",
  filming: "info",
  "post-production": "accent",
  casting: "violet",
};

function deriveSched(d: Drama): string {
  if (d.status === "released") return d.releaseDate ? `首播 ${d.releaseDate.slice(0, 10)}` : "已上线";
  if (d.status === "filming") return "拍摄中";
  if (d.status === "post-production") return d.releaseDate ? `首映 ${d.releaseDate.slice(0, 10)}` : "后期制作";
  return "选角中";
}

function deriveProjectView(d: Drama): ProjectView {
  return {
    title: d.title,
    genre: d.genre,
    episodes: d.episodes > 0 ? `${d.episodes} 集` : "—",
    cast: d.role,
    status: DRAMA_STATUS_LABEL[d.status],
    sched: deriveSched(d),
    tone: DRAMA_STATUS_TONE[d.status],
  };
}

// 只取 drama 主线（id 以 "d-" 开头的 cinematic 剧集），避免泛例剧目混入。
const PROJECTS: ProjectView[] = DRAMAS.filter((d) => d.id.startsWith("d-")).map(deriveProjectView);

const SCRIPT_DRAFTS = [
  {
    title: "《暮色未央》EP09 · 剧情转折",
    suggestion: "建议在第 3 场加入回忆镜头，强化女主动机",
    progress: 82,
    series: "暮色未央",
    updated: "2 小时前",
  },
  {
    title: "《盛夏来信》EP10 · 角色弧光",
    suggestion: "AI 建议合并 EP10/EP11 的次线索",
    progress: 64,
    series: "盛夏来信",
    updated: "昨天 18:30",
  },
  {
    title: "《摩天与月光》宣传 · 30s 切片",
    suggestion: "已生成 4 版分镜，待选定主版本",
    progress: 95,
    series: "摩天与月光",
    updated: "今晨 03:12",
  },
  {
    title: "《雾隐 · 1992》第一稿全集",
    suggestion: "Aiko 形象训练完成后可调拍摄表",
    progress: 28,
    series: "雾隐 · 1992",
    updated: "3 天前",
  },
];

const DISTRIBUTION_CHANNELS = [
  { name: "抖音 · 短剧站", reach: "32.6M", retention: 68, conv: "1.86%", state: "在投" as const, tone: "success" as const },
  { name: "快手 · 剧集号", reach: "21.4M", retention: 62, conv: "1.42%", state: "在投" as const, tone: "success" as const },
  { name: "微博 · 话题页", reach: "8.9M", retention: 41, conv: "0.78%", state: "预热" as const, tone: "accent" as const },
  { name: "B 站 · 短剧专区", reach: "6.2M", retention: 54, conv: "1.12%", state: "在投" as const, tone: "success" as const },
  { name: "小红书 · 安利向", reach: "4.7M", retention: 47, conv: "0.95%", state: "测试" as const, tone: "info" as const },
];

const TRENDS = [
  { topic: "暴风女主 + 反差萌", score: 92, delta: "+18", windows: "7 日窗口" },
  { topic: "古言 · 双男主 BE", score: 86, delta: "+12", windows: "14 日窗口" },
  { topic: "现代职场 · 倒霉打工人", score: 78, delta: "+7", windows: "30 日窗口" },
  { topic: "悬疑 · 时间循环", score: 71, delta: "+4", windows: "30 日窗口" },
  { topic: "穿书 · 救活配角", score: 64, delta: "-2", windows: "30 日窗口" },
];

// ────────────────────────────────────────────────────────────────────────────
// 各 tab 视图
// ────────────────────────────────────────────────────────────────────────────

function OverviewView() {
  return (
    <>
      {/* KPI grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <KpiCard label="演员 IP · 在线" value="12" delta="+2 / 月" tone="accent" spark={[42, 50, 48, 60, 68, 70, 84]} />
        <KpiCard label="在产剧集" value="5" delta="3 在线 · 2 制作" tone="violet" spark={[22, 26, 30, 36, 38, 44, 48]} />
        <KpiCard label="30 日累计播放" value="84.6M" delta="+14.2% vs 上月" tone="info" spark={[30, 38, 42, 48, 56, 64, 72]} />
        <KpiCard label="30 日营收" value="¥7.42M" delta="+9.6% vs 上月" tone="success" spark={[28, 30, 36, 40, 48, 54, 62]} />
      </div>

      {/* cast + health */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <Card style={{ padding: "22px 24px" }}>
          <SectionHeader eyebrow="cast & roster" title="演员 IP 阵容" rightHref="/console?tab=cast" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
            {CAST.slice(0, 4).map((c) => (
              <CastRow key={c.id} c={c} />
            ))}
          </div>
        </Card>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <Card style={{ padding: "22px 22px" }}>
            <SectionHeader eyebrow="system pulse" title="工作台状态" />
            <Meter label="渲染队列利用" value={62} tone="accent" hint="GPU · 渲染剧集 · 02 上线" />
            <Meter label="形象保真度" value={88} tone="success" hint="平均 · 全部 A 类演员" />
            <Meter label="授权额度" value={34} tone="warning" hint="≈ 22 天剩余" />
            <Meter label="脚本审稿" value={76} tone="info" hint="本周 18 / 24 已审" />
          </Card>

          <Card glass style={{ padding: "22px 22px" }}>
            <SectionHeader eyebrow="quick draw" title="快速动作" />
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

      <ProjectsTable rows={PROJECTS} />
      <ScriptForge drafts={SCRIPT_DRAFTS.slice(0, 3)} />
    </>
  );
}

function CastView() {
  return (
    <>
      <ViewHeader
        eyebrow="cast & roster"
        title={
          <>
            演员 IP{" "}
            <span className="text-gradient-gold" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
              阵容
            </span>
          </>
        }
        meta="6 个演员 IP · 4 A 类 · 1 训练中"
        action={
          <Button variant="primary" size="md">
            <Sparkles size={14} /> 训练新演员
          </Button>
        }
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        {CAST.map((c) => (
          <Card key={c.id} style={{ padding: 0, overflow: "hidden" }}>
            <div
              style={{
                height: 220,
                background: c.gradient,
                position: "relative",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.6))",
                }}
              />
              <div style={{ position: "absolute", top: 14, left: 14 }}>
                <Chip tone={c.tone}>fidelity {c.fidelity}</Chip>
              </div>
              <div style={{ position: "absolute", bottom: 14, left: 16, right: 16 }}>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    fontFamily: "var(--font-display)",
                    color: "var(--fg-0)",
                  }}
                >
                  {c.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--fg-1)", marginTop: 4 }}>{c.role}</div>
              </div>
            </div>
            <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", fontFamily: "var(--font-mono)", fontSize: 11, letterSpacing: 0.4, color: "var(--fg-2)" }}>
              <span>{c.series} 部剧集</span>
              <span style={{ color: "var(--fg-1)" }}>{c.plays}</span>
              <span style={{ color: "var(--accent)" }}>{c.revenue}</span>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}

function ScriptsView() {
  return (
    <>
      <ViewHeader
        eyebrow="script forge · ai assist"
        title={
          <>
            脚本{" "}
            <span className="text-gradient-gold" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
              工坊
            </span>
          </>
        }
        meta={`${SCRIPT_DRAFTS.length} 份草稿 · 平均完成度 67%`}
        action={
          <Button variant="primary" size="md">
            <Wand2 size={14} /> 新建脚本
          </Button>
        }
      />
      <ScriptForge drafts={SCRIPT_DRAFTS} expanded />
    </>
  );
}

function ProjectsView() {
  return (
    <>
      <ViewHeader
        eyebrow="project pipeline"
        title={
          <>
            项目{" "}
            <span className="text-gradient-gold" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
              流水线
            </span>
          </>
        }
        meta={`${PROJECTS.length} 条剧集 · 3 在线 · 1 制作 · 1 脚本`}
        action={
          <Button variant="primary" size="md">
            <Film size={14} /> 创建新项目
          </Button>
        }
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KpiCard label="在产 · 全部" value={`${PROJECTS.length}`} tone="accent" />
        <KpiCard label="本月上线" value="2" delta="EP08 · EP07" tone="success" />
        <KpiCard label="脚本待审" value="3" delta="2 加急" tone="warning" />
        <KpiCard label="排期占用" value="68%" delta="GPU 渲染 + 演员档期" tone="violet" />
      </div>
      <ProjectsTable rows={PROJECTS} />
    </>
  );
}

function DistributionView() {
  return (
    <>
      <ViewHeader
        eyebrow="multi-channel distribution"
        title={
          <>
            多平台{" "}
            <span className="text-gradient-gold" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
              分发
            </span>
          </>
        }
        meta={`${DISTRIBUTION_CHANNELS.length} 条渠道 · 4 在投 · 1 预热 · 1 测试`}
        action={
          <Button variant="primary" size="md">
            <Share2 size={14} /> 新增渠道
          </Button>
        }
      />
      <Card style={{ padding: "22px 24px" }}>
        <div style={{ overflow: "hidden", borderRadius: "var(--radius-md)", border: "1px solid var(--line)" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.02)" }}>
                {["渠道", "30 日触达", "完播率", "转化率", "状态"].map((h) => (
                  <th key={h} className="eyebrow" style={{ textAlign: "left", padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--fg-2)", fontWeight: 500 }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DISTRIBUTION_CHANNELS.map((c, i) => (
                <tr key={c.name} style={{ borderBottom: i < DISTRIBUTION_CHANNELS.length - 1 ? "1px solid var(--line)" : "none" }}>
                  <td style={{ padding: "14px 16px", fontWeight: 500, fontFamily: "var(--font-display)", color: "var(--fg-0)" }}>{c.name}</td>
                  <td className="mono" style={{ padding: "14px 16px", color: "var(--fg-1)", fontSize: 12 }}>{c.reach}</td>
                  <td style={{ padding: "14px 16px", color: "var(--fg-1)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ height: 4, flex: 1, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden", minWidth: 80 }}>
                        <div style={{ width: `${c.retention}%`, height: "100%", background: "var(--accent)" }} />
                      </div>
                      <span className="mono" style={{ fontSize: 11, color: "var(--fg-2)", minWidth: 32 }}>{c.retention}%</span>
                    </div>
                  </td>
                  <td className="mono" style={{ padding: "14px 16px", color: "var(--accent)", fontSize: 12 }}>{c.conv}</td>
                  <td style={{ padding: "14px 16px" }}><Chip tone={c.tone}>● {c.state}</Chip></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function InsightsView() {
  return (
    <>
      <ViewHeader
        eyebrow="data insights"
        title={
          <>
            数据{" "}
            <span className="text-gradient-gold" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
              洞察
            </span>
          </>
        }
        meta="同步于 2 分钟前 · 数据周期 30 日"
        action={<Button variant="secondary" size="md">⇣ 导出报表</Button>}
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KpiCard label="完播率 · 加权" value="58.4%" delta="+3.2 pp" tone="success" spark={[40, 45, 50, 48, 54, 58, 58]} />
        <KpiCard label="单集平均时长" value="03:42" delta="-12s vs 上月" tone="info" spark={[60, 56, 54, 52, 48, 46, 44]} />
        <KpiCard label="点赞 / 播放" value="6.8%" delta="+0.9 pp" tone="violet" spark={[40, 44, 50, 52, 58, 60, 68]} />
        <KpiCard label="ARPDAU" value="¥0.41" delta="+8.4%" tone="accent" spark={[28, 30, 34, 36, 38, 40, 41]} />
      </div>
      <Card style={{ padding: "32px 36px" }}>
        <SectionHeader eyebrow="time series · 30d" title="播放与营收趋势" />
        <div
          style={{
            height: 240,
            display: "flex",
            alignItems: "flex-end",
            gap: 8,
          }}
        >
          {[...Array(30)].map((_, i) => {
            const h1 = 30 + Math.sin(i / 3) * 25 + i * 1.6;
            const h2 = 22 + Math.cos(i / 2.5) * 20 + i * 1.2;
            return (
              <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", gap: 2 }}>
                <div style={{ height: `${h1}%`, background: "var(--accent)", borderRadius: 2, opacity: 0.85 }} />
                <div style={{ height: `${h2}%`, background: "var(--extra-violet)", borderRadius: 2, opacity: 0.55 }} />
              </div>
            );
          })}
        </div>
        <div style={{ display: "flex", gap: 18, marginTop: 14, fontSize: 11, color: "var(--fg-2)", fontFamily: "var(--font-mono)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, background: "var(--accent)" }} /> 播放（百万次）
          </span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 10, height: 10, background: "var(--extra-violet)" }} /> 营收（万 ¥）
          </span>
        </div>
      </Card>
    </>
  );
}

function TrendsView() {
  return (
    <>
      <ViewHeader
        eyebrow="content radar"
        title={
          <>
            趋势{" "}
            <span className="text-gradient-gold" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
              雷达
            </span>
          </>
        }
        meta="来源 · 全网内容声量 + 站内观看停留"
      />
      <Card style={{ padding: "22px 24px" }}>
        {TRENDS.map((t, i) => (
          <div
            key={t.topic}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 18,
              padding: "16px 4px",
              borderBottom: i < TRENDS.length - 1 ? "1px solid var(--line)" : "none",
            }}
          >
            <div className="mono" style={{ width: 28, fontSize: 11, color: "var(--fg-3)" }}>
              {String(i + 1).padStart(2, "0")}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 500, color: "var(--fg-0)", marginBottom: 4, fontFamily: "var(--font-display)" }}>
                {t.topic}
              </div>
              <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-3)", letterSpacing: 0.4 }}>{t.windows}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 200, height: 6, background: "rgba(255,255,255,0.06)", borderRadius: "var(--radius-pill)", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${t.score}%`,
                    height: "100%",
                    background: "var(--gradient-gold)",
                  }}
                />
              </div>
              <div className="mono" style={{ width: 38, fontSize: 12, color: "var(--accent)", textAlign: "right" }}>{t.score}</div>
              <div className="mono" style={{ width: 40, fontSize: 11, color: t.delta.startsWith("-") ? "var(--danger)" : "var(--success)" }}>
                {t.delta}
              </div>
            </div>
          </div>
        ))}
      </Card>
    </>
  );
}

function SettingsView() {
  return (
    <>
      <ViewHeader
        eyebrow="studio settings"
        title={
          <>
            工作室{" "}
            <span className="text-gradient-gold" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
              设置
            </span>
          </>
        }
        meta="账户与计费 · 团队成员 · API 接入"
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        <Card style={{ padding: "26px 28px" }}>
          <SectionHeader eyebrow="account" title="账户与计费" />
          <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 13, color: "var(--fg-1)" }}>
            <Row label="工作室名称" value="星光工作室" />
            <Row label="账户级别" value="A 类 · MCN" tone="accent" />
            <Row label="本月积分预算" value="100,000 / 月" />
            <Row label="续费日" value="2026-06-12" />
          </div>
        </Card>
        <Card style={{ padding: "26px 28px" }}>
          <SectionHeader eyebrow="team" title="团队成员（4）" />
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {[
              { name: "李雨萱", role: "工作室运营", chip: "owner" as const },
              { name: "陈陌", role: "主创 / 脚本", chip: "writer" as const },
              { name: "周亦凡", role: "剪辑 / 上线", chip: "editor" as const },
              { name: "Aiko", role: "外协 / 演员", chip: "guest" as const },
            ].map((m) => (
              <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.02)", border: "1px solid var(--line)" }}>
                <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg-3)", border: "1px solid var(--line-2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, color: "var(--fg-1)" }}>
                  {m.name[0]}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: "var(--fg-0)" }}>{m.name}</div>
                  <div style={{ fontSize: 11, color: "var(--fg-2)" }}>{m.role}</div>
                </div>
                <div className="mono" style={{ fontSize: 10, color: "var(--fg-3)", letterSpacing: 0.5, textTransform: "uppercase" }}>{m.chip}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "accent" }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--line)", padding: "8px 0" }}>
      <div style={{ color: "var(--fg-2)", fontSize: 12 }}>{label}</div>
      <div style={{ color: tone === "accent" ? "var(--accent)" : "var(--fg-0)", fontFamily: "var(--font-mono)", fontSize: 12 }}>{value}</div>
    </div>
  );
}

// shared bits
function SectionHeader({ eyebrow, title, rightHref }: { eyebrow: string; title: string; rightHref?: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 18 }}>
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <div style={{ fontSize: 17, fontWeight: 600, fontFamily: "var(--font-display)", marginTop: 6 }}>{title}</div>
      </div>
      {rightHref && (
        <a href={rightHref} style={{ fontSize: 12, color: "var(--accent)", fontFamily: "var(--font-mono)", display: "inline-flex", alignItems: "center", gap: 4 }}>
          查看全部 <ArrowUpRight size={12} />
        </a>
      )}
    </div>
  );
}

function ViewHeader({
  eyebrow,
  title,
  meta,
  action,
}: {
  eyebrow: string;
  title: React.ReactNode;
  meta?: string;
  action?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, marginBottom: 4 }}>
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1 style={{ fontSize: 36, fontWeight: 700, letterSpacing: "var(--tracking-tight)", fontFamily: "var(--font-display)", margin: "10px 0 8px", lineHeight: 1.05 }}>
          {title}
        </h1>
        {meta && <div style={{ fontSize: 13.5, color: "var(--fg-2)" }}>{meta}</div>}
      </div>
      {action}
    </div>
  );
}

function CastRow({ c }: { c: typeof CAST[number] }) {
  return (
    <div style={{ display: "flex", gap: 14, padding: 14, borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.02)", border: "1px solid var(--line)" }}>
      <div style={{ width: 60, height: 80, borderRadius: "var(--radius-sm)", background: c.gradient, flexShrink: 0, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.4))" }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: "var(--fg-0)", fontFamily: "var(--font-display)" }}>{c.name}</div>
          <Chip tone={c.tone}>{c.fidelity}</Chip>
        </div>
        <div style={{ fontSize: 11.5, color: "var(--fg-2)", marginBottom: 10, lineHeight: 1.4 }}>{c.role}</div>
        <div className="mono" style={{ display: "flex", gap: 12, fontSize: 10.5, color: "var(--fg-3)", letterSpacing: 0.3 }}>
          <span>{c.series} 部剧集</span>
          <span style={{ color: "var(--fg-2)" }}>{c.plays}</span>
          <span style={{ color: "var(--accent)" }}>{c.revenue}</span>
        </div>
      </div>
    </div>
  );
}

function ProjectsTable({ rows }: { rows: typeof PROJECTS }) {
  return (
    <Card style={{ padding: "22px 24px" }}>
      <SectionHeader eyebrow="project pipeline" title="项目流水线" />
      <div style={{ overflow: "hidden", borderRadius: "var(--radius-md)", border: "1px solid var(--line)" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ background: "rgba(255,255,255,0.02)" }}>
              {["剧名", "类型", "集数进度", "主演", "状态", "排期"].map((h) => (
                <th key={h} className="eyebrow" style={{ textAlign: "left", padding: "12px 16px", borderBottom: "1px solid var(--line)", color: "var(--fg-2)", fontWeight: 500 }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p, i) => (
              <tr key={p.title} style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--line)" : "none" }}>
                <td style={{ padding: "14px 16px", color: "var(--fg-0)", fontWeight: 500, fontFamily: "var(--font-display)" }}>{p.title}</td>
                <td style={{ padding: "14px 16px", color: "var(--fg-1)" }}>{p.genre}</td>
                <td className="mono" style={{ padding: "14px 16px", color: "var(--fg-1)", fontSize: 12 }}>{p.episodes}</td>
                <td style={{ padding: "14px 16px", color: "var(--fg-1)" }}>{p.cast}</td>
                <td style={{ padding: "14px 16px" }}>
                  <Chip tone={p.tone}>● {p.status}</Chip>
                </td>
                <td className="mono" style={{ padding: "14px 16px", color: "var(--fg-2)", fontSize: 12 }}>{p.sched}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ScriptForge({ drafts, expanded }: { drafts: typeof SCRIPT_DRAFTS; expanded?: boolean }) {
  return (
    <Card glass style={{ padding: "22px 24px" }}>
      <SectionHeader eyebrow="script forge · ai assist" title="脚本工坊" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: expanded ? "repeat(2, 1fr)" : "repeat(3, 1fr)",
          gap: 14,
        }}
      >
        {drafts.map((s, i) => (
          <div key={s.title} style={{ padding: "16px 18px", borderRadius: "var(--radius-md)", background: "rgba(255,255,255,0.03)", border: "1px solid var(--line)" }}>
            <div className="mono" style={{ fontSize: 10, color: "var(--fg-3)", letterSpacing: 0.6, marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
              <span>DRAFT · {String(i + 1).padStart(2, "0")} · {s.series}</span>
              {expanded && <span>{s.updated}</span>}
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--fg-0)", marginBottom: 10, lineHeight: 1.4, fontFamily: "var(--font-display)" }}>
              {s.title}
            </div>
            <div style={{ fontSize: 12, color: "var(--fg-2)", lineHeight: 1.55, marginBottom: 14, fontStyle: "italic", fontFamily: "var(--font-serif)" }}>
              "{s.suggestion}"
            </div>
            <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, overflow: "hidden" }}>
              <div style={{ width: `${s.progress}%`, height: "100%", background: "var(--gradient-gold)" }} />
            </div>
            <div className="mono" style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: "var(--fg-3)", marginTop: 8, letterSpacing: 0.3 }}>
              <span>完成度</span>
              <span style={{ color: "var(--accent)" }}>{s.progress}%</span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// 顶层 hero（仅 overview）+ 路由分发
// ────────────────────────────────────────────────────────────────────────────

const TAB_META: Record<TabId, { icon: React.ElementType; label: string }> = {
  overview: { icon: BarChart3, label: "总览" },
  cast: { icon: Users, label: "演员 IP 阵容" },
  scripts: { icon: PenTool, label: "脚本工坊" },
  projects: { icon: Film, label: "项目流水线" },
  distribution: { icon: Share2, label: "多平台分发" },
  insights: { icon: BarChart3, label: "数据洞察" },
  trends: { icon: Compass, label: "趋势雷达" },
  settings: { icon: Settings, label: "工作室设置" },
};

interface PageProps {
  searchParams?: Promise<{ tab?: string }>;
}

export default async function DramaConsole({ searchParams }: PageProps) {
  const sp = (await searchParams) ?? {};
  const tab = resolveTab(sp.tab);

  let view: React.ReactNode;
  switch (tab) {
    case "cast":
      view = <CastView />;
      break;
    case "scripts":
      view = <ScriptsView />;
      break;
    case "projects":
      view = <ProjectsView />;
      break;
    case "distribution":
      view = <DistributionView />;
      break;
    case "insights":
      view = <InsightsView />;
      break;
    case "trends":
      view = <TrendsView />;
      break;
    case "settings":
      view = <SettingsView />;
      break;
    default:
      view = null;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      {tab === "overview" && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24 }}>
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
              <span className="text-gradient-gold" style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}>
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
      )}
      {tab === "overview" ? <OverviewView /> : view}
    </div>
  );
}

export { TAB_META };
export type { TabId };
