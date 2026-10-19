"use client";
// 「全能创作」: one continuous conversation per canvas (docs/ip-studio-conversational-video-recreation-plan.md §对话形态).
// No modes, no history picker, no 「新对话」. The server streams real reply text, work records,
// plans and confirmation cards into one timeline; the composer stays editable throughout and
// new messages are queued as steering. Canvas commands from the server are projected into
// the document idempotently and saved through the ordinary save chain; work an execution
// finished while the canvas was closed is rebuilt from that execution on the next open
// (missing nodes only, never over the user's own text). Conversations from the
// old four-mode assistant stay readable (with their adoption bindings) under 「之前的对话」.
import { useCallback, useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ApiError, formatCredits } from "@ai-star-eco/api-client";
import { Button, Select } from "antd";
import { ArrowUp, FileText, Image, SlidersHorizontal, Video, Workflow } from "lucide-react";
import { nanoid } from "nanoid";
import type { IpRun, IpSavedAsset } from "@ai-star-eco/types";
import type { StudioAssistantMode, StudioCapabilities, StudioDialogueMessage, StudioPlan, StudioPlanExecution, StudioSkillRequiredDetails, StudioSkillSummary } from "@ai-star-eco/types/ip-studio-workflow";
import type { CanvasConnection, CanvasNodeData } from "@/canvas/types/canvas";
import { USE_MOCK } from "@/ip/api/_client";
import { isOperatorRole, useIdentity } from "@/proto/api";
import { getRun } from "@/ip/api/ip-studio";
import { applyStudioRun, dispatchStudioCommand, makeStudioNode } from "@/canvas-bridge/studio-nodes";
import { readRun } from "@/canvas-bridge/api";
import { importStudioMedia, importStudioStory, submitStudioRun } from "@/canvas-bridge/studio-api";
import { saveStudioDocument } from "@/canvas-bridge/studio-save";
import { assistantContextNodes } from "@/canvas-bridge/studio-assistant-context";
import { attachmentNode, readAssistantAttachment, savedAssetPayload } from "@/canvas-bridge/studio-attachments";
import { assistantEditableFields, assistantFieldValue, assistantReplacementNode, assistantStepReferences, assistantUnresolvedReferences, type AssistantReplacement } from "@/canvas-bridge/studio-assistant-plan";
import { placeStudioNode } from "@/canvas-bridge/flow-document";
import { markStudioDescendants } from "@/canvas-bridge/studio-script";
import { approvedCaps, dialogueSections, executionActive, executionBudget, lastAssistantMessage, planForApproval, type DialogueAdoptionBlock, type DialogueApprovalBlock } from "@/canvas-bridge/studio-dialogue-store";
import {
  STUDIO_CHECK_COMMAND, checkSubject, checkedStep, executionRestoreUpserts, missingExecutionNodes, projectCanvasOps, projectStudioExecution, proposalFieldValue,
  readProjectedNodes, rememberProjectedNodes, stepNodeId, stepRunCandidates, type CanvasProjectionOp, type StudioCheckCommand,
} from "@/canvas-bridge/studio-plan-execution";
import { activeStudioSkills, completionExecutionId, loadStudioSkills, reloadStudioSkills, skillRequiredChoices, studioSkillBadge, studioSkillNotes } from "@/canvas-bridge/studio-skills";
import { StudioErrorNotice, studioRunError, useStudioApp, useStudioErrorState } from "./studio-errors";
import { StudioFloatingPanel } from "./studio-floating-panel";
import { useStudioDialogueSession } from "./studio-dialogue-session";
import { StudioDialogueComposer, type DialogueComposerHandle } from "./studio-dialogue-composer";
import { StudioDialogueTimeline } from "./studio-dialogue-timeline";
import { StudioDialogueExecution } from "./studio-dialogue-execution";
import { StudioDialogueLegacy, type LegacyGroup } from "./studio-dialogue-legacy";
import type { DialogueMessageHandlers } from "./studio-dialogue-message";
import { StudioDialogueSkillDraft } from "./studio-dialogue-skill-draft";

type Props = {
  projectId: string; conversations: CanvasNodeData[]; setConversations: Dispatch<SetStateAction<CanvasNodeData[]>>;
  nodes: CanvasNodeData[]; setNodes: Dispatch<SetStateAction<CanvasNodeData[]>>; setConnections: Dispatch<SetStateAction<CanvasConnection[]>>;
  /** Current edges; lets server-produced connections be de-duplicated against what is on the canvas. */
  connections?: CanvasConnection[];
  /** The saved document fingerprint, when the host knows it; node.upsert with an expected version is skipped unless it matches. */
  docVersion?: string;
  capabilities?: StudioCapabilities; open: boolean; initialNodeId?: string; initialPrompt?: string;
  /** Kept for callers; the dialogue routes intent itself and has no modes. */
  initialMode?: StudioAssistantMode;
  /** The canvas lacks output of an execution (it finished while the canvas was closed): read the thread now, panel open or not. */
  restorePending?: boolean;
  onClose: () => void; selectedIds: string[]; onUseStep: (step: StudioPlan["steps"][number]) => string | void;
};
type ComposerDraft = { text: string; pinnedIds: string[]; attachmentIds: string[] };
/** Contract limit for pinnedNodeIds / attachmentNodeIds (specs/openapi.yaml StudioPostMessageRequest). */
const MAX_REFERENCES = 64;
const ATTACHMENT_NOTE = "可多选图片、视频、音频和故事；导入免费，加入画布后可编辑和复用。JPG / PNG 原图最多 50 MB，大图自动优化后上传；MP4 视频 128 MB / 60 秒，音频 25 MB / 10 分钟。TXT / Markdown 256 KB，PDF / Word 8 MB，正文最多 24000 字；扫描件需先识别文字。";
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
/** The settings' 「自动」 choice: no skillKey on the message, the server routes by intent. */
const AUTO_SKILL = "__auto__";
type SkillChoice = StudioSkillRequiredDetails["skills"][number];
/**
 * 400 STUDIO_SKILL_REQUIRED is a question, not a failure: say which skills fit, keep the draft and open the choice.
 * It is shown inline only (no error notification).
 */
function skillRequiredNotice(error: unknown, fallback: SkillChoice[]) {
  const choices = skillRequiredChoices(error);
  if (!choices) return undefined;
  const names = (choices.length ? choices : fallback).map(s => `「${s.name}」`);
  const text = names.length ? `这条消息用${names.join("或")}都能做，选一个技能再发，消息已经放回输入框` : "这条消息要先选一个技能再发，消息已经放回输入框";
  return { choices, text };
}
/** 402 while an execution runs: this turn would not fit the stage budget. Say by how much; the draft stays. */
function budgetExceededError(error: unknown) {
  if (!(error instanceof ApiError) || error.code !== "STUDIO_PLAN_BUDGET_EXCEEDED") return undefined;
  const shortfall = Number((error.details as { shortfall?: unknown } | undefined)?.shortfall);
  const text = Number.isFinite(shortfall) && shortfall > 0 ? `本阶段预算还差 ${formatCredits(shortfall)} 积分，提高上限后再发` : "本阶段预算不够了，提高上限后再发";
  return Object.assign(new Error(text), { code: error.code, logId: error.logId });
}

export function StudioAssistant({ projectId, conversations, setConversations, nodes, setNodes, setConnections, connections, docVersion, capabilities, open, initialNodeId, initialPrompt, restorePending, onClose, selectedIds, onUseStep }: Props) {
  const { message } = useStudioApp();
  const session = useStudioDialogueSession({ projectId, open, autoload: !!restorePending });
  const { store } = session;
  const [text, setText] = useState(""), [pinnedIds, setPinnedIds] = useState<string[]>([]), [attachmentIds, setAttachmentIds] = useState<string[]>([]);
  const [model, setModel] = useState<string>();
  const [settingsOpen, setSettingsOpen] = useState(false), [legacyOpen, setLegacyOpen] = useState(false);
  const [reading, setReading] = useState(false), [attachmentsUnsaved, setAttachmentsUnsaved] = useState(false);
  const [sending, setSending] = useState(false), [stopping, setStopping] = useState(false), [recovering, setRecovering] = useState<string>();
  const [composerError, setComposerError] = useStudioErrorState();
  const [canvasNotice, setCanvasNotice] = useState("");
  const [skills, setSkills] = useState<StudioSkillSummary[]>([]);
  const [skillKey, setSkillKey] = useState<string>(), [skillChoices, setSkillChoices] = useState<SkillChoice[]>(), [skillNotice, setSkillNotice] = useState("");
  const identity = useIdentity();
  const composer = useRef<DialogueComposerHandle>(null);
  const live = useRef({ nodes, conversations, projectId, connections: connections || [] });
  live.current = { nodes, conversations, projectId, connections: connections || [] };
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const same = (project: string) => mounted.current && live.current.projectId === project;

  // ── Drafts: each canvas keeps its own unsent text and references ──────────
  const drafts = useRef(new Map<string, ComposerDraft>());
  const draft = useRef<ComposerDraft>({ text, pinnedIds, attachmentIds });
  draft.current = { text, pinnedIds, attachmentIds };
  const opened = useRef<{ projectId: string; initialNodeId?: string } | undefined>(undefined);
  useEffect(() => { setText(""); setPinnedIds([]); setAttachmentIds([]); setReading(false); setAttachmentsUnsaved(false); setCanvasNotice(""); setSkillKey(undefined); setSkillChoices(undefined); setSkillNotice(""); }, [projectId]);
  useEffect(() => {
    if (!open) return;
    if (opened.current?.projectId === projectId && opened.current.initialNodeId === initialNodeId) return;
    if (opened.current) drafts.current.set(opened.current.projectId, draft.current);
    opened.current = { projectId, initialNodeId };
    const saved = drafts.current.get(projectId);
    const entry = [...live.current.nodes, ...live.current.conversations].find(n => n.id === initialNodeId);
    if (entry && live.current.conversations.some(c => c.id === entry.id)) {
      setLegacyOpen(true);
      requestAnimationFrame(() => [...document.querySelectorAll<HTMLElement>("[data-node-id]")].find(el => el.dataset.nodeId === entry.id)?.scrollIntoView?.({ block: "start" }));
    }
    if (saved) { setText(saved.text); setPinnedIds(saved.pinnedIds); setAttachmentIds(saved.attachmentIds); return; }
    const referenceable = assistantContextNodes(live.current.nodes);
    // A selection or the homepage brief becomes visible, removable pins; nothing is pinned silently.
    const pins = entry?.metadata?.studioStart === "assistant" && referenceable.some(n => n.id === entry.id) ? [entry.id] : referenceable.filter(n => selectedIds.includes(n.id)).map(n => n.id);
    setPinnedIds(pins.slice(0, MAX_REFERENCES));
    setText(initialPrompt || (entry?.metadata?.studioStart === "assistant" ? entry.metadata?.prompt || "" : ""));
  }, [open, projectId, initialNodeId]);
  useEffect(() => { if (open && !skills.length) loadStudioSkills().then(list => { if (mounted.current) setSkills(list); }).catch(() => undefined); }, [open]);

  // ── Model ceiling (the reply's own cost; production budgets are approved separately) ──
  const textModels = capabilities?.textModels || [];
  const selectable = capabilities?.textModelMode === "selectable" && textModels.length > 1;
  const selectedModel = textModels.find(m => m.endpointId === ((selectable && textModels.some(m => m.endpointId === model) ? model : undefined) || textModels.find(m => m.isDefault)?.endpointId || textModels[0]?.endpointId));
  const demo = USE_MOCK || !!capabilities?.mock;
  const maxCost = demo ? 0 : selectedModel?.tokenPricing ? Math.ceil(selectedModel.tokenPricing.maxCost) : undefined;
  // ── Skill choice: only while the thread has none yet (a bound thread changes method by starting over from a message) ──
  const activeSkills = activeStudioSkills(skills);
  const skillOptions: SkillChoice[] = [...activeSkills.map(s => ({ key: s.key, name: s.name, summary: s.summary })), ...(skillChoices || []).filter(c => !activeSkills.some(s => s.key === c.key))];
  const boundSkillKey = store.thread?.skillKey;
  const boundSkill = boundSkillKey ? skills.find(s => s.key === boundSkillKey) : undefined;
  const chosenSkill = boundSkillKey ? undefined : skillOptions.find(s => s.key === skillKey);
  const pickSkill = !boundSkillKey && skillOptions.length > 1;
  const chooseSkill = (value?: string) => { setSkillKey(!value || value === AUTO_SKILL ? undefined : value); setSkillNotice(""); };
  // The skill-draft run is a text run on the scene's default model; its ceiling is that model's.
  const draftModel = textModels.find(m => m.isDefault) || textModels[0];
  const draftCost = demo ? 0 : draftModel?.tokenPricing ? Math.ceil(draftModel.tokenPricing.maxCost) : draftModel?.creditCost ?? undefined;
  const operator = USE_MOCK || isOperatorRole(identity?.operatorRole);
  const costHint = demo ? "演示模式，回复和制作都不扣积分" : maxCost !== undefined ? `每轮回复最多 ${maxCost} 积分，按实际用量结算；制作另行报价，确认后才开始` : "回复按实际用量结算；制作另行报价，确认后才开始";

  // ── References ─────────────────────────────────────────────────────────
  const contextNodes = assistantContextNodes(nodes);
  const missing = [...pinnedIds, ...attachmentIds].filter(id => !contextNodes.some(n => n.id === id));
  const pin = (node: CanvasNodeData) => {
    if (pinnedIds.includes(node.id)) return true;
    if (pinnedIds.length >= MAX_REFERENCES) { setComposerError(`一次最多指定 ${MAX_REFERENCES} 个画布对象`); return false; }
    setPinnedIds(ids => [...ids, node.id]); setComposerError(""); return true;
  };

  // ── Attachments: import into the canvas, save, then they can be sent ──────
  const importLock = useRef(false);
  const saveAttachments = async (project: string) => {
    setAttachmentsUnsaved(true);
    await saveStudioDocument(project);
    if (same(project)) setAttachmentsUnsaved(false);
  };
  const addAttachments = async (source: File[] | IpSavedAsset[]) => {
    if (importLock.current) return;
    const project = projectId;
    importLock.current = true; setReading(true); setComposerError("");
    let staged = [...live.current.nodes], ids = [...draft.current.attachmentIds], added = 0;
    const failures: string[] = [];
    try {
      for (const item of source) {
        if (!same(project)) return;
        try {
          if (ids.length >= MAX_REFERENCES) throw new Error(`一次最多添加 ${MAX_REFERENCES} 个附件`);
          const node = item instanceof File
            ? await readAssistantAttachment(item, staged, file => importStudioStory(project, file), (file, type) => importStudioMedia(project, file, type))
            : attachmentNode(savedAssetPayload(item), staged);
          if (!same(project)) return;
          if (!staged.some(n => n.id === node.id)) { staged = [...staged, node]; setNodes(list => [...list, node]); }
          if (!ids.includes(node.id)) { ids = [...ids, node.id]; setAttachmentIds(ids); }
          added++;
        } catch (e) { failures.push(`${item instanceof File ? item.name : item.title}：${e instanceof Error ? e.message : "导入失败，请重试"}`); }
      }
      if (added) { await saveAttachments(project); if (same(project)) message.success(`已添加 ${added} 个附件，可以继续写再发送`); }
      if (failures.length) throw new Error(failures.join("；"));
    } catch (e) { if (same(project)) { setComposerError(e); throw e; } }
    finally { importLock.current = false; if (same(project)) setReading(false); }
  };
  const retryAttachmentSave = async () => {
    const project = projectId;
    setReading(true);
    try { await saveAttachments(project); setComposerError(""); message.success("附件已保存，可以发送了"); }
    catch (e) { setComposerError(e); }
    finally { if (same(project)) setReading(false); }
  };

  // ── Send / stop ────────────────────────────────────────────────────────
  const sendDisabledReason = !text.trim() ? "先写下你想做的" : session.status !== "ready" ? "对话还在加载，请稍等" : reading ? "附件还在导入" :
    attachmentsUnsaved ? "附件还没保存好，保存后才能发送" : missing.length ? "有引用已从画布删除，请先移除" : "";
  const send = async () => {
    if (sendDisabledReason || sending) return;
    const project = projectId;
    const input = { text: text.trim(), pinnedNodeIds: pinnedIds, attachmentNodeIds: attachmentIds.filter(id => !pinnedIds.includes(id)), ...(maxCost !== undefined ? { maxCost } : {}),
      ...(chosenSkill ? { skillKey: chosenSkill.key } : {}) };
    setSending(true); setComposerError(""); setSkillNotice("");
    try {
      // Pinned and attached nodes must exist in the saved document before the server reads them.
      await saveStudioDocument(project);
    } catch (e) { if (same(project)) { setComposerError(e); setSending(false); } return; }
    if (!same(project)) return;
    setText(""); setPinnedIds([]); setAttachmentIds([]); drafts.current.delete(project);
    try {
      const outcome = await session.send(input);
      if (!same(project)) return;
      if (outcome.state === "rejected") {
        // Definitely not accepted: give the draft back for editing.
        setText(current => current.trim() ? current : input.text);
        setPinnedIds(current => current.length ? current : input.pinnedNodeIds);
        setAttachmentIds(current => current.length ? current : input.attachmentNodeIds);
        const required = skillRequiredNotice(outcome.error, skillOptions);
        if (required) {
          setSkillChoices(required.choices.length ? required.choices : undefined); setSettingsOpen(true); setSkillNotice(required.text);
          // The server may know skills this page has not loaded yet.
          void reloadStudioSkills().then(list => { if (mounted.current) setSkills(list); }).catch(() => undefined);
        } else setComposerError(budgetExceededError(outcome.error) ?? outcome.error);
      } else if (outcome.state === "sent") setSkillChoices(undefined);
      else if (outcome.state === "unknown") setComposerError("消息没有确认送达。点对话里的「重新发送」，服务端只会处理一次");
    } finally { if (same(project)) setSending(false); }
  };
  const stop = async () => {
    if (stopping) return;
    setStopping(true);
    try { await session.stop(); } catch (e) { message.error(e); } finally { if (mounted.current) setStopping(false); }
  };
  const compose = useCallback((value: string) => composer.current?.compose(value), []);

  // ── Canvas projection of server commands ─────────────────────────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scheduleSave = useCallback(() => {
    const project = projectId;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => { if (same(project)) void saveStudioDocument(project).catch(e => message.error(e)); }, 300);
  }, [projectId, message]);
  useEffect(() => () => clearTimeout(saveTimer.current), []);
  /** Project a batch onto the canvas through its two setters and the ordinary save chain. */
  const applyCanvasOps = (ops: CanvasProjectionOp[], opts: { docVersion?: string } = {}) => {
    const base = { nodes: live.current.nodes, connections: live.current.connections };
    const result = projectCanvasOps(base, ops, opts);
    if (result.changed) {
      setNodes(list => projectCanvasOps({ nodes: list, connections: base.connections }, ops, opts).doc.nodes);
      // Edges are projected against the nodes the batch started from: a restore only adds edges next to nodes
      // the batch itself creates, and against the already-updated nodes it would see none of them as new.
      setConnections(list => projectCanvasOps({ nodes: base.nodes, connections: list }, ops, opts).doc.connections);
      scheduleSave();
    }
    return result;
  };
  useEffect(() => {
    const ops = store.canvasOps;
    if (!ops.length) return;
    const result = applyCanvasOps(ops, { docVersion });
    setCanvasNotice(result.conflicts ? "画布已变化，稍后重试" : "");
    const fallback = lastAssistantMessage(store)?.id;
    for (const p of result.proposals) {
      const messageId = store.turnMessages[p.turnId] || fallback;
      if (messageId) session.dispatch({ type: "adoption.add", messageId, block: { type: "adoption", nodeId: p.nodeId, field: p.field, content: p.content, snapshot: p.snapshot, status: "proposed" } });
    }
    rememberProjectedNodes(projectId, result.projected);
    session.dispatch({ type: "canvas.ack", seq: ops[ops.length - 1].seq });
  }, [store.canvasOps]);

  // ── Work an execution finished while this canvas was closed ─────────────
  // The execution and its native runs are the record of what was made; events may be pruned and a new browser
  // has no cursor. Only nodes the canvas lacks and this viewer never projected are added, through the same
  // idempotent projection and save chain as live commands.
  const restored = useRef(new Map<string, string>());
  useEffect(() => { restored.current = new Map(); }, [projectId]);
  const restoreExecution = async (project: string, execution: StudioPlanExecution) => {
    const steps = missingExecutionNodes(execution, live.current.nodes, readProjectedNodes(project));
    if (!steps.length) return;
    const runs: Record<string, IpRun> = {};
    for (const step of steps) for (const id of stepRunCandidates(step)) {
      const run = await getRun(id).catch(() => undefined);
      if (!same(project)) return;
      if (run) runs[id] = run;
      if (run?.status === "done") break;
    }
    const ops = executionRestoreUpserts(execution, runs, new Set(steps.map(step => stepNodeId(execution, step))))
      .map(data => ({ kind: "node" as const, data, executionId: execution.id, turnId: execution.id, restore: true }));
    if (!ops.length) return;
    rememberProjectedNodes(project, applyCanvasOps(ops).projected);
  };
  useEffect(() => {
    const project = projectId;
    for (const execution of session.executions) {
      if (restored.current.get(execution.id) === execution.updatedAt) continue;
      restored.current.set(execution.id, execution.updatedAt);
      void restoreExecution(project, execution).catch(() => restored.current.delete(execution.id));
    }
  }, [session.executions]);
  useEffect(() => {
    const execution = store.execution;
    if (!execution || projectStudioExecution(live.current.nodes, execution) === live.current.nodes) return;
    setNodes(list => projectStudioExecution(list, execution));
    scheduleSave();
  }, [store.execution]);

  // ── 「就用这版」/「重做这一段」 from check nodes ─────────────────────────
  useEffect(() => {
    const listener = (event: Event) => {
      const { action, nodeId } = (event as CustomEvent<StudioCheckCommand>).detail;
      const node = live.current.nodes.find(n => n.id === nodeId), check = node?.metadata?.studio?.check;
      if (!node || !check) return;
      const subject = checkSubject(live.current.nodes, node);
      if (action === "redo") {
        if (!subject) { message.error("找不到这一段的视频，请在画布上选中它再重新生成"); return; }
        dispatchStudioCommand(subject.type === "image" ? "image" : "video", subject.id);
        return;
      }
      void (async () => {
        const executionId = node.metadata?.studio?.execution?.executionId || subject?.metadata?.studio?.execution?.executionId;
        if (!executionId) throw new Error("这一段不属于正在进行的制作，无法记下采用");
        const execution = await session.ensureExecution(executionId);
        const stepId = checkedStep(execution, check.targetRunId)?.id || subject?.metadata?.studio?.execution?.stepId;
        if (!stepId) throw new Error("找不到这一段对应的制作步骤，请刷新后重试");
        await session.acceptStep(executionId, stepId, check.targetRunId);
        message.success("已记下就用这一版，检查结论保持不变");
      })().catch(e => message.error(e));
    };
    window.addEventListener(STUDIO_CHECK_COMMAND, listener);
    return () => window.removeEventListener(STUDIO_CHECK_COMMAND, listener);
  }, [session.ensureExecution, session.acceptStep, message]);

  // ── Message actions ──────────────────────────────────────────────────────
  const adopt = async (block: DialogueAdoptionBlock) => {
    const target = live.current.nodes.find(n => n.id === block.nodeId);
    if (!target) throw new Error("原节点已从画布删除");
    if (!assistantEditableFields(target).includes(block.field)) throw new Error("这个节点正在生成或不能编辑，请稍后再采用");
    const current = proposalFieldValue(target, block.field);
    if (current === block.content) return;
    if (current !== block.snapshot) throw new Error("这段内容在回复之后被改过，没有覆盖。可以让我按最新内容重写");
    const node = assistantReplacementNode(target, block.field, block.content);
    setNodes(list => markStudioDescendants(list, target.id).map(n => n.id === target.id ? node : n));
    await saveStudioDocument(projectId);
    message.success(block.field === "prompt" ? "已更新节点提示词" : "已更新节点内容");
  };
  const approve = async (block: DialogueApprovalBlock, caps: { budgetCap: number; autoFixCap: number }, messageId: string) => {
    // The execution reads canvas references from the saved document.
    await saveStudioDocument(projectId);
    try { await session.approve(block, caps, messageId); }
    catch (e) {
      if (e instanceof ApiError && e.code === "STUDIO_PLAN_STALE") throw Object.assign(new Error("方案已经更新，请看最新的报价再确认"), { code: e.code, logId: e.logId });
      throw e;
    }
  };
  /** Operators: 「整理成技能草稿」 under the completion summary of an execution that finished with work to learn from. */
  const completionActions = (message: StudioDialogueMessage) => {
    const executionId = completionExecutionId(message);
    if (!executionId) return null;
    const known = session.executions.find(e => e.id === executionId);
    if (known && !["done", "partial"].includes(known.status)) return null;
    return <StudioDialogueSkillDraft key={executionId} projectId={projectId} executionId={executionId} maxCost={draftCost} demo={demo}/>;
  };
  const handlers: DialogueMessageHandlers = {
    onCompose: compose, onRevise: () => composer.current?.focus(), onApprove: approve, onAdopt: adopt,
    planReady: block => !!planForApproval(store, block), onBranch: session.branch, approvedCaps: block => approvedCaps(block, session.executions),
    skillLabel: plan => studioSkillBadge(skills, plan), completionActions: operator ? completionActions : undefined,
  };

  // ── Old four-mode conversations (read-only history with adoption) ──────────
  const legacyGroups: LegacyGroup[] = useMemo(() => {
    const server = dialogueSections(store).legacy;
    const ids = [...new Set([...conversations.map(c => c.id), ...server.map(m => m.legacyNodeId!)])];
    return ids.map(id => ({ id, node: conversations.find(c => c.id === id), messages: server.filter(m => m.legacyNodeId === id) }));
  }, [store.messages, conversations]);
  const patchConversation = (id: string, update: (node: CanvasNodeData) => CanvasNodeData) => setConversations(list => list.map(n => n.id === id ? update(n) : n));
  const editLegacyStep = (id: string, step: StudioPlan["steps"][number]) => patchConversation(id, n => ({ ...n, metadata: { ...n.metadata, studio: { ...n.metadata!.studio!,
    conversation: { ...n.metadata!.studio!.conversation!, plan: { ...n.metadata!.studio!.conversation!.plan!, steps: n.metadata!.studio!.conversation!.plan!.steps.map(s => s.id === step.id ? step : s) } } } } }));
  const applyLegacyStep = async (id: string, step: StudioPlan["steps"][number], replacement?: AssistantReplacement) => {
    const source = live.current.conversations.find(n => n.id === id);
    const latest = source?.metadata?.studio?.conversation?.plan, contextIds = source?.metadata?.studio?.request?.contextNodeIds || [];
    const saved = latest?.steps.find(s => s.id === step.id);
    if (!saved || !latest) throw new Error("方案已更新，请重新打开结果");
    const refs = assistantStepReferences(saved, latest, live.current.nodes);
    if (refs.waiting.length) throw new Error("请先完成前置内容，再继续这一步");
    const resolved = { ...saved, referenceNodeIds: refs.ids, unresolvedReferences: assistantUnresolvedReferences(saved, latest) };
    const existing = live.current.nodes.find(n => n.id === saved.resultNodeId);
    // Retry saving the same adopted node; never duplicate a result after a transport failure.
    if (existing) { editLegacyStep(id, { ...saved, unresolvedReferences: resolved.unresolvedReferences }); await saveStudioDocument(projectId); if (step.operation !== "text" && !saved.editTarget) onUseStep(resolved); return; }
    let resultId: string | void;
    const value = step.operation === "text" ? saved.content : saved.prompt;
    if (replacement) {
      const target = live.current.nodes.find(n => n.id === replacement.id), field = replacement.field || "content";
      if (!target || !contextIds.includes(target.id) || !assistantEditableFields(target).includes(field)) throw new Error("目标节点已不可编辑，请重新选择");
      if (assistantFieldValue(target, field) !== replacement.content) throw new Error("节点内容已有修改，请重新发送并核对修改稿");
      if (!value?.trim()) throw new Error("请先填写修改后的内容");
      const node = assistantReplacementNode(target, field, value);
      resultId = target.id;
      setNodes(list => markStudioDescendants(list, target.id).map(n => n.id === target.id ? node : n));
      resolved.editTarget = { nodeId: target.id, field };
    } else if (step.operation === "text") {
      if (!saved.content?.trim()) throw new Error("请先填写文字内容");
      const node = { ...makeStudioNode("text", live.current.nodes.find(n => refs.ids.includes(n.id))), title: saved.title, metadata: { content: saved.content, status: "success" as const, studio: { kind: "text" as const } } };
      resultId = node.id;
      setNodes(list => [...list, placeStudioNode(node, list)]);
      setConnections(list => [...list, ...refs.ids.filter(ref => ref !== node.id).map(ref => ({ id: nanoid(), fromNodeId: ref, toNodeId: node.id }))]);
    } else resultId = onUseStep(resolved);
    if (resultId) editLegacyStep(id, { ...saved, editTarget: replacement ? resolved.editTarget : undefined, unresolvedReferences: resolved.unresolvedReferences, resultNodeId: resultId });
    await saveStudioDocument(projectId);
    if (replacement) message.success(replacement.field === "prompt" ? "已更新节点提示词" : "已更新节点内容"); else if (step.operation === "text") message.success("文字已放入画布");
  };
  /** Re-reads the exact accepted request of an old conversation; never a new paid submission. */
  const recoverLegacy = async (id: string) => {
    const project = projectId, request = live.current.conversations.find(n => n.id === id)?.metadata?.studio?.request;
    if (!request || recovering) return;
    setRecovering(id);
    try {
      await saveStudioDocument(project);
      let run = await submitStudioRun(project, request);
      while (same(project)) {
        patchConversation(id, n => { const next = applyStudioRun(n, run); return run.status === "running" ? next : { ...next, metadata: { ...next.metadata, studio: { ...next.metadata!.studio!, assistantPreviousConversation: undefined } } }; });
        if (run.status !== "running") { await saveStudioDocument(project); if (run.status === "failed") throw Object.assign(new Error(run.errorMessage || "对话未完成"), studioRunError(run)); return; }
        await sleep(1200);
        try { run = await readRun(run.id); } catch { await sleep(2000); }
      }
    } catch (e) { if (same(project)) message.error(e); }
    finally { if (same(project)) setRecovering(undefined); }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const { current } = dialogueSections(store);
  const empty = !current.length && !store.outbox.length;
  const execution = store.execution && (executionActive(store.execution) || store.execution.threadId === store.thread?.id) ? store.execution : undefined;
  const checks = Object.values(store.checks);
  const streamNote = session.stream === "reconnecting" ? "连接中断，正在重连" : session.stream === "polling" ? "实时更新暂时不可用，每隔几秒刷新一次" : "";
  const starters = pinnedIds.length > 1 ? [
    ["整理所选内容", "整理这些节点的内容，生成一份可直接使用的文字摘要。", FileText],
    ["统一视觉风格", "基于所选素材，设计一张风格统一的新图片。", Image],
    ["规划场景视频", "基于所选素材，规划一条场景视频，保留人物和场景特征。", Video],
    ["串成创作流程", "根据这些节点，规划接下来需要的文字、图片和视频节点及引用关系。", Workflow],
  ] as const : [
    [pinnedIds.length ? "修改节点内容" : "写一段文字", pinnedIds.length ? "修改所选节点的内容，保留核心设定，给我一版可以写回原节点的完整修改稿。" : "生成一个末世英雄的角色描述，补全外貌、服装和性格，直接给我初稿。", FileText],
    [pinnedIds.length ? "优化节点提示词" : "创作一张图片", pinnedIds.length ? "优化所选节点的提示词，保留主体和核心设定，直接给出完整的新提示词供我写回原节点，不生成新素材。" : "设计一个有辨识度的原创 IP 形象，先给出可生成图片的方案。", Image],
    ["复刻一条短视频", "参考画布上的这条视频，换成我的商品和人物重新做一版，保留原片的节奏和反转。", Video],
    ["搭建创作流程", "帮我搭建从角色描述、多视角设定图、细节参考图到场景视频的创作流程。", Workflow],
  ] as const;
  return <StudioFloatingPanel title="Studio 创作助手" className="studio-assistant-panel" open={open} onClose={() => { drafts.current.set(projectId, draft.current); onClose(); }} width={448} utility dockable footer={<>
      <StudioDialogueComposer ref={composer} projectId={projectId} text={text} onText={setText} contextNodes={contextNodes} pinnedIds={pinnedIds} attachmentIds={attachmentIds}
        onPin={pin} onUnpin={id => setPinnedIds(ids => ids.filter(value => value !== id))} onRemoveAttachment={id => setAttachmentIds(ids => ids.filter(value => value !== id))}
        onFiles={files => void addAttachments(files).catch(() => {})} onAssets={addAttachments} reading={reading} attachmentsUnsaved={attachmentsUnsaved} onRetrySave={() => void retryAttachmentSave()}
        sendDisabledReason={sendDisabledReason} sending={sending} onSend={() => void send()} canStop={!!store.activeTurnId} stopping={stopping} onStop={() => void stop()} costHint={costHint}/>
      {skillNotice && <p className="studio-dialogue-note" role="status">{skillNotice}</p>}
      {(composerError || missing.length > 0) && <p className="studio-assistant-error" role="alert"><span>{missing.length ? "部分引用已从画布删除，请移除后重新选择" : composerError}</span> <StudioErrorNotice error={missing.length ? "部分引用已从画布删除，请移除后重新选择" : composerError} autoReport={false} label="查看详情"/></p>}
    </>}>
    <div className="studio-assistant studio-dialogue">
      <div className="studio-assistant-toolbar"><span>全能创作{demo && <em className="studio-dialogue-mock" title="演示数据，不是模型生成，也不扣积分">演示</em>}</span>
        <div>{streamNote && <small className="studio-dialogue-stream" role="status">{streamNote}</small>}
          {/* A single or fixed model is shown without opening settings (ported from the old composer, 2026-10-18). */}
          {!selectable && selectedModel && <Select aria-label="助手模型" className="studio-dialogue-model" size="small" disabled value={selectedModel.endpointId} title={selectedModel.name}
            options={[{ value: selectedModel.endpointId, label: selectedModel.name }]}/>}
          <Button aria-label="对话设置" aria-expanded={settingsOpen} icon={<SlidersHorizontal size={16}/>} onClick={() => setSettingsOpen(v => !v)}/></div></div>
      {settingsOpen && <section className="studio-assistant-tools studio-dialogue-settings" aria-label="对话设置">
        {selectable && <label className="studio-dialogue-setting"><span>回复用的模型</span><Select aria-label="助手模型" value={selectedModel?.endpointId} onChange={setModel} options={textModels.map(m => ({ value: m.endpointId, label: m.name }))}/></label>}
        {pickSkill && <label className="studio-dialogue-setting"><span>技能</span><Select aria-label="技能" value={chosenSkill?.key || AUTO_SKILL} onChange={chooseSkill}
          options={[{ value: AUTO_SKILL, label: "自动" }, ...skillOptions.map(s => ({ value: s.key, label: s.name }))]}/></label>}
        {pickSkill && <p className="studio-helper-note">{chosenSkill ? chosenSkill.summary : "自动：按你的消息和素材挑一个合适的技能。第一次回复之后，这段对话就一直用它"}</p>}
        {boundSkill && activeSkills.length > 1 && <p className="studio-helper-note">这段对话在按「{boundSkill.name}」做。要换技能，在某条消息上点「从这里重新开始」。</p>}
        {studioSkillNotes(skills).map(note => <p key={note} className="studio-helper-note">{note}</p>)}
        <p className="studio-helper-note">整张画布都会作为参考，需要时我会读取图片和视频画面，读取过程记在工作记录里。用 @ 指定的内容一定会读。</p>
        <details className="studio-helper-note"><summary>附件说明</summary><p>{ATTACHMENT_NOTE}</p></details>
      </section>}
      {execution && <StudioDialogueExecution execution={execution} budget={executionBudget(store)} checks={checks} notice={canvasNotice} onControl={session.controlExecution}/>}
      {!execution && canvasNotice && <p className="studio-dialogue-warning" role="status">{canvasNotice}</p>}
      {session.status === "loading" && <p className="studio-dialogue-note" role="status">正在读取这张画布的对话</p>}
      {session.status === "error" && <div className="studio-assistant-pending" role="alert"><p>对话没有读取成功。</p><StudioErrorNotice error={session.loadError} autoReport={false}/><Button onClick={() => void session.reload()}>重新读取</Button></div>}
      {empty && session.status !== "error" && <div className="studio-assistant-welcome"><p className="studio-assistant-eyebrow">从一个想法开始</p><h3 className="w-full max-w-full">说出想法，<br/>一起完成创作。</h3>
        <p>{pinnedIds.length ? `已指定 ${pinnedIds.length} 个节点。可以修改内容和提示词，也可以做新的内容。` : "写文字、做图片、复刻视频，或搭建一整套创作流程。中途想改，直接说。"}</p>
        <div className="studio-assistant-starters">{starters.map(([title, value, Icon]) => <button key={title} type="button" onClick={() => { setText(value); composer.current?.focus(); }}><Icon size={18}/><span>{title}</span><ArrowUp size={14}/></button>)}</div></div>}
      {!!legacyGroups.length && <details className="studio-dialogue-legacy" open={legacyOpen} onToggle={e => setLegacyOpen(e.currentTarget.open)}>
        <summary>之前的对话（{legacyGroups.length} 段）</summary>
        {legacyGroups.map(group => <StudioDialogueLegacy key={group.id} group={group} projectId={projectId} nodes={nodes} selectedIds={selectedIds} recovering={recovering === group.id}
          onEditStep={editLegacyStep} onApplyStep={applyLegacyStep} onRecover={id => void recoverLegacy(id)} onCompose={compose}/>)}
      </details>}
      <StudioDialogueTimeline store={store} nodes={nodes} handlers={handlers} onRetry={id => void session.retry(id)} onLoadOlder={session.loadOlder} readThread={session.readThread}/>
    </div>
  </StudioFloatingPanel>;
}
