// ─────────────────────────────────────────────────────────────────────────────
// mocks/studio-dialogue.ts — NEXT_PUBLIC_USE_MOCK=1 时「全能创作」对话的内存实现（无网络）。
//
// 形状逐字照 packages/types/src/ip-studio-workflow.ts 的对话契约；事件按 seq 递增、可从任意
// afterSeq 重放，快照由同一个 reducer 折叠出来，所以演示模式和真实模式走同一套前端逻辑。
// 这是演示：正文是写死的示例回答，按小段定时推出来，不是模型输出；面板上有「演示」角标，
// 产出的节点带 studio.mock=true（AGENTS.md §8.0 (c)），不扣任何积分。
//
// 演示流程：第一条消息 → 读取画布 + 分析计划 + 确认卡「开始分析」→ 拉片（工作记录）→
// 制作计划（推荐与替代做法）+ 确认卡「开始制作」→ 两段视频节点 + 一次检查（含一项无法判断）。
//
// 和真服务端一样：每一步做完都有一次可读取的运行（getRun），画布节点 id 按
// StudioPlanExecutionIds.nodeId 推出来，节点形状照 StudioPlanExecutor.nodeEvents；
// 快照只带进行中的制作，做完的制作要从确认卡上的 executionId 读回来；
// 事件可以被裁掉（eventFloorSeq），游标低于它就要求重新读快照。
// mockSeedCompletedExecution 造一张「关着页面时制作已经做完」的画布，用来验收重新打开后补节点。
// ─────────────────────────────────────────────────────────────────────────────

import type {
  StudioBranchRequest, StudioCheckResultData, StudioDialogueControlRequest, StudioDialogueEvent, StudioDialogueEventType, StudioDialogueMessage,
  StudioDialogueState, StudioDialogueThread, StudioMessageBlock, StudioNodeUpsertData, StudioPlanExecution, StudioPlanExecutionAcceptRequest,
  StudioPlanExecutionCreateRequest, StudioPlanExecutionStep, StudioPostMessageRequest, StudioPostMessageResult, StudioSkillDraftOutput, StudioSkillDraftRequest,
  StudioSkillRequiredDetails, StudioSkillSummary, StudioTokenBilling,
} from "@ai-star-eco/types/ip-studio-workflow";
import type { IpRun, IpRunOutput } from "@ai-star-eco/types";
import { ApiError } from "@ai-star-eco/api-client";
import { dialogueReducer, emptyDialogueStore, isPlaceholderMessage, type DialogueStore } from "@/canvas-bridge/studio-dialogue-store";
import { MOCK_CLOSED_EXECUTION_PROJECT_ID, mockReadRun, mockRegisterRun, mockStore } from "./ip-studio";

export const MOCK_STUDIO_SKILLS: StudioSkillSummary[] = [{
  key: "video-recreation", name: "短视频复刻", version: 2, status: "active", planning: "dynamic",
  summary: "参考一条短视频的节奏和反转，换成你的商品和人物重新做一版。",
  methodExamples: ["保留原片动作，换商品和台词", "关键画面重做"],
  operations: { analysis: ["recreation", "text"], production: ["text", "image", "video", "check", "assemble"] },
  limits: { maxSourceSec: 60, maxSegments: 8, maxSegmentSec: "model", maxSteps: 28, maxAutoFixPerSegment: 1 },
  checks: ["subject", "caption"], autoFixChecks: [], requiredCapabilities: ["video"],
  triggers: { media: ["video"], keywords: ["复刻", "照着"], default: true },
}, {
  key: "talking-head-seeding", name: "口播种草", version: 1, status: "active", planning: "dynamic",
  summary: "按商品卖点写口播，配商品特写和字幕，做一条 30 秒以内的种草视频。",
  methodExamples: ["先写口播再配画面"],
  operations: { analysis: ["text"], production: ["text", "image", "video", "check", "assemble"] },
  limits: { maxSourceSec: 30, maxSegments: 4, maxSegmentSec: 10, maxSteps: 16, maxAutoFixPerSegment: 1 },
  checks: ["caption"], autoFixChecks: [], requiredCapabilities: ["video"],
  triggers: { media: ["image"], keywords: ["口播", "种草"] },
}];
const mockSkill = (key?: string) => MOCK_STUDIO_SKILLS.find(s => s.key === key && s.status === "active");
/** Like the server's intent routing on a thread's first turn: an explicit choice wins, a tie asks the user. */
function routeSkill(t: MockThread, request: StudioPostMessageRequest): StudioSkillSummary {
  if (request.skillKey && t.thread.skillKey && request.skillKey !== t.thread.skillKey)
    throw new ApiError({ code: "STUDIO_INPUT_INVALID", message: "这条对话已经在按另一种方法制作；要换方法，请从某条消息重新开始" }, 400);
  if (request.skillKey) {
    const chosen = mockSkill(request.skillKey);
    if (!chosen) throw new ApiError({ code: "STUDIO_SKILL_NOT_FOUND", message: "这个技能已经停用了，换一个再发" }, 404);
    return chosen;
  }
  const bound = mockSkill(t.thread.skillKey);
  if (bound) return bound;
  const hits = MOCK_STUDIO_SKILLS.filter(s => s.status === "active" && s.triggers?.keywords?.some(k => request.text.includes(k)));
  if (hits.length > 1) {
    const details: StudioSkillRequiredDetails = { skills: hits.map(s => ({ key: s.key, name: s.name, summary: s.summary })) };
    throw new ApiError({ code: "STUDIO_SKILL_REQUIRED", message: "这条消息有几种做法都说得通，请选一个", details }, 400);
  }
  return hits[0] || MOCK_STUDIO_SKILLS.find(s => s.status === "active" && s.triggers?.default) || MOCK_STUDIO_SKILLS[0];
}

/** Delay between streamed pieces of the canned answer. Tests may lower it. */
export const mockDialogueTiming = { tickMs: 90 };

type Listener = (event: StudioDialogueEvent) => void;
type Step = { run: () => void; delay?: number; waitsForExecution?: boolean };
interface MockThread {
  thread: StudioDialogueThread; view: DialogueStore; events: StudioDialogueEvent[]; listeners: Set<Listener>;
  /** Events at or below this seq were pruned; a cursor below it must rebuild from the snapshot (410 on the server). */
  eventFloorSeq: number;
  generation: number; running: boolean; turnId?: string; runId?: string; queued: string[]; results: Map<string, StudioPostMessageResult>;
}
type Stage = "idle" | "analysis-proposed" | "analysis-running" | "production-proposed" | "production-running" | "done";
interface MockProject { threads: Map<string, MockThread>; currentThreadId: string; execution?: StudioPlanExecution; stage: Stage }

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
    p = { threads: new Map([[main.thread.id, main]]), currentThreadId: main.thread.id, stage: "idle" };
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

/** Like the server: only an execution still in progress rides along; a finished one is read back by its id. */
function snapshot(p: MockProject, t: MockThread): StudioDialogueState {
  const active = p.execution && ["running", "paused", "needs_user"].includes(p.execution.status) ? p.execution.id : undefined;
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
  const messageId = startTurn(t);
  play(p, t, [...say(t, messageId, "ack", "收到，后面的步骤会按你刚才说的来。已经交给厂商的任务保持原样。"),
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

function canvasSize(projectId: string) {
  const nodes = mockStore().projects.get(projectId)?.doc.nodes || [];
  return { count: nodes.length, right: Math.max(40, ...nodes.map(n => n.position.x + n.width)), videos: nodes.filter(n => n.type === "video").length, images: nodes.filter(n => n.type === "image").length };
}

// ── Scripts ────────────────────────────────────────────────────────────────

function firstTurn(projectId: string, p: MockProject, t: MockThread, request: StudioPostMessageRequest) {
  const messageId = startTurn(t), canvas = canvasSize(projectId), tool = nextId("tool");
  const fingerprint = "mock-analysis-v1";
  const plan: Extract<StudioMessageBlock, { type: "plan" }> = { type: "plan", planRunId: "mock-plan-analysis", revision: 1, fingerprint, plan: {
    summary: "先拉片，弄清原片每一段在做什么，再给你制作方案。", questions: [], skillKey: t.thread.skillKey, skillVersion: t.thread.skillVersion, stage: "analysis", revision: 1, fingerprint,
    steps: [
      { id: "s1", operation: "recreation", title: "拉片：切成 2 段", prompt: "", referenceNodeIds: [], quotedCost: 20 },
      { id: "s2", operation: "text", title: "整理每段的画面和节奏", prompt: "", referenceNodeIds: [], quotedCost: 6, dependsOn: ["s1"] },
    ], budget: { estimated: 26, autoFixCap: 0 } } };
  play(p, t, [
    ...say(t, messageId, "p1", "我先看一下画布上的素材和你的要求，再说怎么做。"),
    { run: () => emit(t, "tool.started", { toolCallId: tool, toolName: "read_canvas", title: "读取画布素材", safeInputSummary: `画布上 ${canvas.count} 个节点${request.pinnedNodeIds?.length ? `，你指定了 ${request.pinnedNodeIds.length} 个` : ""}` }) },
    { delay: mockDialogueTiming.tickMs * 4, run: () => emit(t, "tool.progress", { toolCallId: tool, toolName: "read_canvas", progress: `已读取 ${canvas.count} 个节点` }) },
    { delay: mockDialogueTiming.tickMs * 4, run: () => emit(t, "tool.finished", { toolCallId: tool, toolName: "read_canvas", status: "done", result: { summary: `找到 ${canvas.videos} 条视频、${canvas.images} 张图片` }, creditsActual: 0, settling: false }) },
    ...say(t, messageId, "p2", "原片可以按两段来做：前段交代场景，后段做反转。先拉片确认每段的画面和节奏，这一步不超过 30 积分。"),
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
  const e = p.execution!, messageId = startTurn(t), tool = nextId("tool"), fingerprint = "mock-production-v2";
  const plan: Extract<StudioMessageBlock, { type: "plan" }> = { type: "plan", planRunId: "mock-plan-production", revision: 2, fingerprint, plan: {
    summary: "按两段重做：保留原片动作和反转，商品换成你的，台词重写。", questions: [], skillKey: t.thread.skillKey, skillVersion: t.thread.skillVersion, stage: "production", revision: 2, fingerprint,
    recommendedApproachId: "keep-motion",
    approaches: [
      { id: "keep-motion", title: "保留动作，换商品和台词", summary: "两段都参考原片的动作和机位，只换商品和台词。", rationale: "原片的笑点在动作和反转，保留它们最稳。",
        preserve: ["人物动作和机位", "结尾的反转"], change: ["商品换成你的", "台词按新商品重写"], tradeoffs: ["画面里的场景和原片很像"], requiredCapabilities: ["video"] },
      { id: "reshoot", title: "关键画面重做", summary: "第 2 段按新商品重新设计画面。", rationale: "商品更醒目，但和原片节奏差得多一些。",
        preserve: ["故事走向"], change: ["第 2 段的画面和机位"], tradeoffs: ["报价更高", "反转的效果要重新验证"], requiredCapabilities: ["video", "image"] },
    ],
    steps: [
      { id: "v1", operation: "video", title: "第 1 段视频", prompt: "参考原片第 1 段的动作，主体换成新商品。", referenceNodeIds: [], quotedCost: 40, strategy: { approachId: "keep-motion", method: "参考原片动作", reason: "保留节奏" } },
      { id: "v2", operation: "video", title: "第 2 段视频", prompt: "参考原片第 2 段的反转，台词按新商品重写。", referenceNodeIds: [], quotedCost: 40, strategy: { approachId: "keep-motion", method: "参考原片动作", reason: "保留反转" } },
      { id: "c1", operation: "check", title: "检查第 1 段", prompt: "", referenceNodeIds: [], quotedCost: 2, dependsOn: ["v1"] },
      { id: "m1", operation: "assemble", title: "合成成片", prompt: "", referenceNodeIds: [], quotedCost: 0, dependsOn: ["v1", "v2"] },
    ], budget: { estimated: 82, autoFixCap: 40 } } };
  play(p, t, [
    { run: () => { setStep(p, "s1", "running", `${e.id}-run-recreation`); budget(p, t, 0, 20, "quote"); } },
    ...say(t, messageId, "b1", "开始拉片。"),
    { waitsForExecution: true, run: () => emit(t, "tool.started", { toolCallId: tool, toolName: "recreation", title: "拉片", safeInputSummary: "原片，最多切成 2 段", childRunId: `${e.id}-run-recreation` }, e.id) },
    { waitsForExecution: true, delay: mockDialogueTiming.tickMs * 5, run: () => emit(t, "tool.progress", { toolCallId: tool, toolName: "recreation", progress: "已切成 2 段" }, e.id) },
    { waitsForExecution: true, delay: mockDialogueTiming.tickMs * 5, run: () => emit(t, "tool.progress", { toolCallId: tool, toolName: "recreation", progress: "正在读取第 2 段" }, e.id) },
    { waitsForExecution: true, delay: mockDialogueTiming.tickMs * 5, run: () => {
      emit(t, "tool.finished", { toolCallId: tool, toolName: "recreation", status: "done", result: { summary: "切成 2 段：第 1 段人物出场，第 2 段可见主体是水杯" }, creditsActual: 18, settling: false }, e.id);
      finishStep(projectId, p, t, "s1", { text: MOCK_RECREATION_TEXT });
      finishStep(projectId, p, t, "s2", { textRevision: { content: MOCK_NOTES, summary: "每段的画面和节奏" } }, `${e.id}-run-notes`);
      budget(p, t, 24, 0, "actual");
    } },
    ...say(t, messageId, "b2", "拉片完成。前段交代场景，后段靠水杯做反转。推荐保留原片动作，把水杯换成你的商品、台词重写；也可以重做第 2 段的画面，商品更醒目，但节奏和原片差得多一些。"),
    { run: () => emit(t, "plan.proposed", { messageId, block: plan }) },
    { run: () => {
      updateExecution(p, x => ({ ...x, status: "needs_user", needsUserReason: "等你确认制作方案和预算" }));
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
    ...say(t, messageId, "c1", "开始制作，先做第 1 段。"),
    ...video(1),
    ...say(t, messageId, "c2", "第 1 段好了，接着做第 2 段，同时检查第 1 段。"),
    ...video(2),
    { waitsForExecution: true, run: () => { setStep(p, "c1", "running", `${e.id}-run-c1`); emit(t, "tool.started", { toolCallId: checkTool, toolName: "check", title: "检查第 1 段", safeInputSummary: "主体、字幕", childRunId: `${e.id}-run-c1` }, e.id); } },
    { waitsForExecution: true, delay: mockDialogueTiming.tickMs * 6, run: () => {
      emit(t, "tool.finished", { toolCallId: checkTool, toolName: "check", status: "done", result: { summary: "通过 1 项，无法判断 1 项" }, creditsActual: 2, settling: false }, e.id);
      // The server publishes check.result first, then the executor's node.upsert for the check step.
      emit(t, "check.result", check, e.id); finishStep(projectId, p, t, "c1", { check: check.result }); budget(p, t, 82, 0, "actual");
    } },
    { run: () => { setStep(p, "m1", "skipped", undefined, "演示模式不合成成片"); updateExecution(p, x => ({ ...x, status: "done", finishedAt: now() })); } },
    ...say(t, messageId, "c3", "两段都做好了，一共用了 82 积分。第 1 段有一项检查无法判断：这一段没有字幕，看不出台词是否完整。演示模式不合成成片。"),
    { run: () => {
      const suggestions = ["给第 1 段加字幕再检查", "第 2 段换成横屏", "保存成模板"];
      emit(t, "turn.done", { reason: "completed", messageId, billing: MOCK_BILLING, settling: false, suggestions });
      // Like the server's completion summary: one per execution (keyed by it), follow-ups kept across reloads.
      patchViewMessage(t, messageId, m => ({ ...m, suggestions, clientMessageId: `exec-summary-${e.id}` }));
      p.stage = "done";
    } },
  ]);
}

function replyTurn(p: MockProject, t: MockThread, request: StudioPostMessageRequest) {
  const messageId = startTurn(t);
  const pinnedText = mockStore().projects.get(t.thread.projectId)?.doc.nodes.find(n => request.pinnedNodeIds?.includes(n.id) && n.type === "text" && typeof n.metadata?.content === "string" && n.metadata.content.trim());
  const reply = p.stage === "analysis-proposed" ? "好的，记下了。确认没问题就点「开始分析」，也可以继续告诉我要改什么。"
    : p.stage === "production-proposed" ? "好的，记下了。看一下最新的报价，没问题就点「开始制作」。"
      : "好的。需要改哪一段，直接告诉我。";
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
  let skill: StudioSkillSummary;
  try { skill = routeSkill(t, request); } catch (error) { return Promise.reject(error); }
  if (!t.thread.skillKey) { t.thread.skillKey = skill.key; t.thread.skillVersion = skill.version; }
  const message: StudioDialogueMessage = { id: nextId("msg"), threadId, seq: ++t.thread.lastSeq, role: "user", text: request.text, blocks: [],
    pinnedNodeIds: request.pinnedNodeIds, attachmentNodeIds: request.attachmentNodeIds, clientMessageId: request.clientMessageId, status: busy ? "queued" : "done", createdAt: now() };
  t.view = { ...t.view, messages: [...t.view.messages, message] };
  let result: StudioPostMessageResult;
  if (busy) { t.queued.push(message.id); result = { messageId: message.id, turnId: t.turnId, queueState: "queued" }; }
  else {
    if (p.stage === "idle") firstTurn(projectId, p, t, request); else replyTurn(p, t, request);
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
  p.threads.set(branch.thread.id, branch); p.currentThreadId = branch.thread.id;
  // A branch never inherits approvals or payment: the demo starts its plan again.
  p.stage = "idle";
  return later(snapshot(p, branch));
}

export function mockExecutionCreate(projectId: string, request: StudioPlanExecutionCreateRequest): Promise<StudioPlanExecution> {
  const p = project(projectId), t = thread(p, p.currentThreadId), at = now();
  if (request.stage === "analysis") {
    if (p.execution && ["running", "paused", "needs_user"].includes(p.execution.status) && p.execution.stage === "analysis") return later(p.execution);
    const id = nextId("exec");
    p.execution = { id, projectId, threadId: t.thread.id, skillKey: t.thread.skillKey || "video-recreation", skillVersion: t.thread.skillVersion || 1, stage: "analysis", planRunId: request.planRunId, planRevision: 1,
      planFingerprint: request.planFingerprint, status: "running", steps: withNodeIds(id, [step("s1", "拉片：切成 2 段", "recreation", "analysis", 20), step("s2", "整理每段的画面和节奏", "text", "analysis", 6, ["s1"])]),
      budgets: [{ stage: "analysis", approvedCap: request.budgetCap, autoFixCap: request.autoFixCap, spent: 0, inFlight: 0, remaining: request.budgetCap }],
      startedAt: at, deadlineAt: new Date(Date.now() + 90 * 60_000).toISOString(), updatedAt: at };
    patchApproval(t, request.approvalId, p.execution.id, request);
    p.stage = "analysis-running";
    analysisTurn(projectId, p, t);
    return later(p.execution);
  }
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
  const execution: StudioPlanExecution = { id, projectId, threadId: t.thread.id, skillKey: "video-recreation", skillVersion: 1, stage: "production", planRunId: "mock-plan-production",
    planRevision: 2, planFingerprint: "mock-production-v2", status: "done", steps, startedAt: at, deadlineAt: at, updatedAt: at, finishedAt: at,
    budgets: [{ stage: "analysis", approvedCap: 30, autoFixCap: 0, spent: 24, inFlight: 0, remaining: 6 }, { stage: "production", approvedCap: 100, autoFixCap: 20, spent: 82, inFlight: 0, remaining: 18 }] };
  const outputs: Record<string, IpRunOutput> = { s1: { text: MOCK_RECREATION_TEXT }, s2: { textRevision: { content: MOCK_NOTES, summary: "每段的画面和节奏" } }, v1: {}, v2: {},
    c1: { check: MOCK_CHECK_ITEMS(`${id}-run-v1`) } };
  for (const s of steps) mockRegisterRun(stepRun(projectId, execution, s, outputs[s.id]));
  const approval = (approvalId: string, stage: "analysis" | "production", fingerprint: string, scope: string[], quotedCost: number, budgetCap: number, autoFixCap: number, approvedBudgetCap: number, approvedAutoFixCap: number): StudioMessageBlock =>
    ({ type: "approval", approvalId, stage, planFingerprint: fingerprint, scope, quotedCost, budgetCap, autoFixCap, status: "approved", executionId: id, approvedBudgetCap, approvedAutoFixCap, approvedAt: at });
  const message = (mid: string, seq: number, role: "user" | "assistant", text: string, blocks: StudioMessageBlock[] = []): StudioDialogueMessage =>
    ({ id: mid, threadId: t.thread.id, seq, role, text, blocks, status: "done", createdAt: at });
  const analysisPlan: StudioMessageBlock = { type: "plan", planRunId: "mock-plan-analysis", revision: 1, fingerprint: "mock-analysis-v1", plan: { summary: "先拉片，再给你制作方案。", questions: [], stage: "analysis", revision: 1, fingerprint: "mock-analysis-v1",
    steps: [{ id: "s1", operation: "recreation", title: "拉片：切成 2 段", prompt: "", referenceNodeIds: [], quotedCost: 20 }, { id: "s2", operation: "text", title: "整理每段的画面和节奏", prompt: "", referenceNodeIds: [], quotedCost: 6, dependsOn: ["s1"] }], budget: { estimated: 26, autoFixCap: 0 } } };
  const productionPlan: StudioMessageBlock = { type: "plan", planRunId: "mock-plan-production", revision: 2, fingerprint: "mock-production-v2", plan: { summary: "按两段重做：保留原片动作和反转。", questions: [], stage: "production", revision: 2, fingerprint: "mock-production-v2",
    steps: [{ id: "v1", operation: "video", title: "第 1 段视频", prompt: "", referenceNodeIds: [], quotedCost: 40 }, { id: "v2", operation: "video", title: "第 2 段视频", prompt: "", referenceNodeIds: [], quotedCost: 40 },
      { id: "c1", operation: "check", title: "检查第 1 段", prompt: "", referenceNodeIds: [], quotedCost: 2, dependsOn: ["v1"] }], budget: { estimated: 82, autoFixCap: 40 } } };
  const messages = [
    message("seed-u1", 1, "user", "换成我的洗衣液，保留最后的反转"),
    message("seed-m1", 2, "assistant", "先拉片确认每段的画面和节奏，这一步不超过 30 积分。", [analysisPlan, approval("seed-approval-analysis", "analysis", "mock-analysis-v1", ["拉片，切成 2 段", "整理每段的画面和节奏"], 26, 30, 0, 30, 0)]),
    message("seed-m2", 3, "assistant", "拉片完成。推荐保留原片动作，把水杯换成你的商品。", [productionPlan, approval("seed-approval-production", "production", "mock-production-v2", ["第 1 段视频", "第 2 段视频", "检查第 1 段"], 82, 122, 40, 100, 20)]),
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
