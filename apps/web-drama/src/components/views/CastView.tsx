"use client";

// 演员阵容全屏视图：影院级风格。
// 顶部：KPI 概览四张卡（在线 / 训练中 / S 类 / 30 日营收）。
// 中部：搜索框 + 状态过滤 + 品质过滤。
// 主体：3 列演员卡片网格，点击打开右侧详情抽屉。
// 抽屉：演员档案 + 才艺六维雷达图 + 出演剧集 + 单条数据条。

import * as React from "react";
import {
  ArrowUpRight,
  Award,
  Crown,
  Eye,
  Filter,
  Mic2,
  Search,
  Shield,
  Sparkles,
  Star,
  Theater,
  TrendingUp,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import type { Artist } from "@ai-star-eco/types/artist";
import type { Drama } from "@ai-star-eco/types/film";
import { Button, Card, Chip, KpiCard, Meter } from "@/components/premium";
import {
  deriveCastView,
  formatCny,
  formatCompact,
  QUALITY_LABEL,
  QUALITY_TONE,
  STATUS_LABEL,
  type CastTone,
} from "@/lib/cast-derive";
import { TalentRadar } from "./TalentRadar";

interface Props {
  artists: Artist[];
  dramas: Drama[];
}

type StatusFilter = "all" | Artist["status"];
type QualityFilter = "all" | Artist["quality"];

const STATUS_FILTERS: { id: StatusFilter; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "全部", icon: Users },
  { id: "active", label: "在线", icon: Eye },
  { id: "trainee", label: "训练中", icon: Sparkles },
  { id: "debut", label: "出道期", icon: Star },
];

const QUALITY_FILTERS: { id: QualityFilter; label: string; icon: LucideIcon }[] = [
  { id: "all", label: "全等级", icon: Shield },
  { id: "legendary", label: "S 类", icon: Crown },
  { id: "epic", label: "A 类", icon: Award },
  { id: "rare", label: "B 类", icon: Star },
];

const DOMAIN_ICON: Record<string, LucideIcon> = {
  影视: Theater,
  音乐: Mic2,
  舞台表演: Star,
  商业代言: TrendingUp,
};

export function CastView({ artists, dramas }: Props) {
  const [query, setQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [qualityFilter, setQualityFilter] = React.useState<QualityFilter>("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return artists.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (qualityFilter !== "all" && a.quality !== qualityFilter) return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.bio.toLowerCase().includes(q) ||
        (a.domains ?? []).some((d) => d.toLowerCase().includes(q))
      );
    });
  }, [artists, query, statusFilter, qualityFilter]);

  const stats = React.useMemo(() => {
    const total = artists.length;
    const online = artists.filter((a) => a.status === "active").length;
    const training = artists.filter((a) => a.status === "trainee").length;
    const sClass = artists.filter((a) => a.quality === "legendary" || a.quality === "epic").length;
    const monthly = artists.reduce((sum, a) => sum + (a.stats.monthlyRevenue ?? 0), 0);
    return { total, online, training, sClass, monthly };
  }, [artists]);

  const selected = React.useMemo(
    () => (selectedId ? artists.find((a) => a.id === selectedId) ?? null : null),
    [artists, selectedId],
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* 视图标题 */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: 24,
        }}
      >
        <div>
          <div className="eyebrow">演员阵容 · 全部签约 IP</div>
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
            演员 IP{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              阵容
            </span>
          </h1>
          <div style={{ fontSize: 13.5, color: "var(--fg-2)", lineHeight: 1.55 }}>
            共 {stats.total} 位签约演员 · {stats.online} 位在线 · {stats.training} 位训练中
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="secondary" size="md">
            <Filter size={14} /> 高级筛选
          </Button>
          <Button variant="primary" size="md">
            <Sparkles size={14} /> 训练新演员
          </Button>
        </div>
      </div>

      {/* KPI 概览 */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
        <KpiCard
          label="签约总数"
          value={String(stats.total)}
          delta={`${stats.online} 在线 · ${stats.training} 训练中`}
          tone="accent"
        />
        <KpiCard
          label="S / A 类"
          value={String(stats.sClass)}
          delta={`占比 ${Math.round((stats.sClass / Math.max(stats.total, 1)) * 100)}%`}
          tone="violet"
        />
        <KpiCard
          label="本月营收"
          value={formatCny(stats.monthly)}
          delta="累计全部演员"
          tone="success"
        />
        <KpiCard
          label="待签约位"
          value="3"
          delta="本月已开放招募"
          tone="info"
        />
      </div>

      {/* 搜索与过滤工具栏 */}
      <Card glass style={{ padding: "18px 22px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 14px",
              borderRadius: "var(--radius-md)",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid var(--line-2)",
              minWidth: 280,
              flex: "1 1 280px",
            }}
          >
            <Search size={14} color="var(--fg-2)" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索演员姓名、简介或擅长领域…"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--fg-0)",
                fontSize: 13,
                fontFamily: "var(--font-sans)",
              }}
            />
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {STATUS_FILTERS.map((f) => {
              const Icon = f.icon;
              const active = statusFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setStatusFilter(f.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 13px",
                    borderRadius: "var(--radius-pill)",
                    fontSize: 12,
                    fontFamily: "var(--font-sans)",
                    background: active
                      ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                      : "transparent",
                    border: active
                      ? "1px solid color-mix(in srgb, var(--accent) 50%, transparent)"
                      : "1px solid var(--line-2)",
                    color: active ? "var(--accent)" : "var(--fg-1)",
                    cursor: "pointer",
                    transition: "background 160ms, border-color 160ms",
                  }}
                >
                  <Icon size={12} />
                  {f.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {QUALITY_FILTERS.map((f) => {
              const Icon = f.icon;
              const active = qualityFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setQualityFilter(f.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 13px",
                    borderRadius: "var(--radius-pill)",
                    fontSize: 12,
                    fontFamily: "var(--font-sans)",
                    background: active
                      ? "color-mix(in srgb, var(--extra-violet) 12%, transparent)"
                      : "transparent",
                    border: active
                      ? "1px solid color-mix(in srgb, var(--extra-violet) 50%, transparent)"
                      : "1px solid var(--line-2)",
                    color: active ? "var(--extra-violet)" : "var(--fg-1)",
                    cursor: "pointer",
                    transition: "background 160ms, border-color 160ms",
                  }}
                >
                  <Icon size={12} />
                  {f.label}
                </button>
              );
            })}
          </div>

          <div
            className="mono"
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: "var(--fg-2)",
              letterSpacing: 0.4,
            }}
          >
            匹配 {filtered.length} / {artists.length}
          </div>
        </div>
      </Card>

      {/* 演员卡片网格 */}
      {filtered.length === 0 ? (
        <Card glass style={{ padding: "60px 24px", textAlign: "center" }}>
          <div className="eyebrow">无匹配结果</div>
          <div style={{ fontSize: 15, color: "var(--fg-1)", marginTop: 12 }}>
            没有找到符合条件的演员，调整搜索或过滤条件再试。
          </div>
        </Card>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {filtered.map((a) => {
            const c = deriveCastView(a);
            const active = selectedId === a.id;
            return (
              <button
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                style={{
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  padding: 0,
                  cursor: "pointer",
                  borderRadius: "var(--radius-lg)",
                  outline: active
                    ? "2px solid color-mix(in srgb, var(--accent) 70%, transparent)"
                    : "2px solid transparent",
                  outlineOffset: 2,
                  transition: "outline-color 160ms, transform 160ms",
                }}
              >
                <Card style={{ padding: 0, overflow: "hidden" }}>
                  <div style={{ height: 220, background: c.gradient, position: "relative" }}>
                    <div
                      style={{
                        position: "absolute",
                        inset: 0,
                        background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.65))",
                      }}
                    />
                    <div style={{ position: "absolute", top: 14, left: 14, display: "flex", gap: 6 }}>
                      <Chip tone={c.tone}>{QUALITY_LABEL[a.quality]}</Chip>
                      <Chip tone="neutral">{STATUS_LABEL[a.status]}</Chip>
                    </div>
                    <div
                      style={{
                        position: "absolute",
                        top: 14,
                        right: 14,
                        fontFamily: "var(--font-mono)",
                        fontSize: 10,
                        letterSpacing: 0.6,
                        color: "rgba(255,255,255,0.7)",
                      }}
                    >
                      LV {a.level}
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
                        {a.name}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--fg-1)", marginTop: 4 }}>{c.role}</div>
                    </div>
                  </div>
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--fg-3)" }}>保真度</div>
                        <div
                          style={{
                            fontFamily: "var(--font-display)",
                            fontSize: 18,
                            color: "var(--fg-0)",
                            fontWeight: 600,
                          }}
                        >
                          {c.fidelity}
                        </div>
                      </div>
                      <ArrowUpRight size={14} color="var(--fg-3)" />
                    </div>
                    <div
                      className="mono"
                      style={{
                        display: "flex",
                        gap: 12,
                        fontSize: 10.5,
                        color: "var(--fg-3)",
                        marginTop: 10,
                        letterSpacing: 0.3,
                      }}
                    >
                      <span>{c.series} 部剧集</span>
                      <span style={{ color: "var(--fg-2)" }}>{c.plays}</span>
                      <span style={{ color: "var(--accent)", marginLeft: "auto" }}>{c.revenue}</span>
                    </div>
                  </div>
                </Card>
              </button>
            );
          })}
        </div>
      )}

      {/* 详情抽屉（侧边） */}
      {selected && (
        <DetailDrawer
          artist={selected}
          dramas={dramas}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

interface DrawerProps {
  artist: Artist;
  dramas: Drama[];
  onClose: () => void;
}

function DetailDrawer({ artist, dramas, onClose }: DrawerProps) {
  const c = deriveCastView(artist);
  // 出演剧集匹配：Drama.role 字段在本 mock 里写了主演名（如 "苏念 + 陆烬"），
  // 用模糊包含匹配；后续 spec 加 Drama.castIds[] 后改 join。
  const myDramas = dramas.filter((d) => d.role && d.role.includes(artist.name));
  return (
    <div
      role="dialog"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        justifyContent: "flex-end",
      }}
    >
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
        }}
      />
      <div
        className="glass"
        style={{
          position: "relative",
          width: "min(560px, 100%)",
          height: "100%",
          background: "var(--bg-1)",
          borderLeft: "1px solid var(--line-2)",
          overflowY: "auto",
          padding: "26px 28px",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, marginBottom: 18 }}>
          <div>
            <div className="eyebrow">演员档案</div>
            <h2
              style={{
                fontSize: 28,
                fontFamily: "var(--font-display)",
                fontWeight: 700,
                margin: "8px 0 6px",
                letterSpacing: "var(--tracking-tight)",
              }}
            >
              {artist.name}
            </h2>
            <div style={{ display: "flex", gap: 8 }}>
              <Chip tone={c.tone}>{QUALITY_LABEL[artist.quality]}</Chip>
              <Chip tone="neutral">{STATUS_LABEL[artist.status]}</Chip>
              <Chip tone="info">LV {artist.level}</Chip>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: 8,
              border: "1px solid var(--line-2)",
              borderRadius: "var(--radius-md)",
              background: "transparent",
              color: "var(--fg-2)",
              cursor: "pointer",
            }}
          >
            <X size={14} />
          </button>
        </div>

        <div
          style={{
            height: 220,
            borderRadius: "var(--radius-md)",
            background: c.gradient,
            position: "relative",
            overflow: "hidden",
            marginBottom: 22,
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.55))",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 14,
              left: 16,
              right: 16,
              fontSize: 13,
              fontFamily: "var(--font-serif)",
              fontStyle: "italic",
              lineHeight: 1.5,
              color: "rgba(255,255,255,0.92)",
            }}
          >
            "{artist.bio}"
          </div>
        </div>

        {/* 才艺六维 */}
        <div className="eyebrow" style={{ marginBottom: 8 }}>才艺六维</div>
        <Card style={{ padding: "12px 6px", marginBottom: 22 }}>
          <TalentRadar talents={artist.talents} size={280} />
        </Card>

        {/* 数据条 */}
        <div className="eyebrow" style={{ marginBottom: 8 }}>商业表现</div>
        <Card style={{ padding: "20px 22px", marginBottom: 22 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 18, marginBottom: 18 }}>
            <Stat label="粉丝" value={formatCompact(artist.stats.fans)} />
            <Stat label="人气" value={`${artist.stats.popularity}`} />
            <Stat label="累计营收" value={formatCny(artist.stats.revenue)} />
            <Stat label="本月营收" value={formatCny(artist.stats.monthlyRevenue)} />
            <Stat label="商业代言" value={`${artist.endorsements ?? 0} 单`} />
            <Stat label="商业估值" value={formatCny(artist.commercialValue ?? 0)} />
          </div>
          <Meter label="形象保真度" value={c.fidelity} tone="accent" />
          <Meter
            label="经验进度"
            value={Math.min(100, Math.round((artist.exp / Math.max(artist.maxExp, 1)) * 100))}
            tone="violet"
            hint={`${artist.exp} / ${artist.maxExp} XP`}
          />
        </Card>

        {/* 出演剧集 */}
        <div className="eyebrow" style={{ marginBottom: 8 }}>出演剧集</div>
        {myDramas.length === 0 ? (
          <Card style={{ padding: "20px 22px", marginBottom: 22 }}>
            <div style={{ fontSize: 13, color: "var(--fg-2)" }}>
              暂无在产 / 已上线剧集。
            </div>
          </Card>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 22 }}>
            {myDramas.map((d) => (
              <Card key={d.id} style={{ padding: "14px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
                  <div
                    style={{
                      fontSize: 15,
                      fontWeight: 600,
                      fontFamily: "var(--font-display)",
                      color: "var(--fg-0)",
                    }}
                  >
                    {d.title}
                  </div>
                  <DramaStatusChip status={d.status} />
                </div>
                <div
                  className="mono"
                  style={{ display: "flex", gap: 14, fontSize: 11, color: "var(--fg-3)", letterSpacing: 0.3 }}
                >
                  <span>{d.genre}</span>
                  <span>{d.episodes > 0 ? `${d.episodes} 集` : "—"}</span>
                  {d.views > 0 && <span style={{ color: "var(--fg-2)" }}>{formatCompact(d.views)} 播放</span>}
                  {d.revenue > 0 && <span style={{ color: "var(--accent)", marginLeft: "auto" }}>{formatCny(d.revenue)}</span>}
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* 擅长领域 */}
        {artist.domains && artist.domains.length > 0 && (
          <>
            <div className="eyebrow" style={{ marginBottom: 8 }}>擅长领域</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 22 }}>
              {artist.domains.map((d) => {
                const Icon = DOMAIN_ICON[d] ?? Star;
                return (
                  <div
                    key={d}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: "var(--radius-pill)",
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid var(--line)",
                      fontSize: 12,
                      color: "var(--fg-1)",
                    }}
                  >
                    <Icon size={12} color="var(--accent)" />
                    {d}
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div style={{ display: "flex", gap: 10 }}>
          <Button variant="primary" size="md" style={{ flex: 1 }}>
            <Sparkles size={14} /> 安排新剧集
          </Button>
          <Button variant="secondary" size="md">
            形象编辑
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          fontFamily: "var(--font-display)",
          color: "var(--fg-0)",
          letterSpacing: "var(--tracking-tight)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

const DRAMA_STATUS_TONE_MAP: Record<Drama["status"], CastTone> = {
  released: "success",
  filming: "info",
  "post-production": "accent",
  casting: "violet",
};

const DRAMA_STATUS_LABEL_MAP: Record<Drama["status"], string> = {
  released: "在线",
  filming: "拍摄中",
  "post-production": "后期",
  casting: "选角",
};

function DramaStatusChip({ status }: { status: Drama["status"] }) {
  return <Chip tone={DRAMA_STATUS_TONE_MAP[status]}>{DRAMA_STATUS_LABEL_MAP[status]}</Chip>;
}
