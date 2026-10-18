// Plan executions: API wrappers plus the pure canvas projection of execution events.
//
// The canvas document is client-owned, so server-produced nodes arrive as node.upsert
// commands and the client writes them through the ordinary save chain. Projection is
// idempotent by stable node ids (same pattern as studio-film-study.ts): replaying an event
// never duplicates a node or an edge, and text the user wrote is never overwritten; a
// differing server text becomes an adoption proposal instead.
import type {
  StudioCheckResultData, StudioNodeUpsertData, StudioPlanExecution, StudioPlanExecutionAcceptRequest,
  StudioPlanExecutionControlRequest, StudioPlanExecutionCreateRequest,
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

/**
 * Apply one node.upsert. `docVersion` is the canvas fingerprint the client currently holds;
 * when the event names an expected version that the client cannot confirm, nothing is written.
 */
export function projectStudioNodeUpsert(doc: ProjectionDoc, data: StudioNodeUpsertData, opts: { docVersion?: string } = {}): ProjectionResult {
  const unchanged = (outcome: ProjectionOutcome = 'unchanged', proposals: ProjectionProposal[] = []): ProjectionResult => ({ ...doc, outcome, proposals });
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
    const next = addConnection(doc, data.connection.fromNodeId, data.connection.toNodeId);
    return !next ? unchanged('missing') : next === doc ? unchanged() : { ...next, outcome: 'applied', proposals: [] };
  }
  if (!data.node) return unchanged();
  const incoming = { ...(data.node as unknown as CanvasNodeData), id: data.nodeId };
  const existing = doc.nodes.find(n => n.id === data.nodeId);
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
    const linked = addConnection(next, data.connection.fromNodeId, data.connection.toNodeId);
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

/** Apply a batch of queued canvas operations in seq order. Pure and idempotent. */
export function projectCanvasOps(doc: ProjectionDoc, ops: ({ kind: 'node'; data: StudioNodeUpsertData; executionId?: string; turnId: string } | { kind: 'check'; data: StudioCheckResultData; executionId?: string; turnId: string })[], opts: { docVersion?: string } = {}) {
  let next = doc, conflicts = 0, changed = false;
  const proposals: (ProjectionProposal & { turnId: string })[] = [], missing: StudioNodeUpsertData[] = [];
  for (const op of ops) {
    const result = op.kind === 'node' ? projectStudioNodeUpsert(next, op.data, opts) : projectStudioCheckResult(next, op.data, op.executionId);
    if (result.outcome === 'conflict') conflicts++;
    if (result.outcome === 'applied') changed = true;
    if (result.outcome === 'missing' && op.kind === 'node' && op.data.op === 'connect') missing.push(op.data);
    proposals.push(...result.proposals.map(p => ({ ...p, turnId: op.turnId })));
    next = { nodes: result.nodes, connections: result.connections };
  }
  // A connection may name a node created later in the same batch.
  for (const data of missing) {
    const result = projectStudioNodeUpsert(next, data, opts);
    if (result.outcome === 'applied') { changed = true; next = { nodes: result.nodes, connections: result.connections }; }
  }
  return { doc: next, conflicts, proposals, changed };
}
