// ─────────────────────────────────────────────────────────────────────────────
// mocks/studio-dialogue.ts — NEXT_PUBLIC_USE_MOCK=1 时「全能创作」对话的内存实现（无网络）。
//
// 形状逐字照 packages/types/src/ip-studio-workflow.ts 的对话契约；事件按 seq 递增、可从任意
// afterSeq 重放，快照由同一个 reducer 折叠出来，所以演示模式和真实模式走同一套前端逻辑。
// 这是演示：正文是写死的示例回答，按小段定时推出来，不是模型输出；面板上有「演示」角标，
// 产出的节点带 studio.mock=true（AGENTS.md §8.0 (c)），不扣任何积分。
//
// 演示流程（技能按服务端 StudioSkillRouter 的规则选，见 docs/ip-studio-dialogue-intents.md §4）：
// · 复刻：第一条消息 → 读取画布 + 分析计划 + 确认卡「开始分析」→ 拉片（工作记录）→
//   制作计划（推荐与替代做法）+ 确认卡「开始制作」→ 两段视频节点 + 一次检查（含一项无法判断）。
// · 出图 / 出视频（直达）：同一轮发制作方案 + 制作确认卡（不带 executionId）→ 确认后直接以制作阶段建执行，跑完一步。
// · 写剧本与文案：短稿当轮写好，放进画布一个文字节点，没有确认卡。
// · 没命中任何技能：不绑技能，直接回答（全能创作）。
//
// 和真服务端一样：每一步做完都有一次可读取的运行（getRun），画布节点 id 按
// StudioPlanExecutionIds.nodeId 推出来，节点形状照 StudioPlanExecutor.nodeEvents；
// 快照只带进行中的制作，做完的制作要从确认卡上的 executionId 读回来；
// 事件可以被裁掉（eventFloorSeq），游标低于它就要求重新读快照。
// mockSeedCompletedExecution 造一张「关着页面时制作已经做完」的画布，用来验收重新打开后补节点。
// 一张画布可以有多段对话（新对话 / 历史对话，docs/ip-studio-new-canvas-and-threads.md §3）：列表、新建（复用没说过话的空对话）、
// 打开都照服务端语义；演示流程走到哪一步按对话各记各的，切回来接着走。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  StudioBranchRequest, StudioCheckResultData, StudioCreateThreadRequest, StudioDialogueControlRequest, StudioDialogueEvent, StudioDialogueEventType, StudioDialogueMessage,
  StudioDialogueState, StudioDialogueThread, StudioDialogueThreadSummary, StudioMessageBlock, StudioNodeUpsertData, StudioPlanExecution, StudioPlanExecutionAcceptRequest,
  StudioPlanExecutionCreateRequest, StudioPlanExecutionStep, StudioPostMessageRequest, StudioPostMessageResult, StudioSkillDraftOutput, StudioSkillDraftRequest,
  StudioSkillSummary, StudioTokenBilling,
} from "@ai-star-eco/types/ip-studio-workflow";
import type { IpRun, IpRunOutput } from "@ai-star-eco/types";
import { ApiError } from "@ai-star-eco/api-client";
import { dialogueReducer, emptyDialogueStore, isPlaceholderMessage, type DialogueStore } from "@/canvas-bridge/studio-dialogue-store";
import { MOCK_CLOSED_EXECUTION_PROJECT_ID, mockReadRun, mockRegisterRun, mockStore } from "./ip-studio";

// The recreation skill and the three direct skills seeded on the server (resources/studio/skills/{reference-video-recreation,
// image-generation,script-writing,video-generation}.md): key / name / summary / operations / limits / checks / triggers
// copied from their YAML front matter (maxSteps "maxSegments * 3 + 4" is resolved to 28 like the server's summary), and
// one demo-only skill (口播种草). Keep them in step: the new conversation's 「复刻视频」 card names the server's key.
export const MOCK_STUDIO_SKILLS: StudioSkillSummary[] = [{
  key: "reference-video-recreation", name: "参考视频复刻", version: 1, status: "active", planning: "dynamic",
  summary: "看懂一条参考视频的创意、脚本与手法，结合用户的新商品/新人物素材，现场决定做法并编排制作、检查与合成。",
  methodExamples: ["remap-subject", "creative-rewrite", "preserve-audio-rebuild-visuals", "keyframe-rebuild"],
  operations: { analysis: ["recreation", "text"], production: ["text", "image", "video", "check", "assemble"] },
  limits: { maxSourceSec: 60, maxSegments: 8, maxSegmentSec: "model", maxSteps: 28, maxAutoFixPerSegment: 2 },
  checks: ["subject-replaced", "old-subject-residue", "character-consistency", "product-facts", "scene-and-action", "dialogue-and-subtitles", "duration-and-order"],
  autoFixChecks: [], requiredCapabilities: ["vision-text-model", "video-generation", "film-study"],
  triggers: { media: ["video"], keywords: ["复刻", "拉片", "参考视频", "参考这条", "照着这条", "照这条", "照着做", "照这个做", "做同款", "同款视频", "翻拍", "仿一条", "仿拍"], default: true },
}, {
  key: "talking-head-seeding", name: "口播种草", version: 1, status: "active", planning: "dynamic",
  summary: "按商品卖点写口播，配商品特写和字幕，做一条 30 秒以内的种草视频。",
  methodExamples: ["先写口播再配画面"],
  operations: { analysis: ["text"], production: ["text", "image", "video", "check", "assemble"] },
  limits: { maxSourceSec: 30, maxSegments: 4, maxSegmentSec: 10, maxSteps: 16, maxAutoFixPerSegment: 1 },
  checks: ["caption"], autoFixChecks: [], requiredCapabilities: ["video"],
  triggers: { media: ["image"], keywords: ["口播", "种草"] },
}, {
  key: "image-generation", name: "出图", version: 1, status: "active", planning: "dynamic",
  summary: "用一句话、一段描述或画布上的参考图直接出图：海报、封面、商品图、人物设定、插画、配图。信息够就一轮确认开始生成，不追问风格画幅这类有默认值的事。",
  methodExamples: ["text-to-image", "reference-styled", "character-sheet", "product-shot", "variations"],
  operations: { analysis: [], production: ["text", "image"] },
  limits: { maxSourceSec: 60, maxSegments: 8, maxSegmentSec: "model", maxSteps: 8, maxAutoFixPerSegment: 0 },
  checks: [], autoFixChecks: [], requiredCapabilities: ["image-generation"],
  triggers: { media: ["image"], keywords: ["出图", "生图", "画一", "画张", "画个", "画几", "一张图", "几张图", "做张图", "做几张", "海报", "封面", "配图", "设定图", "三视图", "头像", "插画",
    "商品图", "产品图", "换个背景", "换背景", "换个风格", "同款图", "再来一张", "再出一张", "P图", "修图"] },
}, {
  key: "script-writing", name: "写剧本与文案", version: 1, status: "active", planning: "dynamic",
  summary: "写能直接用的文字：短视频剧本、分镜脚本、口播稿、带货文案、标题、广告语、人物小传。短稿当轮写好放进画布；长稿或多集才走制作计划。",
  methodExamples: ["short-video-script", "talking-head-copy", "storyboard-breakdown", "product-copy", "rewrite-and-polish"],
  operations: { analysis: [], production: ["text"] },
  limits: { maxSourceSec: 60, maxSegments: 8, maxSegmentSec: "model", maxSteps: 12, maxAutoFixPerSegment: 0 },
  checks: [], autoFixChecks: [], requiredCapabilities: ["text-model"],
  triggers: { media: ["text"], keywords: ["剧本", "脚本", "文案", "口播", "台词", "分镜", "故事", "标题", "广告语", "卖点", "小传", "人设", "写一段", "写个", "写一篇", "写一条",
    "改写", "润色", "缩短", "扩写", "翻译成"] },
}, {
  key: "video-generation", name: "出视频", version: 1, status: "active", planning: "dynamic",
  summary: "用一句话、一段剧本或画布上的图直接出一段或几段视频：把图动起来、商品展示、口播镜头、短片。信息够就一轮确认开始生成；没有参考视频要拆解时用这个，不是复刻。",
  methodExamples: ["image-to-motion", "text-to-clip", "script-to-segments", "keyframe-first"],
  operations: { analysis: [], production: ["text", "image", "video", "check", "assemble"] },
  limits: { maxSourceSec: 60, maxSegments: 8, maxSegmentSec: "model", maxSteps: 28, maxAutoFixPerSegment: 0 },
  checks: ["subject-consistency", "scene-and-action", "duration-and-order"], autoFixChecks: [], requiredCapabilities: ["video-generation"],
  triggers: { media: ["image"], keywords: ["视频", "出片", "动起来", "动一下", "短片", "动画", "做一条", "拍一条", "来一条", "成片", "一段片", "镜头", "运镜", "口播视频", "带货视频", "宣传片"] },
}];
/** A skill the thread may keep working with (a draft keeps working, a withdrawn one never does). */
const mockSkill = (key?: string) => MOCK_STUDIO_SKILLS.find(s => s.key === key && s.status !== "withdrawn");
const activeSkill = (key?: string) => MOCK_STUDIO_SKILLS.find(s => s.key === key && s.status === "active");
/** A direct skill (出图 / 写剧本与文案 / 出视频) has no analysis operations: its first card starts production (StudioSkill.direct()). */
export const mockSkillIsDirect = (skill: Pick<StudioSkillSummary, "operations">) => !skill.operations.analysis?.length;

/** Canvas node type → trigger media type (StudioSkillRouter.mediaOf); unknown types do not count. */
function mediaOf(nodeType?: string): "video" | "image" | "audio" | "text" | undefined {
  const type = (nodeType || "").toLowerCase();
  if (type.includes("video")) return "video";
  if (type.includes("image")) return "image";
  if (type.includes("audio") || type.includes("voice") || type.includes("music")) return "audio";
  if (type.includes("text") || type.includes("script")) return "text";
  return undefined;
}

/**
 * StudioSkillRouter.route, line for line: 2 per matching keyword + 1 per matching media type (words outrank media);
 * a unique best wins; no hit keeps the bound skill (or none); a tie keeps the bound skill when it is among the leaders,
 * otherwise none (the model picks inside the turn). There is no 400 for a tie any more.
 */
export function mockRouteSkill(active: StudioSkillSummary[], media: Set<string>, text: string, bound?: StudioSkillSummary): StudioSkillSummary | undefined {
  if (!active.length) return undefined;
  const haystack = text.toLowerCase();
  let best = 0, leaders: StudioSkillSummary[] = [];
  for (const skill of active) {
    const score = (skill.triggers?.keywords || []).filter(k => k.trim() && haystack.includes(k.toLowerCase())).length * 2
      + (skill.triggers?.media || []).filter(m => media.has(m)).length;
    if (score > best) { best = score; leaders = [skill]; }
    else if (score === best && score > 0) leaders.push(skill);
  }
  const boundOffered = !!bound && bound.status === "active" && active.some(s => s.key === bound.key);
  if (best === 0) return boundOffered ? bound : undefined;
  if (leaders.length === 1) return leaders[0];
  return boundOffered && leaders.some(s => s.key === bound!.key) ? bound : undefined;
}

const workingExecution = (p: MockProject) => !!p.execution && ["running", "paused", "needs_user"].includes(p.execution.status);

/**
 * The skill for this message, like StudioDialogueService.startTurn: an explicit choice wins (switching away from the bound
 * skill only while no execution is active); with an active execution the method stays; otherwise every message is routed
 * again and a hit on another skill switches the thread. A tie or no hit keeps the current skill (or none).
 */
function pickSkill(projectId: string, p: MockProject, t: MockThread, request: StudioPostMessageRequest): StudioSkillSummary | undefined {
  const current = mockSkill(t.thread.skillKey);
  if (request.skillKey) {
    const chosen = current?.key === request.skillKey ? current : activeSkill(request.skillKey);
    if (!chosen) throw new ApiError({ code: "STUDIO_SKILL_NOT_FOUND", message: "这个技能已经停用了，换一个再发" }, 404);
    if (current && current.key !== chosen.key && workingExecution(p))
      throw new ApiError({ code: "STUDIO_INPUT_INVALID", message: "这条对话正在按另一种方法制作；要换方法，请先结束这次制作，或从某条消息重新开始" }, 400);
    return chosen;
  }
  if (workingExecution(p)) return current;
  const nodes = mockStore().projects.get(projectId)?.doc.nodes || [];
  const ids = new Set([...(request.pinnedNodeIds || []), ...(request.attachmentNodeIds || [])]);
  const media = new Set(nodes.filter(n => ids.has(n.id)).map(n => mediaOf(n.type)).filter((m): m is NonNullable<typeof m> => !!m));
  return mockRouteSkill(MOCK_STUDIO_SKILLS.filter(s => s.status === "active"), media, request.text, current) ?? current;
}

/** Delay between streamed pieces of the canned answer. Tests may lower it. */
export const mockDialogueTiming = { tickMs: 90 };

type Listener = (event: StudioDialogueEvent) => void;
type Step = { run: () => void; delay?: number; waitsForExecution?: boolean };
interface MockThread {
  thread: StudioDialogueThread; view: DialogueStore; events: StudioDialogueEvent[]; listeners: Set<Listener>;
  /** Where this thread's demo flow stood when another conversation was opened; restored when it is opened again. */
  stage?: Stage;
  /** Events at or below this seq were pruned; a cursor below it must rebuild from the snapshot (410 on the server). */
  eventFloorSeq: number;
  generation: number; running: boolean; turnId?: string; runId?: string; queued: string[]; results: Map<string, StudioPostMessageResult>;
}
type Stage = "idle" | "analysis-proposed" | "analysis-running" | "production-proposed" | "production-running" | "done";
interface MockProject { threads: Map<string, MockThread>; currentThreadId: string; execution?: StudioPlanExecution; stage: Stage;
  /** POST /conversations idempotency: clientRequestId → the thread it created or reused. */
  createdThreads: Map<string, string> }

const projects = new Map<string, MockProject>();
let counter = 0;
const nextId = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(++counter).toString(36)}`;
const now = () => new Date().toISOString();
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const later = <T,>(value: T, ms = 120) => new Promise<T>(resolve => setTimeout(() => resolve(clone(value)), ms));
const MOCK_BILLING: StudioTokenBilling = { inputTokens: 0, outputTokens: 0, credits: 0, inputCreditsPerK: 0, outputCreditsPerK: 0 };

function createThread(projectId: string, parent?: { threadId: string; messageId: string }): MockThread {
  const at = now();
  const thread: StudioDialogueThread = { id: nextId("thread"), projectId, lastSeq: 0, createdAt: at, updatedAt: at,
    ...(parent ? { parentThreadId: parent.threadId, branchFromMessageId: parent.messageId } : {}) };
  return { thread, view: { ...emptyDialogueStore(), thread }, events: [], eventFloorSeq: 0, listeners: new Set(), generation: 0, running: false, queued: [], results: new Map() };
}

function project(projectId: string): MockProject {
  let p = projects.get(projectId);
  if (!p) {
    const main = createThread(projectId);
    p = { threads: new Map([[main.thread.id, main]]), currentThreadId: main.thread.id, stage: "idle", createdThreads: new Map() };
    projects.set(projectId, p);
    if (projectId === MOCK_CLOSED_EXECUTION_PROJECT_ID) seedCompleted(projectId, p, main);
  }
  return p;
}
function thread(p: MockProject, threadId: string) {
  const t = p.threads.get(threadId);
  if (!t) throw Object.assign(new Error("这段对话不存在，请刷新后重试"), { code: "STUDIO_THREAD_NOT_FOUND" });
  return t;
}

/** Like the server: only an execution still in progress rides along (on the thread that started it); a finished one is read back by its id. */
function snapshot(p: MockProject, t: MockThread): StudioDialogueState {
  const active = p.execution && ["running", "paused", "needs_user"].includes(p.execution.status) && (!p.execution.threadId || p.execution.threadId === t.thread.id) ? p.execution.id : undefined;
  return clone({ thread: { ...t.thread, activeTurnId: t.running ? t.turnId : undefined, activeExecutionId: active },
    messages: t.view.messages.filter(m => !isPlaceholderMessage(m.id)), latestSeq: t.thread.lastSeq, ...(active ? { execution: p.execution } : {}) });
}

function emit<T>(t: MockThread, type: StudioDialogueEventType, data: T, executionId?: string) {
  const event: StudioDialogueEvent<T> = { eventId: nextId("evt"), seq: ++t.thread.lastSeq, threadId: t.thread.id, turnId: t.turnId || "turn-none",
    runId: t.runId, ...(executionId ? { executionId } : {}), createdAt: now(), type, data };
  t.events.push(event as StudioDialogueEvent);
  t.view = dialogueReducer(t.view, { type: "event", event: event as StudioDialogueEvent });
  t.thread.updatedAt = event.createdAt;
  for (const listener of t.listeners) setTimeout(() => listener(clone(event as StudioDialogueEvent)), 0);
}

function patchViewMessage(t: MockThread, messageId: string, update: (m: StudioDialogueMessage) => StudioDialogueMessage) {
  t.view = { ...t.view, messages: t.view.messages.map(m => m.id === messageId ? update(m) : m) };
}

/** Pieces of a canned sentence, a few characters each. */
function say(t: MockThread, messageId: string, partId: string, text: string): Step[] {
  const chars = Array.from(text), pieces: string[] = [];
  for (let i = 0; i < chars.length; i += 4) pieces.push(chars.slice(i, i + 4).join(""));
  return pieces.map(delta => ({ run: () => emit(t, "message.delta", { messageId, partId, delta }) }));
}

function play(p: MockProject, t: MockThread, steps: Step[], done?: () => void) {
  const generation = ++t.generation;
  t.running = true;
  const next = () => {
    if (generation !== t.generation) return;
    const step = steps[0];
    if (!step) { t.running = false; done?.(); applyQueued(p, t); return; }
    if (step.waitsForExecution && p.execution?.status === "paused") { setTimeout(next, mockDialogueTiming.tickMs * 4); return; }
    steps.shift();
    setTimeout(() => { if (generation !== t.generation) return; step.run(); next(); }, step.delay ?? mockDialogueTiming.tickMs);
  };
  next();
}

function startTurn(t: MockThread) {
  t.turnId = nextId("turn"); t.runId = nextId("run");
  return nextId("msg");
}

/** Messages that arrived mid-turn are applied at the next boundary: here, when the current turn ends. */
function applyQueued(p: MockProject, t: MockThread) {
  if (!t.queued.length || t.running) return;
  const ids = t.queued.splice(0);
  for (const id of ids) patchViewMessage(t, id, m => ({ ...m, status: "applied" }));
  // A 「可以」 typed while the reply that brought the card was still running confirms it once that reply ends —
  // the server sends queued messages through the model too. The demo used to answer every queued message with 「收到…」.
  const approving = [...ids].reverse().map(id => t.view.messages.find(m => m.id === id)).find(m => m && mockSaysApprove(m.text));
  if (approving && naturalApproval(t.thread.projectId, p, t, approving.text, approving.id)) return;
  const messageId = startTurn(t);
  play(p, t, [...say(t, messageId, "ack", "后面的步骤按你刚才说的来，已经在生成的不受影响。"),
    { run: () => emit(t, "turn.done", { reason: "completed", messageId, billing: MOCK_BILLING, settling: false }) }]);
}

const step = (id: string, title: string, operation: StudioPlanExecutionStep["operation"], stage: StudioPlanExecutionStep["stage"], quotedCost: number, dependsOn: string[] = []): StudioPlanExecutionStep =>
  ({ id, title, operation, stage, dependsOn, status: "pending", runIds: [], attempt: 0, quotedCost });
/** The step's output node on the canvas: StudioPlanExecutionIds.nodeId on the server. */
const stepNodeId = (executionId: string, s: Pick<StudioPlanExecutionStep, "id" | "stage">) => `${executionId}-${s.stage === "production" ? "p" : "a"}-${s.id}`;
const withNodeIds = (executionId: string, steps: StudioPlanExecutionStep[]) => steps.map(s => ({ ...s, nodeId: stepNodeId(executionId, s) }));

function updateExecution(p: MockProject, update: (e: StudioPlanExecution) => StudioPlanExecution) {
  if (p.execution) p.execution = { ...update(p.execution), updatedAt: now() };
}
function setStep(p: MockProject, id: string, status: StudioPlanExecutionStep["status"], runId?: string, reason?: string) {
  updateExecution(p, e => ({ ...e, steps: e.steps.map(s => s.id === id ? { ...s, status, attempt: Math.max(1, s.attempt), runIds: runId && !s.runIds.includes(runId) ? [...s.runIds, runId] : s.runIds, ...(reason ? { reason } : {}) } : s) }));
}
function budget(p: MockProject, t: MockThread, spent: number, inFlight: number, source: "actual" | "quote") {
  const e = p.execution!;
  const b = e.budgets.find(x => x.stage === e.stage)!;
  updateExecution(p, x => ({ ...x, budgets: x.budgets.map(y => y.stage === x.stage ? { ...y, spent, inFlight, remaining: y.approvedCap - spent - inFlight } : y) }));
  emit(t, "budget.update", { executionId: e.id, stage: e.stage, approvedCap: b.approvedCap, spent, inFlight, remaining: b.approvedCap - spent - inFlight, source }, e.id);
}

/** The step's native run, finished: readable through getRun like the real one. */
function stepRun(projectId: string, e: StudioPlanExecution, s: StudioPlanExecutionStep, output: IpRunOutput, runId = s.runIds.at(-1)!): IpRun {
  const at = now();
  return { id: runId, projectId, nodeId: s.nodeId || stepNodeId(e.id, s), kind: `studio-${s.operation}`, status: "done", stage: "done", pct: 100, cost: 0,
    inputs: { executionId: e.id, stage: s.stage } as unknown as IpRun["inputs"], output: { mock: true, ...output }, createdAt: at, finishedAt: at };
}

/** node.upsert commands of a finished step, shaped like StudioPlanExecutor.nodeEvents (plus the demo marker). */
function stepNodeEvents(e: StudioPlanExecution, s: StudioPlanExecutionStep, run: IpRun): StudioNodeUpsertData[] {
  const nodeId = s.nodeId || stepNodeId(e.id, s), type = s.operation === "video" || s.operation === "assemble" ? "video" : s.operation === "image" ? "image" : "text";
  const studio: Record<string, unknown> = { runId: run.id, execution: { executionId: e.id, stepId: s.id, runId: run.id }, mock: true };
  const metadata: Record<string, unknown> = { status: "success", studio };
  let title = s.title, connection: StudioNodeUpsertData["connection"];
  if (s.operation === "check") {
    const subject = e.steps.find(x => run.output.check && x.runIds.includes(run.output.check.targetRunId));
    const subjectId = subject && (subject.nodeId || stepNodeId(e.id, subject));
    title = `${subject?.title || "成片"} · 检查`;
    Object.assign(studio, { kind: "check", parentNodeId: subjectId, check: run.output.check });
    if (subjectId) connection = { fromNodeId: subjectId, toNodeId: nodeId };
  } else if (s.operation === "recreation") { studio.kind = "recreation"; metadata.content = run.output.text || ""; }
  else if (type === "text") { studio.kind = "text"; metadata.content = run.output.textRevision?.content ?? run.output.text ?? ""; }
  const node = { id: nodeId, type, title, width: type === "text" ? 380 : 320, height: type === "text" ? 320 : 240, position: { x: 0, y: 0 }, metadata } as unknown as NonNullable<StudioNodeUpsertData["node"]>;
  const out: StudioNodeUpsertData[] = [{ nodeId, op: "create", executionId: e.id, stepId: s.id, runId: run.id, node, ...(connection ? { connection } : {}) }];
  if (s.operation !== "check") for (const dependency of s.dependsOn) {
    const upstream = e.steps.find(x => x.id === dependency && x.stage === s.stage);
    if (upstream && upstream.operation !== "check") out.push({ nodeId, op: "connect", executionId: e.id, stepId: s.id, runId: run.id, connection: { fromNodeId: upstream.nodeId || stepNodeId(e.id, upstream), toNodeId: nodeId } });
  }
  return out;
}

/** A step finished: its run becomes readable and the canvas is told about its node, like the server does. */
function finishStep(projectId: string, p: MockProject, t: MockThread, stepId: string, output: IpRunOutput, runId?: string) {
  setStep(p, stepId, "done", runId);
  const e = p.execution!, s = e.steps.find(x => x.id === stepId)!;
  const run = stepRun(projectId, e, s, output);
  mockRegisterRun(run);
  for (const data of stepNodeEvents(e, s, run)) emit(t, "node.upsert", data, e.id);
}

const MOCK_CHECK_ITEMS = (targetRunId: string): StudioCheckResultData["result"] => ({ status: "unknown", targetRunId, sampledTimesSec: [0.5, 2.5, 4.5], items: [
  { id: "subject", status: "pass", evidence: [{ kind: "frame", timeSec: 2.5, observation: "画面中央是新商品，标签朝向镜头" }], reason: "主体和你的商品一致" },
  { id: "caption", status: "unknown", evidence: [{ kind: "text", observation: "这一段没有可读的字幕" }], reason: "没有字幕，看不出台词是否完整", suggestion: "加上字幕后再检查一次" },
] });
const MOCK_RECREATION_TEXT = "切成 2 段：第 1 段人物出场，交代场景；第 2 段可见主体是水杯，靠它做反转。";
const MOCK_NOTES = "第 1 段：人物出场，中景，节奏慢，先交代场景。\n第 2 段：特写水杯，节奏突然加快，台词点出反转。";

/** Like the server's thread.planRevision: every plan on a thread gets the next revision, whichever skill proposed it (a
 *  lower revision after a newer plan would read as replaced). */
const nextPlanRevision = (t: MockThread) => Math.max(0, ...t.view.messages.flatMap(m => m.blocks).map(b => b.type === "plan" ? b.revision : 0)) + 1;

function canvasSize(projectId: string) {
  const nodes = mockStore().projects.get(projectId)?.doc.nodes || [];
  return { count: nodes.length, right: Math.max(40, ...nodes.map(n => n.position.x + n.width)), videos: nodes.filter(n => n.type === "video").length, images: nodes.filter(n => n.type === "image").length };
}

// ── Scripts ────────────────────────────────────────────────────────────────

function firstTurn(projectId: string, p: MockProject, t: MockThread, request: StudioPostMessageRequest) {
  const messageId = startTurn(t), canvas = canvasSize(projectId), tool = nextId("tool");
  const revision = nextPlanRevision(t), fingerprint = `mock-analysis-v${revision}`;
  const plan: Extract<StudioMessageBlock, { type: "plan" }> = { type: "plan", planRunId: "mock-plan-analysis", revision, fingerprint, plan: {
    summary: "拉片看清原片两段的画面和节奏", questions: [], skillKey: t.thread.skillKey, skillVersion: t.thread.skillVersion, stage: "analysis", revision, fingerprint,
    steps: [
      { id: "s1", operation: "recreation", title: "拉片：切成 2 段", prompt: "", referenceNodeIds: [], quotedCost: 20 },
      { id: "s2", operation: "text", title: "整理每段的画面和节奏", prompt: "", referenceNodeIds: [], quotedCost: 6, dependsOn: ["s1"] },
    ], budget: { estimated: 26, autoFixCap: 0 } } };
  play(p, t, [
    { run: () => emit(t, "tool.started", { toolCallId: tool, toolName: "read_canvas", title: "读取画布素材", safeInputSummary: `画布上 ${canvas.count} 个节点${request.pinnedNodeIds?.length ? `，你指定了 ${request.pinnedNodeIds.length} 个` : ""}` }) },
    { delay: mockDialogueTiming.tickMs * 4, run: () => emit(t, "tool.progress", { toolCallId: tool, toolName: "read_canvas", progress: `已读取 ${canvas.count} 个节点` }) },
    { delay: mockDialogueTiming.tickMs * 4, run: () => emit(t, "tool.finished", { toolCallId: tool, toolName: "read_canvas", status: "done", result: { summary: `找到 ${canvas.videos} 条视频、${canvas.images} 张图片` }, creditsActual: 0, settling: false }) },
    ...say(t, messageId, "p2", "原片可以分成两段：前段交代场景，后段做反转。"),
    { run: () => emit(t, "plan.proposed", { messageId, block: plan }) },
    { run: () => emit(t, "approval.required", { messageId, block: { type: "approval", approvalId: "mock-approval-analysis", stage: "analysis", planFingerprint: fingerprint,
      scope: ["拉片，切成 2 段", "整理每段的画面和节奏"], quotedCost: 26, budgetCap: 30, autoFixCap: 0, status: "pending", expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() } }) },
    { run: () => {
      emit(t, "turn.done", { reason: "waiting_user", messageId, billing: MOCK_BILLING, settling: false, suggestions: ["先拉片看看", "结尾的反转保留不变", "画幅跟原片一致"] });
      // A structured question persisted with the message (visible in the next snapshot).
      patchViewMessage(t, messageId, m => ({ ...m, blocks: [...m.blocks, { type: "question", questionId: "mock-q-product", text: "新商品是哪一款？", options: ["洗衣液", "护手霜", "先用示例商品"] }] }));
      p.stage = "analysis-proposed";
    } },
  ]);
}

function analysisTurn(projectId: string, p: MockProject, t: MockThread) {
  const e = p.execution!, messageId = startTurn(t), tool = nextId("tool"), revision = nextPlanRevision(t), fingerprint = `mock-production-v${revision}`;
  const plan: Extract<StudioMessageBlock, { type: "plan" }> = { type: "plan", planRunId: "mock-plan-production", revision, fingerprint, plan: {
    summary: "两段 5 秒竖屏视频，保留原片动作和反转，换成你的商品", questions: [], skillKey: t.thread.skillKey, skillVersion: t.thread.skillVersion, stage: "production", revision, fingerprint,
    recommendedApproachId: "keep-motion",
    approaches: [
      { id: "keep-motion", title: "保留动作，换商品和台词", summary: "两段都参考原片的动作和机位，只换商品和台词。", rationale: "原片的笑点在动作和反转，保留它们最稳。",
        preserve: ["人物动作和机位", "结尾的反转"], change: ["商品换成你的", "台词按新商品重写"], tradeoffs: ["画面里的场景和原片很像"], requiredCapabilities: ["video"] },
      { id: "reshoot", title: "关键画面重做", summary: "第 2 段按新商品重新设计画面。", rationale: "商品更醒目，但和原片节奏差得多一些。",
        preserve: ["故事走向"], change: ["第 2 段的画面和机位"], tradeoffs: ["报价更高", "反转的效果要重新验证"], requiredCapabilities: ["video", "image"] },
    ],
    steps: [
      { id: "v1", operation: "video", title: "第 1 段视频", prompt: "竖屏 5 秒，中景。人物从画面左侧走进厨房，拿起台面上的商品看向镜头，动作和机位照原片第 1 段，暖色室内光，节奏放慢，先交代场景。", referenceNodeIds: [], quotedCost: 40, strategy: { approachId: "keep-motion", method: "参考原片动作", reason: "保留节奏" } },
      { id: "v2", operation: "video", title: "第 2 段视频", prompt: "竖屏 5 秒，商品特写，镜头快速推近，照原片第 2 段的反转节奏，台词换成介绍你的商品。", referenceNodeIds: [], quotedCost: 40, strategy: { approachId: "keep-motion", method: "参考原片动作", reason: "保留反转" } },
      { id: "c1", operation: "check", title: "检查第 1 段", prompt: "", referenceNodeIds: [], quotedCost: 2, dependsOn: ["v1"] },
      { id: "m1", operation: "assemble", title: "合成成片", prompt: "", referenceNodeIds: [], quotedCost: 0, dependsOn: ["v1", "v2"] },
    ], budget: { estimated: 82, autoFixCap: 40 } } };
  play(p, t, [
    { run: () => { setStep(p, "s1", "running", `${e.id}-run-recreation`); budget(p, t, 0, 20, "quote"); } },
    { waitsForExecution: true, run: () => emit(t, "tool.started", { toolCallId: tool, toolName: "recreation", title: "拉片", safeInputSummary: "原片，最多切成 2 段", childRunId: `${e.id}-run-recreation` }, e.id) },
    { waitsForExecution: true, delay: mockDialogueTiming.tickMs * 5, run: () => emit(t, "tool.progress", { toolCallId: tool, toolName: "recreation", progress: "已切成 2 段" }, e.id) },
    { waitsForExecution: true, delay: mockDialogueTiming.tickMs * 5, run: () => emit(t, "tool.progress", { toolCallId: tool, toolName: "recreation", progress: "正在读取第 2 段" }, e.id) },
    { waitsForExecution: true, delay: mockDialogueTiming.tickMs * 5, run: () => {
      emit(t, "tool.finished", { toolCallId: tool, toolName: "recreation", status: "done", result: { summary: "切成 2 段：第 1 段人物出场，第 2 段可见主体是水杯" }, creditsActual: 18, settling: false }, e.id);
      finishStep(projectId, p, t, "s1", { text: MOCK_RECREATION_TEXT });
      finishStep(projectId, p, t, "s2", { textRevision: { content: MOCK_NOTES, summary: "每段的画面和节奏" } }, `${e.id}-run-notes`);
      budget(p, t, 24, 0, "actual");
    } },
    ...say(t, messageId, "b2", "拉片好了：前段交代场景，后段靠水杯做反转。"),
    { run: () => emit(t, "plan.proposed", { messageId, block: plan }) },
    { run: () => {
      updateExecution(p, x => ({ ...x, status: "needs_user", needsUserReason: "等你确认制作方案" }));
      emit(t, "approval.required", { messageId, block: { type: "approval", approvalId: "mock-approval-production", stage: "production", planFingerprint: fingerprint,
        scope: ["第 1 段视频", "第 2 段视频", "检查第 1 段", "合成成片"], quotedCost: 82, budgetCap: 122, autoFixCap: 40, status: "pending", executionId: e.id,
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() } });
    } },
    { run: () => { emit(t, "turn.done", { reason: "waiting_user", messageId, billing: MOCK_BILLING, settling: false, suggestions: ["按推荐做", "第 2 段换成新拍的画面", "预算控制在 100 积分以内"] }); p.stage = "production-proposed"; } },
  ]);
}

function productionTurn(projectId: string, p: MockProject, t: MockThread) {
  const e = p.execution!, messageId = startTurn(t);
  const video = (no: number): Step[] => {
    const tool = nextId("tool");
    return [
      { waitsForExecution: true, run: () => { setStep(p, `v${no}`, "running", `${e.id}-run-v${no}`); emit(t, "tool.started", { toolCallId: tool, toolName: "video", title: `制作第 ${no} 段`, safeInputSummary: "5 秒 · 竖屏 · 参考原片动作", childRunId: `${e.id}-run-v${no}` }, e.id); budget(p, t, (no - 1) * 40, 40, "quote"); } },
      { waitsForExecution: true, delay: mockDialogueTiming.tickMs * 6, run: () => emit(t, "tool.progress", { toolCallId: tool, toolName: "video", progress: "已提交，等待出片" }, e.id) },
      { waitsForExecution: true, delay: mockDialogueTiming.tickMs * 8, run: () => {
        emit(t, "tool.finished", { toolCallId: tool, toolName: "video", status: "done", result: { summary: `第 ${no} 段出片 1 条`, nodeIds: [stepNodeId(e.id, { id: `v${no}`, stage: "production" })] }, creditsActual: 40, settling: false }, e.id);
        finishStep(projectId, p, t, `v${no}`, {}); budget(p, t, no * 40, 0, "actual");
      } },
    ];
  };
  const checkTool = nextId("tool");
  const check: StudioCheckResultData = { stepId: "c1", runId: `${e.id}-run-c1`, result: MOCK_CHECK_ITEMS(`${e.id}-run-v1`) };
  play(p, t, [
    ...video(1),
    ...video(2),
    { waitsForExecution: true, run: () => { setStep(p, "c1", "running", `${e.id}-run-c1`); emit(t, "tool.started", { toolCallId: checkTool, toolName: "check", title: "检查第 1 段", safeInputSummary: "主体、字幕", childRunId: `${e.id}-run-c1` }, e.id); } },
    { waitsForExecution: true, delay: mockDialogueTiming.tickMs * 6, run: () => {
      emit(t, "tool.finished", { toolCallId: checkTool, toolName: "check", status: "done", result: { summary: "通过 1 项，无法判断 1 项" }, creditsActual: 2, settling: false }, e.id);
      // The server publishes check.result first, then the executor's node.upsert for the check step.
      emit(t, "check.result", check, e.id); finishStep(projectId, p, t, "c1", { check: check.result }); budget(p, t, 82, 0, "actual");
    } },
    { run: () => { setStep(p, "m1", "skipped", undefined, "演示模式不合成成片"); updateExecution(p, x => ({ ...x, status: "done", finishedAt: now() })); } },
    // The server's completion summary (StudioExecutionSummary): how it ended and the real total, then only the check
    // that could not judge; the skipped assemble step of a finished run is not listed.
    ...say(t, messageId, "c3", "做好了，花了 82 积分。\n「第 1 段视频」没法判断：没有字幕，看不出台词是否完整。"),
    { run: () => {
      const suggestions = ["重做第 1 段「第 1 段视频」", "把做好的片段合成一条成片"];
      emit(t, "turn.done", { reason: "completed", messageId, billing: MOCK_BILLING, settling: false, suggestions });
      // Like the server's completion summary: one per execution (keyed by it), follow-ups kept across reloads.
      patchViewMessage(t, messageId, m => ({ ...m, suggestions, clientMessageId: `exec-summary-${e.id}` }));
      p.stage = "done";
    } },
  ]);
}

/** No skill fits and the thread has none: 「全能创作」 answers directly; nothing is planned or charged. */
function generalTurn(p: MockProject, t: MockThread) {
  const messageId = startTurn(t);
  play(p, t, [
    ...say(t, messageId, "g1", "我可以出图、写文案、出视频，或者照着一条视频做一版，说说要做哪件事。"),
    { run: () => emit(t, "turn.done", { reason: "completed", messageId, billing: MOCK_BILLING, settling: false, suggestions: ["画一张国风海报，9:16", "写一段保温杯的口播", "做一条 5 秒的商品展示视频"] }) },
  ]);
}

// What the plan prompt asks for since v20 (dap.ip_studio_skill_plan.md rule 7): the summary and titles say what will be made,
// with the filled-in defaults inside the sentence; the reply that carries the card is one sentence, with no price or how-to.
const clip = (text: string, max: number) => { const t = text.replace(/\s+/g, " ").trim(); return Array.from(t).length > max ? `${Array.from(t).slice(0, max).join("")}…` : t; };
const ratioIn = (text: string, fallback: string) => text.match(/(\d{1,2})\s*[:：]\s*(\d{1,2})/)?.slice(1, 3).join(":") || fallback;
const secondsIn = (text: string) => Number(text.match(/(\d{1,2})\s*秒/)?.[1]) || 5;
/** What kind of picture the request names (the 「制作个人 IP」 card asks for one of these three). */
const pictureIn = (text: string) => /设定图/.test(text) ? "多视角设定图" : /三视图/.test(text) ? "三视图" : /头像/.test(text) ? "头像" : "图";
const shape = (ratio: string) => ratio === "9:16" ? "竖屏" : ratio === "16:9" ? "横屏" : ratio;
const sentence = (text: string) => text.trim().replace(/[。.！!？?，,\s]+$/, "");
type DirectSpec = { operation: StudioPlanExecutionStep["operation"]; quotedCost: (text: string) => number; title: (text: string) => string; summary: (text: string) => string; prompt: (text: string) => string; said: string };
const DIRECT_STEP: Record<string, DirectSpec> = {
  "image-generation": { operation: "image", quotedCost: () => 8, title: text => `一张 ${ratioIn(text, "1:1")} 的${pictureIn(text)}`,
    summary: text => `一张 ${ratioIn(text, "1:1")} 的${pictureIn(text)}：${clip(text, 24)}`,
    prompt: text => `${sentence(text)}。${ratioIn(text, "1:1")} 画幅，主体居中，画面干净，细节清楚。`, said: "按你的描述出一张。" },
  "video-generation": { operation: "video", quotedCost: text => secondsIn(text) * 8, title: text => `一段 ${secondsIn(text)} 秒${shape(ratioIn(text, "9:16"))}视频`,
    summary: text => `一段 ${secondsIn(text)} 秒${shape(ratioIn(text, "9:16"))}视频：${clip(text, 22)}`,
    prompt: text => `${sentence(text)}。${ratioIn(text, "9:16")}，${secondsIn(text)} 秒，${/镜头/.test(text) ? "" : "镜头缓慢推近，"}光线自然。`, said: "按你的描述出一段。" },
};
const MOCK_SCRIPT = "【开场】一句话抛出问题：出门一天，水还是烫的吗？\n【卖点】杯身拿在手里，说一个最打动人的点。\n【收尾】只留一个动作：点下面的链接看看。";
/** A 剧本 request (the 「写剧本」 card) gets a scene-by-scene sample built around its synopsis. */
const mockDrama = (text: string) => {
  const synopsis = text.match(/剧本[：:]([^。]+)/)?.[1]?.trim() || "主角遇到一件意外的小事";
  return `梗概：${synopsis}。\n\n第 1 场 · 街口\n画面：主角匆匆赶路，手里拿着那件关键的东西。\n台词：「来不及了，就差这一单。」\n\n`
    + "第 2 场 · 门口\n画面：门开了，对方愣住，事情和主角想的不一样。\n台词：「你怎么知道是我？」\n\n"
    + "第 3 场 · 屋内\n画面：真相揭开，反转落地，两人对视后笑出来。\n台词：「原来是你。」";
};

/**
 * A direct skill's first turn (StudioSkill.direct()): no analysis. 出图 / 出视频 send the production plan and its card in
 * the same reply, the card without an executionId (confirming it starts a new execution). 写剧本与文案 writes a short
 * draft straight onto the canvas (create_nodes), with no card and no charge.
 */
function directTurn(projectId: string, p: MockProject, t: MockThread, request: StudioPostMessageRequest, skill: StudioSkillSummary) {
  const messageId = startTurn(t);
  if (skill.key === "script-writing") {
    const tool = nextId("tool"), nodeId = nextId("dlg"), canvas = canvasSize(projectId), drama = /剧本/.test(request.text);
    const node = { id: nodeId, type: "text", title: drama ? "剧本 · 示例" : "口播稿 · 示例", width: 380, height: drama ? 420 : 320, position: { x: canvas.right + 40, y: 40 },
      metadata: { content: drama ? mockDrama(request.text) : MOCK_SCRIPT, studio: { mock: true } } } as unknown as NonNullable<StudioNodeUpsertData["node"]>;
    play(p, t, [
      { run: () => emit(t, "tool.started", { toolCallId: tool, toolName: "create_nodes", title: "放进画布", safeInputSummary: "新建 1 个对象" }) },
      { run: () => { emit(t, "node.upsert", { nodeId, op: "create", node } satisfies StudioNodeUpsertData);
        emit(t, "tool.finished", { toolCallId: tool, toolName: "create_nodes", status: "done", result: { summary: "已在画布上新建 1 个对象", nodeIds: [nodeId] }, creditsActual: 0, settling: false }); } },
      ...say(t, messageId, "w1", drama ? "剧本放在画布上了，分 3 场，每场写了画面和台词。" : "口播稿放在画布上了，分开场问题、一个卖点、一个动作三段。"),
      { run: () => emit(t, "turn.done", { reason: "completed", messageId, billing: MOCK_BILLING, settling: false,
        suggestions: drama ? ["反转再提前一点", "改成 3 集", "按这个剧本出分镜图"] : ["开头再抓人一点", "缩短到 100 字以内", "按这段出一条视频"] }) },
    ]);
    return;
  }
  const spec = DIRECT_STEP[skill.key] || DIRECT_STEP["image-generation"], cost = spec.quotedCost(request.text);
  const n = ++counter, revision = nextPlanRevision(t), fingerprint = `mock-direct-${skill.key}-${n}`, planRunId = `mock-plan-${skill.key}-${n}`;
  const references = mockStore().projects.get(projectId)?.doc.nodes.filter(x => request.attachmentNodeIds?.includes(x.id) || request.pinnedNodeIds?.includes(x.id)).map(x => x.id) || [];
  const plan: Extract<StudioMessageBlock, { type: "plan" }> = { type: "plan", planRunId, revision, fingerprint, plan: {
    summary: spec.summary(request.text), questions: [], skillKey: skill.key, skillVersion: skill.version, stage: "production", revision, fingerprint,
    steps: [{ id: "d1", operation: spec.operation, title: spec.title(request.text), prompt: spec.prompt(request.text), referenceNodeIds: references, quotedCost: cost }],
    budget: { estimated: cost, autoFixCap: 0 } } };
  play(p, t, [
    ...say(t, messageId, "d1", spec.said),
    { run: () => emit(t, "plan.proposed", { messageId, block: plan }) },
    { run: () => emit(t, "approval.required", { messageId, block: { type: "approval", approvalId: `mock-approval-${skill.key}-${n}`, stage: "production", planFingerprint: fingerprint,
      scope: [spec.title(request.text)], quotedCost: cost, budgetCap: cost + 10, autoFixCap: 0, status: "pending", expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() } }) },
    { run: () => { emit(t, "turn.done", { reason: "waiting_user", messageId, billing: MOCK_BILLING, settling: false, suggestions: ["可以，开始", "改成 16:9", "多来一版"] }); p.stage = "production-proposed"; } },
  ]);
}

/** A confirmed direct card: its execution starts in production and runs the one step, like productionTurn does. */
function directProductionTurn(projectId: string, p: MockProject, t: MockThread) {
  const e = p.execution!, messageId = startTurn(t), s = e.steps[0], tool = nextId("tool"), runId = `${e.id}-run-${s.id}`;
  play(p, t, [
    { waitsForExecution: true, run: () => { setStep(p, s.id, "running", runId); emit(t, "tool.started", { toolCallId: tool, toolName: s.operation, title: s.title, safeInputSummary: s.title, childRunId: runId }, e.id); budget(p, t, 0, s.quotedCost, "quote"); } },
    { waitsForExecution: true, delay: mockDialogueTiming.tickMs * 6, run: () => emit(t, "tool.progress", { toolCallId: tool, toolName: s.operation, progress: "已提交，等待结果" }, e.id) },
    { waitsForExecution: true, delay: mockDialogueTiming.tickMs * 6, run: () => {
      emit(t, "tool.finished", { toolCallId: tool, toolName: s.operation, status: "done", result: { summary: `${s.title}完成`, nodeIds: [stepNodeId(e.id, s)] }, creditsActual: s.quotedCost, settling: false }, e.id);
      finishStep(projectId, p, t, s.id, {}, runId); budget(p, t, s.quotedCost, 0, "actual");
      updateExecution(p, x => ({ ...x, status: "done", finishedAt: now() }));
    } },
    // The server's completion summary and follow-ups (StudioExecutionSummary) for a run of one finished step. One clip is
    // already the whole video, so there is nothing to join (the server offers that only from two finished clips).
    ...say(t, messageId, "e2", `做好了，花了 ${s.quotedCost} 积分。`),
    { run: () => {
      const suggestions = s.operation === "video" ? ["把这张画布存为模板"] : ["用这张图做一段视频", "换个风格再出一张"];
      emit(t, "turn.done", { reason: "completed", messageId, billing: MOCK_BILLING, settling: false, suggestions });
      patchViewMessage(t, messageId, m => ({ ...m, suggestions, clientMessageId: `exec-summary-${e.id}` }));
      p.stage = "done";
    } },
  ]);
}

// Like the server's guard (StudioNaturalApprovals): a reply that says to go ahead confirms the pending card; a question,
// hesitation or edit never does. The demo used to answer every reply with 「确认没问题就点…」, so the card's
// 「直接回复「开始」也行」 could not be tried here.
const HESITATION = ["？", "?", "吗", "先别", "别开始", "不要开始", "不开始", "暂不", "暂时不", "不确认", "不同意", "等一下", "等等", "再想想", "考虑一下", "再看看", "算了", "不用了", "不行",
  "等我通知", "等通知", "等我说", "再通知", "等我确认", "稍后", "以后再", "先修改", "只修改", "先改", "改一下", "改成", "不生成", "别生成", "不要生成", "先不", "暂停", "停一下", "不急", "等一等", "晚点", "过会"];
const APPROVAL = ["确认", "开始", "按这个", "按此", "按你", "按推荐", "按方案", "就这样", "就这个", "同意", "批准", "可以做", "可以开始", "做吧", "开工", "执行", "通过", "没问题", "就按", "照这个",
  "ok", "OK", "Ok", "好的", "行，", "行。"];
// A reply made only of short affirmatives (「可以」「好」「嗯，可以」「好吧」) also confirms: every piece between punctuation,
// after its trailing particles, must be one of these (StudioNaturalApprovals.SHORT_AFFIRMATIVES).
const SHORT_AFFIRMATIVES = new Set(["可以", "可", "好", "好好", "行", "行行", "嗯", "嗯嗯", "对", "对的", "是", "是的", "没错", "可以可以", "好嘞", "妥"]);
function onlyAffirmatives(text: string) {
  const pieces = text.trim().split(/[\s,，。.!！、;；~～…]+/).filter(Boolean);
  return pieces.length > 0 && pieces.every(p => SHORT_AFFIRMATIVES.has(p.replace(/[吧啊呀啦哈哦呢嘛了]+$/, "")));
}
export function mockSaysApprove(text: string) {
  const said = text.trim();
  return !!said && !HESITATION.some(h => said.includes(h)) && (APPROVAL.some(a => said.includes(a)) || onlyAffirmatives(said));
}
// A typed stop or pause (StudioStopIntent): the whole message, after punctuation, a polite opener and trailing particles,
// must be one of these. 「不要停」「要停吗？」 and longer sentences stay ordinary messages.
const STOP_PHRASES = new Set(["停", "停止", "停下", "停下来", "停掉", "先停", "先停下", "先停下来", "先停止", "停止制作", "停止生成", "全部停止", "都停下", "都停",
  "别做", "先别做", "不做", "不要做", "不用做", "取消", "取消制作", "结束制作"]);
const PAUSE_PHRASES = new Set(["暂停", "先暂停", "暂停一下", "先暂停一下", "暂停制作", "暂停生成", "停一下", "先停一下", "暂停后续"]);
export function mockStopIntent(text: string): "stop" | "pause" | undefined {
  const said = text.trim();
  if (!said || said.length > 24 || /[?？吗么]/.test(said)) return undefined;
  const core = said.replace(/[\s,，。.!！、;；~～…]+/g, "").replace(/^(?:请|麻烦你|麻烦|帮我|你|好的?|行|嗯)+/, "").replace(/[吧啊呀啦哈哦嘛了]+$/, "");
  return STOP_PHRASES.has(core) ? "stop" : PAUSE_PHRASES.has(core) ? "pause" : undefined;
}
function naturalApproval(projectId: string, p: MockProject, t: MockThread, text: string, messageId: string): boolean {
  if ((p.stage !== "analysis-proposed" && p.stage !== "production-proposed") || !mockSaysApprove(text)) return false;
  const stage = p.stage === "analysis-proposed" ? "analysis" as const : "production" as const;
  const blocks = t.view.messages.flatMap(m => m.blocks);
  const card = blocks.filter((b): b is Extract<StudioMessageBlock, { type: "approval" }> => b.type === "approval" && b.status === "pending" && b.stage === stage).at(-1);
  if (!card) return false;
  const plan = blocks.filter((b): b is Extract<StudioMessageBlock, { type: "plan" }> => b.type === "plan" && b.plan.stage === stage).at(-1);
  try {
    void mockExecutionCreate(projectId, { clientRequestId: nextId("said"), stage, planRunId: plan?.planRunId || `mock-plan-${stage}`, planFingerprint: card.planFingerprint,
      budgetCap: card.budgetCap, autoFixCap: card.autoFixCap, approvalId: card.approvalId, confirmationMessageId: messageId,
      // Like the panel: a production card confirms the execution it names; a direct skill's card names none and starts one.
      ...(stage === "production" && card.executionId ? { executionId: card.executionId, expectedRevision: plan?.revision ?? 2 } : {}) });
  } catch { return false; }
  const holder = t.view.messages.find(m => m.blocks.some(b => b.type === "approval" && b.approvalId === card.approvalId));
  const approved = holder?.blocks.find(b => b.type === "approval" && b.approvalId === card.approvalId);
  if (holder && approved) emit(t, "approval.required", { messageId: holder.id, block: approved }, p.execution?.id);
  return true;
}

function replyTurn(p: MockProject, t: MockThread, request: StudioPostMessageRequest) {
  const messageId = startTurn(t);
  const pinnedText = mockStore().projects.get(t.thread.projectId)?.doc.nodes.find(n => request.pinnedNodeIds?.includes(n.id) && n.type === "text" && typeof n.metadata?.content === "string" && n.metadata.content.trim());
  const reply = p.stage === "analysis-proposed" ? "记下了，分析时按这个来。"
    : p.stage === "production-proposed" ? "记下了，制作时按这个来。"
      : "记下了。";
  play(p, t, [
    ...say(t, messageId, "r1", reply),
    ...(pinnedText ? [{ run: () => emit(t, "node.upsert", { nodeId: pinnedText.id, op: "propose", proposal: { field: "content", content: `${String(pinnedText.metadata!.content).trim()}\n（示例修改：语气更口语）` } } satisfies StudioNodeUpsertData) }] : []),
    { run: () => emit(t, "turn.done", { reason: "completed", messageId, billing: MOCK_BILLING, settling: false }) },
  ]);
}

// ── Endpoints ──────────────────────────────────────────────────────────────

export function mockDialogueConversation(projectId: string): Promise<StudioDialogueState> {
  const p = project(projectId);
  return later(snapshot(p, thread(p, p.currentThreadId)));
}

export function mockDialogueMessages(projectId: string, threadId: string, opts: { beforeSeq?: number; limit?: number }): Promise<StudioDialogueMessage[]> {
  const t = thread(project(projectId), threadId);
  const limit = opts.limit || 50;
  const list = t.view.messages.filter(m => !isPlaceholderMessage(m.id) && (opts.beforeSeq === undefined || m.seq < opts.beforeSeq));
  return later(list.slice(-limit));
}

export function mockDialoguePost(projectId: string, threadId: string, request: StudioPostMessageRequest): Promise<StudioPostMessageResult> {
  const p = project(projectId), t = thread(p, threadId);
  const known = t.results.get(request.clientMessageId);
  if (known) return later(known);
  const busy = t.running;
  // Same as the server: a typed stop / pause while something is working is a priority control, not queued steering.
  const said = mockStopIntent(request.text);
  const working = p.execution && ["running", "paused", "needs_user"].includes(p.execution.status);
  if (said && (busy || working) && !request.pinnedNodeIds?.length && !request.attachmentNodeIds?.length) {
    const action = said === "pause" && working ? "pause" as const : "stop" as const;
    void mockDialogueControl(projectId, threadId, { controlId: nextId("say"), action });
    const message: StudioDialogueMessage = { id: nextId("msg"), threadId, seq: ++t.thread.lastSeq, role: "user", text: request.text, blocks: [],
      clientMessageId: request.clientMessageId, status: "done", createdAt: now() };
    t.view = { ...t.view, messages: [...t.view.messages, message] };
    const reply = action === "pause" ? "已暂停，已经提交的任务会照常做完。"
      : working ? "已停止，已经开始生成的任务会照常做完。" : "已停止。";
    const ack = startTurn(t);
    play(p, t, [...say(t, ack, "r1", reply), { run: () => emit(t, "turn.done", { reason: "completed", messageId: ack, billing: MOCK_BILLING, settling: false }) }]);
    const result: StudioPostMessageResult = { messageId: message.id, queueState: "applied" };
    t.results.set(request.clientMessageId, result);
    return later(result);
  }
  // Like the server, a message sent mid-turn is queued as is; routing happens when a turn starts (and a refused choice
  // leaves no message behind).
  let skill: StudioSkillSummary | undefined;
  if (!busy) try { skill = pickSkill(projectId, p, t, request); } catch (error) { return Promise.reject(error); }
  const message: StudioDialogueMessage = { id: nextId("msg"), threadId, seq: ++t.thread.lastSeq, role: "user", text: request.text, blocks: [],
    pinnedNodeIds: request.pinnedNodeIds, attachmentNodeIds: request.attachmentNodeIds, clientMessageId: request.clientMessageId, status: busy ? "queued" : "done", createdAt: now() };
  t.view = { ...t.view, messages: [...t.view.messages, message] };
  let result: StudioPostMessageResult;
  if (busy) { t.queued.push(message.id); result = { messageId: message.id, turnId: t.turnId, queueState: "queued" }; }
  else {
    // The skill is bound per job: a different one switches the thread and starts its job from the beginning.
    if (skill && skill.key !== t.thread.skillKey) { t.thread.skillKey = skill.key; t.thread.skillVersion = skill.version; p.stage = "idle"; }
    if (!skill) generalTurn(p, t);
    else if (mockSkillIsDirect(skill) && (p.stage === "idle" || p.stage === "done")) directTurn(projectId, p, t, request, skill);
    else if (p.stage === "idle") firstTurn(projectId, p, t, request);
    else if (!naturalApproval(projectId, p, t, request.text, message.id)) replyTurn(p, t, request);
    result = { messageId: message.id, turnId: t.turnId, runId: t.runId, queueState: "accepted" };
    patchViewMessage(t, message.id, m => ({ ...m, turnId: t.turnId }));
  }
  t.results.set(request.clientMessageId, result);
  return later(result);
}

/** `onExpired`: the cursor is below the pruned floor (the server answers 410); the caller rebuilds from a snapshot. */
export function mockDialogueSubscribe(projectId: string, threadId: string, afterSeq: number, onEvent: Listener, onExpired?: () => void): () => void {
  const t = thread(project(projectId), threadId);
  let open = true;
  if (afterSeq < t.eventFloorSeq) {
    setTimeout(() => { if (open) onExpired?.(); }, 0);
    return () => { open = false; };
  }
  const backlog = t.events.filter(e => e.seq > afterSeq).map(e => clone(e));
  const listener: Listener = event => { if (open) onEvent(event); };
  setTimeout(() => { if (!open) return; for (const e of backlog) onEvent(e); t.listeners.add(listener); }, 0);
  return () => { open = false; t.listeners.delete(listener); };
}

export function mockDialogueControl(projectId: string, threadId: string, request: StudioDialogueControlRequest): Promise<StudioDialogueState> {
  const p = project(projectId), t = thread(p, threadId);
  if (request.action === "stop") {
    if (t.running) {
      t.generation++; t.running = false;
      const messageId = t.view.turnMessages[t.turnId || ""];
      if (messageId) emit(t, "turn.done", { reason: "interrupted", messageId, billing: MOCK_BILLING, settling: false });
    }
    if (p.execution && ["running", "paused", "needs_user"].includes(p.execution.status)) {
      updateExecution(p, e => ({ ...e, status: "canceled", finishedAt: now(), steps: e.steps.map(s => s.status === "pending" ? { ...s, status: "skipped", reason: "已停止" } : s) }));
      p.stage = "done";
    }
  } else if (p.execution) updateExecution(p, e => ({ ...e, status: request.action === "pause" ? "paused" : "running" }));
  return later(snapshot(p, t));
}

export function mockDialogueBranch(projectId: string, threadId: string, request: StudioBranchRequest): Promise<StudioDialogueState> {
  const p = project(projectId), source = thread(p, threadId);
  const from = source.view.messages.find(m => m.id === request.fromMessageId);
  if (!from) throw Object.assign(new Error("这条消息不存在，请刷新后重试"), { code: "STUDIO_INPUT_INVALID" });
  const branch = createThread(projectId, { threadId, messageId: from.id });
  const copied = source.view.messages.filter(m => !isPlaceholderMessage(m.id) && m.seq <= from.seq)
    .map(m => ({ ...clone(m), id: `${m.id}~${branch.thread.id}`, threadId: branch.thread.id, blocks: m.blocks.filter(b => b.type !== "approval") }));
  branch.thread.lastSeq = from.seq;
  branch.view = { ...branch.view, messages: copied, latestSeq: from.seq };
  p.threads.set(branch.thread.id, branch); makeCurrent(p, branch);
  // A branch never inherits approvals or payment: the demo starts its plan again.
  p.stage = "idle";
  return later(snapshot(p, branch));
}

// ── Conversations of one canvas (docs/ip-studio-new-canvas-and-threads.md §3.2) ─────────────
// Like StudioDialogueController (specs/openapi.yaml studioConversationList / Create / Read / Open): list (the ones with messages
// plus the current one, newest activity first, at most 50 with the current one kept), create (an empty conversation
// becomes current; the newest unused empty one that is not a branch and has no skill is reused; same key → same thread)
// read (one conversation's snapshot; the current one stays) and open (becomes current). None of them reads a model or
// spends anything.

const CLIENT_ID = /^[A-Za-z0-9_.:-]{1,64}$/;
const threadMessages = (t: MockThread) => t.view.messages.filter(m => !isPlaceholderMessage(m.id));
/** The thread whose turn is replying, or whose execution is running / paused / waiting for the user. */
const threadActive = (p: MockProject, t: MockThread) => t.running || (workingExecution(p) && p.execution!.threadId === t.thread.id);
/** The server's display name: the first user message with text, whitespace squeezed, at most 24 code points plus 「…」. */
function threadTitle(t: MockThread) {
  const first = threadMessages(t).map(m => m.role === "user" ? m.text.replace(/\s+/g, " ").trim() : "").find(Boolean);
  if (!first) return "新对话";
  const chars = Array.from(first);
  return chars.length > 24 ? `${chars.slice(0, 24).join("")}…` : first;
}
/** Opening another conversation keeps where this one's demo flow stood (the project holds one stage at a time). */
function makeCurrent(p: MockProject, t: MockThread) {
  if (p.currentThreadId === t.thread.id) return;
  const previous = p.threads.get(p.currentThreadId);
  if (previous) previous.stage = p.stage;
  p.currentThreadId = t.thread.id;
  p.stage = t.stage ?? "idle";
}

export function mockDialogueThreads(projectId: string): Promise<StudioDialogueThreadSummary[]> {
  const p = project(projectId);
  const list = [...p.threads.values()].filter(t => t.thread.id === p.currentThreadId || threadMessages(t).length).map((t): StudioDialogueThreadSummary => {
    const messages = threadMessages(t), last = messages.at(-1)?.createdAt;
    // A branch keeps its copied messages' times, so the later of the last message and the thread's creation counts.
    return { id: t.thread.id, title: threadTitle(t), ...(t.thread.parentThreadId ? { parentThreadId: t.thread.parentThreadId } : {}), messageCount: messages.length,
      lastActivityAt: last && last > t.thread.createdAt ? last : t.thread.createdAt, createdAt: t.thread.createdAt, current: t.thread.id === p.currentThreadId, active: threadActive(p, t) };
  }).sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt) || b.createdAt.localeCompare(a.createdAt));
  const shown = list.slice(0, 50), current = list.find(t => t.current);
  if (current && !shown.includes(current)) shown.splice(49, 1, current);
  return later(shown, 60);
}

export function mockDialogueCreateThread(projectId: string, request: StudioCreateThreadRequest): Promise<StudioDialogueState> {
  if (!request?.clientRequestId || !CLIENT_ID.test(request.clientRequestId))
    return Promise.reject(new ApiError({ code: "STUDIO_INPUT_INVALID", message: "请求编号不正确，请刷新后重试" }, 400));
  const p = project(projectId);
  const known = p.threads.get(p.createdThreads.get(request.clientRequestId) || "");
  if (known) { makeCurrent(p, known); return later(snapshot(p, known)); }
  // The newest conversation nobody has written in yet (nothing running on it, not a branch, no skill) is reused.
  const reusable = [...p.threads.values()].filter(t => !threadMessages(t).length && !threadActive(p, t) && !t.thread.parentThreadId && !t.thread.skillKey)
    .sort((a, b) => b.thread.createdAt.localeCompare(a.thread.createdAt))[0];
  const t = reusable || createThread(projectId);
  if (!reusable) p.threads.set(t.thread.id, t);
  p.createdThreads.set(request.clientRequestId, t.thread.id);
  makeCurrent(p, t);
  return later(snapshot(p, t));
}

/** POST …/conversations/{threadId}/open: the user picked this conversation, so it becomes the current one. */
export function mockDialogueOpenThread(projectId: string, threadId: string): Promise<StudioDialogueState> {
  const p = project(projectId), t = p.threads.get(threadId);
  if (!t) return Promise.reject(new ApiError({ code: "STUDIO_THREAD_NOT_FOUND", message: "这条对话不存在，请刷新画布" }, 404));
  makeCurrent(p, t);
  return later(snapshot(p, t));
}

/** GET …/conversations/{threadId}: the snapshot only; the current conversation (and its demo flow) stays where it was. */
export function mockDialogueThreadSnapshot(projectId: string, threadId: string): Promise<StudioDialogueState> {
  const p = project(projectId), t = p.threads.get(threadId);
  if (!t) return Promise.reject(new ApiError({ code: "STUDIO_THREAD_NOT_FOUND", message: "这条对话不存在，请刷新画布" }, 404));
  return later(snapshot(p, t));
}

export function mockExecutionCreate(projectId: string, request: StudioPlanExecutionCreateRequest): Promise<StudioPlanExecution> {
  const p = project(projectId), t = thread(p, p.currentThreadId), at = now();
  if (request.stage === "analysis") {
    if (p.execution && ["running", "paused", "needs_user"].includes(p.execution.status) && p.execution.stage === "analysis") return later(p.execution);
    const id = nextId("exec");
    p.execution = { id, projectId, threadId: t.thread.id, skillKey: t.thread.skillKey || "reference-video-recreation", skillVersion: t.thread.skillVersion || 1, stage: "analysis", planRunId: request.planRunId, planRevision: 1,
      planFingerprint: request.planFingerprint, status: "running", steps: withNodeIds(id, [step("s1", "拉片：切成 2 段", "recreation", "analysis", 20), step("s2", "整理每段的画面和节奏", "text", "analysis", 6, ["s1"])]),
      budgets: [{ stage: "analysis", approvedCap: request.budgetCap, autoFixCap: request.autoFixCap, spent: 0, inFlight: 0, remaining: request.budgetCap }],
      startedAt: at, deadlineAt: new Date(Date.now() + 90 * 60_000).toISOString(), updatedAt: at };
    patchApproval(t, request.approvalId, p.execution.id, request);
    p.stage = "analysis-running";
    analysisTurn(projectId, p, t);
    return later(p.execution);
  }
  if (!request.executionId) return directExecutionCreate(projectId, p, t, request);
  const e = p.execution;
  if (!e || e.id !== request.executionId) throw Object.assign(new Error("分析还没有完成，请先确认分析"), { code: "STUDIO_PLAN_STALE" });
  if (e.stage === "production") return later(e);
  p.execution = { ...e, stage: "production", status: "running", planRunId: request.planRunId, planRevision: request.expectedRevision ?? 2, planFingerprint: request.planFingerprint, needsUserReason: undefined,
    steps: [...e.steps, ...withNodeIds(e.id, [step("v1", "第 1 段视频", "video", "production", 40), step("v2", "第 2 段视频", "video", "production", 40), step("c1", "检查第 1 段", "check", "production", 2, ["v1"]), step("m1", "合成成片", "assemble", "production", 0, ["v1", "v2"])])],
    budgets: [...e.budgets, { stage: "production", approvedCap: request.budgetCap, autoFixCap: request.autoFixCap, spent: 0, inFlight: 0, remaining: request.budgetCap }], updatedAt: at };
  patchApproval(t, request.approvalId, e.id, request);
  p.stage = "production-running";
  productionTurn(projectId, p, t);
  return later(p.execution);
}

/**
 * A production card without an executionId (StudioPlanExecutionService.create): allowed only for a plan of a direct skill,
 * which then starts in production with the plan's steps; any other plan still needs its analysis first (400). The same
 * plan and card confirmed twice returns the same execution.
 */
function directExecutionCreate(projectId: string, p: MockProject, t: MockThread, request: StudioPlanExecutionCreateRequest): Promise<StudioPlanExecution> {
  if (p.execution && p.execution.planRunId === request.planRunId && p.execution.stage === "production") return later(p.execution);
  const plan = t.view.messages.flatMap(m => m.blocks).filter((b): b is Extract<StudioMessageBlock, { type: "plan" }> => b.type === "plan" && b.planRunId === request.planRunId).at(-1);
  const skill = mockSkill(plan?.plan.skillKey);
  // Thrown, like the other refusals here, so the typed 「可以」 path (naturalApproval) can catch it.
  if (!plan || !skill || !mockSkillIsDirect(skill)) throw new ApiError({ code: "STUDIO_INPUT_INVALID", message: "这个方案要先确认分析，再确认制作" }, 400);
  if (workingExecution(p)) throw new ApiError({ code: "STUDIO_INPUT_INVALID", message: "上一次制作还没结束，结束后再开始新的" }, 400);
  const id = nextId("exec"), at = now();
  p.execution = { id, projectId, threadId: t.thread.id, skillKey: skill.key, skillVersion: skill.version, stage: "production", planRunId: request.planRunId, planRevision: plan.revision,
    planFingerprint: request.planFingerprint, status: "running",
    steps: withNodeIds(id, plan.plan.steps.map(x => step(x.id, x.title, x.operation, "production", x.quotedCost, x.dependsOn || []))),
    budgets: [{ stage: "production", approvedCap: request.budgetCap, autoFixCap: request.autoFixCap, spent: 0, inFlight: 0, remaining: request.budgetCap }],
    startedAt: at, deadlineAt: new Date(Date.now() + 90 * 60_000).toISOString(), updatedAt: at };
  patchApproval(t, request.approvalId, id, request);
  p.stage = "production-running";
  directProductionTurn(projectId, p, t);
  return later(p.execution);
}

/** Like the server's approval snapshot: the card keeps what was actually authorized, not what it proposed. */
function patchApproval(t: MockThread, approvalId: string | undefined, executionId: string, request: StudioPlanExecutionCreateRequest) {
  if (!approvalId) return;
  const approved = { approvedBudgetCap: request.budgetCap, approvedAutoFixCap: request.autoFixCap, approvedAt: now(), ...(request.confirmationMessageId ? { approvedByMessageId: request.confirmationMessageId } : {}) };
  t.view = { ...t.view, messages: t.view.messages.map(m => ({ ...m, blocks: m.blocks.map(b => b.type === "approval" && b.approvalId === approvalId ? { ...b, status: "approved" as const, executionId, ...approved } : b) })) };
}

export function mockExecutionGet(projectId: string, executionId: string): Promise<StudioPlanExecution> {
  const e = project(projectId).execution;
  if (!e || e.id !== executionId) throw Object.assign(new Error("找不到这次制作"), { code: "STUDIO_PLAN_EXECUTION_NOT_FOUND" });
  return later(e, 60);
}

export function mockExecutionControl(projectId: string, executionId: string, action: "pause" | "resume" | "cancel"): Promise<StudioPlanExecution> {
  const p = project(projectId), e = p.execution;
  if (!e || e.id !== executionId) throw Object.assign(new Error("找不到这次制作"), { code: "STUDIO_PLAN_EXECUTION_NOT_FOUND" });
  if (action === "cancel") {
    const t = thread(p, p.currentThreadId);
    if (t.running) { t.generation++; t.running = false; }
    updateExecution(p, x => ({ ...x, status: "canceled", finishedAt: now(), steps: x.steps.map(s => s.status === "pending" ? { ...s, status: "skipped", reason: "已停止" } : s) }));
    p.stage = "done";
  } else updateExecution(p, x => ({ ...x, status: action === "pause" ? "paused" : "running" }));
  return later(p.execution!);
}

export function mockExecutionAccept(projectId: string, executionId: string, stepId: string, request: StudioPlanExecutionAcceptRequest): Promise<StudioPlanExecution> {
  const p = project(projectId);
  if (!p.execution || p.execution.id !== executionId) throw Object.assign(new Error("找不到这次制作"), { code: "STUDIO_PLAN_EXECUTION_NOT_FOUND" });
  updateExecution(p, x => ({ ...x, steps: x.steps.map(s => s.id === stepId ? { ...s, acceptedRunId: request.runId, acceptedCandidateIndex: request.candidateIndex } : s) }));
  return later(p.execution!);
}

/**
 * A canvas whose recreation finished while it was closed: the thread holds both confirmed cards, the execution is
 * done (and so no longer in the snapshot), every step has a readable run, the canvas has none of the nodes, and the
 * events are pruned. Opening it must rebuild the nodes from the execution. Returns the execution.
 */
/** Idempotent: make sure the closed-canvas sample has its finished execution and runs before the canvas is read. */
export function mockEnsureClosedProjectSeeded(projectId: string): void { project(projectId); }
export function mockSeedCompletedExecution(projectId: string): StudioPlanExecution {
  const p = project(projectId);
  return seedCompleted(projectId, p, thread(p, p.currentThreadId));
}
function seedCompleted(projectId: string, p: MockProject, t: MockThread): StudioPlanExecution {
  const at = now();
  const id = `exec-${projectId}-done`;
  const steps = withNodeIds(id, [step("s1", "拉片：切成 2 段", "recreation", "analysis", 20), step("s2", "整理每段的画面和节奏", "text", "analysis", 6, ["s1"]),
    step("v1", "第 1 段视频", "video", "production", 40), step("v2", "第 2 段视频", "video", "production", 40), step("c1", "检查第 1 段", "check", "production", 2, ["v1"])])
    .map(s => ({ ...s, status: "done" as const, attempt: 1, runIds: [`${id}-run-${s.id}`] }));
  const execution: StudioPlanExecution = { id, projectId, threadId: t.thread.id, skillKey: "reference-video-recreation", skillVersion: 1, stage: "production", planRunId: "mock-plan-production",
    planRevision: 2, planFingerprint: "mock-production-v2", status: "done", steps, startedAt: at, deadlineAt: at, updatedAt: at, finishedAt: at,
    budgets: [{ stage: "analysis", approvedCap: 30, autoFixCap: 0, spent: 24, inFlight: 0, remaining: 6 }, { stage: "production", approvedCap: 100, autoFixCap: 20, spent: 82, inFlight: 0, remaining: 18 }] };
  const outputs: Record<string, IpRunOutput> = { s1: { text: MOCK_RECREATION_TEXT }, s2: { textRevision: { content: MOCK_NOTES, summary: "每段的画面和节奏" } }, v1: {}, v2: {},
    c1: { check: MOCK_CHECK_ITEMS(`${id}-run-v1`) } };
  for (const s of steps) mockRegisterRun(stepRun(projectId, execution, s, outputs[s.id]));
  const approval = (approvalId: string, stage: "analysis" | "production", fingerprint: string, scope: string[], quotedCost: number, budgetCap: number, autoFixCap: number, approvedBudgetCap: number, approvedAutoFixCap: number): StudioMessageBlock =>
    ({ type: "approval", approvalId, stage, planFingerprint: fingerprint, scope, quotedCost, budgetCap, autoFixCap, status: "approved", executionId: id, approvedBudgetCap, approvedAutoFixCap, approvedAt: at });
  const message = (mid: string, seq: number, role: "user" | "assistant", text: string, blocks: StudioMessageBlock[] = []): StudioDialogueMessage =>
    ({ id: mid, threadId: t.thread.id, seq, role, text, blocks, status: "done", createdAt: at });
  const analysisPlan: StudioMessageBlock = { type: "plan", planRunId: "mock-plan-analysis", revision: 1, fingerprint: "mock-analysis-v1", plan: { summary: "拉片看清原片两段的画面和节奏", questions: [], stage: "analysis", revision: 1, fingerprint: "mock-analysis-v1",
    steps: [{ id: "s1", operation: "recreation", title: "拉片：切成 2 段", prompt: "", referenceNodeIds: [], quotedCost: 20 }, { id: "s2", operation: "text", title: "整理每段的画面和节奏", prompt: "", referenceNodeIds: [], quotedCost: 6, dependsOn: ["s1"] }], budget: { estimated: 26, autoFixCap: 0 } } };
  const productionPlan: StudioMessageBlock = { type: "plan", planRunId: "mock-plan-production", revision: 2, fingerprint: "mock-production-v2", plan: { summary: "两段 5 秒竖屏视频，保留原片动作和反转，换成你的商品", questions: [], stage: "production", revision: 2, fingerprint: "mock-production-v2",
    steps: [{ id: "v1", operation: "video", title: "第 1 段视频", prompt: "", referenceNodeIds: [], quotedCost: 40 }, { id: "v2", operation: "video", title: "第 2 段视频", prompt: "", referenceNodeIds: [], quotedCost: 40 },
      { id: "c1", operation: "check", title: "检查第 1 段", prompt: "", referenceNodeIds: [], quotedCost: 2, dependsOn: ["v1"] }], budget: { estimated: 82, autoFixCap: 40 } } };
  const messages = [
    message("seed-u1", 1, "user", "换成我的洗衣液，保留最后的反转"),
    message("seed-m1", 2, "assistant", "原片可以分成两段：前段交代场景，后段做反转。", [analysisPlan, approval("seed-approval-analysis", "analysis", "mock-analysis-v1", ["拉片，切成 2 段", "整理每段的画面和节奏"], 26, 30, 0, 30, 0)]),
    message("seed-m2", 3, "assistant", "拉片好了：前段交代场景，后段靠水杯做反转。", [productionPlan, approval("seed-approval-production", "production", "mock-production-v2", ["第 1 段视频", "第 2 段视频", "检查第 1 段"], 82, 122, 40, 100, 20)]),
  ];
  t.thread.lastSeq = 40; t.eventFloorSeq = 40; t.events = [];
  t.view = { ...t.view, messages, latestSeq: 40 };
  p.execution = execution; p.stage = "done";
  return clone(execution);
}

/**
 * 「整理成技能草稿」: like the server, a paid text run (free here) reads the finished execution and saves a draft
 * version that an admin has to review and publish. Same clientRequestId → the same run.
 */
const draftRuns = new Map<string, string>();
export async function mockCreateSkillDraft(projectId: string, request: StudioSkillDraftRequest): Promise<IpRun> {
  const known = draftRuns.get(request.clientRequestId);
  if (known) return later(mockReadRun(known), 60);
  const p = project(projectId);
  const e = p.execution?.id === request.executionId ? p.execution : undefined;
  if (!e) throw new ApiError({ code: "STUDIO_PLAN_EXECUTION_NOT_FOUND", message: "找不到这次制作，刷新后再试" }, 404);
  if (!["done", "partial"].includes(e.status)) throw new ApiError({ code: "STUDIO_INPUT_INVALID", message: "这次制作还没做完，做完再整理" }, 400);
  const skill = MOCK_STUDIO_SKILLS.find(s => s.key === e.skillKey) || MOCK_STUDIO_SKILLS[0];
  const skillDraft: StudioSkillDraftOutput = { skillKey: skill.key, version: skill.version + 1, baseVersion: skill.version, changeNote: "口播段只换手里的商品，合并 2 秒内的碎段", strippedReferences: 3 };
  const at = now(), id = nextId("IPR-draft");
  const run: IpRun = { id, projectId, nodeId: e.id, kind: "studio-text", status: "running", stage: "queued", pct: 0, cost: 0, inputs: {}, output: { skillDraft, mock: true } as IpRunOutput, createdAt: at };
  mockRegisterRun(run);
  const entry = mockStore().runs.get(id);
  if (entry) entry.durationMs = mockDialogueTiming.tickMs * 20;
  draftRuns.set(request.clientRequestId, id);
  return later({ ...run, output: {} }, 60);
}

/** Tests only: drop all mock threads. */
export function resetMockDialogue() { projects.clear(); draftRuns.clear(); }
