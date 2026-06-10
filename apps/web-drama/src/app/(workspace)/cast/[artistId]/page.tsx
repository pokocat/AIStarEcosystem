"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Calendar,
  Heart,
  Sparkles,
  TrendingUp,
  Wand2,
  Archive,
  PlayCircle,
} from "lucide-react";
import type { Artist } from "@ai-star-eco/types/artist";
import { Button, Card, Chip, KpiCard } from "@/components/premium";
import {
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  Field,
  LoadingBlock,
  SectionHeader,
  StatusBadge,
  TextInput,
  TextArea,
  ViewHeader,
} from "@/components/common";
import { useAsync, invalidate } from "@/lib/drama-query";
import { ArtistsApi } from "@/api";
import { ApiError } from "@ai-star-eco/api-client";
import { ImportAvatarDialog } from "../_dialogs/ImportAvatarDialog";
import {
  formatCny,
  formatCompact,
  QUALITY_GRADIENT,
  QUALITY_LABEL,
  QUALITY_TONE,
  STATUS_LABEL,
} from "@/lib/cast-derive";

interface PageProps {
  params: Promise<{ artistId: string }>;
}

export default function ArtistDetailPage({ params }: PageProps) {
  const { artistId } = React.use(params);
  const router = useRouter();

  const key = `/me/artists/${artistId}`;
  const q = useAsync<Artist | null>(key, () => ArtistsApi.getArtist(artistId));

  const [name, setName] = React.useState("");
  const [bio, setBio] = React.useState("");
  const [saving, setSaving] = React.useState(false);
  const [editing, setEditing] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);
  const [displayPickerOpen, setDisplayPickerOpen] = React.useState(false);

  React.useEffect(() => {
    if (q.data) {
      setName(q.data.name);
      setBio(q.data.bio);
    }
  }, [q.data]);

  if (q.isLoading) return <LoadingBlock rows={3} height={120} label="加载演员档案…" />;
  if (q.error) return <ErrorBlock onRetry={q.refetch} />;
  if (!q.data) {
    return (
      <EmptyState
        icon={<Sparkles size={28} />}
        title="演员不存在"
        description="该演员可能已被归档或删除。"
        action={
          <Button variant="primary" size="md" onClick={() => router.push("/cast")}>
            返回阵容
          </Button>
        }
      />
    );
  }

  const a = q.data;

  async function save() {
    setSaving(true);
    try {
      await ArtistsApi.patchArtist(a.id, { name: name.trim() || a.name, bio: bio.trim() || a.bio });
      invalidate(key);
      invalidate("/me/artists");
      toast.success("已保存");
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    try {
      await ArtistsApi.archiveArtist(a.id);
      invalidate(key);
      invalidate("/me/artists");
      toast.success(`${a.name} 已归档`);
      router.push("/cast");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "归档失败");
    }
  }

  async function activate() {
    try {
      await ArtistsApi.activateArtist(a.id);
      invalidate(key);
      invalidate("/me/artists");
      toast.success(`${a.name} 已重新上线`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "操作失败");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <button
        onClick={() => router.push("/cast")}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          fontSize: 12,
          color: "var(--fg-2)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          alignSelf: "flex-start",
        }}
      >
        <ArrowLeft size={12} /> 返回阵容
      </button>

      {/* Hero */}
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <div
          style={{
            height: 200,
            background: a.dapDisplayImageUrl
              ? `url(${JSON.stringify(a.dapDisplayImageUrl)}) center 18% / cover no-repeat`
              : QUALITY_GRADIENT[a.quality],
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "linear-gradient(180deg, transparent 35%, rgba(0,0,0,0.55))",
            }}
          />
          <div style={{ position: "absolute", top: 16, right: 16, display: "flex", gap: 8, alignItems: "center" }}>
            {a.dapAvatarId && (
              <button
                onClick={() => setDisplayPickerOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 10px",
                  borderRadius: "var(--radius-pill)",
                  border: "1px solid rgba(255,255,255,0.35)",
                  background: "rgba(0,0,0,0.35)",
                  color: "#fff",
                  fontSize: 11,
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                }}
              >
                <Sparkles size={11} /> 更换展示图
              </button>
            )}
            <StatusBadge tone={a.status === "active" ? "success" : a.status === "retired" ? "neutral" : "info"}>
              {STATUS_LABEL[a.status]}
            </StatusBadge>
            <Chip tone={QUALITY_TONE[a.quality]}>{QUALITY_LABEL[a.quality]}</Chip>
          </div>
          <div style={{ position: "absolute", bottom: 20, left: 28 }}>
            <div className="eyebrow" style={{ color: "#f8f3e8" }}>
              ARTIST IP · {a.type}
            </div>
            <h1
              style={{
                fontSize: 40,
                fontWeight: 700,
                color: "#fff",
                fontFamily: "var(--font-display)",
                margin: "8px 0 0",
                letterSpacing: -0.5,
              }}
            >
              {a.name}
            </h1>
          </div>
        </div>

        <div
          style={{
            padding: "20px 28px",
            display: "flex",
            gap: 14,
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div className="mono" style={{ fontSize: 11, color: "var(--fg-3)", letterSpacing: 0.4 }}>
            创建 {a.createdAt.slice(0, 10)} · 最近活跃 {a.lastActive.slice(0, 10)}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button
              variant="secondary"
              size="md"
              onClick={() => router.push(`/cast/${encodeURIComponent(a.id)}/generate`)}
            >
              <Wand2 size={14} />
              生成新形象
            </Button>
            <Button
              variant="ghost"
              size="md"
              onClick={() => toast.info("演员档期排期 v0.7")}
            >
              <Calendar size={14} />
              查看档期
            </Button>
            {a.status !== "retired" ? (
              <Button variant="danger" size="md" onClick={() => setArchiveOpen(true)}>
                <Archive size={14} />
                归档
              </Button>
            ) : (
              <Button variant="primary" size="md" onClick={activate}>
                <PlayCircle size={14} />
                重新上线
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KpiCard label="参演剧集" value={String(a.stats.dramas)} tone="violet" />
        <KpiCard label="粉丝数" value={formatCompact(a.stats.fans)} tone="info" />
        <KpiCard label="累计营收" value={formatCny(a.stats.revenue)} tone="accent" />
        <KpiCard label="人气指数" value={`${a.stats.popularity}`} tone="success" delta="/ 100" />
      </div>

      {/* 主体两栏 */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <Card style={{ padding: "24px 26px" }}>
          <SectionHeader
            eyebrow="档案"
            title="档案"
            right={
              !editing && (
                <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
                  编辑
                </Button>
              )
            }
          />
          {editing ? (
            <>
              <Field label="艺名" required>
                <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={32} />
              </Field>
              <Field label="简介" hint="≤ 200 字">
                <TextArea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={200} rows={4} />
              </Field>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <Button variant="ghost" size="md" onClick={() => setEditing(false)} disabled={saving}>
                  取消
                </Button>
                <Button variant="primary" size="md" loading={saving} onClick={save}>
                  保存
                </Button>
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13.5, color: "var(--fg-1)", lineHeight: 1.65, marginBottom: 16 }}>
                {a.bio}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {a.domains.map((d) => (
                  <Chip key={d} tone="neutral">
                    {d}
                  </Chip>
                ))}
              </div>
            </>
          )}
        </Card>

        <Card style={{ padding: "22px 24px" }}>
          <SectionHeader eyebrow="才艺矩阵" title="才艺六维" />
          {(["acting", "singing", "dancing", "hosting", "comedy", "variety"] as const).map((k) => {
            const v = a.talents[k];
            const label = {
              acting: "演技",
              singing: "唱功",
              dancing: "舞蹈",
              hosting: "主持",
              comedy: "喜剧",
              variety: "综艺",
            }[k];
            return (
              <div key={k} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: "var(--fg-2)" }}>{label}</span>
                  <span className="mono" style={{ color: "var(--accent)" }}>
                    {v}
                  </span>
                </div>
                <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: "var(--radius-pill)" }}>
                  <div
                    style={{
                      width: `${v}%`,
                      height: "100%",
                      background: "var(--gradient-gold)",
                      borderRadius: "var(--radius-pill)",
                    }}
                  />
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      {/* v0.60：更换数字人展示图（引用指针，AiAvatar 渲染新图后自动跟随） */}
      <ImportAvatarDialog
        open={displayPickerOpen}
        onOpenChange={setDisplayPickerOpen}
        existingArtist={a}
        onUpdated={() => {
          invalidate(key);
          invalidate("/me/artists");
        }}
      />

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`归档「${a.name}」`}
        description="归档后该演员不再出现在选角池中。历史数据保留，可随时恢复。"
        destructive
        confirmLabel="归档"
        onConfirm={archive}
      />
    </div>
  );
}
