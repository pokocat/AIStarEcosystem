"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Award, Crown, Eye, Search, Shield, Sparkles, Star, Users, Users as UsersIcon, Wand2, X } from "lucide-react";
import type { Artist, ArtistStatus, ArtistQuality } from "@ai-star-eco/types/artist";
import { Button, Card, Chip, KpiCard } from "@/components/premium";
import {
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  StatusBadge,
  ViewHeader,
} from "@/components/common";
import { useAsync, invalidate } from "@/lib/drama-query";
import { ArtistsApi } from "@/api";
import { ApiError } from "@ai-star-eco/api-client";
import {
  deriveCastView,
  formatCny,
  formatCompact,
  QUALITY_GRADIENT,
  QUALITY_LABEL,
  QUALITY_TONE,
  STATUS_LABEL,
} from "@/lib/cast-derive";
import { NewArtistDialog } from "./_dialogs/NewArtistDialog";

type StatusFilter = "all" | ArtistStatus;
type QualityFilter = "all" | ArtistQuality;

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string; icon: React.ElementType }> = [
  { id: "all", label: "全部", icon: Users },
  { id: "active", label: "在线", icon: Eye },
  { id: "trainee", label: "训练中", icon: Sparkles },
  { id: "debut", label: "出道期", icon: Star },
  { id: "rest", label: "休养", icon: Shield },
  { id: "retired", label: "归档", icon: Shield },
];

const QUALITY_FILTERS: Array<{ id: QualityFilter; label: string; icon: React.ElementType }> = [
  { id: "all", label: "全等级", icon: Shield },
  { id: "legendary", label: "S 类", icon: Crown },
  { id: "epic", label: "A 类", icon: Award },
  { id: "rare", label: "B 类", icon: Star },
];

const STATUS_TONE: Record<ArtistStatus, "success" | "info" | "violet" | "accent" | "neutral"> = {
  active: "success",
  trainee: "info",
  debut: "violet",
  rest: "accent",
  retired: "neutral",
};

export default function CastListPage() {
  return (
    <React.Suspense fallback={null}>
      <CastListInner />
    </React.Suspense>
  );
}

function CastListInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // URL 持久化：?q=&status=&quality=
  const qInit = searchParams.get("q") ?? "";
  const statusInit = (searchParams.get("status") as StatusFilter) ?? "all";
  const qualityInit = (searchParams.get("quality") as QualityFilter) ?? "all";

  const [q, setQ] = React.useState(qInit);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>(statusInit);
  const [qualityFilter, setQualityFilter] = React.useState<QualityFilter>(qualityInit);
  const [showNew, setShowNew] = React.useState(false);
  const [archiveTarget, setArchiveTarget] = React.useState<Artist | null>(null);

  // 同步 URL（不重渲，不替换 history）
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (qualityFilter !== "all") params.set("quality", qualityFilter);
    const newUrl = params.toString() ? `?${params.toString()}` : "";
    window.history.replaceState(null, "", `/cast${newUrl}`);
  }, [q, statusFilter, qualityFilter]);

  const artistsQ = useAsync<Artist[]>("/me/artists", () => ArtistsApi.listArtists());
  const all = artistsQ.data ?? [];

  const filtered = React.useMemo(() => {
    return all.filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (qualityFilter !== "all" && a.quality !== qualityFilter) return false;
      if (q) {
        const needle = q.toLowerCase();
        if (!a.name.toLowerCase().includes(needle) && !a.bio.toLowerCase().includes(needle))
          return false;
      }
      return true;
    });
  }, [all, q, statusFilter, qualityFilter]);

  const active = all.filter((a) => a.status === "active").length;
  const trainee = all.filter((a) => a.status === "trainee").length;
  const sClass = all.filter((a) => a.quality === "legendary").length;
  const totalRevenue = all.reduce((sum, a) => sum + a.stats.revenue, 0);

  async function handleArchive() {
    if (!archiveTarget) return;
    try {
      await ArtistsApi.archiveArtist(archiveTarget.id);
      invalidate("/me/artists");
      toast.success(`${archiveTarget.name} 已归档`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "归档失败");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <ViewHeader
        eyebrow="跨项目 IP 资产"
        title="演员 IP 阵容"
        meta={`${all.length} 个 IP · ${active} 在线 · ${trainee} 训练中 · 跨项目复用`}
        action={
          <Button variant="primary" size="md" onClick={() => setShowNew(true)}>
            <Wand2 size={14} />
            新增演员
          </Button>
        }
      />

      {/* 与短剧工坊 角色与资产 的职能分工 */}
      <div
        className="card row gap-3"
        style={{
          padding: "12px 16px",
          background: "var(--surface-2)",
          border: "1px solid var(--line-soft)",
          alignItems: "center",
        }}
      >
        <UsersIcon size={16} style={{ color: "var(--accent)", flex: "none" }} />
        <div className="grow" style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
          这里是<b style={{ color: "var(--ink)" }}>跨项目的演员 IP 库</b>:可以反复在不同短剧里出演。
          要给某部短剧的<b style={{ color: "var(--ink)" }}>角色绑数字人</b>,请到「我的短剧 → 进入项目 → 角色与资产」阶段。
        </div>
        <Link href="/projects" style={{ textDecoration: "none" }}>
          <button type="button" className="btn btn-line btn-sm">去做短剧 →</button>
        </Link>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KpiCard label="在线 · 全部" value={String(active)} tone="success" delta={`${all.length} 总数`} />
        <KpiCard label="训练中" value={String(trainee)} tone="info" delta="孵化营 · 在岗" />
        <KpiCard label="S 类 · Legendary" value={String(sClass)} tone="accent" delta="顶级 IP" />
        <KpiCard label="累计营收" value={formatCny(totalRevenue)} tone="violet" delta="历史汇总" />
      </div>

      {/* 搜索 + 过滤 */}
      <Card style={{ padding: "16px 18px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--line-2)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <Search size={14} color="var(--fg-2)" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="按演员名 / 简介关键字搜索…"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                color: "var(--fg-0)",
                fontSize: 13,
                outline: "none",
                fontFamily: "var(--font-sans)",
              }}
            />
            {q && (
              <button
                onClick={() => setQ("")}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--fg-3)",
                  cursor: "pointer",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
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
                  padding: "6px 12px",
                  borderRadius: "var(--radius-pill)",
                  border: active
                    ? "1px solid color-mix(in srgb, var(--accent) 50%, transparent)"
                    : "1px solid var(--line-2)",
                  background: active ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "transparent",
                  color: active ? "var(--accent)" : "var(--fg-1)",
                  fontSize: 12,
                  fontFamily: "var(--font-sans)",
                  cursor: "pointer",
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
                  padding: "6px 12px",
                  borderRadius: "var(--radius-pill)",
                  border: active
                    ? "1px solid color-mix(in srgb, var(--extra-violet) 50%, transparent)"
                    : "1px solid var(--line-2)",
                  background: active
                    ? "color-mix(in srgb, var(--extra-violet) 12%, transparent)"
                    : "transparent",
                  color: active ? "var(--extra-violet)" : "var(--fg-1)",
                  fontSize: 12,
                  fontFamily: "var(--font-sans)",
                  cursor: "pointer",
                }}
              >
                <Icon size={12} />
                {f.label}
              </button>
            );
          })}
        </div>
      </Card>

      {/* 列表 */}
      {artistsQ.isLoading && <LoadingBlock rows={3} height={140} />}
      {!!artistsQ.error && <ErrorBlock onRetry={artistsQ.refetch} />}
      {!artistsQ.isLoading && !artistsQ.error && filtered.length === 0 && (
        <EmptyState
          icon={<Users size={28} />}
          title="没有匹配的演员"
          description={q ? `没有找到与「${q}」相关的演员，试试清除筛选条件。` : "你的演员阵容里还没有 IP，先创建第一个吧。"}
          action={
            <>
              {(q || statusFilter !== "all" || qualityFilter !== "all") && (
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setQ("");
                    setStatusFilter("all");
                    setQualityFilter("all");
                  }}
                >
                  清除筛选
                </Button>
              )}
              <Button variant="primary" size="md" onClick={() => setShowNew(true)}>
                <Wand2 size={14} />
                新增演员
              </Button>
            </>
          }
        />
      )}

      {!artistsQ.isLoading && filtered.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
          {filtered.map((a) => {
            const v = deriveCastView(a);
            return (
              <Card
                key={a.id}
                style={{
                  padding: 0,
                  overflow: "hidden",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  transition: "border-color 140ms ease, transform 140ms ease",
                }}
                onClick={() => router.push(`/cast/${encodeURIComponent(a.id)}`)}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor =
                    "color-mix(in srgb, var(--accent) 35%, transparent)";
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor = "var(--line)";
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                }}
              >
                <div
                  style={{
                    height: 168,
                    background: QUALITY_GRADIENT[a.quality],
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.5))",
                    }}
                  />
                  <div style={{ position: "absolute", top: 12, right: 12, display: "flex", gap: 6 }}>
                    <StatusBadge tone={STATUS_TONE[a.status]}>{STATUS_LABEL[a.status]}</StatusBadge>
                  </div>
                  <div style={{ position: "absolute", bottom: 12, left: 14, right: 14 }}>
                    <div
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: "#fff",
                        fontFamily: "var(--font-display)",
                        marginBottom: 2,
                      }}
                    >
                      {a.name}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <Chip tone={QUALITY_TONE[a.quality]}>{QUALITY_LABEL[a.quality]}</Chip>
                    </div>
                  </div>
                </div>

                <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ fontSize: 12, color: "var(--fg-1)", lineHeight: 1.5, minHeight: 36 }}>
                    {a.bio.length > 56 ? `${a.bio.slice(0, 56)}…` : a.bio}
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
                    <span>{v.series} 部剧集</span>
                    <span>{v.plays} 播放</span>
                    <span style={{ color: "var(--accent)" }}>{v.revenue}</span>
                  </div>

                  <div style={{ display: "flex", gap: 6, marginTop: "auto", paddingTop: 8 }}>
                    <Button
                      variant="primary"
                      size="sm"
                      style={{ flex: 1 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/cast/${encodeURIComponent(a.id)}/generate`);
                      }}
                    >
                      <Sparkles size={12} />
                      生成新形象
                    </Button>
                    {a.status !== "retired" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setArchiveTarget(a);
                        }}
                      >
                        归档
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <NewArtistDialog
        open={showNew}
        onOpenChange={setShowNew}
        onCreated={(a) => {
          invalidate("/me/artists");
          toast.success(`演员「${a.name}」已加入阵容`);
          router.push(`/cast/${encodeURIComponent(a.id)}`);
        }}
      />

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(o) => !o && setArchiveTarget(null)}
        title={`归档「${archiveTarget?.name ?? ""}」`}
        description="归档后该演员将不再出现在选角池中，但历史作品和数据仍然可见。可随时恢复。"
        destructive
        confirmLabel="归档"
        onConfirm={handleArchive}
      />
    </div>
  );
}
