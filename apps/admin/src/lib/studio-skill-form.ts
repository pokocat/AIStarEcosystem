// ─────────────────────────────────────────────────────────────────────────────
// lib/studio-skill-form.ts — 「Studio 技能」后台编辑表单与技能头部（front matter）之间的换算。
//
// 发布时把表单合并回这一版原来的头部对象（StudioSkillPublishRequest.frontmatter 接受 JSON 对象），
// 表单不管的字段（key / version / planning / maxSteps 的推导式 / 将来新增的字段）原样保留，
// 不在前端重新拼 YAML。服务端仍会完整校验一遍；这里只先拦住明显填错的（autoFixChecks ⊆ checks 等）。
// ─────────────────────────────────────────────────────────────────────────────

import type { StudioPlanOperation, StudioPlanStage, StudioSkillStatus, StudioSkillSummary, StudioSkillTriggers, StudioSkillVersionSource } from "@/types/studio-skills";

export type TriggerMedia = NonNullable<StudioSkillTriggers["media"]>[number];

export interface SkillForm {
  name: string;
  summary: string;
  methodExamples: string[];
  operations: Record<StudioPlanStage, StudioPlanOperation[]>;
  maxSourceSec: string;
  maxSegments: string;
  /** true = 每段时长按所选视频模型的最长时长（maxSegmentSec: model）。 */
  segmentByModel: boolean;
  maxSegmentSec: string;
  maxAutoFixPerSegment: string;
  checks: string[];
  autoFixChecks: string[];
  requiredCapabilities: string[];
  triggerMedia: TriggerMedia[];
  triggerKeywords: string[];
  triggerDefault: boolean;
  bodyMd: string;
}

export const STAGES: { value: StudioPlanStage; label: string }[] = [
  { value: "analysis", label: "分析" },
  { value: "production", label: "制作" },
];
/** 可在技能里开放的操作。剧本 / 分镜只给旧的建议流程用，不在技能里开放。 */
export const SKILL_OPERATIONS: { value: StudioPlanOperation; label: string }[] = [
  { value: "recreation", label: "拉片" },
  { value: "text", label: "文字" },
  { value: "image", label: "图片" },
  { value: "video", label: "视频" },
  { value: "check", label: "检查" },
  { value: "assemble", label: "合成" },
];
export const OPERATION_LABEL: Record<StudioPlanOperation, string> = {
  text: "文字", script: "剧本", storyboard: "分镜", image: "图片", video: "视频", recreation: "拉片", check: "检查", assemble: "合成",
};
export const TRIGGER_MEDIA: { value: TriggerMedia; label: string }[] = [
  { value: "video", label: "视频" },
  { value: "image", label: "图片" },
  { value: "audio", label: "音频" },
  { value: "text", label: "文字" },
];
export const STATUS_META: Record<StudioSkillStatus, { label: string; tone: "success" | "warning" | "neutral"; hint: string }> = {
  active: { label: "启用", tone: "success", hint: "对话里可以用，用户没选时也会按路由提示自动挑" },
  draft: { label: "草稿", tone: "warning", hint: "只能在后台试跑，用户那边看不到" },
  withdrawn: { label: "已停用", tone: "neutral", hint: "不再接新的对话；进行中的制作照常完成" },
};
export const SOURCE_LABEL: Record<StudioSkillVersionSource, string> = {
  seed: "仓内文件", admin: "后台发布", rollback: "回滚", distilled: "对话整理",
};

const CHECK_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const strings = (value: unknown): string[] => Array.isArray(value) ? value.map(v => String(v)).filter(Boolean) : [];
const record = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
const numberText = (value: unknown, fallback = "") => typeof value === "number" && Number.isFinite(value) ? String(value) : typeof value === "string" && /^\d+$/.test(value.trim()) ? value.trim() : fallback;

/** Form values from a stored version's front matter; the runtime summary fills what the raw object lacks. */
export function formFromVersion(version: { frontmatter: Record<string, unknown>; bodyMd: string }, fallback?: StudioSkillSummary): SkillForm {
  const fm = version.frontmatter || {};
  const ops = record(fm.operations), limits = record(fm.limits), triggers = record(fm.triggers);
  const stageOps = (stage: StudioPlanStage) => {
    const raw = strings(ops[stage]);
    return (raw.length || !fallback ? raw : fallback.operations[stage]) as StudioPlanOperation[];
  };
  const segmentSec = limits.maxSegmentSec ?? fallback?.limits.maxSegmentSec;
  return {
    name: String(fm.name ?? fallback?.name ?? ""),
    summary: String(fm.summary ?? fallback?.summary ?? ""),
    methodExamples: fm.methodExamples !== undefined ? strings(fm.methodExamples) : fallback?.methodExamples ?? [],
    operations: { analysis: stageOps("analysis"), production: stageOps("production") },
    maxSourceSec: numberText(limits.maxSourceSec, fallback ? String(fallback.limits.maxSourceSec) : ""),
    maxSegments: numberText(limits.maxSegments, fallback ? String(fallback.limits.maxSegments) : ""),
    segmentByModel: segmentSec === "model",
    maxSegmentSec: segmentSec === "model" ? "" : numberText(segmentSec),
    maxAutoFixPerSegment: numberText(limits.maxAutoFixPerSegment, fallback ? String(fallback.limits.maxAutoFixPerSegment) : "0"),
    checks: fm.checks !== undefined ? strings(fm.checks) : fallback?.checks ?? [],
    autoFixChecks: fm.autoFixChecks !== undefined ? strings(fm.autoFixChecks) : fallback?.autoFixChecks ?? [],
    requiredCapabilities: fm.requiredCapabilities !== undefined ? strings(fm.requiredCapabilities) : fallback?.requiredCapabilities ?? [],
    triggerMedia: strings(triggers.media).filter((m): m is TriggerMedia => TRIGGER_MEDIA.some(t => t.value === m)),
    triggerKeywords: strings(triggers.keywords),
    triggerDefault: triggers.default === true,
    bodyMd: version.bodyMd || "",
  };
}

/** Problems the server would reject anyway, caught before a round trip. Empty = ready to publish. */
export function validateSkillForm(form: SkillForm): string[] {
  const errors: string[] = [];
  if (!form.name.trim()) errors.push("请填写名称");
  if (!form.summary.trim()) errors.push("请填写用途说明");
  for (const stage of STAGES) if (!form.operations[stage.value].length) errors.push(`${stage.label}阶段至少要开放一种操作`);
  const positive = (label: string, value: string) => { if (!/^\d+$/.test(value.trim()) || Number(value) <= 0) errors.push(`${label}要填正整数`); };
  positive("原片最长秒数", form.maxSourceSec);
  positive("最多段数", form.maxSegments);
  if (!form.segmentByModel) positive("每段最长秒数", form.maxSegmentSec);
  if (!/^\d+$/.test(form.maxAutoFixPerSegment.trim())) errors.push("每段自动修正次数要填 0 或正整数");
  const seen = new Set<string>();
  for (const id of form.checks) {
    if (!CHECK_ID.test(id)) errors.push(`检查项「${id}」只能用小写字母、数字和连字符`);
    if (seen.has(id)) errors.push(`检查项「${id}」重复了`);
    seen.add(id);
  }
  for (const id of form.autoFixChecks) if (!form.checks.includes(id)) errors.push(`自动修正项「${id}」不在检查项里，先把它加进检查项`);
  if (form.autoFixChecks.length && Number(form.maxAutoFixPerSegment) === 0) errors.push("开了自动修正项，每段自动修正次数至少要 1 次");
  if (!form.bodyMd.trim()) errors.push("正文不能为空");
  return errors;
}

/** The form merged back onto the version's own front matter object; fields the form does not edit stay as they were. */
export function frontmatterFromForm(base: Record<string, unknown>, form: SkillForm): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base };
  out.name = form.name.trim();
  out.summary = form.summary.trim();
  out.methodExamples = [...form.methodExamples];
  out.operations = { ...record(base.operations), analysis: [...form.operations.analysis], production: [...form.operations.production] };
  out.limits = {
    ...record(base.limits),
    maxSourceSec: Number(form.maxSourceSec),
    maxSegments: Number(form.maxSegments),
    maxSegmentSec: form.segmentByModel ? "model" : Number(form.maxSegmentSec),
    maxAutoFixPerSegment: Number(form.maxAutoFixPerSegment),
  };
  out.checks = [...form.checks];
  out.autoFixChecks = form.autoFixChecks.filter(id => form.checks.includes(id));
  out.requiredCapabilities = [...form.requiredCapabilities];
  const triggers: Record<string, unknown> = { ...record(base.triggers) };
  delete triggers.media; delete triggers.keywords; delete triggers.default;
  if (form.triggerMedia.length) triggers.media = [...form.triggerMedia];
  if (form.triggerKeywords.length) triggers.keywords = [...form.triggerKeywords];
  if (form.triggerDefault) triggers.default = true;
  if (Object.keys(triggers).length) out.triggers = triggers; else delete out.triggers;
  return out;
}

/** Stable JSON for change detection (key order does not count as a change). */
export function stableJson(value: unknown): string {
  const sort = (v: unknown): unknown => Array.isArray(v) ? v.map(sort)
    : v && typeof v === "object" ? Object.fromEntries(Object.keys(v as object).sort().map(k => [k, sort((v as Record<string, unknown>)[k])])) : v;
  return JSON.stringify(sort(value));
}

/** How the step cap reads: the server derives it from the segment count unless the file pins a number. */
export function maxStepsText(base: Record<string, unknown>, form: SkillForm, evaluated?: number): string {
  const raw = record(base.limits).maxSteps;
  const segments = Number(form.maxSegments);
  if (typeof raw === "number") return `${raw} 步（文件里写死的数）`;
  if (Number.isFinite(segments) && segments > 0) return `${segments * 3 + 4} 步（段数 × 3 + 4）`;
  return evaluated ? `${evaluated} 步` : "按段数推出";
}

export function triggersSummary(triggers?: StudioSkillTriggers): string {
  if (!triggers) return "没有路由提示";
  const parts = [
    triggers.media?.length ? `带${triggers.media.map(m => TRIGGER_MEDIA.find(t => t.value === m)?.label ?? m).join("、")}` : "",
    triggers.keywords?.length ? `说到「${triggers.keywords.slice(0, 3).join("」「")}」${triggers.keywords.length > 3 ? "等" : ""}` : "",
    triggers.default ? "默认" : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : "没有路由提示";
}

/** Which top-level parts of a draft differ from the current version, in the form's own words. */
export function changedParts(current: { frontmatter: Record<string, unknown>; bodyMd: string }, next: { frontmatter: Record<string, unknown>; bodyMd: string }): string[] {
  const labels: [string, string][] = [["name", "名称"], ["summary", "用途说明"], ["methodExamples", "方法示例"], ["operations", "各阶段操作"], ["limits", "上限"],
    ["checks", "检查项"], ["autoFixChecks", "自动修正项"], ["requiredCapabilities", "能力要求"], ["triggers", "路由提示"]];
  const out = labels.filter(([key]) => stableJson(current.frontmatter[key]) !== stableJson(next.frontmatter[key])).map(([, label]) => label);
  const before = new Set(current.bodyMd.split(/\r?\n/)), after = new Set(next.bodyMd.split(/\r?\n/));
  const added = [...after].filter(l => l.trim() && !before.has(l)).length, removed = [...before].filter(l => l.trim() && !after.has(l)).length;
  if (added || removed) out.push(`正文（新增 ${added} 行，删掉 ${removed} 行）`);
  return out;
}

export const SKILL_TEMPLATE = `---
key: my-new-skill
name: 新技能
status: draft
planning: dynamic
summary: 一句话说清这个技能帮用户做什么
methodExamples: []
operations:
  analysis: [text]
  production: [text, image, video, check, assemble]
limits:
  maxSourceSec: 60
  maxSegments: 4
  maxSegmentSec: model
  maxSteps: "maxSegments * 3 + 4"
  maxAutoFixPerSegment: 1
checks: []
autoFixChecks: []
requiredCapabilities: [vision-text-model]
triggers:
  keywords: []
---

# 新技能

写给规划模型看的方法：适用和不适用的情况、先看素材的什么、怎么分段、提示词怎么写、检查依据。
`;
