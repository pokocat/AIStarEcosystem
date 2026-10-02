"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Image as ImageIcon, Sparkles, Archive, PlayCircle } from "lucide-react";
import type { Artist, ArtistStatus } from "@ai-star-eco/types/artist";
import { Button, Card, Chip } from "@/components/premium";
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
} from "@/components/common";
import { useAsync, invalidate } from "@/lib/drama-query";
import { ArtistsApi } from "@/api";
import { dapAvatarDeepLink } from "@/api/dap-avatars";
import { formatDateTime, ApiError } from "@ai-star-eco/api-client";
import { ImportAvatarDialog } from "../_dialogs/ImportAvatarDialog";
import { QUALITY_GRADIENT } from "@/lib/cast-derive";
import { ARCHIVE_DESCRIPTION, CAST_STATUS_LABEL, CAST_STATUS_TONE } from "../_cast-labels";

// v0.197：去掉照搬音乐线的 KPI（粉丝 / 营收 / 人气）、「才艺六维」和永远「开发中」的「查看档期」——
// 导入的数字人演员没有这些数据；「生成新形象」改成去 AiAvatar 做新造型的外链（原来进的是已下线的假锻造炉）。

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
      setBio(q.data.bio ?? "");
    }
  }, [q.data]);

  const backButton = (
    <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} onClick={() => router.push("/cast")}>
      <ArrowLeft size={14} /> 返回数字人演员
    </button>
  );

  if (q.isLoading) return <LoadingBlock rows={3} height={120} label="正在加载演员…" />;
  if (q.error) return <ErrorBlock onRetry={q.refetch} />;
  if (!q.data) {
    return (
      <EmptyState
        icon={<Sparkles size={28} />}
        title="找不到这位演员"
        description="可能已经被删除了。"
        action={
          <Button variant="primary" size="md" onClick={() => router.push("/cast")}>
            返回数字人演员
          </Button>
        }
      />
    );
  }

  const a = q.data;
  const statusLabel = CAST_STATUS_LABEL[a.status as ArtistStatus] ?? CAST_STATUS_LABEL.active;
  const statusTone = CAST_STATUS_TONE[a.status as ArtistStatus] ?? "neutral";

  async function save() {
    setSaving(true);
    try {
      await ArtistsApi.patchArtist(a.id, { name: name.trim() || a.name, bio: bio.trim() || a.bio });
      invalidate(key);
      invalidate("/me/artists");
      toast.success("已保存");
      setEditing(false);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "保存失败，请重试");
    } finally {
      setSaving(false);
    }
  }

  async function archive() {
    try {
      await ArtistsApi.archiveArtist(a.id);
      invalidate(key);
      invalidate("/me/artists");
      toast.success(`已归档「${a.name}」`);
      router.push("/cast");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "归档失败，请重试");
    }
  }

  async function activate() {
    try {
      await ArtistsApi.activateArtist(a.id);
      invalidate(key);
      invalidate("/me/artists");
      toast.success(`已恢复「${a.name}」`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "恢复失败，请重试");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {backButton}

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
          <div style={{ position: "absolute", top: 16, right: 16, left: 16, display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end", flexWrap: "wrap" }}>
            {a.dapAvatarId && (
              <button
                onClick={() => setDisplayPickerOpen(true)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "6px 11px",
                  minHeight: 30,
                  borderRadius: "var(--radius-pill)",
                  border: "1px solid rgba(255,255,255,0.35)",
                  background: "rgba(0,0,0,0.35)",
                  color: "#fff",
                  fontSize: 11.5,
                  cursor: "pointer",
                  fontFamily: "var(--font-sans)",
                }}
              >
                <ImageIcon size={12} /> 换封面图
              </button>
            )}
            <StatusBadge tone={statusTone}>{statusLabel}</StatusBadge>
          </div>
          <div className="mk-cast-hero-title" style={{ position: "absolute", bottom: 20, left: 28, right: 28 }}>
            <div className="eyebrow" style={{ color: "#f8f3e8" }}>
              数字人演员
            </div>
            <h1
              title={a.name}
              style={{
                fontSize: 40,
                fontWeight: 700,
                color: "#fff",
                fontFamily: "var(--font-display)",
                margin: "8px 0 0",
                letterSpacing: -0.5,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {a.name}
            </h1>
          </div>
        </div>

        <div
          className="mk-cast-hero-bar"
          style={{
            padding: "20px 28px",
            display: "flex",
            gap: 14,
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
          }}
        >
          <div className="mono" style={{ fontSize: 11, color: "var(--fg-3)", letterSpacing: 0.4, minWidth: 0 }}>
            导入于 {formatDateTime(a.createdAt)} · 最近更新 {formatDateTime(a.lastActive)}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {a.dapAvatarId && (
              <a
                href={dapAvatarDeepLink(String(a.dapAvatarId), "looks")}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: "none" }}
                title="在 AiAvatar（数字人平台）里给这位数字人做新造型，新标签页打开"
              >
                <Button variant="secondary" size="md">
                  <Sparkles size={14} />
                  去 AiAvatar 做新造型
                  <ExternalLink size={12} />
                </Button>
              </a>
            )}
            {a.status !== "retired" ? (
              <Button variant="danger" size="md" onClick={() => setArchiveOpen(true)}>
                <Archive size={14} />
                归档
              </Button>
            ) : (
              <Button variant="primary" size="md" onClick={activate}>
                <PlayCircle size={14} />
                恢复
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* 基本信息 */}
      <Card style={{ padding: "24px 26px" }}>
        <SectionHeader
          eyebrow="基本信息"
          title="名字和简介"
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
            <Field label="名字" required>
              <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={32} />
            </Field>
            <Field label="简介" hint="最多 200 字">
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
            <div style={{ fontSize: 13.5, color: a.bio ? "var(--fg-1)" : "var(--fg-3)", lineHeight: 1.65, marginBottom: 16 }}>
              {a.bio || "还没写简介。点「编辑」补一句这位演员适合演什么。"}
            </div>
            {(a.domains ?? []).length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(a.domains ?? []).map((d) => (
                  <Chip key={d} tone="neutral">
                    {d}
                  </Chip>
                ))}
              </div>
            )}
          </>
        )}
      </Card>

      {/* v0.60：换封面图（引用指针，AiAvatar 做了新图后自动跟随） */}
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
        description={ARCHIVE_DESCRIPTION}
        destructive
        confirmLabel="归档"
        onConfirm={archive}
      />
    </div>
  );
}
