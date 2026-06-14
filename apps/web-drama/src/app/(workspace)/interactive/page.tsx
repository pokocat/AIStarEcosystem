"use client";

export const dynamic = "force-dynamic";

// 互动短剧列表 —— 剧情互动（互动剧）的入口。每部剧是一张「剧集分支图」。

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Flag, GitBranch, Layers, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button, Card, Chip, KpiCard } from "@/components/premium";
import { ConfirmDialog, EmptyState, ErrorBlock, LoadingBlock, StatusBadge, ViewHeader } from "@/components/common";
import { useAsync, invalidate } from "@/lib/drama-query";
import { ApiError } from "@ai-star-eco/api-client";
import * as InteractiveDramaApi from "@/api/interactive-drama";
import type { InteractiveSeriesSummary } from "@/api/interactive-drama";
import { NewSeriesDialog } from "./_components/NewSeriesDialog";
import { AiDraftDialog } from "./_components/AiDraftDialog";

const LIST_KEY = "/me/interactive/series";

export default function InteractiveListPage() {
  const router = useRouter();
  const [showNew, setShowNew] = React.useState(false);
  const [showAiDraft, setShowAiDraft] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<InteractiveSeriesSummary | null>(null);

  const q = useAsync<InteractiveSeriesSummary[]>(LIST_KEY, () => InteractiveDramaApi.listSeries());
  const all = q.data ?? [];

  const totalBranches = all.reduce((n, s) => n + s.branch_count, 0);
  const totalEndings = all.reduce((n, s) => n + s.ending_count, 0);
  const totalReady = all.reduce((n, s) => n + s.ready_count, 0);
  const totalEpisodes = all.reduce((n, s) => n + s.episode_count, 0);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await InteractiveDramaApi.deleteSeries(deleteTarget.id);
      invalidate(LIST_KEY);
      toast.success(`已删除「${deleteTarget.title}」`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "删除失败");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="剧情互动 · 互动剧"
        title="互动短剧"
        meta={`${all.length} 部 · ${totalBranches} 个互动点 · ${totalEndings} 个结局`}
        action={
          <div className="row gap-2">
            <Button variant="primary" size="md" onClick={() => setShowAiDraft(true)}>
              <Sparkles size={14} /> AI 起草
            </Button>
            <Button variant="secondary" size="md" onClick={() => setShowNew(true)}>
              <Plus size={14} /> 新建
            </Button>
          </div>
        }
      />

      <div
        className="card row gap-3"
        style={{ padding: "12px 16px", background: "var(--surface-2)", border: "1px solid var(--line-soft)", alignItems: "center" }}
      >
        <GitBranch size={16} style={{ color: "var(--accent)", flex: "none" }} />
        <div className="grow" style={{ fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
          互动发生在<b style={{ color: "var(--ink)" }}>剧集之间</b>：某集播完弹出选项，观众的选择决定下一集播哪条分支。
          这里只做<b style={{ color: "var(--ink)" }}>创作端</b> —— 配置剧集分支图、生成每集视频、导出互动配置；播放与分发交给社媒平台。
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KpiCard label="互动剧" value={String(all.length)} tone="accent" />
        <KpiCard label="互动决策点" value={String(totalBranches)} tone="violet" />
        <KpiCard label="结局" value={String(totalEndings)} tone="info" />
        <KpiCard label="已生成 / 总集数" value={`${totalReady} / ${totalEpisodes}`} tone="success" />
      </div>

      {q.isLoading && <LoadingBlock rows={3} height={120} />}
      {!!q.error && <ErrorBlock onRetry={q.refetch} />}
      {!q.isLoading && !q.error && all.length === 0 && (
        <EmptyState
          icon={<GitBranch size={28} />}
          title="还没有互动短剧"
          description="让 AI 起草一部，或从零新建，配置「某集播完 → 互动 → 下一集分支」的剧集图。"
          action={
            <div className="row gap-2">
              <Button variant="primary" size="md" onClick={() => setShowAiDraft(true)}>
                <Sparkles size={14} /> AI 起草
              </Button>
              <Button variant="secondary" size="md" onClick={() => setShowNew(true)}>
                <Plus size={14} /> 新建
              </Button>
            </div>
          }
        />
      )}

      {!q.isLoading && all.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {all.map((s) => (
            <Card
              key={s.id}
              style={{ padding: "18px 20px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 12 }}
              onClick={() => router.push(`/interactive/${encodeURIComponent(s.id)}`)}
              onMouseEnter={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "color-mix(in srgb, var(--accent) 30%, transparent)")}
              onMouseLeave={(e) => ((e.currentTarget as HTMLDivElement).style.borderColor = "var(--line)")}
            >
              <div className="row gap-2" style={{ alignItems: "flex-start" }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 16, fontWeight: 700, color: "var(--ink)", marginBottom: 6 }}>{s.title}</div>
                  <div className="row gap-2" style={{ flexWrap: "wrap" }}>
                    <Chip tone="neutral">{s.genre}</Chip>
                    <StatusBadge tone={s.status === "ready" ? "success" : "warning"}>
                      {s.status === "ready" ? "全部就绪" : "草稿"}
                    </StatusBadge>
                  </div>
                </div>
                <button
                  type="button"
                  title="删除"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteTarget(s);
                  }}
                  className="btn btn-icon btn-ghost btn-sm"
                  style={{ color: "var(--danger)", flex: "none" }}
                >
                  <Trash2 size={13} />
                </button>
              </div>

              <div
                className="row gap-3"
                style={{ flexWrap: "wrap", fontSize: 12, color: "var(--ink-2)", borderTop: "1px dashed var(--line)", paddingTop: 10 }}
              >
                <span className="row gap-1">
                  <Layers size={12} style={{ color: "var(--ink-3)" }} /> {s.episode_count} 集
                </span>
                <span className="row gap-1">
                  <GitBranch size={12} style={{ color: "var(--accent)" }} /> {s.branch_count} 互动点
                </span>
                <span className="row gap-1">
                  <Flag size={12} style={{ color: "var(--accent-2)" }} /> {s.ending_count} 结局
                </span>
                <span className="row gap-1">
                  <Sparkles size={12} style={{ color: "var(--success)" }} /> {s.ready_count}/{s.episode_count} 已生成
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <NewSeriesDialog
        open={showNew}
        onOpenChange={setShowNew}
        onCreated={(s) => {
          invalidate(LIST_KEY);
          toast.success(`已创建「${s.title}」`);
          router.push(`/interactive/${encodeURIComponent(s.id)}`);
        }}
      />

      <AiDraftDialog
        open={showAiDraft}
        onOpenChange={setShowAiDraft}
        onCreated={(s) => {
          invalidate(LIST_KEY);
          toast.success(`AI 已起草「${s.title}」`);
          router.push(`/interactive/${encodeURIComponent(s.id)}`);
        }}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`删除「${deleteTarget?.title ?? ""}」`}
        description="删除后这部互动剧的剧集分支图将不可恢复。"
        destructive
        confirmLabel="删除"
        onConfirm={handleDelete}
      />
    </div>
  );
}
