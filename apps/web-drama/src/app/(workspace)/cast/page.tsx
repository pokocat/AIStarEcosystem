"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { Archive, ExternalLink, PlayCircle, Search, Sparkles, Users, Users as UsersIcon, Wand2, X } from "lucide-react";
import type { Artist, ArtistStatus } from "@ai-star-eco/types/artist";
import { Button, Card } from "@/components/premium";
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
import { dapAvatarDeepLink } from "@/api/dap-avatars";
import { ApiError } from "@ai-star-eco/api-client";
import { QUALITY_GRADIENT } from "@/lib/cast-derive";
import { ImportAvatarDialog } from "./_dialogs/ImportAvatarDialog";
import { CAST_STATUS_LABEL, CAST_STATUS_TONE, ARCHIVE_DESCRIPTION } from "./_cast-labels";

// v0.197：这一页原来照搬音乐线的偶像孵化指标（在线 / 训练中 / 出道期 / S·A·B 类 / 累计营收），
// 从 AiAvatar 导入的数字人一律是 active + common，这些筛选和统计对真实用户永远是空或 0 → 去掉。
// 「生成新形象」原来进已下线的形象锻造炉（出假图）→ 改成去 AiAvatar 做新造型的外链。
type StatusFilter = "all" | "active" | "retired";

const STATUS_FILTERS: Array<{ id: StatusFilter; label: string }> = [
  { id: "all", label: "全部" },
  { id: "active", label: "在用" },
  { id: "retired", label: "已归档" },
];

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

  // URL 持久化：?q=&status=
  const qInit = searchParams.get("q") ?? "";
  const rawStatus = searchParams.get("status");
  const statusInit: StatusFilter = rawStatus === "active" || rawStatus === "retired" ? rawStatus : "all";

  const [q, setQ] = React.useState(qInit);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>(statusInit);
  const [showNew, setShowNew] = React.useState(false);
  const [archiveTarget, setArchiveTarget] = React.useState<Artist | null>(null);

  // 同步 URL（不重渲，不替换 history）
  React.useEffect(() => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (statusFilter !== "all") params.set("status", statusFilter);
    const newUrl = params.toString() ? `?${params.toString()}` : "";
    window.history.replaceState(null, "", `/cast${newUrl}`);
  }, [q, statusFilter]);

  const artistsQ = useAsync<Artist[]>("/me/artists", () => ArtistsApi.listArtists());
  const all = artistsQ.data ?? [];

  const filtered = React.useMemo(() => {
    return all.filter((a) => {
      if (statusFilter === "retired" && a.status !== "retired") return false;
      if (statusFilter === "active" && a.status === "retired") return false;
      if (q) {
        const needle = q.toLowerCase();
        if (!a.name.toLowerCase().includes(needle) && !(a.bio ?? "").toLowerCase().includes(needle))
          return false;
      }
      return true;
    });
  }, [all, q, statusFilter]);

  const retiredN = all.filter((a) => a.status === "retired").length;
  const filtering = !!q || statusFilter !== "all";

  async function handleArchive() {
    if (!archiveTarget) return;
    try {
      await ArtistsApi.archiveArtist(archiveTarget.id);
      invalidate("/me/artists");
      toast.success(`已归档「${archiveTarget.name}」`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "归档失败，请重试");
    }
  }

  async function handleRestore(a: Artist) {
    try {
      await ArtistsApi.activateArtist(a.id);
      invalidate("/me/artists");
      toast.success(`已恢复「${a.name}」`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "恢复失败，请重试");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <ViewHeader
        eyebrow="从 AiAvatar 导入的数字人"
        title="数字人演员"
        meta={`共 ${all.length} 位${retiredN > 0 ? `，其中 ${retiredN} 位已归档` : ""}`}
        action={
          <Button variant="primary" size="md" onClick={() => setShowNew(true)} style={{ flex: "none" }}>
            <Wand2 size={14} />
            从 AiAvatar 导入数字人
          </Button>
        }
      />

      {/* 和短剧里「角色绑定数字人」的关系：绑定时直接从 AiAvatar 的数字人里选，不经过这里 */}
      <div
        className="card row gap-3 mk-cast-note"
        style={{
          padding: "12px 16px",
          background: "var(--surface-2)",
          border: "1px solid var(--line-soft)",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <UsersIcon size={16} style={{ color: "var(--accent)", flex: "none" }} />
        <div style={{ flex: "1 1 240px", minWidth: 0, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
          {"这里放你从 AiAvatar（数字人平台）导入的数字人，可以统一改名字、换封面。给某部短剧的角色"}
          <b style={{ color: "var(--ink)" }}>绑定数字人</b>
          {"：到「我的短剧」打开那部短剧，在「短剧设定」的角色卡上点「绑定数字人」，直接从你在 AiAvatar 的数字人里选，不用先导入到这里。"}
        </div>
        <Link href="/projects" style={{ textDecoration: "none", flex: "none" }}>
          <button type="button" className="btn btn-line btn-sm">去我的短剧</button>
        </Link>
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
              minWidth: 0,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: "rgba(255,255,255,0.03)",
              border: "1px solid var(--line-2)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <Search size={14} color="var(--fg-2)" style={{ flex: "none" }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="搜演员名或简介"
              aria-label="搜索演员"
              style={{
                flex: 1,
                minWidth: 0,
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
                aria-label="清空搜索"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--fg-3)",
                  cursor: "pointer",
                  flex: "none",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {STATUS_FILTERS.map((f) => {
            const active = statusFilter === f.id;
            return (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                className="mk-tap"
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
          title={filtering ? "没有匹配的演员" : "还没有数字人演员"}
          description={
            q
              ? `没找到和「${q}」有关的演员，换个词或清掉筛选。`
              : filtering
                ? "这个分类下还没有演员。"
                : "先在 AiAvatar 做好数字人，再回这里导入。"
          }
          action={
            <>
              {filtering && (
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => {
                    setQ("");
                    setStatusFilter("all");
                  }}
                >
                  清除筛选
                </Button>
              )}
              <Button variant="primary" size="md" onClick={() => setShowNew(true)}>
                <Wand2 size={14} />
                导入数字人
              </Button>
            </>
          }
        />
      )}

      {!artistsQ.isLoading && filtered.length > 0 && (
        <div className="mk-cast-grid">
          {filtered.map((a) => {
            const dramas = a.stats?.dramas ?? 0;
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
                  opacity: a.status === "retired" ? 0.72 : 1,
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
                    background: a.dapDisplayImageUrl
                      ? `url(${JSON.stringify(a.dapDisplayImageUrl)}) center 20% / cover no-repeat`
                      : QUALITY_GRADIENT[a.quality],
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
                    <StatusBadge tone={CAST_STATUS_TONE[a.status as ArtistStatus] ?? "neutral"}>
                      {CAST_STATUS_LABEL[a.status as ArtistStatus] ?? CAST_STATUS_LABEL.active}
                    </StatusBadge>
                  </div>
                  <div style={{ position: "absolute", bottom: 12, left: 14, right: 14 }}>
                    <div
                      title={a.name}
                      style={{
                        fontSize: 20,
                        fontWeight: 700,
                        color: "#fff",
                        fontFamily: "var(--font-display)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {a.name}
                    </div>
                  </div>
                </div>

                <div style={{ padding: "16px 18px", flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
                  <div
                    style={{
                      fontSize: 12,
                      color: a.bio ? "var(--fg-1)" : "var(--fg-3)",
                      lineHeight: 1.5,
                      minHeight: 36,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {a.bio || "还没写简介"}
                  </div>

                  {dramas > 0 && (
                    <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-3)", letterSpacing: 0.3 }}>
                      参演 {dramas} 部短剧
                    </div>
                  )}

                  <div style={{ display: "flex", gap: 6, marginTop: "auto", paddingTop: 8, flexWrap: "wrap" }}>
                    {a.dapAvatarId && (
                      <a
                        href={dapAvatarDeepLink(String(a.dapAvatarId), "looks")}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        style={{ textDecoration: "none", flex: "1 1 auto", minWidth: 0 }}
                        title="在 AiAvatar（数字人平台）里给这位数字人做新造型，新标签页打开"
                      >
                        <Button variant="secondary" size="sm" style={{ width: "100%", justifyContent: "center" }}>
                          <Sparkles size={12} />
                          去 AiAvatar 做新造型
                          <ExternalLink size={11} />
                        </Button>
                      </a>
                    )}
                    {a.status !== "retired" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setArchiveTarget(a);
                        }}
                      >
                        <Archive size={12} />
                        归档
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          void handleRestore(a);
                        }}
                      >
                        <PlayCircle size={12} />
                        恢复
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* v0.60 收敛：演员创建改为从 AiAvatar 导入数字人（取代本地孵化表单） */}
      <ImportAvatarDialog
        open={showNew}
        onOpenChange={setShowNew}
        defaultType="actor"
        importedAvatarIds={(artistsQ.data ?? [])
          .filter((a) => a.type === "actor" && a.dapAvatarId)
          .map((a) => String(a.dapAvatarId))}
        onImported={(a) => {
          invalidate("/me/artists");
          router.push(`/cast/${encodeURIComponent(a.id)}`);
        }}
      />

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(o) => !o && setArchiveTarget(null)}
        title={`归档「${archiveTarget?.name ?? ""}」`}
        description={ARCHIVE_DESCRIPTION}
        destructive
        confirmLabel="归档"
        onConfirm={handleArchive}
      />
    </div>
  );
}
