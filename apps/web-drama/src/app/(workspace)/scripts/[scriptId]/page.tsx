"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  ArrowLeft,
  Check,
  Copy,
  Download,
  History,
  Save,
  Send,
  Wand2,
} from "lucide-react";
import type { Script, ScriptVersion } from "@/types/script";
import { Button, Card, Chip } from "@/components/premium";
import {
  ConfirmDialog,
  Dialog,
  EmptyState,
  ErrorBlock,
  Field,
  LoadingBlock,
  SectionHeader,
  StatusBadge,
  TextArea,
  TextInput,
  ViewHeader,
} from "@/components/common";
import { ScriptsApi } from "@/api";
import { useAsync, invalidate } from "@/lib/drama-query";
import { ApiError } from "@ai-star-eco/api-client";

const STATUS_LABEL = { draft: "草稿", review: "审稿中", approved: "已通过", archived: "已归档" } as const;
const STATUS_TONE = { draft: "info", review: "accent", approved: "success", archived: "neutral" } as const;

interface PageProps {
  params: Promise<{ scriptId: string }>;
}

export default function ScriptEditorPage({ params }: PageProps) {
  const { scriptId } = React.use(params);
  const router = useRouter();

  const scriptQ = useAsync<Script | null>(`/me/scripts/${scriptId}`, () => ScriptsApi.getScript(scriptId));
  const versionsQ = useAsync<ScriptVersion[]>(`/me/scripts/${scriptId}/versions`, () =>
    ScriptsApi.listVersionsByScript(scriptId),
  );

  const [content, setContent] = React.useState("");
  const [activeVersionId, setActiveVersionId] = React.useState<string | null>(null);
  const [aiPromptOpen, setAiPromptOpen] = React.useState(false);
  const [aiPrompt, setAiPrompt] = React.useState("接着写一段，主角第一次坦诚。");
  const [aiRunning, setAiRunning] = React.useState(false);
  const [commitOpen, setCommitOpen] = React.useState(false);
  const [commitNote, setCommitNote] = React.useState("");
  const [committing, setCommitting] = React.useState(false);
  const [archiveOpen, setArchiveOpen] = React.useState(false);

  const script = scriptQ.data ?? null;
  const versions = versionsQ.data ?? [];

  // 初始化激活版本
  React.useEffect(() => {
    if (script && versions.length > 0 && !activeVersionId) {
      const cur = versions.find((v) => v.id === script.currentVersionId) ?? versions[0]!;
      setActiveVersionId(cur.id);
      setContent(cur.content);
    }
  }, [script, versions, activeVersionId]);

  function switchVersion(v: ScriptVersion) {
    if (content !== versions.find((x) => x.id === activeVersionId)?.content) {
      if (!window.confirm("当前有未保存的修改，确认切换版本？")) return;
    }
    setActiveVersionId(v.id);
    setContent(v.content);
  }

  async function aiContinue() {
    if (!script) return;
    if (!aiPrompt.trim()) {
      toast.error("请填写续写提示");
      return;
    }
    setAiRunning(true);
    try {
      const { content: appended } = await ScriptsApi.generateDraft(script.id, aiPrompt.trim());
      setContent(appended);
      setAiPromptOpen(false);
      toast.success("AI 已续写一段，请审阅");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "AI 续写失败");
    } finally {
      setAiRunning(false);
    }
  }

  async function commitNewVersion() {
    if (!script) return;
    setCommitting(true);
    try {
      const v = await ScriptsApi.commitVersion(script.id, {
        content,
        note: commitNote.trim() || `保存于 ${new Date().toLocaleString("zh-CN")}`,
        aiAssisted: content.includes("[AI 续写"),
      });
      invalidate(`/me/scripts/${script.id}`);
      invalidate(`/me/scripts/${script.id}/versions`);
      invalidate("/me/scripts");
      setActiveVersionId(v.id);
      setCommitOpen(false);
      setCommitNote("");
      toast.success(`已存为 v${v.version}`);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "保存失败");
    } finally {
      setCommitting(false);
    }
  }

  async function submitForReview() {
    if (!script) return;
    try {
      await ScriptsApi.setScriptStatus(script.id, "review");
      invalidate(`/me/scripts/${script.id}`);
      invalidate("/me/scripts");
      toast.success("已提交审稿");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "提交失败");
    }
  }

  async function approve() {
    if (!script) return;
    try {
      await ScriptsApi.setScriptStatus(script.id, "approved");
      invalidate(`/me/scripts/${script.id}`);
      invalidate("/me/scripts");
      toast.success("已通过审稿");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "操作失败");
    }
  }

  async function archive() {
    if (!script) return;
    try {
      await ScriptsApi.archiveScript(script.id);
      toast.success("已归档");
      router.push("/scripts");
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "归档失败");
    }
  }

  function exportFountain() {
    if (!script) return;
    const blob = new Blob([`Title: ${script.title}\n\n${content}`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${script.title}.fountain`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("已导出 .fountain");
  }

  if (scriptQ.isLoading) return <LoadingBlock rows={3} height={120} />;
  if (scriptQ.error) return <ErrorBlock onRetry={scriptQ.refetch} />;
  if (!script) {
    return (
      <EmptyState
        title="脚本不存在"
        action={
          <Button variant="primary" size="md" onClick={() => router.push("/scripts")}>
            返回脚本工坊
          </Button>
        }
      />
    );
  }

  const activeVer = versions.find((v) => v.id === activeVersionId);
  const dirty = activeVer ? activeVer.content !== content : false;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
      <button
        onClick={() => router.push("/scripts")}
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
        <ArrowLeft size={12} /> 返回脚本工坊
      </button>

      <ViewHeader
        eyebrow={script.kind}
        title={script.title}
        meta={
          <>
            <span style={{ marginRight: 8 }}>
              <StatusBadge tone={STATUS_TONE[script.status]}>{STATUS_LABEL[script.status]}</StatusBadge>
            </span>
            {script.series ? `${script.series} · ${script.episode ?? ""}` : "未归属剧集"} · 完成度 {script.progress}%
          </>
        }
        action={
          <>
            <Button variant="secondary" size="md" onClick={() => setAiPromptOpen(true)}>
              <Wand2 size={14} />
              AI 续写
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setCommitOpen(true)}
              disabled={!dirty}
            >
              <Save size={14} />
              另存版本
            </Button>
          </>
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "200px 1fr 280px", gap: 16 }}>
        {/* 左：版本树 */}
        <Card style={{ padding: "20px 18px", maxHeight: "calc(100vh - 240px)", overflowY: "auto" }}>
          <SectionHeader eyebrow="versions" title={<><History size={13} style={{ marginRight: 6 }} />版本树</>} />
          {versionsQ.isLoading && <LoadingBlock rows={2} height={40} />}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {versions.map((v) => {
              const active = v.id === activeVersionId;
              const isCur = v.id === script.currentVersionId;
              return (
                <button
                  key={v.id}
                  onClick={() => switchVersion(v)}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    background: active
                      ? "color-mix(in srgb, var(--accent) 12%, transparent)"
                      : "rgba(255,255,255,0.02)",
                    border: active
                      ? "1px solid color-mix(in srgb, var(--accent) 35%, transparent)"
                      : "1px solid var(--line)",
                    borderRadius: "var(--radius-sm)",
                    cursor: "pointer",
                    color: active ? "var(--accent)" : "var(--fg-1)",
                    fontSize: 12,
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="mono" style={{ fontWeight: 600 }}>
                      v{v.version}
                    </span>
                    {isCur && (
                      <span
                        className="mono"
                        style={{
                          fontSize: 9,
                          padding: "1px 5px",
                          background: "rgba(76,224,160,0.16)",
                          color: "var(--success)",
                          borderRadius: 4,
                          letterSpacing: 0.4,
                        }}
                      >
                        当前
                      </span>
                    )}
                    {v.aiAssisted && (
                      <span
                        className="mono"
                        style={{
                          fontSize: 9,
                          padding: "1px 5px",
                          background: "rgba(164,76,255,0.18)",
                          color: "var(--extra-violet)",
                          borderRadius: 4,
                          letterSpacing: 0.4,
                        }}
                      >
                        AI
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 4, color: "var(--fg-2)" }}>{v.note ?? "无说明"}</div>
                  <div className="mono" style={{ fontSize: 9.5, color: "var(--fg-3)", marginTop: 4 }}>
                    {new Date(v.createdAt).toLocaleString("zh-CN")}
                  </div>
                </button>
              );
            })}
          </div>
        </Card>

        {/* 中：编辑器 */}
        <Card style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <div
            style={{
              padding: "12px 18px",
              borderBottom: "1px solid var(--line)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div className="mono" style={{ fontSize: 11, color: "var(--fg-2)" }}>
              {dirty ? "● 未保存" : "已保存"} · {content.length} 字
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <Button variant="ghost" size="sm" onClick={() => navigator.clipboard.writeText(content).then(() => toast.success("已复制"))}>
                <Copy size={11} />
                复制
              </Button>
              <Button variant="ghost" size="sm" onClick={exportFountain}>
                <Download size={11} />
                导出
              </Button>
            </div>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="开始写作……"
            style={{
              flex: 1,
              minHeight: 480,
              padding: "20px 22px",
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--fg-0)",
              fontFamily: "var(--font-serif), serif",
              fontSize: 15,
              lineHeight: 1.7,
              resize: "vertical",
            }}
          />
        </Card>

        {/* 右：动作 + AI 建议 */}
        <Card style={{ padding: "20px 22px", display: "flex", flexDirection: "column", gap: 12 }}>
          <SectionHeader eyebrow="actions" title="工作流" />
          {script.status === "draft" && (
            <Button variant="primary" size="md" onClick={submitForReview}>
              <Send size={13} />
              提交审稿
            </Button>
          )}
          {script.status === "review" && (
            <Button variant="primary" size="md" onClick={approve}>
              <Check size={13} />
              通过审稿
            </Button>
          )}
          {script.status === "approved" && (
            <Chip tone="success">已通过 · 可下场使用</Chip>
          )}
          <Button variant="secondary" size="md" onClick={() => setAiPromptOpen(true)}>
            <Wand2 size={13} />
            AI 续写一段
          </Button>
          <Button
            variant="ghost"
            size="md"
            onClick={async () => {
              try {
                const copy = await ScriptsApi.cloneScript(script.id);
                invalidate("/me/scripts");
                toast.success("已克隆，跳转到副本");
                router.push(`/scripts/${encodeURIComponent(copy.id)}`);
              } catch {
                toast.error("克隆失败");
              }
            }}
          >
            <Copy size={13} />
            克隆为新脚本
          </Button>
          {script.status !== "archived" && (
            <Button variant="danger" size="md" onClick={() => setArchiveOpen(true)}>
              <Archive size={13} />
              归档
            </Button>
          )}

          {script.suggestion && (
            <>
              <div className="eyebrow" style={{ marginTop: 10 }}>
                ai suggestion
              </div>
              <div
                style={{
                  padding: "12px 14px",
                  borderRadius: "var(--radius-sm)",
                  background: "rgba(164,76,255,0.08)",
                  border: "1px solid rgba(164,76,255,0.22)",
                  fontSize: 12,
                  color: "var(--fg-1)",
                  fontStyle: "italic",
                  fontFamily: "var(--font-serif)",
                  lineHeight: 1.55,
                }}
              >
                {script.suggestion}
              </div>
            </>
          )}
        </Card>
      </div>

      {/* AI prompt dialog */}
      <Dialog
        open={aiPromptOpen}
        onOpenChange={(o) => {
          if (aiRunning) return;
          setAiPromptOpen(o);
        }}
        title="AI 续写"
        description="提示 AI 想要的下文方向。续写内容会追加在当前正文末尾。"
        width={520}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setAiPromptOpen(false)} disabled={aiRunning}>
              取消
            </Button>
            <Button variant="primary" size="md" loading={aiRunning} onClick={aiContinue}>
              <Wand2 size={13} />
              开始续写
            </Button>
          </>
        }
      >
        <Field label="续写提示" required>
          <TextArea
            rows={4}
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            maxLength={200}
            autoFocus
          />
        </Field>
      </Dialog>

      {/* commit dialog */}
      <Dialog
        open={commitOpen}
        onOpenChange={(o) => {
          if (committing) return;
          setCommitOpen(o);
        }}
        title="另存为新版本"
        description="保留历史轨迹，方便对比回溯。"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setCommitOpen(false)} disabled={committing}>
              取消
            </Button>
            <Button variant="primary" size="md" loading={committing} onClick={commitNewVersion}>
              <Save size={13} />
              保存
            </Button>
          </>
        }
      >
        <Field label="本次修改说明（可选）">
          <TextInput
            value={commitNote}
            onChange={(e) => setCommitNote(e.target.value)}
            maxLength={80}
            placeholder="如：补充第二幕回忆镜头"
          />
        </Field>
      </Dialog>

      <ConfirmDialog
        open={archiveOpen}
        onOpenChange={setArchiveOpen}
        title={`归档「${script.title}」`}
        description="归档后将不再出现在主列表，但历史版本仍可查看。"
        destructive
        confirmLabel="归档"
        onConfirm={archive}
      />
    </div>
  );
}
