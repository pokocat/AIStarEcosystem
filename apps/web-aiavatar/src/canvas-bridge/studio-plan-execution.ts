// Plan executions: API wrappers plus the pure canvas projection of execution events.
//
// The canvas document is client-owned, so server-produced nodes arrive as node.upsert
// commands and the client writes them through the ordinary save chain. Projection is
// idempotent by stable node ids (same pattern as studio-film-study.ts): replaying an event
// never duplicates a node or an edge, and text the user wrote is never overwritten; a
// differing server text becomes an adoption proposal instead.
//
// A canvas closed while an execution ran gets its nodes back on the next open from the
// execution itself (steps + their native runs, executionRestoreUpserts), not only from
// events: those are pruned after a while and a new browser has no cursor. Restored commands
// only add what is missing, so reopening never duplicates and never touches user writing.
import type { IpRun, IpRunOutput } from '@ai-star-eco/types';
import type {
  StudioCheckResultData, StudioNodeUpsertData, StudioPlanExecution, StudioPlanExecutionAcceptRequest,
  StudioPlanExecutionControlRequest, StudioPlanExecutionCreateRequest, StudioPlanExecutionStep, StudioPlanStage,
} from '@ai-star-eco/types/ip-studio-workflow';
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from '@/canvas/types/canvas';
import { USE_MOCK, apiFetch } from '@/ip/api/_client';
import { placeStudioNode } from './flow-document';
import { withStudioBilling } from './studio-billing';
import { assistantFieldValue } from './studio-assistant-plan';
import { mockExecutionAccept, mockExecutionControl, mockExecutionCreate, mockExecutionGet } from '@/ip/mocks/studio-dialogue';

// ── API ────────────────────────────────────────────────────────────────────

export async function createStudioPlanExecution(projectId: string, request: StudioPlanExecutionCreateRequest): Promise<StudioPlanExecution> {
  if (USE_MOCK) return mockExecutionCreate(projectId, request);
  const body = request.billing ? request : await withStudioBilling(projectId, request, { expectedCost: request.budgetCap });
  return apiFetch<StudioPlanExecution>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/plan-executions`, { method: "POST", body });
}
export async function getStudioPlanExecution(projectId: string, executionId: string): Promise<StudioPlanExecution> {
  if (USE_MOCK) return mockExecutionGet(projectId, executionId);
  return apiFetch<StudioPlanExecution>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/plan-executions/${encodeURIComponent(executionId)}`);
}
export async function pauseStudioPlanExecution(projectId: string, executionId: string, request: StudioPlanExecutionControlRequest): Promise<StudioPlanExecution> {
  if (USE_MOCK) return mockExecutionControl(projectId, executionId, 'pause');
  return apiFetch<StudioPlanExecution>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/plan-executions/${encodeURIComponent(executionId)}/pause`, { method: "POST", body: request });
}
export async function resumeStudioPlanExecution(projectId: string, executionId: string, request: StudioPlanExecutionControlRequest): Promise<StudioPlanExecution> {
  if (USE_MOCK) return mockExecutionControl(projectId, executionId, 'resume');
  return apiFetch<StudioPlanExecution>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/plan-executions/${encodeURIComponent(executionId)}/resume`, { method: "POST", body: request });
}
export async function cancelStudioPlanExecution(projectId: string, executionId: string, request: StudioPlanExecutionControlRequest): Promise<StudioPlanExecution> {
  if (USE_MOCK) return mockExecutionControl(projectId, executionId, 'cancel');
  return apiFetch<StudioPlanExecution>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/plan-executions/${encodeURIComponent(executionId)}/cancel`, { method: "POST", body: request });
}
export async function acceptStudioPlanExecutionStep(projectId: string, executionId: string, stepId: string, request: StudioPlanExecutionAcceptRequest): Promise<StudioPlanExecution> {
  if (USE_MOCK) return mockExecutionAccept(projectId, executionId, stepId, request);
  return apiFetch<StudioPlanExecution>(`/v1/ip-studio/projects/${encodeURIComponent(projectId)}/plan-executions/${encodeURIComponent(executionId)}/steps/${encodeURIComponent(stepId)}/accept`, { method: "POST", body: request });
}

// ── Projection ─────────────────────────────────────────────────────────────

export type ProjectionDoc = { nodes: CanvasNodeData[]; connections: CanvasConnection[] };
export type ProjectionProposal = { nodeId: string; field: 'content' | 'prompt' | 'script'; content: string; snapshot: string };
export type ProjectionOutcome = 'applied' | 'unchanged' | 'conflict' | 'missing';
export type ProjectionResult = ProjectionDoc & { outcome: ProjectionOutcome; proposals: ProjectionProposal[] };

/** The value an adoption would replace, read the same way the adoption path reads it. */
export function proposalFieldValue(node: CanvasNodeData, field: ProjectionProposal['field']): string | undefined {
  if (field === 'script' && !node.metadata?.studio?.script) return undefined;
  return assistantFieldValue(node, field);
}

/** Media-type nodes store a derived media address in `content`; only text-like nodes store user writing there. */
const userTextContent = (node: Pick<CanvasNodeData, 'type'>) => node.type === CanvasNodeType.Text || node.type === CanvasNodeType.Config;
const edgeId = (from: string, to: string) => `exec-edge-${from}-${to}`;
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function addConnection(doc: ProjectionDoc, from: string, to: string): ProjectionDoc | undefined {
  if (!doc.nodes.some(n => n.id === from) || !doc.nodes.some(n => n.id === to)) return undefined;
  if (doc.connections.some(c => c.fromNodeId === from && c.toNodeId === to)) return doc;
  return { ...doc, connections: [...doc.connections, { id: edgeId(from, to), fromNodeId: from, toNodeId: to }] };
}

/**
 * The node a command targets: its stable id, or the check node a check.result already made for the same check run
 * (check.result is published before the executor's node.upsert for that step, under another id).
 */
function projectedNode(doc: ProjectionDoc, data: StudioNodeUpsertData, incoming?: CanvasNodeData) {
  const byId = doc.nodes.find(n => n.id === data.nodeId);
  if (byId || incoming?.metadata?.studio?.kind !== 'check' || !data.runId) return byId;
  return doc.nodes.find(n => n.metadata?.studio?.kind === 'check' && n.metadata.studio.execution?.runId === data.runId
    && (!data.executionId || n.metadata.studio.execution.executionId === data.executionId));
}

function binding(data: StudioNodeUpsertData, incoming?: CanvasNodeData, existing?: CanvasNodeData) {
  const saved = incoming?.metadata?.studio?.execution || existing?.metadata?.studio?.execution;
  const executionId = data.executionId || saved?.executionId, stepId = data.stepId || saved?.stepId;
  return executionId && stepId ? { executionId, stepId, runId: data.runId || saved?.runId } : saved;
}

/** Merge server-owned fields; position, size, title and user writing stay with the user. */
function mergeServerNode(existing: CanvasNodeData, incoming: CanvasNodeData, execution: ReturnType<typeof binding>) {
  const proposals: ProjectionProposal[] = [];
  const { content, prompt, composerContent: _composerContent, studio: incomingStudio, ...serverOwned } = incoming.metadata || {};
  const metadata = { ...existing.metadata, ...serverOwned };
  const keepText = (field: 'content' | 'prompt', value: string | undefined) => {
    const current = existing.metadata?.[field];
    if (value === undefined || value === current) return;
    if (!current?.trim()) metadata[field] = value;
    else proposals.push({ nodeId: existing.id, field, content: value, snapshot: proposalFieldValue(existing, field) ?? current });
  };
  if (userTextContent(existing)) keepText('content', content);
  else if (content !== undefined) metadata.content = content;
  keepText('prompt', prompt);
  const studio = existing.metadata?.studio || incomingStudio
    ? { ...incomingStudio, ...existing.metadata?.studio, ...(incomingStudio ? {
        kind: existing.metadata?.studio?.kind || incomingStudio.kind, task: incomingStudio.task, runId: incomingStudio.runId ?? existing.metadata?.studio?.runId,
        check: incomingStudio.check ?? existing.metadata?.studio?.check, mock: incomingStudio.mock ?? existing.metadata?.studio?.mock } : {}),
      ...(execution ? { execution } : {}) } as NonNullable<CanvasNodeData['metadata']>['studio']
    : undefined;
  if (studio) metadata.studio = studio;
  return { node: { ...existing, title: existing.title || incoming.title, metadata }, proposals };
}

export type ProjectionOptions = {
  docVersion?: string;
  /**
   * Restore: add only what the canvas is missing. An existing node is left exactly as it is (no merge, no
   * proposal), proposals are dropped, and an edge is added only next to a node this batch created.
   */
  missingOnly?: boolean;
  /** Node ids created earlier in the same batch (restore edges may attach to them). */
  created?: ReadonlySet<string>;
};

/**
 * Apply one node.upsert. `docVersion` is the canvas fingerprint the client currently holds;
 * when the event names an expected version that the client cannot confirm, nothing is written.
 */
export function projectStudioNodeUpsert(doc: ProjectionDoc, data: StudioNodeUpsertData, opts: ProjectionOptions = {}): ProjectionResult {
  const unchanged = (outcome: ProjectionOutcome = 'unchanged', proposals: ProjectionProposal[] = []): ProjectionResult => ({ ...doc, outcome, proposals });
  if (data.op === 'propose' && opts.missingOnly) return unchanged();
  if (data.op === 'propose') {
    const target = doc.nodes.find(n => n.id === data.nodeId);
    if (!target || !data.proposal) return unchanged('missing');
    const field = data.proposal.field;
    const snapshot = proposalFieldValue(target, field);
    if (snapshot === undefined) return unchanged('missing');
    return snapshot === data.proposal.content ? unchanged() : unchanged('unchanged', [{ nodeId: target.id, field, content: data.proposal.content, snapshot }]);
  }
  if (data.expectedDocVersion && data.expectedDocVersion !== opts.docVersion) return unchanged('conflict');
  if (data.op === 'connect') {
    if (!data.connection) return unchanged();
    const { fromNodeId: from, toNodeId: to } = data.connection;
    if (opts.missingOnly && doc.nodes.some(n => n.id === from) && doc.nodes.some(n => n.id === to) && !opts.created?.has(from) && !opts.created?.has(to)) return unchanged();
    const next = addConnection(doc, from, to);
    return !next ? unchanged('missing') : next === doc ? unchanged() : { ...next, outcome: 'applied', proposals: [] };
  }
  if (!data.node) return unchanged();
  const incoming = { ...(data.node as unknown as CanvasNodeData), id: data.nodeId };
  const existing = projectedNode(doc, data, incoming);
  if (existing && opts.missingOnly) return unchanged();
  const execution = binding(data, incoming, existing);
  let next: ProjectionDoc = doc, proposals: ProjectionProposal[] = [], changed = false;
  if (!existing) {
    const created = placeStudioNode({ ...incoming, metadata: { ...incoming.metadata, ...(execution ? { studio: { kind: userTextContent(incoming) ? 'text' as const : 'shot' as const, ...incoming.metadata?.studio, execution } } : {}) } }, doc.nodes);
    next = { ...doc, nodes: [...doc.nodes, created] };
    changed = true;
  } else {
    const merged = mergeServerNode(existing, incoming, execution);
    proposals = merged.proposals;
    if (!sameJson(merged.node, existing)) { next = { ...doc, nodes: doc.nodes.map(n => n.id === existing.id ? merged.node : n) }; changed = true; }
  }
  if (data.connection) {
    // Edges name the stable id; a check node merged under another id keeps its own.
    const target = existing?.id ?? data.nodeId, end = (id: string) => id === data.nodeId ? target : id;
    const linked = addConnection(next, end(data.connection.fromNodeId), end(data.connection.toNodeId));
    if (linked && linked !== next) { next = linked; changed = true; }
  }
  return { ...next, outcome: changed ? 'applied' : 'unchanged', proposals };
}

/** A check result is shown on the node bound to that check run, or on one stable check node beside its subject. */
export function projectStudioCheckResult(doc: ProjectionDoc, data: StudioCheckResultData, executionId?: string): ProjectionResult {
  const result = data.result;
  const bound = doc.nodes.find(n => n.metadata?.studio?.execution?.runId === data.runId)
    || doc.nodes.find(n => n.metadata?.studio?.kind === 'check' && n.metadata.studio.check?.targetRunId === result.targetRunId && (!data.stepId || n.metadata.studio.execution?.stepId === data.stepId));
  const subject = doc.nodes.find(n => n.id !== bound?.id && n.metadata?.studio?.execution?.runId === result.targetRunId)
    || (result.targetStorageKey ? doc.nodes.find(n => n.id !== bound?.id && n.metadata?.storageKey === result.targetStorageKey) : undefined);
  if (bound) {
    let next: ProjectionDoc = doc, changed = false;
    if (!sameJson(bound.metadata?.studio?.check, result)) {
      const node = { ...bound, metadata: { ...bound.metadata, studio: { ...bound.metadata?.studio, kind: bound.metadata?.studio?.kind || 'check' as const, check: result } } };
      next = { ...next, nodes: next.nodes.map(n => n.id === bound.id ? node : n) }; changed = true;
    }
    // The edge is projected separately from the node (connections and nodes have their own setters); keep it idempotent.
    const linked = subject ? addConnection(next, subject.id, bound.id) : undefined;
    if (linked && linked !== next) { next = linked; changed = true; }
    return { ...next, outcome: changed ? 'applied' : 'unchanged', proposals: [] };
  }
  const id = `${executionId || 'studio'}-${data.stepId || data.runId}-check`;
  const right = Math.max(20, ...doc.nodes.map(n => n.position.x + n.width));
  const node: CanvasNodeData = placeStudioNode({ id, type: CanvasNodeType.Text, title: subject ? `${subject.title} · 检查` : '检查结果', width: 380, height: 320,
    position: subject ? { x: subject.position.x, y: subject.position.y + subject.height + 48 } : { x: right + 80, y: 120 },
    metadata: { status: 'success', studio: { kind: 'check', check: result, parentNodeId: subject?.id,
      ...(executionId && data.stepId ? { execution: { executionId, stepId: data.stepId, runId: data.runId } } : {}) } } }, doc.nodes);
  let next: ProjectionDoc = { ...doc, nodes: [...doc.nodes, node] };
  if (subject) next = addConnection(next, subject.id, node.id) || next;
  return { ...next, outcome: 'applied', proposals: [] };
}

/** Reflect terminal step states on bound nodes that still look busy. Never invents progress. */
export function projectStudioExecution(nodes: CanvasNodeData[], execution: StudioPlanExecution): CanvasNodeData[] {
  let changed = false;
  const next = nodes.map(node => {
    const bound = node.metadata?.studio?.execution;
    if (!bound || bound.executionId !== execution.id || node.metadata?.status !== 'loading') return node;
    const step = execution.steps.find(s => s.id === bound.stepId);
    if (!step) return node;
    if (step.status === 'failed') { changed = true; return { ...node, metadata: { ...node.metadata, status: 'error' as const, errorDetails: step.reason || '这一段没有完成' } }; }
    if ((step.status === 'done' || step.status === 'skipped') && (node.metadata?.storageKey || node.metadata?.content)) { changed = true; return { ...node, metadata: { ...node.metadata, status: 'success' as const } }; }
    return node;
  });
  return changed ? next : nodes;
}

/** The execution step whose run a check inspected (the accept target for 「就用这版」). */
export function checkedStep(execution: StudioPlanExecution | undefined, targetRunId: string) {
  return execution?.steps.find(s => s.runIds.includes(targetRunId) || s.acceptedRunId === targetRunId);
}

/** 「就用这版」/「重做这一段」 from a check node; the dialogue panel owns the execution and handles it. */
export const STUDIO_CHECK_COMMAND = 'studio-check-command';
export type StudioCheckCommand = { action: 'accept' | 'redo'; nodeId: string };
export function dispatchStudioCheckCommand(detail: StudioCheckCommand) {
  window.dispatchEvent(new CustomEvent<StudioCheckCommand>(STUDIO_CHECK_COMMAND, { detail }));
}

/** The canvas node a check inspected: bound to the target run, the same media key, or its recorded parent. */
export function checkSubject(nodes: CanvasNodeData[], node: CanvasNodeData) {
  const check = node.metadata?.studio?.check;
  if (!check) return undefined;
  return nodes.find(n => n.id !== node.id && n.metadata?.studio?.execution?.runId === check.targetRunId)
    || (check.targetStorageKey ? nodes.find(n => n.id !== node.id && n.metadata?.storageKey === check.targetStorageKey) : undefined)
    || nodes.find(n => n.id === node.metadata?.studio?.parentNodeId);
}

export type CanvasProjectionOp =
  | { kind: 'node'; data: StudioNodeUpsertData; executionId?: string; turnId: string; restore?: boolean }
  | { kind: 'check'; data: StudioCheckResultData; executionId?: string; turnId: string; restore?: boolean };

/**
 * Apply a batch of queued canvas operations in seq order. Pure and idempotent. `projected` lists the nodes the
 * batch's node commands stand for (created, updated or already there), for the viewer's projection record.
 */
export function projectCanvasOps(doc: ProjectionDoc, ops: CanvasProjectionOp[], opts: { docVersion?: string } = {}) {
  let next = doc, conflicts = 0, changed = false;
  const proposals: (ProjectionProposal & { turnId: string })[] = [], missing: StudioNodeUpsertData[] = [];
  const created = new Set<string>(), projected = new Set<string>();
  const options = (op: CanvasProjectionOp): ProjectionOptions => ({ ...opts, missingOnly: !!op.restore, created });
  for (const op of ops) {
    const before = next;
    const result = op.kind === 'node' ? projectStudioNodeUpsert(next, op.data, options(op)) : projectStudioCheckResult(next, op.data, op.executionId);
    if (result.outcome === 'conflict') conflicts++;
    if (result.outcome === 'applied') changed = true;
    if (result.outcome === 'missing' && op.kind === 'node' && op.data.op === 'connect') missing.push(op.data);
    proposals.push(...result.proposals.map(p => ({ ...p, turnId: op.turnId })));
    next = { nodes: result.nodes, connections: result.connections };
    for (const n of next.nodes) if (!before.nodes.some(b => b.id === n.id)) created.add(n.id);
    if (op.kind === 'node' && op.data.op !== 'connect' && op.data.op !== 'propose') {
      const target = projectedNode(next, op.data, op.data.node ? { ...(op.data.node as unknown as CanvasNodeData), id: op.data.nodeId } : undefined);
      if (target) projected.add(target.id);
    }
  }
  // A connection may name a node created later in the same batch.
  for (const data of missing) {
    const op = ops.find(o => o.kind === 'node' && o.data === data);
    const result = projectStudioNodeUpsert(next, data, { ...opts, missingOnly: !!op?.restore, created });
    if (result.outcome === 'applied') { changed = true; next = { nodes: result.nodes, connections: result.connections }; }
  }
  return { doc: next, conflicts, proposals, changed, projected: [...projected] };
}

// ── Restore from execution state ──────────────────────────────────────────

/** Stable output node id of a step (StudioPlanExecutionIds.nodeId on the server). */
export const executionNodeId = (executionId: string, stage: StudioPlanStage, stepId: string) => `${executionId}-${stage === 'production' ? 'p' : 'a'}-${stepId}`;
export const stepNodeId = (execution: Pick<StudioPlanExecution, 'id'>, step: Pick<StudioPlanExecutionStep, 'id' | 'stage' | 'nodeId'>) =>
  step.nodeId || executionNodeId(execution.id, step.stage, step.id);

/** Runs a finished step stands for, best first: the accepted run, else the most recent attempts. */
export function stepRunCandidates(step: StudioPlanExecutionStep): string[] {
  return step.acceptedRunId ? [step.acceptedRunId] : [...step.runIds].reverse();
}
/** The run whose output a finished step left behind: the accepted one, else the latest that succeeded. */
export function stepOutputRun(step: StudioPlanExecutionStep, runs: Record<string, IpRun | undefined>): IpRun | undefined {
  for (const id of stepRunCandidates(step)) if (runs[id]?.status === 'done') return runs[id];
  return undefined;
}

/** Primary media key of a run output, read like StudioPlanOutputs.outputKey (a candidate index picks among candidates). */
export function runOutputKey(output: IpRunOutput | undefined, candidate?: number): string | undefined {
  const videos = output?.videoCandidates;
  if (videos?.length) {
    if (candidate !== undefined) return videos[candidate]?.status === 'done' ? videos[candidate].storageKey : undefined;
    return videos.find(v => v.status === 'done')?.storageKey;
  }
  const images = output?.candidates;
  if (images?.length) return images[candidate ?? 0]?.key;
  return output?.storageKey;
}

type UpsertNode = NonNullable<StudioNodeUpsertData['node']>;
function stepUpsert(execution: StudioPlanExecution, nodeId: string, type: 'text' | 'image' | 'video', title: string, stepId: string, runId: string, mock?: boolean) {
  const node = { id: nodeId, type, title, width: type === 'text' ? 380 : 320, height: type === 'text' ? 320 : 240, position: { x: 0, y: 0 },
    metadata: { status: 'success', studio: { runId, execution: { executionId: execution.id, stepId, runId }, ...(mock ? { mock: true } : {}) } } };
  return { nodeId, op: 'create' as const, executionId: execution.id, stepId, runId, node: node as unknown as UpsertNode };
}
const meta = (data: StudioNodeUpsertData) => (data.node as unknown as CanvasNodeData).metadata!;

/**
 * The node.upsert commands a finished execution sent (or would have sent) to the canvas, rebuilt from its steps and
 * their native runs: one node per finished step with its real output key or text, a check node beside what it
 * inspected, one video node per film-study segment and the edges from each step's inputs. Same ids and fields as
 * StudioPlanExecutor.nodeEvents, so a restored node is the node a live client would have made; feed the result
 * through projectCanvasOps as restore commands. `only` limits it to the given step node ids.
 */
export function executionRestoreUpserts(execution: StudioPlanExecution, runs: Record<string, IpRun | undefined>, only?: ReadonlySet<string>): StudioNodeUpsertData[] {
  const out: StudioNodeUpsertData[] = [];
  const stageSteps = (stage: StudioPlanStage) => execution.steps.filter(s => s.stage === stage);
  for (const step of execution.steps) {
    const nodeId = stepNodeId(execution, step);
    if (step.status !== 'done' || (only && !only.has(nodeId))) continue;
    const run = stepOutputRun(step, runs);
    if (!run) continue;
    const output = run.output || {}, operation = step.operation;
    const type = operation === 'image' ? 'image' : operation === 'video' || operation === 'assemble' ? 'video' : 'text';
    const data = stepUpsert(execution, nodeId, type, step.title, step.id, run.id, output.mock);
    const metadata = meta(data), studio = metadata.studio!;
    if (type !== 'text') {
      const key = runOutputKey(output, step.acceptedRunId === run.id ? step.acceptedCandidateIndex : undefined);
      if (key) metadata.storageKey = key;
      if (operation === 'assemble') studio.kind = 'work';
    } else if (operation === 'check') {
      const subject = (output.check && checkedStep(execution, output.check.targetRunId)) || stageSteps(step.stage).find(s => s.id === step.dependsOn[0]);
      const subjectId = subject ? stepNodeId(execution, subject) : undefined;
      (data.node as unknown as CanvasNodeData).title = `${subject?.title || '成片'} · 检查`;
      studio.kind = 'check';
      if (subjectId) { studio.parentNodeId = subjectId; Object.assign(data, { connection: { fromNodeId: subjectId, toNodeId: nodeId } }); }
      if (output.check) studio.check = output.check;
    } else if (operation === 'recreation') {
      studio.kind = 'recreation'; metadata.content = output.text ?? '';
    } else {
      studio.kind = 'text'; metadata.content = output.textRevision?.content ?? output.text ?? '';
    }
    out.push(data);
    if (operation !== 'check') for (const dependency of step.dependsOn) {
      const upstream = stageSteps(step.stage).find(s => s.id === dependency);
      if (!upstream || upstream.operation === 'check') continue;
      out.push({ nodeId, op: 'connect', executionId: execution.id, stepId: step.id, runId: run.id, connection: { fromNodeId: stepNodeId(execution, upstream), toNodeId: nodeId } });
    }
    if (operation === 'recreation') for (const segment of output.filmStudy?.segments || []) {
      if (!segment.storageKey) continue;
      const segmentId = `${nodeId}-s${segment.no}`;
      const clip = stepUpsert(execution, segmentId, 'video', `第 ${segment.no} 段 · ${segment.title || '片段'}`, step.id, run.id, output.mock);
      meta(clip).storageKey = segment.storageKey;
      meta(clip).studio!.sourceRange = { startSec: segment.startSec, endSec: segment.endSec, storageKey: segment.storageKey };
      out.push({ ...clip, connection: { fromNodeId: nodeId, toNodeId: segmentId } });
    }
  }
  // Restoring only some nodes must also restore their edges toward steps that are already on the canvas: the loop
  // above emits a step's input edges only when that step itself is restored, so an upstream brought back next to an
  // existing downstream lost its dependency edge (Codex R7-01). Both ends exist afterwards; projection keeps it idempotent.
  if (only) for (const step of execution.steps) {
    const nodeId = stepNodeId(execution, step);
    if (step.status !== 'done' || only.has(nodeId)) continue;
    const upstreams = step.operation === 'check'
      ? [stageSteps(step.stage).find(s => s.id === step.dependsOn[0])]
      : step.dependsOn.map(d => stageSteps(step.stage).find(s => s.id === d)).filter(u => u && u.operation !== 'check');
    for (const upstream of upstreams) {
      if (!upstream) continue;
      const upstreamId = stepNodeId(execution, upstream);
      if (only.has(upstreamId)) out.push({ nodeId, op: 'connect', executionId: execution.id, stepId: step.id, connection: { fromNodeId: upstreamId, toNodeId: nodeId } });
    }
  }
  return out;
}

/** Step output nodes of an execution that the canvas does not have and this viewer has not projected before. */
export function missingExecutionNodes(execution: StudioPlanExecution, nodes: CanvasNodeData[], projected: ReadonlySet<string>): StudioPlanExecutionStep[] {
  // A canvas emptied by the user stays empty on this browser: the per-browser record is the deletion tombstone and is
  // honored even when nothing is left (Codex R6-02). A browser without the record (fresh device) restores once.
  return execution.steps.filter(step => {
    if (step.status !== 'done' || !step.runIds.length && !step.acceptedRunId) return false;
    const id = stepNodeId(execution, step);
    if (projected.has(id) || nodes.some(n => n.id === id)) return false;
    // A node bound to one of this step's runs stands for it under another id (a check.result's own check node).
    // Step ids repeat across stages, so the run decides, not the step id alone.
    return !nodes.some(n => { const bound = n.metadata?.studio?.execution;
      return bound?.executionId === execution.id && bound.stepId === step.id && !!bound.runId && (step.runIds.includes(bound.runId) || step.acceptedRunId === bound.runId); });
  });
}

/**
 * The project has a finished execution step run (`inputs.executionId`) that no canvas node stands for and this viewer
 * never projected: the canvas was closed while the execution ran. A cheap signal from the project's run list, used
 * to read the dialogue thread on canvas open so the restore can run without the panel being opened.
 */
export function executionOutputMissing(runs: IpRun[], nodes: CanvasNodeData[], projected: ReadonlySet<string>): boolean {
  return runs.some(run => run.status === 'done' && !!(run.inputs as { executionId?: string } | undefined)?.executionId && !projected.has(run.nodeId)
    && !nodes.some(n => n.id === run.nodeId || n.metadata?.studio?.execution?.runId === run.id || n.metadata?.studio?.runId === run.id));
}

// Per-viewer record of the nodes this browser already projected, so a node the user deleted is not rebuilt on the
// next open. It is a convenience: without it (another browser) a deleted output comes back once, never twice.
const projectedKey = (projectId: string) => `studio-projected-nodes:${projectId}`;
const PROJECTED_MAX = 2000;
export function readProjectedNodes(projectId: string): Set<string> {
  try { const raw = JSON.parse(localStorage.getItem(projectedKey(projectId)) || '[]'); return new Set(Array.isArray(raw) ? raw.filter((v): v is string => typeof v === 'string') : []); }
  catch { return new Set(); }
}
export function rememberProjectedNodes(projectId: string, ids: string[]) {
  if (!ids.length) return;
  try {
    const known = [...readProjectedNodes(projectId)];
    const fresh = ids.filter(id => !known.includes(id));
    if (fresh.length) localStorage.setItem(projectedKey(projectId), JSON.stringify([...known, ...fresh].slice(-PROJECTED_MAX)));
  } catch { /* the canvas itself still holds what was projected */ }
}
