"use client";

// 编剧室（v0.7）：把原「脚本工坊」的长文本 + 版本树 + AI 续写并入短剧创作的「剧本」步。
// 自包含：可选已有文本剧本或新建，进入后是 版本树 | 编辑器 + 工作流动作。
// 与结构化分镜（SceneEditor）并行——分镜是生成真源，本面板是长文本精修/留痕的编剧室。
// 注意：原 scripts/[scriptId] 用了 window.confirm 切换版本（违反 §8），这里改用 ConfirmDialog。
import * as React from "react";
import { toast } from "sonner";
import { Archive, Check, ChevronDown, ChevronRight, Download, History, PenLine, Plus, Save, Send, Wand2 } from "lucide-react";
import type { Script, ScriptVersion, ScriptStatus } from "@ai-star-eco/types/script";
import { Button, Chip } from "@/components/premium";
import { ConfirmDialog, Dialog, EmptyState, Field, StatusBadge, TextArea, TextInput } from "@/components/common";
import { ScriptsApi } from "@/api";
import { ApiError } from "@ai-star-eco/api-client";

const STATUS_LABEL: Record<ScriptStatus, string> = { draft: "草稿", review: "审稿中", approved: "已通过", archived: "已归档" };
const STATUS_TONE: Record<ScriptStatus, "info" | "accent" | "success" | "neutral"> = {
  draft: "info",
  review: "accent",
  approved: "success",
  archived: "neutral",
};

function errMsg(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

export function ScriptProsePanel({ defaultTitle }: { defaultTitle?: string }) {
  const [open, setOpen] = React.useState(false);
  const [scripts, setScripts] = React.useState<Script[]>([]);
  const [loadingList, setLoadingList] = React.useState(false);
  const [creating, setCreating] = React.useState(false);

  const [script, setScript] = React.useState<Script | null>(null);
  const [versions, setVersions] = React.useState<ScriptVersion[]>([]);
  const [content, setContent] = React.useState("");
  const [activeVersionId, setActiveVersionId] = React.useState<string | null>(null);

  const [aiOpen, setAiOpen] = React.useState(false);
  const [aiPrompt, setAiPrompt] = React.useState("接着写一段，主角第一次坦诚。");
  const [aiRunning, setAiRunning] = React.useState(false);
  const [commitOpen, setCommitOpen] = React.useState(false);
  const [commitNote, setCommitNote] = React.useState("");
  const [committing, setCommitting] = React.useState(false);
  const [pendingVersion, setPendingVersion] = React.useState<ScriptVersion | null>(null);

  const activeVer = versions.find((v) => v.id === activeVersionId);
  const dirty = activeVer ? activeVer.content !== content : content.length > 0;

  const loadList = React.useCallback(() => {
    setLoadingList(true);
    ScriptsApi.listScripts()
      .then((all) => setScripts(all.filter((s) => s.status !== "archived")))
      .catch(() => setScripts([]))
      .finally(() => setLoadingList(false));
  }, []);

  React.useEffect(() => {
    if (open && scripts.length === 0 && !script) loadList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function openScript(s: Script) {
    try {
      const [full, vers] = await Promise.all([ScriptsApi.getScript(s.id), ScriptsApi.listVersionsByScript(s.id)]);
      const sc = full ?? s;
      setScript(sc);
      setVersions(vers);
      const cur = vers.find((v) => v.id === sc.currentVersionId) ?? vers[0] ?? null;
      setActiveVersionId(cur?.id ?? null);
      setContent(cur?.content ?? "");
    } catch (e) {
      toast.error(errMsg(e, "打开剧本失败"));
    }
  }

  async function createNew() {
    setCreating(true);
    try {
      const created = await ScriptsApi.createScript({
        title: defaultTitle?.trim() ? `${defaultTitle.trim()} · 长文本` : "未命名长文本剧本",
        kind: "drama",
        initialContent: "",
      });
      toast.success("已新建文本剧本");
      await openScript(created);
      loadList();
    } catch (e) {
      toast.error(errMsg(e, "新建失败"));
    } finally {
      setCreating(false);
    }
  }

  function requestSwitch(v: ScriptVersion) {
    if (v.id === activeVersionId) return;
    if (dirty) {
      setPendingVersion(v);
      return;
    }
    applySwitch(v);
  }
  function applySwitch(v: ScriptVersion) {
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
      setAiOpen(false);
      toast.success("AI 已续写一段，请审阅后另存版本");
    } catch (e) {
      toast.error(errMsg(e, "AI 续写失败"));
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
        aiAssisted: content.includes("[AI"),
      });
      const vers = await ScriptsApi.listVersionsByScript(script.id);
      setVersions(vers);
      setActiveVersionId(v.id);
      setCommitOpen(false);
      setCommitNote("");
      toast.success(`已存为 v${v.version}`);
    } catch (e) {
      toast.error(errMsg(e, "保存失败"));
    } finally {
      setCommitting(false);
    }
  }

  async function changeStatus(status: ScriptStatus) {
    if (!script) return;
    try {
      const next = await ScriptsApi.setScriptStatus(script.id, status);
      setScript(next);
      toast.success(status === "review" ? "已提交审稿" : status === "approved" ? "已通过审稿" : "已更新状态");
    } catch (e) {
      toast.error(errMsg(e, "操作失败"));
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

  function backToList() {
    setScript(null);
    setVersions([]);
    setActiveVersionId(null);
    setContent("");
    loadList();
  }

  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: "var(--radius-md)", overflow: "hidden" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          background: "var(--surface-1)",
          border: "none",
          borderBottom: open ? "1px solid var(--line)" : "none",
          cursor: "pointer",
          textAlign: "left",
          color: "var(--fg-0)",
          fontFamily: "var(--font-sans)",
        }}
      >
        {open ? <ChevronDown size={15} color="var(--fg-2)" /> : <ChevronRight size={15} color="var(--fg-2)" />}
        <PenLine size={15} color="var(--accent)" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600 }}>长文本剧本 · 版本树（编剧室）</div>
          <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 2 }}>
            精修长文本台词、多版本对比与 AI 续写；与上方结构化分镜并行，按需展开
          </div>
        </div>
        {script && <StatusBadge tone={STATUS_TONE[script.status]} dot={false}>{STATUS_LABEL[script.status]}</StatusBadge>}
      </button>

      {open && (
        <div style={{ padding: "16px" }}>
          {!script ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="eyebrow">选择或新建文本剧本</div>
                <Button variant="secondary" size="sm" loading={creating} onClick={createNew}>
                  <Plus size={12} /> 新建文本剧本
                </Button>
              </div>
              {loadingList ? (
                <div style={{ fontSize: 12, color: "var(--fg-3)" }}>加载中…</div>
              ) : scripts.length === 0 ? (
                <EmptyState icon={<PenLine size={24} />} title="还没有文本剧本" description="点「新建文本剧本」开始长文本写作，支持版本树与 AI 续写。" />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 240, overflowY: "auto" }}>
                  {scripts.map((s) => (
                    <button
                      key={s.id}
                      onClick={() => openScript(s)}
                      style={{
                        textAlign: "left",
                        padding: "10px 12px",
                        borderRadius: "var(--radius-sm)",
                        background: "var(--surface-1)",
                        border: "1px solid var(--line)",
                        cursor: "pointer",
                        fontFamily: "var(--font-sans)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--fg-0)" }}>{s.title}</span>
                        <StatusBadge tone={STATUS_TONE[s.status]} dot={false}>{STATUS_LABEL[s.status]}</StatusBadge>
                      </div>
                      <div className="mono" style={{ fontSize: 10, color: "var(--fg-3)", marginTop: 3 }}>
                        更新 {new Date(s.updatedAt).toLocaleString("zh-CN")}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <Button variant="ghost" size="sm" onClick={backToList}>← 剧本列表</Button>
                <span style={{ fontSize: 14, fontWeight: 600, color: "var(--fg-0)", fontFamily: "var(--font-display)" }}>{script.title}</span>
                <span className="mono" style={{ fontSize: 11, color: dirty ? "var(--warning)" : "var(--fg-3)" }}>
                  {dirty ? "● 未保存" : "已保存"} · {content.length} 字
                </span>
                <div style={{ flex: 1 }} />
                <Button variant="secondary" size="sm" onClick={() => setAiOpen(true)}><Wand2 size={12} /> AI 续写</Button>
                <Button variant="primary" size="sm" onClick={() => setCommitOpen(true)} disabled={!dirty}><Save size={12} /> 另存版本</Button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: 12 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 360, overflowY: "auto" }}>
                  <div className="eyebrow" style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><History size={11} /> 版本树</div>
                  {versions.length === 0 && <div style={{ fontSize: 11, color: "var(--fg-3)" }}>暂无版本，写完点「另存版本」。</div>}
                  {versions.map((v) => {
                    const active = v.id === activeVersionId;
                    const isCur = v.id === script.currentVersionId;
                    return (
                      <button
                        key={v.id}
                        onClick={() => requestSwitch(v)}
                        style={{
                          textAlign: "left",
                          padding: "8px 10px",
                          borderRadius: "var(--radius-sm)",
                          background: active ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--surface-1)",
                          border: active ? "1px solid color-mix(in srgb, var(--accent) 35%, transparent)" : "1px solid var(--line)",
                          cursor: "pointer",
                          color: active ? "var(--accent)" : "var(--fg-1)",
                          fontFamily: "var(--font-sans)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 6 }}>
                          <span className="mono" style={{ fontSize: 11, fontWeight: 600 }}>v{v.version}</span>
                          {isCur && <span className="mono" style={{ fontSize: 8.5, padding: "1px 5px", background: "color-mix(in srgb, var(--success) 18%, transparent)", color: "var(--success)", borderRadius: 4 }}>当前</span>}
                          {v.aiAssisted && <span className="mono" style={{ fontSize: 8.5, padding: "1px 5px", background: "color-mix(in srgb, var(--extra-violet) 18%, transparent)", color: "var(--extra-violet)", borderRadius: 4 }}>AI</span>}
                        </div>
                        <div style={{ fontSize: 10.5, marginTop: 3, color: "var(--fg-2)" }}>{v.note ?? "无说明"}</div>
                      </button>
                    );
                  })}
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <TextArea
                    rows={14}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="开始长文本写作……"
                    style={{ fontFamily: "var(--font-serif), serif", fontSize: 14, lineHeight: 1.7, minHeight: 300 }}
                  />
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {script.status === "draft" && <Button variant="secondary" size="sm" onClick={() => changeStatus("review")}><Send size={12} /> 提交审稿</Button>}
                    {script.status === "review" && <Button variant="secondary" size="sm" onClick={() => changeStatus("approved")}><Check size={12} /> 通过审稿</Button>}
                    {script.status === "approved" && <Chip tone="success">已通过 · 可下场使用</Chip>}
                    <Button variant="ghost" size="sm" onClick={exportFountain}><Download size={12} /> 导出 .fountain</Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <Dialog
        open={aiOpen}
        onOpenChange={(o) => { if (!aiRunning) setAiOpen(o); }}
        title="AI 续写"
        description="提示 AI 想要的下文方向。续写内容会替换为带新段落的正文，请审阅后另存版本。"
        width={520}
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setAiOpen(false)} disabled={aiRunning}>取消</Button>
            <Button variant="primary" size="md" loading={aiRunning} onClick={aiContinue}><Wand2 size={13} /> 开始续写</Button>
          </>
        }
      >
        <Field label="续写提示" required>
          <TextArea rows={4} value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)} maxLength={200} autoFocus />
        </Field>
      </Dialog>

      <Dialog
        open={commitOpen}
        onOpenChange={(o) => { if (!committing) setCommitOpen(o); }}
        title="另存为新版本"
        description="保留历史轨迹，方便对比回溯。"
        footer={
          <>
            <Button variant="ghost" size="md" onClick={() => setCommitOpen(false)} disabled={committing}>取消</Button>
            <Button variant="primary" size="md" loading={committing} onClick={commitNewVersion}><Save size={13} /> 保存</Button>
          </>
        }
      >
        <Field label="本次修改说明（可选）">
          <TextInput value={commitNote} onChange={(e) => setCommitNote(e.target.value)} maxLength={80} placeholder="如：补充第二幕回忆镜头" />
        </Field>
      </Dialog>

      <ConfirmDialog
        open={!!pendingVersion}
        onOpenChange={(o) => { if (!o) setPendingVersion(null); }}
        title="切换版本？"
        description="当前有未保存的修改，切换版本会丢弃它们。"
        destructive
        confirmLabel="丢弃并切换"
        onConfirm={() => {
          if (pendingVersion) applySwitch(pendingVersion);
          setPendingVersion(null);
        }}
      />
    </div>
  );
}
