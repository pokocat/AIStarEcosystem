"use client";

// 「Studio 技能」页的子组件：标签输入、试跑、版本表、草稿审阅与新建弹窗。
// 页面本身（page.tsx）只管选中哪个技能、加载与编辑表单。

import * as React from "react";
import { FlaskConical, Plus, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/api";
import { cn, formatDateTimeCN } from "@/lib/utils";
import { OPERATION_LABEL, SKILL_TEMPLATE, SOURCE_LABEL, STAGES, changedParts } from "@/lib/studio-skill-form";
import type { StudioPlan, StudioPlanStage, StudioSkillDryRunResult, StudioSkillVersion } from "@/types/studio-skills";

/** Server error → list of readable lines (STUDIO_SKILL_INVALID carries details.errors). */
export function errorLines(error: unknown): string[] {
  if (error instanceof ApiError) {
    const details = error.details as { errors?: unknown } | undefined;
    const list = Array.isArray(details?.errors) ? details!.errors.map(String).filter(Boolean) : [];
    return list.length ? list : [error.message];
  }
  return [error instanceof Error ? error.message : "操作没有成功，请重试"];
}

export function ErrorList({ lines, className }: { lines: string[]; className?: string }) {
  if (!lines.length) return null;
  return (
    <div role="alert" className={cn("rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs leading-5 text-destructive", className)}>
      {lines.length === 1 ? lines[0] : <ul className="list-disc space-y-0.5 pl-4">{lines.map((line, i) => <li key={i}>{line}</li>)}</ul>}
    </div>
  );
}

/** Free-form chips: type and press Enter (or 添加); each chip can be removed. */
export function ChipsInput({ label, values, onChange, placeholder, normalize, hint }: {
  label: string; values: string[]; onChange: (next: string[]) => void; placeholder?: string; normalize?: (raw: string) => string; hint?: string;
}) {
  const [draft, setDraft] = React.useState("");
  const add = () => {
    const value = (normalize ? normalize(draft) : draft).trim();
    if (!value) return;
    if (!values.includes(value)) onChange([...values, value]);
    setDraft("");
  };
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="text-sm font-medium">{label}</div>
      <div className="flex min-w-0 flex-wrap gap-1.5" aria-label={label}>
        {values.map((value) => (
          <span key={value} className="inline-flex max-w-full items-center gap-1 rounded-full bg-surface-muted px-2 py-0.5 text-xs">
            <span className="truncate" title={value}>{value}</span>
            <button type="button" aria-label={`移除 ${value}`} className="rounded-full p-0.5 text-muted-foreground hover:text-foreground" onClick={() => onChange(values.filter((v) => v !== value))}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {!values.length && <span className="text-xs text-muted-foreground">还没有</span>}
      </div>
      <div className="flex gap-2">
        <Input value={draft} aria-label={`添加${label}`} placeholder={placeholder} className="h-8 text-xs"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.nativeEvent.isComposing) { e.preventDefault(); add(); } }} />
        <Button type="button" size="sm" variant="outline" onClick={add} disabled={!draft.trim()}><Plus className="h-3.5 w-3.5" />添加</Button>
      </div>
      {hint && <p className="text-xs leading-5 text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Pick any of a fixed set; pressed chips are on. */
export function ChipToggles<T extends string>({ label, options, values, onChange, disabledHint }: {
  label: string; options: { value: T; label: string; disabled?: boolean }[]; values: T[]; onChange: (next: T[]) => void; disabledHint?: string;
}) {
  return (
    <div className="min-w-0 space-y-1.5">
      <div className="text-sm font-medium">{label}</div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={label}>
        {options.map((option) => {
          const on = values.includes(option.value);
          return (
            <button key={option.value} type="button" aria-pressed={on} disabled={option.disabled && !on} title={option.disabled && !on ? disabledHint : undefined}
              onClick={() => onChange(on ? values.filter((v) => v !== option.value) : [...values, option.value])}
              className={cn("max-w-full truncate rounded-full border px-2.5 py-1 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                on ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-muted-foreground hover:text-foreground")}>
              {option.label}
            </button>
          );
        })}
        {!options.length && <span className="text-xs text-muted-foreground">{disabledHint}</span>}
      </div>
    </div>
  );
}

// ── 试跑 ────────────────────────────────────────────────────────────────────

export function PlanView({ plan }: { plan: StudioPlan }) {
  const list = (label: string, items: string[]) => items.length ? <div className="text-xs leading-5"><span className="font-medium">{label}：</span>{items.join("；")}</div> : null;
  return (
    <div className="space-y-3">
      {plan.summary && <p className="text-sm leading-6">{plan.summary}</p>}
      {!!plan.approaches?.length && (
        <div className="grid gap-2 md:grid-cols-2">
          {plan.approaches.map((a) => (
            <div key={a.id} className="min-w-0 space-y-1 rounded-md border border-border p-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-medium" title={a.title}>{a.title}</span>
                {a.id === plan.recommendedApproachId && <Badge tone="primary" className="shrink-0">推荐</Badge>}
              </div>
              {a.summary && <p className="text-xs leading-5 text-muted-foreground">{a.summary}</p>}
              {a.rationale && <p className="text-xs leading-5 text-muted-foreground">{a.rationale}</p>}
              {list("保留", a.preserve)}{list("改变", a.change)}{list("取舍", a.tradeoffs)}
            </div>
          ))}
        </div>
      )}
      {!!plan.steps.length && (
        <ol className="divide-y divide-border rounded-md border border-border">
          {plan.steps.map((s, i) => (
            <li key={s.id} className="flex min-w-0 items-start gap-3 px-3 py-2 text-sm">
              <span className="w-5 shrink-0 tabular-nums text-muted-foreground">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="truncate font-medium" title={s.title}>{s.title}</span>
                  <Badge tone="neutral" className="shrink-0">{OPERATION_LABEL[s.operation] ?? "其他"}</Badge>
                  {s.execution === "confirm" && <Badge tone="warning" className="shrink-0">这一步停下等用户确认</Badge>}
                </div>
                {s.prompt && <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted-foreground" title={s.prompt}>{s.prompt}</p>}
                {s.strategy && <p className="text-xs leading-5 text-muted-foreground">做法：{s.strategy.method}（{s.strategy.reason}）</p>}
                {!!s.dependsOn?.length && <p className="text-xs text-muted-foreground">依赖：第 {s.dependsOn.map((d) => plan.steps.findIndex((x) => x.id === d) + 1 || d).join("、")} 步</p>}
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{s.quotedCost === undefined ? "未报价" : `${s.quotedCost} 积分`}</span>
            </li>
          ))}
        </ol>
      )}
      {!!plan.questions.length && <div className="text-xs leading-5"><span className="font-medium">会问用户：</span>{plan.questions.join("；")}</div>}
      {!!plan.notes?.length && <div className="space-y-0.5 text-xs leading-5 text-muted-foreground">{plan.notes.map((n, i) => <p key={i}>{n}</p>)}</div>}
    </div>
  );
}

export type DryRunSource = "editor" | "current" | `v${number}`;
export function DryRunCard({ versions, currentVersion, dirty, running, result, error, source, onSource, onRun }: {
  versions: StudioSkillVersion[]; currentVersion: number; dirty: boolean; running: boolean; result: StudioSkillDryRunResult | null; error: string[];
  source: DryRunSource; onSource: (source: DryRunSource) => void;
  onRun: (input: { stage: StudioPlanStage; analysisMarkdown: string; brief: string }) => void;
}) {
  const [stage, setStage] = React.useState<StudioPlanStage>("analysis");
  const [analysisMarkdown, setAnalysis] = React.useState("");
  const [brief, setBrief] = React.useState("");
  const missing = !brief.trim() ? "先写一句这次要做什么" : stage === "production" && !analysisMarkdown.trim() ? "试跑制作阶段要先贴一份分析结论" : "";
  const sourceOptions: { value: DryRunSource; label: string }[] = [
    { value: "editor", label: dirty ? "编辑器里的内容（还没发布）" : "编辑器里的内容（和当前版本相同）" },
    { value: "current", label: `当前版本 v${currentVersion}` },
    ...versions.filter((v) => v.version !== currentVersion).map((v) => ({ value: `v${v.version}` as DryRunSource, label: `v${v.version}${v.status === "draft" ? "（待审阅草稿）" : ""}` })),
  ];
  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base"><FlaskConical className="h-4 w-4" />试跑</CardTitle>
        <p className="text-xs leading-5 text-muted-foreground">贴一份分析结论和一句需求，看这一版会编出什么计划。会真实调用一次规划模型，不扣用户积分，也不保存任何内容。</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="min-w-0 space-y-1.5">
            <span className="text-sm font-medium">用哪一版</span>
            <Select value={source} onValueChange={(v) => onSource(v as DryRunSource)}>
              <SelectTrigger aria-label="试跑用哪一版"><SelectValue /></SelectTrigger>
              <SelectContent>{sourceOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
            </Select>
          </label>
          <label className="min-w-0 space-y-1.5">
            <span className="text-sm font-medium">阶段</span>
            <Select value={stage} onValueChange={(v) => setStage(v as StudioPlanStage)}>
              <SelectTrigger aria-label="试跑阶段"><SelectValue /></SelectTrigger>
              <SelectContent>{STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
            </Select>
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">分析结论（Markdown）</span>
          <Textarea value={analysisMarkdown} onChange={(e) => setAnalysis(e.target.value)} rows={6} className="font-mono text-xs"
            placeholder={"第 1 段：人物出场，中景，交代场景。\n第 2 段：特写水杯，台词点出反转。"} />
          <span className="block text-xs text-muted-foreground">制作阶段必填；分析阶段可以留空，也可以贴原片的拉片笔记。</span>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium">这次要做什么</span>
          <Textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={2} placeholder="换成我的洗衣液，保留最后的反转" />
        </label>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" disabled={running || !!missing} title={missing || undefined} onClick={() => onRun({ stage, analysisMarkdown, brief })}>{running ? "试跑中…" : "试跑"}</Button>
          {missing && <span className="text-xs text-muted-foreground">{missing}</span>}
        </div>
        <ErrorList lines={error} />
        {result && (
          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={result.validation.ok ? "success" : "danger"}>{result.validation.ok ? "计划通过校验" : "计划没通过校验"}</Badge>
              <span className="text-xs text-muted-foreground">
                {result.skillVersion ? `v${result.skillVersion}` : "编辑器里的内容"} · {result.stage === "analysis" ? "分析" : "制作"} · {result.model || result.endpointId}
                {result.usage.totalTokens !== undefined ? ` · ${result.usage.totalTokens} tokens` : ""}
              </span>
            </div>
            <ErrorList lines={result.validation.errors} />
            {result.plan ? <PlanView plan={result.plan} /> : <p className="text-sm text-muted-foreground">没有可用的计划。</p>}
            {result.rawExcerpt && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground">模型回复的开头</summary>
                <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2 font-mono">{result.rawExcerpt}</pre>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── 版本表 ──────────────────────────────────────────────────────────────────

export function VersionsCard({ versions, loading, currentVersion, busyVersion, onRollback, onReview, onLoad, onTry }: {
  versions: StudioSkillVersion[]; loading: boolean; currentVersion: number; busyVersion?: number;
  onRollback: (v: StudioSkillVersion) => void; onReview: (v: StudioSkillVersion) => void; onLoad: (v: StudioSkillVersion) => void; onTry: (v: StudioSkillVersion) => void;
}) {
  return (
    <Card>
      <CardHeader className="flex-col items-start gap-1 space-y-0">
        <CardTitle className="text-base">版本记录</CardTitle>
        <p className="text-xs leading-5 text-muted-foreground">每一版都不能修改。回滚会用旧版本的内容生成一个新版本；对话整理出来的草稿要审阅后才会生效。</p>
      </CardHeader>
      <CardContent className="p-0">
        {loading && <div className="px-4 py-3 text-sm text-muted-foreground">加载中…</div>}
        {!loading && !versions.length && <div className="px-4 py-3 text-sm text-muted-foreground">还没有版本。</div>}
        {!loading && !!versions.length && (
          <ul className="divide-y divide-border border-t border-border" aria-label="版本列表">
            {versions.map((v) => {
              const draft = v.status === "draft", current = v.version === currentVersion;
              return (
                <li key={v.id} aria-label={`v${v.version}`} className={cn("flex min-w-0 flex-col gap-2 px-4 py-3 2xl:flex-row 2xl:items-center 2xl:gap-4", current && "bg-primary/5")}>
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="text-sm font-medium tabular-nums">v{v.version}</span>
                      {current && <Badge tone="success">当前</Badge>}
                      {draft && <Badge tone="warning">待审阅</Badge>}
                      <Badge tone={v.source === "distilled" ? "primary" : "neutral"}>{SOURCE_LABEL[v.source] ?? v.source}</Badge>
                      <span className="text-xs tabular-nums text-muted-foreground">{formatDateTimeCN(v.publishedAt || v.createdAt)}</span>
                    </div>
                    <div className="truncate text-xs" title={v.note || undefined}>{v.note || "没有说明"}</div>
                    <div className="truncate text-xs text-muted-foreground" title={v.author}>{v.author}{draft && v.baseVersion ? ` · 基于 v${v.baseVersion}` : ""}</div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5">
                    <Button size="sm" variant="ghost" onClick={() => onLoad(v)}>载入编辑器</Button>
                    <Button size="sm" variant="ghost" onClick={() => onTry(v)}>试跑这一版</Button>
                    {draft ? <Button size="sm" variant="outline" onClick={() => onReview(v)}>审阅后发布</Button>
                      : !current && <Button size="sm" variant="outline" disabled={busyVersion === v.version} onClick={() => onRollback(v)}>{busyVersion === v.version ? "回滚中…" : "回滚到此版本"}</Button>}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

// ── 审阅整理草稿 ────────────────────────────────────────────────────────────

export function DraftReviewDialog({ draft, current, currentVersion, publishing, error, onClose, onPublish, onLoad, onTry }: {
  draft: StudioSkillVersion | null; current?: StudioSkillVersion; currentVersion: number; publishing: boolean; error: string[];
  onClose: () => void; onPublish: (draft: StudioSkillVersion, note: string) => void; onLoad: (draft: StudioSkillVersion) => void; onTry: (draft: StudioSkillVersion) => void;
}) {
  const [note, setNote] = React.useState("");
  React.useEffect(() => { setNote(""); }, [draft?.id]);
  if (!draft) return null;
  // The server publishes a draft as is only while it is still a revision of the current version.
  const stale = draft.baseVersion !== currentVersion;
  const changes = current ? changedParts(current, draft) : [];
  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>审阅草稿 v{draft.version}</DialogTitle>
          <DialogDescription>这份草稿从一次成功的制作里整理出来，素材和画布内容都已经去掉。发布后新开始的规划立刻按它执行，进行中的制作仍按原来的版本。</DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-3 text-sm">
          <div className="grid gap-1 text-xs text-muted-foreground">
            <span>整理说明：{draft.note || "没有说明"}</span>
            <span>基于 v{draft.baseVersion ?? "?"} 整理 · {draft.author} · {formatDateTimeCN(draft.createdAt)}</span>
            {(draft.sourceProjectId || draft.sourceExecutionId) && <span className="truncate" title={`画布 ${draft.sourceProjectId ?? ""} · 制作 ${draft.sourceExecutionId ?? ""}`}>来源：画布 {draft.sourceProjectId ?? "未知"}，制作 {draft.sourceExecutionId ?? "未知"}</span>}
          </div>
          <div className="rounded-md border border-border bg-surface-muted/50 px-3 py-2 text-xs leading-5">
            <span className="font-medium">和当前 v{currentVersion} 相比改了：</span>{changes.length ? changes.join("、") : "没有看出差别"}
          </div>
          {stale && <ErrorList lines={[`这份草稿是在 v${draft.baseVersion ?? "?"} 上整理的，之后已经换成了 v${currentVersion}，不能直接发布。可以载入编辑器，对照当前版本改完再发布。`]} />}
          <details open className="text-xs">
            <summary className="cursor-pointer font-medium">正文</summary>
            <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono leading-5">{draft.bodyMd}</pre>
          </details>
          <details className="text-xs">
            <summary className="cursor-pointer font-medium">头部</summary>
            <pre className="mt-2 max-h-60 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 font-mono leading-5">{JSON.stringify(draft.frontmatter, null, 2)}</pre>
          </details>
          {!stale && (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">发布说明（选填，写进版本记录）</span>
              <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="看过了，口播段的写法可以推广" />
            </label>
          )}
          <ErrorList lines={error} />
        </div>
        <DialogFooter className="flex-wrap gap-2">
          <Button variant="outline" onClick={() => onTry(draft)}>试跑这一版</Button>
          <Button variant="outline" onClick={() => onLoad(draft)}>载入编辑器</Button>
          <Button disabled={stale || publishing} onClick={() => onPublish(draft, note.trim())}>{publishing ? "发布中…" : "发布这一版"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── 新建技能 ────────────────────────────────────────────────────────────────

export function CreateSkillDialog({ open, creating, error, onClose, onCreate }: {
  open: boolean; creating: boolean; error: string[]; onClose: () => void; onCreate: (markdown: string, note: string) => void;
}) {
  const [markdown, setMarkdown] = React.useState("");
  const [note, setNote] = React.useState("");
  React.useEffect(() => { if (open) { setMarkdown(""); setNote(""); } }, [open]);
  const looksLikeFile = /^﻿?---\r?\n[\s\S]*?\r?\n---/.test(markdown);
  return (
    <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>新建技能</DialogTitle>
          <DialogDescription>贴一整份技能文件：开头用 --- 包住的头部写标识、名称和执行边界，下面是写给规划模型看的方法正文。新技能默认是草稿，试跑没问题再启用。</DialogDescription>
        </DialogHeader>
        <div className="min-w-0 space-y-3">
          <Textarea aria-label="技能文件" value={markdown} onChange={(e) => setMarkdown(e.target.value)} rows={16} className="font-mono text-xs" placeholder={SKILL_TEMPLATE} />
          <div className="flex flex-wrap items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setMarkdown(SKILL_TEMPLATE)}>填入模板</Button>
            {markdown.trim() && !looksLikeFile && <span className="text-xs text-warning">没找到头部：文件要以一行 --- 开头，头部写完再用一行 --- 结束</span>}
          </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">说明（选填，写进版本记录）</span>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="新建口播种草技能" />
          </label>
          <ErrorList lines={error} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>取消</Button>
          <Button disabled={creating || !looksLikeFile} onClick={() => onCreate(markdown, note.trim())}>{creating ? "创建中…" : "创建"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
