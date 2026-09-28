"use client";

export const dynamic = "force-dynamic";

// 脚本库（v0.197：侧栏「即将上线」分组，见 docs/drama-ux-copy-pass.md §3.1）。
// 如实改名：原「归档」调的是 DELETE（真删）→ 改叫「删除」并如实确认；「完成度」是按状态写死的假百分比 → 去掉；
// 顶部横幅说明写好的脚本还不能直接带进某部短剧。
// 第三轮：去掉「草稿 / 待定稿 / 已定稿」筛选和状态标 —— 服务端每次保存都把状态写成 ready
// （DramaScriptService#saveScript），这套状态存不住，按它筛出来的结果不可信。
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, Download, Info, PenTool, Plus, Search, Trash2 } from "lucide-react";
import type { Script } from "@ai-star-eco/types/script";
import { Button, Card, Chip } from "@/components/premium";
import {
  ConfirmDialog,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  ViewHeader,
} from "@/components/common";
import { ScriptsApi } from "@/api";
import { useAsync, invalidate } from "@/lib/drama-query";
import { ApiError, formatDateTime } from "@ai-star-eco/api-client";
import { NewScriptDialog } from "./_dialogs/NewScriptDialog";
import { SCRIPT_KIND_LABEL, downloadScriptText } from "./_script-labels";

export default function ScriptsListPage() {
  const router = useRouter();
  const [q, setQ] = React.useState("");
  const [showNew, setShowNew] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Script | null>(null);

  const scriptsQ = useAsync<Script[]>("/me/scripts", () => ScriptsApi.listScripts());
  const all = scriptsQ.data ?? [];

  const filtered = React.useMemo(() => {
    return all.filter((s) => {
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
  }, [all, q]);

  async function handleClone(s: Script) {
    try {
      const copy = await ScriptsApi.cloneScript(s.id);
      invalidate("/me/scripts");
      toast.success(`已复制为「${copy.title}」`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "复制失败，请重试");
    }
  }

  async function handleExport(s: Script) {
    try {
      const versions = await ScriptsApi.listVersionsByScript(s.id);
      const cur = versions.find((v) => v.id === s.currentVersionId) ?? versions[0];
      downloadScriptText(s.title, cur?.content ?? "");
      toast.success("已下载剧本文件");
    } catch {
      toast.error("下载失败，请重试");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await ScriptsApi.deleteScript(deleteTarget.id);
      invalidate("/me/scripts");
      toast.success(`已删除「${deleteTarget.title}」`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "删除失败，请重试");
    }
  }

  const filtering = !!q;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="即将上线"
        title="脚本库"
        meta={`${all.length} 份脚本`}
        action={
          <Button variant="primary" size="md" onClick={() => setShowNew(true)} style={{ flex: "none" }}>
            <Plus size={14} />
            新建脚本
          </Button>
        }
      />

      {/* 如实说明：脚本库和短剧还没打通 */}
      <div
        className="card row gap-3"
        style={{
          padding: "12px 16px",
          background: "var(--surface-2)",
          border: "1px solid var(--line-soft)",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <Info size={16} style={{ color: "var(--accent)", flex: "none" }} />
        <div style={{ flex: "1 1 240px", minWidth: 0, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
          {"写好的脚本"}
          <b style={{ color: "var(--ink)" }}>还不能直接带进某部短剧</b>
          {"，这里只能写、存和下载。要给某部短剧写分镜，到「我的短剧」打开那部短剧，在「逐集制作」里写。"}
        </div>
        <Link href="/projects" style={{ textDecoration: "none", flex: "none" }}>
          <button type="button" className="btn btn-line btn-sm">去我的短剧</button>
        </Link>
      </div>

      <Card style={{ padding: "16px 18px" }}>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
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
              placeholder="搜标题、所属剧集或关键词"
              aria-label="搜索脚本"
              style={{
                flex: 1,
                minWidth: 0,
                background: "transparent",
                border: "none",
                color: "var(--fg-0)",
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>
        </div>
      </Card>

      {scriptsQ.isLoading && <LoadingBlock rows={4} height={88} />}
      {!!scriptsQ.error && <ErrorBlock onRetry={scriptsQ.refetch} />}
      {!scriptsQ.isLoading && !scriptsQ.error && filtered.length === 0 && (
        <EmptyState
          icon={<PenTool size={28} />}
          title={filtering ? "没有匹配的脚本" : "还没有脚本"}
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
              <div className="mk-script-row">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 6, minWidth: 0 }}>
                    <div
                      title={s.title}
                      style={{
                        fontSize: 15,
                        fontWeight: 600,
                        fontFamily: "var(--font-display)",
                        color: "var(--fg-0)",
                        minWidth: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.title}
                    </div>
                    <span style={{ flex: "none", whiteSpace: "nowrap" }}>
                      <Chip tone="neutral">{SCRIPT_KIND_LABEL[s.kind]}</Chip>
                    </span>
                  </div>
                  {s.suggestion && (
                    <div
                      style={{
                        fontSize: 12.5,
                        color: "var(--fg-2)",
                        marginBottom: 10,
                        fontStyle: "italic",
                        fontFamily: "var(--font-serif)",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      「{s.suggestion}」
                    </div>
                  )}
                  <div
                    className="mono"
                    style={{ display: "flex", gap: "4px 14px", flexWrap: "wrap", fontSize: 10.5, color: "var(--fg-3)", letterSpacing: 0.3 }}
                  >
                    {s.series && <span>{s.series}</span>}
                    {s.episode && <span>{s.episode}</span>}
                    <span>{s.authorName}</span>
                    <span>更新于 {formatDateTime(s.updatedAt)}</span>
                  </div>
                </div>
                <div className="mk-script-actions" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" title="复制一份" aria-label="复制一份" className="mk-script-icon" onClick={() => handleClone(s)}>
                    <Copy size={13} />
                  </Button>
                  <Button variant="ghost" size="sm" title="下载成文本文件" aria-label="下载成文本文件" className="mk-script-icon" onClick={() => handleExport(s)}>
                    <Download size={13} />
                  </Button>
                  <Button variant="ghost" size="sm" title="删除" aria-label="删除" className="mk-script-icon" onClick={() => setDeleteTarget(s)}>
                    <Trash2 size={13} />
                  </Button>
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
        open={!!deleteTarget}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        title={`删除「${deleteTarget?.title ?? ""}」`}
        description="删了没法恢复，确定删除吗？"
        destructive
        confirmLabel="删除"
        onConfirm={handleDelete}
      />
    </div>
  );
}
