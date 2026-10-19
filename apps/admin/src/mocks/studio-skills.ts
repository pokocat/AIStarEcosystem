// ─────────────────────────────────────────────────────────────────────────────
// mocks/studio-skills.ts — NEXT_PUBLIC_USE_MOCK=1 时「Studio 技能」后台的内存实现（无网络）。
// 形状照 types/studio-skills.ts（= packages/types 的 S3 契约）；版本只追加不修改，和服务端一样。
// 试跑返回的是写死的示例计划，不是模型输出。
// ─────────────────────────────────────────────────────────────────────────────

import { ApiError } from "@/api/_client";
import type {
  StudioPlan, StudioPlanOperation, StudioPlanStage, StudioSkillAdminDetail, StudioSkillAdminItem, StudioSkillCreateRequest,
  StudioSkillDryRunRequest, StudioSkillDryRunResult, StudioSkillPublishRequest, StudioSkillStatus, StudioSkillStatusRequest,
  StudioSkillSummary, StudioSkillVersion, StudioSkillVersionActionRequest,
} from "@/types/studio-skills";

type Frontmatter = Record<string, unknown>;
interface MockSkill { key: string; status: StudioSkillStatus; currentVersion: number; createdAt: string; updatedAt: string; updatedBy?: string; seedFile?: string; versions: StudioSkillVersion[] }

const fail = (status: number, code: string, message: string, details?: unknown): never => { throw new ApiError({ code, message, details }, status); };
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const now = () => new Date().toISOString();

const RECREATION_V1: Frontmatter = {
  key: "reference-video-recreation", name: "参考视频复刻", version: 1, status: "active", planning: "dynamic",
  summary: "看懂一条参考视频的创意、脚本与手法，结合用户的新商品/新人物素材，现场决定做法并编排制作、检查与合成。",
  methodExamples: ["remap-subject", "creative-rewrite", "preserve-audio-rebuild-visuals", "keyframe-rebuild"],
  operations: { analysis: ["recreation", "text"], production: ["text", "image", "video", "check", "assemble"] },
  limits: { maxSourceSec: 60, maxSegments: 8, maxSegmentSec: "model", maxSteps: "maxSegments * 3 + 4", maxAutoFixPerSegment: 2 },
  checks: ["subject-replaced", "old-subject-residue", "character-consistency", "product-facts", "scene-and-action", "dialogue-and-subtitles", "duration-and-order"],
  autoFixChecks: [], requiredCapabilities: ["vision-text-model", "video-generation", "film-study"],
};
const RECREATION_BODY = `# 参考视频复刻

你是 Studio 的制作助手。用户给你一条参考视频和自己的素材（商品图、人物图、文案、价格等事实），要的是「照这条视频的路子，做一条属于他的」。

## 看片：先确认什么
1. 原片的推进方式：用一句话说清「开场、冲突、转折、收束」，这是要保留的骨架。
2. 主体与可替换性：哪些是商品、哪些是人物、哪些是场景道具。

## 分段规则
- 分段服从叙事与动作，不是一个切镜一个任务。
- 合并 3 秒以内的碎段；每段不超过所选视频模型的最长时长。
`;
const RECREATION_V2: Frontmatter = { ...RECREATION_V1, version: 2, triggers: { media: ["video"], keywords: ["复刻", "照着做", "同款"], default: true } };
const RECREATION_DRAFT_BODY = `${RECREATION_BODY}
## 口播段（整理自一次成功制作）
- 口播段只换人物手里的商品，人物和机位不动。
- 合并 2 秒以内的碎段，避免同一句台词被切成两段。
`;
const SEEDING_V1: Frontmatter = {
  key: "talking-head-seeding", name: "口播种草", version: 1, status: "draft", planning: "dynamic",
  summary: "按用户的商品卖点写口播脚本，配商品特写和字幕，做成一条 30 秒以内的种草视频。",
  methodExamples: ["script-first", "product-closeups"],
  operations: { analysis: ["text"], production: ["text", "image", "video", "check", "assemble"] },
  limits: { maxSourceSec: 30, maxSegments: 4, maxSegmentSec: 10, maxSteps: "maxSegments * 3 + 4", maxAutoFixPerSegment: 1 },
  checks: ["product-facts", "dialogue-and-subtitles"], autoFixChecks: [], requiredCapabilities: ["vision-text-model", "video-generation"],
  triggers: { media: ["image"], keywords: ["口播", "种草"] },
};
const SEEDING_BODY = `# 口播种草

先用用户给的卖点写一版口播，再按句子配画面。价格、功效只来自用户资料。
`;

function version(key: string, n: number, fm: Frontmatter, bodyMd: string, extra: Partial<StudioSkillVersion>): StudioSkillVersion {
  return { id: `ISV-${key}-${n}`, skillKey: key, version: n, status: "published", source: "admin", author: "admin", createdAt: "2026-10-18T02:00:00Z",
    frontmatter: { ...fm, version: n }, bodyMd, current: false, publishedAt: "2026-10-18T02:00:00Z", ...extra };
}

let skills: MockSkill[] = [];
function seed() {
  skills = [
    { key: "reference-video-recreation", status: "active", currentVersion: 2, createdAt: "2026-10-18T01:00:00Z", updatedAt: "2026-10-18T03:20:00Z", updatedBy: "admin", seedFile: "reference-video-recreation.md",
      versions: [
        version("reference-video-recreation", 1, RECREATION_V1, RECREATION_BODY, { source: "seed", author: "仓内文件", note: "从仓内技能文件导入", createdAt: "2026-10-18T01:00:00Z", publishedAt: "2026-10-18T01:00:00Z" }),
        version("reference-video-recreation", 2, RECREATION_V2, RECREATION_BODY, { note: "加上路由提示：带视频或说「复刻」时优先用", createdAt: "2026-10-18T03:20:00Z", publishedAt: "2026-10-18T03:20:00Z" }),
        version("reference-video-recreation", 3, RECREATION_V2, RECREATION_DRAFT_BODY, { status: "draft", source: "distilled", author: "operator", note: "整理自一次洗衣液复刻：口播段只换商品，合并 2 秒内碎段",
          createdAt: "2026-10-18T05:40:00Z", publishedAt: undefined, baseVersion: 2, sourceProjectId: "IPP-mock-laundry", sourceExecutionId: "IPX-mock-laundry", sourceRunId: "IPR-mock-distill" }),
      ] },
    { key: "talking-head-seeding", status: "draft", currentVersion: 1, createdAt: "2026-10-18T04:00:00Z", updatedAt: "2026-10-18T04:00:00Z", updatedBy: "admin",
      versions: [version("talking-head-seeding", 1, SEEDING_V1, SEEDING_BODY, { note: "新建", createdAt: "2026-10-18T04:00:00Z", publishedAt: "2026-10-18T04:00:00Z" })] },
  ];
}
seed();

/** Tests only. */
export function resetMockStudioSkills() { seed(); }

const strings = (v: unknown) => Array.isArray(v) ? v.map(String) : [];
const OPS: StudioPlanOperation[] = ["text", "script", "storyboard", "image", "video", "recreation", "check", "assemble"];
function summaryOf(skill: MockSkill, fm: Frontmatter): StudioSkillSummary {
  const ops = (fm.operations || {}) as Record<string, unknown>;
  const limits = (fm.limits || {}) as Record<string, unknown>;
  const segments = Number(limits.maxSegments) || 0;
  const steps = typeof limits.maxSteps === "number" ? limits.maxSteps : segments * 3 + 4;
  const stage = (s: StudioPlanStage) => strings(ops[s]).filter((op): op is StudioPlanOperation => (OPS as string[]).includes(op));
  return {
    key: skill.key, name: String(fm.name || skill.key), version: skill.currentVersion, status: skill.status, planning: "dynamic", summary: String(fm.summary || ""),
    methodExamples: strings(fm.methodExamples), operations: { analysis: stage("analysis"), production: stage("production") },
    limits: { maxSourceSec: Number(limits.maxSourceSec) || 0, maxSegments: segments, maxSegmentSec: limits.maxSegmentSec === "model" ? "model" : Number(limits.maxSegmentSec) || 0,
      maxSteps: steps, maxAutoFixPerSegment: Number(limits.maxAutoFixPerSegment) || 0 },
    checks: strings(fm.checks), autoFixChecks: strings(fm.autoFixChecks), requiredCapabilities: strings(fm.requiredCapabilities),
    ...(fm.triggers ? { triggers: clone(fm.triggers) as StudioSkillSummary["triggers"] } : {}),
  };
}
const find = (key: string) => skills.find(s => s.key === key) ?? fail(404, "STUDIO_SKILL_NOT_FOUND", "技能不存在");
const currentOf = (s: MockSkill) => s.versions.find(v => v.version === s.currentVersion)!;
function item(s: MockSkill): StudioSkillAdminItem {
  const current = currentOf(s);
  return { key: s.key, name: String(current.frontmatter.name || s.key), status: s.status, currentVersion: s.currentVersion, summary: String(current.frontmatter.summary || ""),
    updatedBy: s.updatedBy, createdAt: s.createdAt, updatedAt: s.updatedAt,
    pendingDrafts: s.versions.filter(v => v.status === "draft" && v.version > s.currentVersion).length,
    skill: summaryOf(s, current.frontmatter), ...(s.seedFile ? { seedFile: s.seedFile } : {}) };
}
function detail(s: MockSkill): StudioSkillAdminDetail {
  return clone({ ...item(s), current: { ...currentOf(s), current: true } });
}

/** Same checks the server runs before accepting a version (the subset the demo can express). */
function validate(key: string, fm: Frontmatter): string[] {
  const errors: string[] = [];
  if (fm.key !== undefined && fm.key !== key) errors.push(`头部的 key 是「${String(fm.key)}」，和这个技能的标识「${key}」不一致`);
  if (!String(fm.name || "").trim()) errors.push("缺少名称（name）");
  if (!String(fm.summary || "").trim()) errors.push("缺少用途说明（summary）");
  const checks = strings(fm.checks);
  for (const id of strings(fm.autoFixChecks)) if (!checks.includes(id)) errors.push(`自动修正项「${id}」不在检查项里`);
  const ops = (fm.operations || {}) as Record<string, unknown>;
  for (const stage of ["analysis", "production"]) if (!strings(ops[stage]).length) errors.push(`${stage === "analysis" ? "分析" : "制作"}阶段至少要开放一种操作`);
  return errors;
}
function invalid(errors: string[]): never { return fail(400, "STUDIO_SKILL_INVALID", errors.join("；"), { errors }); }

/** A deliberately small YAML reader: `key: value`, inline `[a, b]` lists, `- item` lists and one level of nested maps. */
function parseFrontmatter(yaml: string): Frontmatter {
  const scalar = (raw: string): unknown => {
    const v = raw.trim();
    if (v === "") return undefined;
    if (v.startsWith("[") && v.endsWith("]")) return v.slice(1, -1).split(",").map(s => s.trim()).filter(Boolean).map(s => scalar(s));
    if (/^".*"$/.test(v)) { try { return JSON.parse(v); } catch { return v.slice(1, -1); } }
    if (/^'.*'$/.test(v)) return v.slice(1, -1);
    if (v === "true" || v === "false") return v === "true";
    if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
    return v;
  };
  const out: Frontmatter = {};
  let parent: string | undefined, nested: Record<string, unknown> | undefined, list: unknown[] | undefined;
  for (const line of yaml.split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith("#")) continue;
    const top = /^([A-Za-z][\w-]*):(.*)$/.exec(line);
    if (top) {
      parent = top[1]; nested = undefined; list = undefined;
      const value = scalar(top[2]);
      out[parent] = value;
      continue;
    }
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && parent) { if (!Array.isArray(out[parent])) out[parent] = list = []; (list ||= out[parent] as unknown[]).push(scalar(item[1])); continue; }
    const child = /^\s+([A-Za-z][\w-]*):(.*)$/.exec(line);
    if (child && parent) {
      if (!nested) out[parent] = nested = {};
      nested[child[1]] = scalar(child[2]);
    }
  }
  return out;
}
function splitMarkdown(markdown: string) {
  const match = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(markdown);
  return match ? { frontmatter: parseFrontmatter(match[1]), bodyMd: match[2].replace(/^\r?\n/, "") } : undefined;
}
const frontmatterOf = (value: string | Record<string, unknown>) => typeof value === "string" ? parseFrontmatter(value) : clone(value);

export function mockListStudioSkills(): StudioSkillAdminItem[] { return clone(skills.map(item)); }
export function mockGetStudioSkill(key: string): StudioSkillAdminDetail { return detail(find(key)); }
export function mockListStudioSkillVersions(key: string): StudioSkillVersion[] {
  const s = find(key);
  return clone([...s.versions].sort((a, b) => b.version - a.version).map(v => ({ ...v, current: v.version === s.currentVersion })));
}

export function mockCreateStudioSkill(body: StudioSkillCreateRequest): StudioSkillAdminDetail {
  const parsed = splitMarkdown(body.markdown || "");
  if (!parsed) return invalid(["没有找到头部：文件要以 --- 开头，头部写完再用一行 --- 结束"]);
  const key = String(parsed.frontmatter.key || "").trim();
  if (!/^[a-z0-9][a-z0-9-]{1,63}$/.test(key)) return invalid(["头部的 key 只能用小写字母、数字和连字符，2 到 64 个字符"]);
  if (skills.some(s => s.key === key)) fail(409, "STUDIO_SKILL_EXISTS", `已有标识为「${key}」的技能，请在它的详情里发布新版本`);
  const errors = validate(key, parsed.frontmatter);
  if (errors.length) invalid(errors);
  const at = now();
  const skill: MockSkill = { key, status: parsed.frontmatter.status === "active" ? "active" : "draft", currentVersion: 1, createdAt: at, updatedAt: at, updatedBy: "admin",
    versions: [version(key, 1, parsed.frontmatter, parsed.bodyMd, { note: body.note || "新建", createdAt: at, publishedAt: at })] };
  skills = [...skills, skill];
  return detail(skill);
}

function append(s: MockSkill, v: Omit<StudioSkillVersion, "id" | "skillKey" | "version" | "createdAt" | "author">) {
  const n = Math.max(...s.versions.map(x => x.version)) + 1, at = now();
  const next: StudioSkillVersion = { ...v, id: `ISV-${s.key}-${n}`, skillKey: s.key, version: n, createdAt: at, author: "admin", frontmatter: { ...v.frontmatter, key: s.key, version: n } };
  s.versions = [...s.versions, next];
  if (next.status !== "draft") { s.currentVersion = n; s.updatedAt = at; s.updatedBy = "admin"; }
  return next;
}
function requireCurrent(s: MockSkill, expectedVersion?: number) {
  if (expectedVersion !== undefined && expectedVersion !== s.currentVersion)
    fail(409, "STUDIO_SKILL_VERSION_CONFLICT", `这个技能已经发布了 v${s.currentVersion}，你编辑的是 v${expectedVersion}。请刷新后在最新版本上修改`);
}

/** Like the server: at most one active default skill, so routing never guesses between two fallbacks. */
function requireNoOtherDefault(self: string, fm: Frontmatter) {
  if ((fm.triggers as { default?: unknown } | undefined)?.default !== true) return;
  const other = skills.find(x => x.key !== self && x.status === "active" && (currentOf(x).frontmatter.triggers as { default?: unknown } | undefined)?.default === true);
  if (other) fail(409, "STUDIO_SKILL_DEFAULT_CONFLICT", `「${String(currentOf(other).frontmatter.name)}」已经是默认技能，同时只能有一个默认；请先去掉它的默认再保存`, { skillKey: other.key });
}

export function mockPublishStudioSkillVersion(key: string, body: StudioSkillPublishRequest): StudioSkillAdminDetail {
  const s = find(key);
  requireCurrent(s, body.expectedVersion);
  const fm = frontmatterOf(body.frontmatter);
  const errors = validate(key, fm);
  if (!String(body.bodyMd || "").trim()) errors.push("正文不能为空");
  if (errors.length) invalid(errors);
  if (s.status === "active") requireNoOtherDefault(key, fm);
  append(s, { status: "published", source: "admin", note: body.note, frontmatter: fm, bodyMd: body.bodyMd, publishedAt: now() });
  return detail(s);
}

export function mockSetStudioSkillStatus(key: string, body: StudioSkillStatusRequest): StudioSkillAdminDetail {
  const s = find(key);
  if (s.status === "active" && body.status !== "active" && skills.filter(x => x.status === "active").length <= 1)
    fail(409, "STUDIO_SKILL_LAST_ACTIVE", "这是唯一启用的技能，不能停用");
  if (body.status === "active") requireNoOtherDefault(key, currentOf(s).frontmatter);
  s.status = body.status; s.updatedAt = now(); s.updatedBy = "admin";
  return detail(s);
}

export function mockRollbackStudioSkill(key: string, target: number, body: StudioSkillVersionActionRequest): StudioSkillAdminDetail {
  const s = find(key);
  requireCurrent(s, body.expectedVersion);
  const from = s.versions.find(v => v.version === target && v.status !== "draft") ?? fail(404, "STUDIO_SKILL_VERSION_NOT_FOUND", "这个版本不存在或还没发布");
  if (from.version === s.currentVersion) fail(409, "STUDIO_SKILL_VERSION_CONFLICT", "这已经是当前版本");
  append(s, { status: "published", source: "rollback", note: body.note || `回滚到 v${target}`, frontmatter: clone(from.frontmatter), bodyMd: from.bodyMd, publishedAt: now() });
  return detail(s);
}

export function mockPublishStudioSkillDraft(key: string, target: number, body: StudioSkillVersionActionRequest): StudioSkillAdminDetail {
  const s = find(key);
  requireCurrent(s, body.expectedVersion);
  const draft = s.versions.find(v => v.version === target && v.status === "draft") ?? fail(404, "STUDIO_SKILL_VERSION_NOT_FOUND", "这份草稿不存在或已经发布");
  if (draft.baseVersion !== s.currentVersion)
    fail(409, "STUDIO_SKILL_DRAFT_STALE", `这份草稿是在 v${draft.baseVersion} 的基础上整理的，之后已经换成了 v${s.currentVersion}；请对照当前版本手动合并后再发布`);
  if (s.status === "active") requireNoOtherDefault(s.key, draft.frontmatter);
  const errors = validate(key, draft.frontmatter);
  if (errors.length) invalid(errors);
  s.versions = s.versions.map(v => v.version === target ? { ...v, status: "published", publishedAt: now(), ...(body.note ? { note: body.note } : {}) } : v);
  s.currentVersion = target; s.updatedAt = now(); s.updatedBy = "admin";
  return detail(s);
}

export function mockDryRunStudioSkill(key: string, body: StudioSkillDryRunRequest): StudioSkillDryRunResult {
  const s = find(key);
  if (!body.brief?.trim()) fail(400, "STUDIO_INPUT_INVALID", "请写一句这次要做什么");
  const stage = body.stage || "analysis";
  if (stage === "production" && !body.analysisMarkdown?.trim()) fail(400, "STUDIO_INPUT_INVALID", "试跑制作阶段要先贴一份分析结论");
  const stored = body.version !== undefined ? s.versions.find(v => v.version === body.version) ?? fail(404, "STUDIO_SKILL_VERSION_NOT_FOUND", "这个版本不存在") : currentOf(s);
  const fm = body.frontmatter !== undefined ? frontmatterOf(body.frontmatter) : stored.frontmatter;
  const errors = validate(key, fm);
  const base = { usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 }, skillKey: key, skillVersion: body.frontmatter !== undefined ? undefined : stored.version, stage, endpointId: "mock-planner", model: "演示规划模型", finishReason: "stop" };
  if (errors.length) return { ...base, plan: null, validation: { ok: false, errors }, rawExcerpt: "（演示）头部没通过校验，没有调用模型。" };
  const ops = summaryOf(s, fm).operations[stage];
  const plan: StudioPlan = stage === "analysis" ? {
    summary: "先拉片看清原片每一段在做什么，再给制作方案。", questions: ["新商品的价格要不要出现在画面里？"], skillKey: key, stage,
    steps: [
      { id: "a1", operation: ops.includes("recreation") ? "recreation" : "text", title: "拉片：按叙事切段", prompt: "按动作和台词边界切段，合并 3 秒以内的碎段。", referenceNodeIds: [], execution: "auto" },
      { id: "a2", operation: "text", title: "整理每段的画面、台词和可替换主体", prompt: "区分画面事实、字幕和推测。", referenceNodeIds: [], dependsOn: ["a1"], execution: "auto" },
    ],
  } : {
    summary: "按两段重做：保留原片动作和反转，商品换成用户的，台词重写。", questions: [], skillKey: key, stage, recommendedApproachId: "keep-motion",
    approaches: [
      { id: "keep-motion", title: "保留动作，换商品和台词", summary: "两段都参考原片动作和机位，只换商品和台词。", rationale: "原片的笑点在动作和反转。",
        preserve: ["人物动作和机位", "结尾的反转"], change: ["商品", "台词"], tradeoffs: ["场景和原片很像"], requiredCapabilities: ["video-generation"] },
      { id: "reshoot", title: "关键画面重做", summary: "第 2 段按新商品重新设计画面。", rationale: "商品更醒目。",
        preserve: ["故事走向"], change: ["第 2 段画面"], tradeoffs: ["报价更高"], requiredCapabilities: ["video-generation"] },
    ],
    steps: [
      { id: "p1", operation: "video", title: "第 1 段视频", prompt: "参考原片第 1 段的动作，主体换成新商品。", referenceNodeIds: [], execution: "auto", strategy: { approachId: "keep-motion", method: "参考原片动作", reason: "保留节奏" } },
      { id: "p2", operation: "video", title: "第 2 段视频", prompt: "参考原片第 2 段的反转，台词按新商品重写。", referenceNodeIds: [], execution: "auto", strategy: { approachId: "keep-motion", method: "参考原片动作", reason: "保留反转" } },
      { id: "p3", operation: "check", title: "检查第 1 段", prompt: "", referenceNodeIds: [], dependsOn: ["p1"], execution: "auto" },
      { id: "p4", operation: "assemble", title: "合成成片", prompt: "", referenceNodeIds: [], dependsOn: ["p1", "p2"], execution: "confirm" },
    ],
  };
  return { ...base, plan, validation: { ok: true, errors: [] }, usage: { inputTokens: 1820, outputTokens: 640, totalTokens: 2460 } };
}
