"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, Copy, Download, Filter, PenTool, Plus, Search, Sparkles } from "lucide-react";
import type { Script, ScriptKind, ScriptStatus } from "@/types/script";
import { Button, Card, Chip, KpiCard } from "@/components/premium";
import {
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  SectionHeader,
  StatusBadge,
  ViewHeader,
} from "@/components/common";
import { ScriptsApi } from "@/api";
import { useAsync, invalidate } from "@/lib/drama-query";
import { ApiError } from "@ai-star-eco/api-client";
import { NewScriptDialog } from "./_dialogs/NewScriptDialog";

const KIND_LABEL: Record<ScriptKind, string> = {
  drama: "剧集",
  ad: "广告",
  trailer: "宣传片",
  voice: "配音",
};

const STATUS_LABEL: Record<ScriptStatus, string> = {
  draft: "草稿",
  review: "审稿中",
  approved: "已通过",
  archived: "已归档",
};

const STATUS_TONE: Record<ScriptStatus, "info" | "accent" | "success" | "neutral"> = {
  draft: "info",
  review: "accent",
  approved: "success",
  archived: "neutral",
};

type StatusFilter = "all" | ScriptStatus;

export default function ScriptsListPage() {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [showNew, setShowNew] = React.useState(false);
  const [archiveTarget, setArchiveTarget] = React.useState<Script | null>(null);

  const scriptsQ = useAsync<Script[]>("/me/scripts", () => ScriptsApi.listScripts());
  const all = scriptsQ.data ?? [];

  const filtered = React.useMemo(() => {
    return all.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (q) {
        const needle = q.toLowerCase();
        if (
          !s.title.toLowerCase().includes(needle) &&
          !(s.series ?? "").toLowerCase().includes(needle) &&
          !(s.suggestion ?? "").toLowerCase().includes(needle)
        )
          return false;
      }
      return true;
    });
  }, [all, q, statusFilter]);

  async function handleClone(s: Script) {
    try {
      const copy = await ScriptsApi.cloneScript(s.id);
      invalidate("/me/scripts");
      toast.success(`已克隆为「${copy.title}」`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "克隆失败");
    }
  }

  async function handleExport(s: Script) {
    try {
      const versions = await ScriptsApi.listVersionsByScript(s.id);
      const cur = versions.find((v) => v.id === s.currentVersionId) ?? versions[0];
      const content = cur?.content ?? "";
      const blob = new Blob([`Title: ${s.title}\n\n${content}`], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${s.title}.fountain`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("已导出 .fountain 文件");
    } catch (e) {
      toast.error("导出失败");
    }
  }

  async function handleArchive() {
    if (!archiveTarget) return;
    try {
      await ScriptsApi.archiveScript(archiveTarget.id);
      invalidate("/me/scripts");
      toast.success(`「${archiveTarget.title}」已归档`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "归档失败");
    }
  }

  const draftCount = all.filter((s) => s.status === "draft").length;
  const reviewCount = all.filter((s) => s.status === "review").length;
  const approvedCount = all.filter((s) => s.status === "approved").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="脚本工坊"
        title={
          <>
            脚本{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              工坊
            </span>
          </>
        }
        meta={`${all.length} 份脚本 · ${reviewCount} 待审`}
        action={
          <Button variant="primary" size="md" onClick={() => setShowNew(true)}>
            <Plus size={14} />
            新建脚本
          </Button>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
        <KpiCard label="脚本总数" value={String(all.length)} tone="accent" />
        <KpiCard label="草稿" value={String(draftCount)} tone="info" />
        <KpiCard label="审稿中" value={String(reviewCount)} tone="violet" />
        <KpiCard label="已通过" value={String(approvedCount)} tone="success" />
      </div>

      <Card style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 12 }}>
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
              placeholder="按标题 / 剧集 / 关键字搜索…"
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                color: "var(--fg-0)",
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {(["all", "draft", "review", "approved", "archived"] as StatusFilter[]).map((f) => {
            const active = statusFilter === f;
            return (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "var(--radius-pill)",
                  border: active
                    ? "1px solid color-mix(in srgb, var(--accent) 50%, transparent)"
                    : "1px solid var(--line-2)",
                  background: active ? "color-mix(in srgb, var(--accent) 14%, transparent)" : "transparent",
                  color: active ? "var(--accent)" : "var(--fg-1)",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {f === "all" ? "全部" : STATUS_LABEL[f]}
              </button>
            );
          })}
        </div>
      </Card>

      {scriptsQ.isLoading && <LoadingBlock rows={4} height={88} />}
      {!!scriptsQ.error && <ErrorBlock onRetry={scriptsQ.refetch} />}
      {!scriptsQ.isLoading && !scriptsQ.error && filtered.length === 0 && (
        <EmptyState
          icon={<PenTool size={28} />}
          title="没有匹配的脚本"
          action={
            <Button variant="primary" size="md" onClick={() => setShowNew(true)}>
              <Plus size={14} />
              新建脚本
            </Button>
          }
        />
      )}

      {!scriptsQ.isLoading && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((s) => (
            <Card
              key={s.id}
              style={{
                padding: "18px 22px",
                cursor: "pointer",
                transition: "border-color 140ms ease",
              }}
              onClick={() => router.push(`/scripts/${encodeURIComponent(s.id)}`)}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor =
                  "color-mix(in srgb, var(--accent) 30%, transparent)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.borderColor = "var(--line)";
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6 }}>
                    <div
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        fontFamily: "var(--font-display)",
                        color: "var(--fg-0)",
                      }}
                    >
                      {s.title}
                    </div>
                    <StatusBadge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</StatusBadge>
                    <Chip tone="neutral">{KIND_LABEL[s.kind]}</Chip>
                  </div>
                  {s.suggestion && (
                    <div
                      style={{
                        fontSize: 12.5,
                        color: "var(--fg-2)",
                        marginBottom: 10,
                        fontStyle: "italic",
                        fontFamily: "var(--font-serif)",
                      }}
                    >
                      "{s.suggestion}"
                    </div>
                  )}
                  <div
                    className="mono"
                    style={{ display: "flex", gap: 14, fontSize: 10.5, color: "var(--fg-3)", letterSpacing: 0.3 }}
                  >
                    <span>{s.series ?? "—"}</span>
                    <span>{s.episode ?? "—"}</span>
                    <span>{s.authorName}</span>
                    <span>更新 {new Date(s.updatedAt).toLocaleString("zh-CN")}</span>
                  </div>
                </div>
                <div style={{ minWidth: 200, display: "flex", flexDirection: "column", gap: 6 }}>
                  <div
                    style={{
                      height: 4,
                      background: "rgba(255,255,255,0.06)",
                      borderRadius: "var(--radius-pill)",
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
                  <div className="mono" style={{ fontSize: 10.5, color: "var(--fg-2)", textAlign: "right" }}>
                    完成度 {s.progress}%
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={() => handleClone(s)}>
                    <Copy size={11} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => handleExport(s)}>
                    <Download size={11} />
                  </Button>
                  {s.status !== "archived" && (
                    <Button variant="ghost" size="sm" onClick={() => setArchiveTarget(s)}>
                      <Archive size={11} />
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <NewScriptDialog
        open={showNew}
        onOpenChange={setShowNew}
        onCreated={(s) => {
          invalidate("/me/scripts");
          toast.success(`已创建「${s.title}」`);
          router.push(`/scripts/${encodeURIComponent(s.id)}`);
        }}
      />

      <ConfirmDialog
        open={!!archiveTarget}
        onOpenChange={(o) => !o && setArchiveTarget(null)}
        title={`归档「${archiveTarget?.title ?? ""}」`}
        description="归档后该脚本不再出现在主列表，但历史版本仍然可见。"
        destructive
        confirmLabel="归档"
        onConfirm={handleArchive}
      />
    </div>
  );
}
