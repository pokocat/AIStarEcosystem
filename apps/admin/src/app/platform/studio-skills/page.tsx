"use client";

// Studio 技能 —— 全能创作对话的制作方法（技能表 + 不可变版本）。
// 对应 server 后台技能接口（/api/admin/studio/skills/*）。发布、回滚、审阅草稿都只追加新版本；
// 进行中的制作按它开始时的版本快照执行，不受这里的改动影响。真源：docs/ip-studio-conversational-video-recreation-plan.md S3。

import * as React from "react";
import { ChevronRight, Plus, RotateCcw, Upload, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useConfirm, useToast } from "@/components/feedback";
import { ApiError, StudioSkillsApi } from "@/api";
import { cn, formatDateTimeCN } from "@/lib/utils";
import {
  SKILL_OPERATIONS, STAGES, STATUS_META, SOURCE_LABEL, TRIGGER_MEDIA, formFromVersion, frontmatterFromForm, maxStepsText, stableJson, triggersSummary, validateSkillForm,
  type SkillForm,
} from "@/lib/studio-skill-form";
import type { StudioSkillAdminDetail, StudioSkillAdminItem, StudioSkillDryRunRequest, StudioSkillDryRunResult, StudioSkillStatus, StudioSkillVersion } from "@/types/studio-skills";
import { ChipToggles, ChipsInput, CreateSkillDialog, DraftReviewDialog, DryRunCard, ErrorList, VersionsCard, errorLines, type DryRunSource } from "./parts";

const LAST_ACTIVE_TEXT = "最后一个启用的技能不能停用。对话至少要有一个可用的技能，先启用另一个，再停用它。";
const checkId = (raw: string) => raw.trim().toLowerCase().replace(/\s+/g, "-");

export default function StudioSkillsPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [list, setList] = React.useState<StudioSkillAdminItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeKey, setActiveKey] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<StudioSkillAdminDetail | null>(null);
  const [detailError, setDetailError] = React.useState<string[]>([]);
  const [versions, setVersions] = React.useState<StudioSkillVersion[]>([]);
  const [versionsLoading, setVersionsLoading] = React.useState(false);

  // 编辑：表单从哪一版载入（当前版本或某份草稿），发布时合并回那一版的头部对象。
  const [form, setForm] = React.useState<SkillForm | null>(null);
  const [base, setBase] = React.useState<StudioSkillVersion | null>(null);
  const [publishing, setPublishing] = React.useState(false);
  const [publishError, setPublishError] = React.useState<string[]>([]);
  const [statusBusy, setStatusBusy] = React.useState(false);
  const [statusError, setStatusError] = React.useState("");
  const [busyVersion, setBusyVersion] = React.useState<number>();
  const [review, setReview] = React.useState<StudioSkillVersion | null>(null);
  const [reviewBusy, setReviewBusy] = React.useState(false);
  const [reviewError, setReviewError] = React.useState<string[]>([]);
  const [drySource, setDrySource] = React.useState<DryRunSource>("editor");
  const [dryRunning, setDryRunning] = React.useState(false);
  const [dryResult, setDryResult] = React.useState<StudioSkillDryRunResult | null>(null);
  const [dryError, setDryError] = React.useState<string[]>([]);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string[]>([]);
  const editorRef = React.useRef<HTMLDivElement>(null), dryRef = React.useRef<HTMLDivElement>(null);
  const request = React.useRef(0);

  const loadList = React.useCallback(async (select?: string) => {
    try {
      const rows = await StudioSkillsApi.listStudioSkills();
      setList(rows);
      setActiveKey((prev) => select ?? (prev && rows.some((r) => r.key === prev) ? prev : rows[0]?.key ?? null));
    } catch (e) {
      toast.danger({ title: "技能列表没有加载出来", description: errorLines(e).join("；") });
    } finally {
      setLoading(false);
    }
  }, [toast]);
  React.useEffect(() => { void loadList(); }, [loadList]);

  const loadEditor = React.useCallback((version: StudioSkillVersion, fallback?: StudioSkillAdminDetail) => {
    setForm(formFromVersion(version, fallback?.skill));
    setBase(version);
    setPublishError([]);
  }, []);

  /** resetEditor: replace the form with the (new) current version; false keeps unpublished edits. */
  const loadDetail = React.useCallback(async (key: string, resetEditor: boolean) => {
    const ticket = ++request.current;
    setVersionsLoading(true); setDetailError([]);
    try {
      const [next, history] = await Promise.all([StudioSkillsApi.getStudioSkill(key), StudioSkillsApi.listStudioSkillVersions(key)]);
      if (ticket !== request.current) return;
      setDetail(next);
      setVersions([...history].sort((a, b) => b.version - a.version));
      if (resetEditor) loadEditor(next.current, next);
    } catch (e) {
      if (ticket === request.current) setDetailError(errorLines(e));
    } finally {
      if (ticket === request.current) setVersionsLoading(false);
    }
  }, [loadEditor]);
  React.useEffect(() => {
    if (!activeKey) return;
    setDetail(null); setForm(null); setBase(null); setStatusError(""); setDryResult(null); setDryError([]); setDrySource("editor"); setReview(null);
    void loadDetail(activeKey, true);
  }, [activeKey, loadDetail]);

  const built = React.useMemo(() => form && base ? frontmatterFromForm(base.frontmatter, form) : null, [form, base]);
  const dirty = !!detail && !!built && !!form && (stableJson(built) !== stableJson(detail.current.frontmatter) || form.bodyMd !== detail.current.bodyMd);
  const otherDefault = detail ? list.find((s) => s.key !== detail.key && s.status === "active" && s.skill.triggers?.default) : undefined;
  const formErrors = React.useMemo(() => {
    if (!form) return [];
    const errors = validateSkillForm(form);
    // The server keeps at most one active default skill.
    if (form.triggerDefault && otherDefault && detail?.status === "active") errors.push(`「${otherDefault.name}」已经是默认技能，先去掉它的默认，或者关掉这里的「都没命中时用它」`);
    return errors;
  }, [form, otherDefault, detail?.status]);
  const patch = (update: Partial<SkillForm>) => setForm((f) => f ? { ...f, ...update } : f);

  const discardOk = async (title: string) => {
    if (!dirty) return true;
    const r = await confirm({ title, description: "编辑器里有还没发布的修改，继续会丢掉它们。", confirmLabel: "丢掉修改", tone: "warning" });
    return r.ok;
  };
  const choose = async (key: string) => {
    if (key === activeKey) return;
    if (await discardOk("换一个技能？")) setActiveKey(key);
  };

  const publish = async () => {
    if (!detail || !form || !built) return;
    if (formErrors.length) { setPublishError(formErrors); return; }
    const r = await confirm({ title: "发布新版本？", description: "发布后新开始的规划立刻按这一版执行；进行中的制作仍按它开始时的版本。", confirmLabel: "发布",
      requireReason: true, reasonPlaceholder: "这一版改了什么（写进版本记录）" });
    if (!r.ok) return;
    setPublishing(true); setPublishError([]);
    try {
      await StudioSkillsApi.publishStudioSkillVersion(detail.key, { frontmatter: built, bodyMd: form.bodyMd, note: r.reason.trim(), expectedVersion: detail.currentVersion });
      toast.success({ title: "已发布新版本", description: "新开始的规划会按这一版执行" });
      await Promise.all([loadList(), loadDetail(detail.key, true)]);
    } catch (e) {
      if (e instanceof ApiError && e.code === "STUDIO_SKILL_VERSION_CONFLICT") {
        setPublishError(["刚有人发布了新版本，这次没有发布。你的修改还在编辑器里，看一下版本记录里的新版本，对照着改完再发布。"]);
        await loadDetail(detail.key, false);
      } else setPublishError(errorLines(e));
    } finally {
      setPublishing(false);
    }
  };

  const changeStatus = async (status: StudioSkillStatus) => {
    if (!detail || status === detail.status) return;
    if (status !== "active") {
      const r = await confirm({ title: status === "withdrawn" ? "停用这个技能？" : "把这个技能改回草稿？", tone: "warning", confirmLabel: status === "withdrawn" ? "停用" : "改回草稿",
        description: "新的对话不会再用它；已经开始的制作照常做完并结算。" });
      if (!r.ok) return;
    }
    setStatusBusy(true); setStatusError("");
    try {
      await StudioSkillsApi.setStudioSkillStatus(detail.key, { status });
      toast.success({ title: `已改为「${STATUS_META[status].label}」` });
      await Promise.all([loadList(), loadDetail(detail.key, false)]);
    } catch (e) {
      setStatusError(e instanceof ApiError && e.code === "STUDIO_SKILL_LAST_ACTIVE" ? LAST_ACTIVE_TEXT : errorLines(e).join("；"));
    } finally {
      setStatusBusy(false);
    }
  };

  const rollback = async (version: StudioSkillVersion) => {
    if (!detail) return;
    const r = await confirm({ title: `回滚到 v${version.version}？`, tone: "warning", confirmLabel: "回滚",
      description: `会用 v${version.version} 的内容生成一个新版本并立即生效，进行中的制作不受影响。${dirty ? "编辑器里没发布的修改会换成回滚后的内容。" : ""}` });
    if (!r.ok) return;
    setBusyVersion(version.version);
    try {
      await StudioSkillsApi.rollbackStudioSkill(detail.key, version.version, { expectedVersion: detail.currentVersion });
      toast.success({ title: `已回滚到 v${version.version}`, description: "回滚生成了一个新版本" });
      await Promise.all([loadList(), loadDetail(detail.key, true)]);
    } catch (e) {
      toast.danger({ title: "回滚没有成功", description: errorLines(e).join("；") });
      if (e instanceof ApiError && e.code === "STUDIO_SKILL_VERSION_CONFLICT") await loadDetail(detail.key, false);
    } finally {
      setBusyVersion(undefined);
    }
  };

  const publishDraft = async (draft: StudioSkillVersion, note: string) => {
    if (!detail) return;
    setReviewBusy(true); setReviewError([]);
    try {
      await StudioSkillsApi.publishStudioSkillDraft(detail.key, draft.version, { ...(note ? { note } : {}), expectedVersion: detail.currentVersion });
      toast.success({ title: `v${draft.version} 已发布`, description: "新开始的规划会按这一版执行" });
      setReview(null);
      await Promise.all([loadList(), loadDetail(detail.key, true)]);
    } catch (e) {
      setReviewError(errorLines(e));
    } finally {
      setReviewBusy(false);
    }
  };

  const loadIntoEditor = async (version: StudioSkillVersion) => {
    if (!detail) return;
    if (base?.id !== version.id && !(await discardOk(`把 v${version.version} 载入编辑器？`))) return;
    loadEditor(version, detail);
    setReview(null);
    setDrySource("editor");
    requestAnimationFrame(() => editorRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
  };
  const tryVersion = (version: StudioSkillVersion) => {
    setDrySource(detail && version.version === detail.currentVersion ? "current" : `v${version.version}`);
    setReview(null); setDryResult(null); setDryError([]);
    requestAnimationFrame(() => dryRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" }));
  };

  const runDry = async (input: Pick<StudioSkillDryRunRequest, "stage" | "analysisMarkdown" | "brief">) => {
    if (!detail) return;
    const body: StudioSkillDryRunRequest = { stage: input.stage, analysisMarkdown: input.analysisMarkdown, brief: input.brief.trim() };
    if (drySource === "editor") {
      if (!form || !built) return;
      if (formErrors.length) { setDryError(["编辑器里的内容还有问题，先改好再试跑：", ...formErrors]); return; }
      body.frontmatter = built; body.bodyMd = form.bodyMd;
    } else if (drySource !== "current") body.version = Number(drySource.slice(1));
    setDryRunning(true); setDryError([]); setDryResult(null);
    try {
      setDryResult(await StudioSkillsApi.dryRunStudioSkill(detail.key, body));
    } catch (e) {
      setDryError(errorLines(e));
    } finally {
      setDryRunning(false);
    }
  };

  const create = async (markdown: string, note: string) => {
    setCreating(true); setCreateError([]);
    try {
      const created = await StudioSkillsApi.createStudioSkill({ markdown, ...(note ? { note } : {}) });
      toast.success({ title: `已新建「${created.name}」`, description: "试跑没问题再把它启用" });
      setCreateOpen(false);
      await loadList(created.key);
    } catch (e) {
      setCreateError(errorLines(e));
    } finally {
      setCreating(false);
    }
  };

  const currentVersion = versions.find((v) => v.version === detail?.currentVersion) ?? detail?.current;

  return (
    <div className="admin-page space-y-6">
      <PageHeader
        title="Studio 技能"
        description="全能创作对话按技能来规划制作：头部定执行边界（各阶段能用哪些操作、上限、检查项），正文是写给规划模型的方法。每次发布都生成一个不能修改的新版本。"
        actions={<Button onClick={() => { setCreateError([]); setCreateOpen(true); }}><Plus className="h-4 w-4" />新建技能</Button>}
      />

      <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)] lg:gap-6">
        <Card className="h-fit overflow-hidden">
          <CardHeader className="border-b border-border px-3 py-3">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm">全部技能</CardTitle>
              <span className="text-xs tabular-nums text-muted-foreground">{list.length} 个</span>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading && <div className="px-3 py-4 text-sm text-muted-foreground">加载中…</div>}
            {!loading && !list.length && <div className="px-3 py-4 text-sm text-muted-foreground">还没有技能。</div>}
            <div role="listbox" aria-label="技能列表" className="divide-y divide-border">
              {list.map((s) => {
                const selected = s.key === activeKey, meta = STATUS_META[s.status];
                return (
                  <button key={s.key} type="button" role="option" aria-selected={selected} onClick={() => void choose(s.key)}
                    className={cn("group flex w-full items-start gap-3 px-3 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      selected ? "bg-primary/6" : "bg-card hover:bg-muted/45")}>
                    <span className="min-w-0 flex-1 space-y-1">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate text-sm font-medium" title={s.name}>{s.name}</span>
                        <Badge tone={meta.tone} className="shrink-0 text-[10px]">{meta.label}</Badge>
                        {s.pendingDrafts > 0 && <Badge tone="primary" className="shrink-0 text-[10px]">{s.pendingDrafts} 份待审阅</Badge>}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground" title={triggersSummary(s.skill.triggers)}>{triggersSummary(s.skill.triggers)}</span>
                      <span className="flex min-w-0 items-center gap-2 font-mono text-[10px] text-muted-foreground">
                        <span className="truncate" title={s.key}>{s.key}</span>
                        <span className="shrink-0">v{s.currentVersion}</span>
                        <span className="shrink-0">{formatDateTimeCN(s.updatedAt)}</span>
                      </span>
                    </span>
                    <ChevronRight className={cn("mt-1 h-4 w-4 shrink-0", selected ? "text-primary" : "text-muted-foreground")} aria-hidden />
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-4">
          <ErrorList lines={detailError} />
          {!detail && activeKey && !detailError.length && <div className="text-sm text-muted-foreground">加载中…</div>}
          {detail && form && base && (
            <>
              <Card ref={editorRef}>
                <CardHeader className="flex-col items-start gap-4 space-y-0 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={STATUS_META[detail.status].tone}>{STATUS_META[detail.status].label}</Badge>
                      <Badge tone="neutral">当前 v{detail.currentVersion}</Badge>
                      {detail.seedFile && <Badge tone="neutral" title={`仓内文件 ${detail.seedFile}`}>来自仓内文件</Badge>}
                    </div>
                    <CardTitle className="truncate text-base" title={detail.name}>{detail.name}</CardTitle>
                    <div className="flex flex-wrap gap-2 font-mono text-[11px] text-muted-foreground">
                      <span className="rounded-md bg-surface-muted px-2 py-1">{detail.key}</span>
                      <span className="rounded-md bg-surface-muted px-2 py-1">更新于 {formatDateTimeCN(detail.updatedAt)}{detail.updatedBy ? ` · ${detail.updatedBy}` : ""}</span>
                    </div>
                  </div>
                  <div className="w-full space-y-1.5 sm:w-64">
                    <span className="text-sm font-medium">状态</span>
                    <div role="group" aria-label="技能状态" className="grid grid-cols-3 gap-1 rounded-md border border-border bg-surface-muted p-1">
                      {(Object.keys(STATUS_META) as StudioSkillStatus[]).map((s) => (
                        <button key={s} type="button" aria-pressed={detail.status === s} disabled={statusBusy} onClick={() => void changeStatus(s)}
                          className={cn("truncate rounded px-2 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                            detail.status === s ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
                          {STATUS_META[s].label}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs leading-5 text-muted-foreground">{STATUS_META[detail.status].hint}；改状态立即生效，不产生新版本。</p>
                    {statusError && <ErrorList lines={[statusError]} />}
                  </div>
                </CardHeader>
                <CardContent className="space-y-5">
                  {base.version !== detail.currentVersion && (
                    <div className="flex flex-wrap items-center gap-3 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
                      <span>正在编辑：从 v{base.version}（{base.status === "draft" ? "待审阅草稿" : SOURCE_LABEL[base.source]}）载入，发布后会成为一个新版本。</span>
                      <Button size="sm" variant="outline" onClick={() => void loadIntoEditor(detail.current)}><RotateCcw className="h-3.5 w-3.5" />换回当前版本</Button>
                    </div>
                  )}
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="min-w-0 space-y-1.5">
                      <span className="text-sm font-medium">名称</span>
                      <Input value={form.name} onChange={(e) => patch({ name: e.target.value })} maxLength={40} />
                    </label>
                    <label className="min-w-0 space-y-1.5 md:col-span-2">
                      <span className="text-sm font-medium">用途说明</span>
                      <Textarea value={form.summary} onChange={(e) => patch({ summary: e.target.value })} rows={2} />
                    </label>
                  </div>

                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold">各阶段能用的操作</h3>
                    <p className="text-xs leading-5 text-muted-foreground">服务端按这里放行：模型写出的计划里只要有一步不在本阶段的操作里，整份计划都会被拒。</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      {STAGES.map((stage) => (
                        <ChipToggles key={stage.value} label={`${stage.label}阶段`} options={SKILL_OPERATIONS} values={form.operations[stage.value]}
                          onChange={(next) => patch({ operations: { ...form.operations, [stage.value]: next } })} />
                      ))}
                    </div>
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold">上限</h3>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                      <label className="min-w-0 space-y-1.5"><span className="text-sm font-medium">原片最长（秒）</span>
                        <Input inputMode="numeric" value={form.maxSourceSec} onChange={(e) => patch({ maxSourceSec: e.target.value })} /></label>
                      <label className="min-w-0 space-y-1.5"><span className="text-sm font-medium">最多分几段</span>
                        <Input inputMode="numeric" value={form.maxSegments} onChange={(e) => patch({ maxSegments: e.target.value })} /></label>
                      <div className="min-w-0 space-y-1.5"><span className="text-sm font-medium">每段最长（秒）</span>
                        <Input inputMode="numeric" aria-label="每段最长（秒）" value={form.segmentByModel ? "" : form.maxSegmentSec} disabled={form.segmentByModel}
                          placeholder={form.segmentByModel ? "按所选视频模型" : ""} onChange={(e) => patch({ maxSegmentSec: e.target.value })} />
                        <label className="flex items-center gap-2 text-xs text-muted-foreground"><Switch checked={form.segmentByModel} onCheckedChange={(v) => patch({ segmentByModel: v })} />按所选视频模型的最长时长</label></div>
                      <label className="min-w-0 space-y-1.5"><span className="text-sm font-medium">每段自动修正最多几次</span>
                        <Input inputMode="numeric" value={form.maxAutoFixPerSegment} onChange={(e) => patch({ maxAutoFixPerSegment: e.target.value })} /></label>
                    </div>
                    <p className="text-xs text-muted-foreground">计划最多 {maxStepsText(base.frontmatter, form, detail.skill.limits.maxSteps)}。</p>
                  </section>

                  <section className="grid gap-4 md:grid-cols-2">
                    <ChipsInput label="检查项" values={form.checks} normalize={checkId} placeholder="subject-replaced"
                      hint="小写字母、数字和连字符。每一项要在正文的检查依据里写清楚怎么判。"
                      onChange={(next) => patch({ checks: next, autoFixChecks: form.autoFixChecks.filter((id) => next.includes(id)) })} />
                    <ChipToggles label="允许自动修正的检查项" options={form.checks.map((id) => ({ value: id, label: id }))} values={form.autoFixChecks}
                      disabledHint="先加检查项" onChange={(next) => patch({ autoFixChecks: next })} />
                  </section>
                  <p className="-mt-2 text-xs leading-5 text-muted-foreground">只有选中的检查项明确没通过时才会自动重做，还要同时受每段次数和重做额度限制；其余的只给建议，由用户决定。</p>

                  <section className="grid gap-4 md:grid-cols-2">
                    <ChipsInput label="方法示例" values={form.methodExamples} placeholder="remap-subject" hint="只给模型参考，不是白名单，计划里出现新做法不会因此被拒。"
                      onChange={(next) => patch({ methodExamples: next })} />
                    <ChipsInput label="需要的能力" values={form.requiredCapabilities} placeholder="video-generation" onChange={(next) => patch({ requiredCapabilities: next })} />
                  </section>

                  <section className="space-y-3">
                    <h3 className="text-sm font-semibold">路由提示</h3>
                    <p className="text-xs leading-5 text-muted-foreground">用户没选技能时，服务端按这里给一段新对话挑技能；只影响挑哪个，不放开任何操作。</p>
                    <div className="grid gap-4 md:grid-cols-2">
                      <ChipToggles label="带这些素材时优先" options={TRIGGER_MEDIA} values={form.triggerMedia} onChange={(next) => patch({ triggerMedia: next })} />
                      <ChipsInput label="关键词" values={form.triggerKeywords} placeholder="复刻" onChange={(next) => patch({ triggerKeywords: next })} />
                    </div>
                    <label className="flex items-center gap-2 text-sm">
                      <Switch checked={form.triggerDefault} onCheckedChange={(v) => patch({ triggerDefault: v })} />都没命中时用它
                    </label>
                    {form.triggerDefault && otherDefault && <p className="text-xs text-warning">「{otherDefault.name}」已经是默认技能，同时只能有一个默认{detail.status === "active" ? "。先去掉它的默认，这一版才能发布" : "；启用这个技能之前，要先去掉它的默认"}。</p>}
                  </section>

                  <section className="space-y-1.5">
                    <h3 className="text-sm font-semibold">正文（Markdown）</h3>
                    <Textarea aria-label="技能正文" value={form.bodyMd} onChange={(e) => patch({ bodyMd: e.target.value })} rows={18} className="font-mono text-xs leading-5" />
                  </section>

                  {dirty && formErrors.length > 0 && <ErrorList lines={formErrors} />}
                  <ErrorList lines={publishError} />
                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={() => void publish()} disabled={!dirty || publishing || formErrors.length > 0} title={!dirty ? "和当前版本相比没有改动" : undefined}>
                      <Upload className="h-4 w-4" />{publishing ? "发布中…" : "发布新版本"}
                    </Button>
                    {dirty && <Button variant="outline" onClick={() => void loadIntoEditor(detail.current)}>放弃修改</Button>}
                    <span className="text-xs text-muted-foreground">{dirty ? `发布后成为 v${Math.max(detail.currentVersion, ...versions.map((v) => v.version)) + 1}` : "和当前版本相同"}</span>
                  </div>
                </CardContent>
              </Card>

              <VersionsCard versions={versions} loading={versionsLoading} currentVersion={detail.currentVersion} busyVersion={busyVersion}
                onRollback={(v) => void rollback(v)} onReview={(v) => { setReviewError([]); setReview(v); }} onLoad={(v) => void loadIntoEditor(v)} onTry={tryVersion} />

              <div ref={dryRef}>
                <DryRunCard versions={versions} currentVersion={detail.currentVersion} dirty={dirty} running={dryRunning} result={dryResult} error={dryError}
                  source={drySource} onSource={(s) => { setDrySource(s); setDryResult(null); setDryError([]); }} onRun={(input) => void runDry(input)} />
              </div>
            </>
          )}
          {!loading && !list.length && (
            <Card><CardContent className="space-y-3 py-6 text-sm text-muted-foreground">
              <p>还没有技能。可以贴一份技能文件新建。</p>
              <Button variant="outline" onClick={() => setCreateOpen(true)}><Wand2 className="h-4 w-4" />新建技能</Button>
            </CardContent></Card>
          )}
        </div>
      </div>

      <DraftReviewDialog draft={review} current={currentVersion} currentVersion={detail?.currentVersion ?? 0} publishing={reviewBusy} error={reviewError}
        onClose={() => setReview(null)} onPublish={(d, note) => void publishDraft(d, note)} onLoad={(d) => void loadIntoEditor(d)} onTry={tryVersion} />
      <CreateSkillDialog open={createOpen} creating={creating} error={createError} onClose={() => setCreateOpen(false)} onCreate={(md, note) => void create(md, note)} />
    </div>
  );
}
