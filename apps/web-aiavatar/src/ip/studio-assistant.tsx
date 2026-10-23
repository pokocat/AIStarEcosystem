"use client";
// 「全能创作」: the assistant of one canvas (docs/ip-studio-conversational-video-recreation-plan.md §对话形态). A canvas can
// hold several conversations: 「新对话」 starts one and 「历史对话」 opens an earlier one (docs/ip-studio-new-canvas-and-threads.md
// §3). There are no modes. The server streams real reply text, work records,
// plans and confirmation cards into one timeline; the composer stays editable throughout and
// new messages are queued as steering. Canvas commands from the server are projected into
// the document idempotently and saved through the ordinary save chain; work an execution
// finished while the canvas was closed is rebuilt from that execution on the next open
// (missing nodes only, never over the user's own text). Conversations from the
// old four-mode assistant stay readable (with their adoption bindings) under 「之前的对话」.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { ApiError, formatCredits } from "@ai-star-eco/api-client";
import { Button } from "antd";
import { ChevronRight, FileText, Image, PenLine, Video, Workflow } from "lucide-react";
import { AiMark } from "./studio-ai-icon";
import { nanoid } from "nanoid";
import type { IpRun, IpSavedAsset } from "@ai-star-eco/types";
import type { StudioAssistantMode, StudioCapabilities, StudioDialogueMessage, StudioPlan, StudioPlanExecution, StudioPlanExecutionStep, StudioSkillRequiredDetails, StudioSkillSummary } from "@ai-star-eco/types/ip-studio-workflow";
import { studioTaskQueued } from "@/canvas-bridge/studio-task-status";
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
import { activeStudioSkills, completionExecutionId, loadStudioSkills, reloadStudioSkills, skillRequiredChoices, studioSkillBadge } from "@/canvas-bridge/studio-skills";
import { StudioErrorNotice, studioRunError, useStudioApp, useStudioErrorState } from "./studio-errors";
import { StudioFloatingPanel } from "./studio-floating-panel";
import { DIALOGUE_THREAD_BUSY, DIALOGUE_VERIFYING, dialogueThreadBusy, useStudioDialogueSession } from "./studio-dialogue-session";
import { StudioDialogueThreads } from "./studio-dialogue-threads";
import { StudioDialogueComposer, type DialogueComposerHandle } from "./studio-dialogue-composer";
import { StudioDialogueTimeline } from "./studio-dialogue-timeline";
import { StudioDialogueExecution, StudioDialogueSteps } from "./studio-dialogue-execution";
import { StudioDialogueLegacy, type LegacyGroup } from "./studio-dialogue-legacy";
import type { DialogueMessageHandlers } from "./studio-dialogue-message";
import { StudioDialogueSkillDraft } from "./studio-dialogue-skill-draft";
import { StudioAssistantStarterCards, StudioAssistantStarterForm, composeStarter, isMentionResidue, starterDefaults, starterSlotNodes, starterSlots, studioStarter, type StarterKey } from "./studio-assistant-starters";
import { clearAssistantDraft, readAssistantDraft, readAssistantModel, writeAssistantDraft } from "@/canvas-bridge/studio-assistant-memory";
import { studioBriefNeedsReference, studioCanvasHasDefaultTitle, studioTitleFromBrief } from "./studio-entry";
import { useCanvasStore } from "@/canvas/stores/canvas/use-canvas-store";
import { splitReplyActions } from "@/canvas-bridge/studio-reply-actions";

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
  /** Dialogue-first start: send the prefilled brief as the first message once the thread is ready and still empty. */
  autoSend?: boolean; onAutoSent?: () => void;
};
type ComposerDraft = { text: string; pinnedIds: string[]; attachmentIds: string[] };
/** Contract limit for pinnedNodeIds / attachmentNodeIds (specs/openapi.yaml StudioPostMessageRequest). */
const MAX_REFERENCES = 64;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
/** An open fill-in card (docs/ip-studio-new-canvas-and-threads.md §5): its option choices and its lines of text. Material is the message's own references. */
type Starter = { key: StarterKey; options: Record<string, string>; fields: Record<string, string> };
/** Layout effects warn during server rendering; the assistant only renders in the browser, but the module may be imported on the server. */
const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
/** The header label's hover text: how the method is chosen, since nothing under the composer shows or changes it. */
const modeLabelTitle = (skillName?: string) => skillName
  ? `现在按「${skillName}」做。按你说的话自动选择；有制作在进行时保持不变，想换做法可以开一段新对话。`
  : "按你说的话自动选择做法。";
/** A skill's summary up to its first full stop: the guide says what the skill is for in one line. */
const firstSentence = (text: string) => text.match(/^[^。！？]*[。！？]/)?.[0] || text;
type SkillChoice = StudioSkillRequiredDetails["skills"][number];
/**
 * 400 STUDIO_SKILL_REQUIRED is a question, not a failure: say which skills fit and keep the draft. The skills are offered
 * as quick replies next to the composer, and picking one sends the draft again with that skill (there is no skill picker
 * under the composer any more, 2026-10-21). It is shown inline only (no error notification).
 */
function skillRequiredNotice(error: unknown, fallback: SkillChoice[]) {
  const choices = skillRequiredChoices(error);
  if (!choices) return undefined;
  const names = (choices.length ? choices : fallback).map(s => `「${s.name}」`);
  const text = names.length ? `${names.join("和")}都能做，选一个就按它发送` : "选一种做法，就按它发送";
  return { choices, text };
}
/** 402 while an execution runs: this turn would not fit the stage budget. Say by how much; the draft stays. */
function budgetExceededError(error: unknown) {
  if (!(error instanceof ApiError) || error.code !== "STUDIO_PLAN_BUDGET_EXCEEDED") return undefined;
  const shortfall = Number((error.details as { shortfall?: unknown } | undefined)?.shortfall);
  const text = Number.isFinite(shortfall) && shortfall > 0 ? `积分超出上限，还差 ${formatCredits(shortfall)} 积分，提高上限后再发` : "积分超出上限，提高上限后再发";
  return Object.assign(new Error(text), { code: error.code, logId: error.logId });
}

export function StudioAssistant({ projectId, conversations, setConversations, nodes, setNodes, setConnections, connections, docVersion, capabilities, open, initialNodeId, initialPrompt, restorePending, onClose, selectedIds, onUseStep, autoSend = false, onAutoSent }: Props) {
  const { message } = useStudioApp();
  const session = useStudioDialogueSession({ projectId, open, autoload: !!restorePending });
  const { store } = session;
  // The composer starts from this canvas's saved draft (a refresh keeps what was typed, runbook 2.7).
  const [initialDraft] = useState(() => readAssistantDraft(projectId, new Set(assistantContextNodes(nodes).map(n => n.id))));
  const [text, setText] = useState(initialDraft?.text ?? ""), [pinnedIds, setPinnedIds] = useState<string[]>(initialDraft?.pinnedIds ?? []), [attachmentIds, setAttachmentIds] = useState<string[]>(initialDraft?.attachmentIds ?? []);
  // The reply model has no control under the composer (2026-10-21, user feedback): there is one dialogue model online, the
  // disabled pill could not be changed, and its name read as if videos were made with it too. A choice this browser saved
  // for the canvas earlier (when the picker existed) still applies where the scene offers that model.
  const model = useMemo(() => readAssistantModel(projectId), [projectId]);
  const [guideOpen, setGuideOpen] = useState(false), [legacyOpen, setLegacyOpen] = useState(false), [starter, setStarter] = useState<Starter>();
  // References added while a fill-in card is open belong to that card and leave the message with it (「换一个」).
  // `starterWritten` is the sentence the card last put in the composer; text that is still that sentence (or it plus a
  // pending @ pick) is the card's to rewrite, anything else is the user's own.
  const starterHeld = useRef(new Set<string>()), starterWritten = useRef<string | undefined>(undefined);
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

  // ── Drafts: each canvas keeps its own unsent text and references, in this browser, across a refresh ──────────
  // The state is read from storage when the composer is created and when the canvas changes, and every change is written
  // back to the canvas the state belongs to. Nothing is written from an unmount or a page-hide: those see whatever the
  // state was at that moment, and React (StrictMode, remounts) can run them before a restored draft has reached state —
  // that once wiped the draft it had just restored.
  const draft = useRef<ComposerDraft>({ text, pinnedIds, attachmentIds });
  draft.current = { text, pinnedIds, attachmentIds };
  const draftOwner = useRef(projectId);
  const opened = useRef<{ projectId: string; initialNodeId?: string } | undefined>(undefined);
  useEffect(() => {
    if (draftOwner.current === projectId) return;
    writeAssistantDraft(draftOwner.current, draft.current);
    draftOwner.current = projectId;
    const saved = readAssistantDraft(projectId, new Set(assistantContextNodes(live.current.nodes).map(n => n.id)));
    setText(saved?.text ?? ""); setPinnedIds(saved?.pinnedIds ?? []); setAttachmentIds(saved?.attachmentIds ?? []);
    setReading(false); setAttachmentsUnsaved(false); setCanvasNotice(""); setSkillKey(undefined); setSkillChoices(undefined); setSkillNotice(""); setStarter(undefined); setGuideOpen(false);
    starterHeld.current.clear(); starterWritten.current = undefined;
  }, [projectId]);
  // Runs after the switch above in the same commit only if the composer itself changed, so it never files the old
  // canvas's text under the new one.
  useEffect(() => { writeAssistantDraft(draftOwner.current, draft.current); }, [text, pinnedIds, attachmentIds]);
  useEffect(() => {
    if (!open) return;
    const previous = opened.current;
    if (previous?.projectId === projectId && previous.initialNodeId === initialNodeId) return;
    opened.current = { projectId, initialNodeId };
    const entry = [...live.current.nodes, ...live.current.conversations].find(n => n.id === initialNodeId);
    if (entry && live.current.conversations.some(c => c.id === entry.id) && entry.metadata?.studioStart !== "assistant") {
      setLegacyOpen(true);
      requestAnimationFrame(() => [...document.querySelectorAll<HTMLElement>("[data-node-id]")].find(el => el.dataset.nodeId === entry.id)?.scrollIntoView?.({ block: "start" }));
    }
    // Same canvas, another way in (the homepage brief arriving after the panel opened by default, a task row): what is
    // typed stays. This used to stash the composer and restore it at once — the panel opens by default, so the stash was
    // the empty composer and the homepage brief never reached it (local e2e 2026-10-19). The brief has its own effect below.
    if (previous?.projectId === projectId) return;
    // First open of a canvas without a saved draft: a selection becomes visible, removable pins; nothing is pinned silently.
    const referenceable = assistantContextNodes(live.current.nodes);
    if (readAssistantDraft(projectId, new Set(referenceable.map(n => n.id)))) return;
    const pins = referenceable.filter(n => selectedIds.includes(n.id)).map(n => n.id).slice(0, MAX_REFERENCES);
    if (pins.length) setPinnedIds(pins);
  }, [open, projectId, initialNodeId]);
  useEffect(() => { if (open && !skills.length) loadStudioSkills().then(list => { if (mounted.current) setSkills(list); }).catch(() => undefined); }, [open]);
  // 「问助手」 (node bar, context menu): the node joins this message's references and the cursor lands in the input —
  // whether the assistant was open or closed, with or without a saved draft. The open effect above restores a saved draft
  // and returns early, and the assistant opens by default, so before this the node was never added (2026-10-19 walkthrough).
  useEffect(() => {
    const ask = (event: Event) => {
      const { action, nodeId } = (event as CustomEvent<{ action?: string; nodeId?: string }>).detail || {};
      if (action !== "assistant") return;
      const node = nodeId ? assistantContextNodes(live.current.nodes).find(n => n.id === nodeId) : undefined;
      if (node) {
        setStarter(undefined);
        setPinnedIds(ids => ids.includes(node.id) || ids.length >= MAX_REFERENCES ? ids : [...ids, node.id]);
      }
      requestAnimationFrame(() => requestAnimationFrame(() => composer.current?.focus()));
    };
    window.addEventListener("studio-command", ask);
    return () => window.removeEventListener("studio-command", ask);
  }, []);

  // ── Model ceiling (the reply's own cost; production budgets are approved separately) ──
  const textModels = capabilities?.textModels || [];
  const selectable = capabilities?.textModelMode === "selectable" && textModels.length > 1;
  const selectedModel = textModels.find(m => m.endpointId === ((selectable && textModels.some(m => m.endpointId === model) ? model : undefined) || textModels.find(m => m.isDefault)?.endpointId || textModels[0]?.endpointId));
  const demo = USE_MOCK || !!capabilities?.mock;
  const maxCost = demo ? 0 : selectedModel?.dialogueTokenPricing ? Math.ceil(selectedModel.dialogueTokenPricing.maxCost) : undefined;
  // ── Skill: routed by the server from what is said; a fill-in card or a 「which method」 quick reply names one explicitly ──
  // No picker under the composer (2026-10-21): the 「自动」 dropdown and the fixed pill a bound thread showed confused people
  // (why can it not be changed?). The method in use is shown only by the label in the header.
  const activeSkills = activeStudioSkills(skills);
  const skillOptions: SkillChoice[] = [...activeSkills.map(s => ({ key: s.key, name: s.name, summary: s.summary })), ...(skillChoices || []).filter(c => !activeSkills.some(s => s.key === c.key))];
  const boundSkillKey = store.thread?.skillKey;
  const boundSkill = boundSkillKey ? skills.find(s => s.key === boundSkillKey) : undefined;
  const chosenSkill = boundSkillKey ? undefined : skillOptions.find(s => s.key === skillKey);
  const chooseSkill = (value?: string) => { setSkillKey(value); setSkillNotice(""); };
  // The skill-draft run is a text run on the scene's default model; its ceiling is that model's.
  const draftModel = textModels.find(m => m.isDefault) || textModels[0];
  const draftCost = demo ? 0 : draftModel?.tokenPricing ? Math.ceil(draftModel.tokenPricing.maxCost) : draftModel?.creditCost ?? undefined;
  const operator = USE_MOCK || isOperatorRole(identity?.operatorRole);

  // ── References ─────────────────────────────────────────────────────────
  const contextNodes = assistantContextNodes(nodes);
  const missing = [...pinnedIds, ...attachmentIds].filter(id => !contextNodes.some(n => n.id === id));
  const referenced = [...new Set([...pinnedIds, ...attachmentIds])].flatMap(id => contextNodes.filter(n => n.id === id));
  const pin = (node: CanvasNodeData) => {
    if (pinnedIds.includes(node.id)) return true;
    if (pinnedIds.length >= MAX_REFERENCES) { setComposerError(`一次最多引用 ${MAX_REFERENCES} 个节点`); return false; }
    if (starter) starterHeld.current.add(node.id);
    setPinnedIds(ids => [...ids, node.id]); setComposerError(""); return true;
  };

  // ── Fill-in cards: the sentence they write and what they still need (docs/ip-studio-new-canvas-and-threads.md §5) ──
  // A card belongs to an empty conversation: once this one has a message of its own, it is gone.
  const talked = dialogueSections(store).current.length > 0;
  const starterConfig = starter && !talked ? studioStarter(starter.key) : undefined;
  const starterNodes = starterConfig ? starterSlotNodes(starterConfig, referenced) : {};
  const starterResult = starter && starterConfig ? composeStarter(starter.key, { slots: starterNodes, options: starter.options, fields: starter.fields }) : undefined;
  const starterText = starterResult?.text;
  const starterEdited = starterText !== undefined && text !== starterText && !isMentionResidue(text, starterText);
  // The material is what the skill needs whatever the composer says. The lines of text only feed the sentence: once the
  // user writes the message themselves, they no longer hold it back.
  const starterBlocker = starterResult?.missing.find(m => m.kind === "slot" || !starterEdited)?.reason ?? "";
  // One message at a time: a ref, because two clicks in the same tick both see `sending` still false.
  const sendLock = useRef(false);
  // The sentence follows the card while the composer still holds the card's text (or nothing). Before paint, so the
  // 「按选项重写」 link never flashes; not while a send has just cleared the composer.
  useClientLayoutEffect(() => {
    if (starterText === undefined || sendLock.current) return;
    const current = draft.current.text;
    if (current.trim() && current !== starterWritten.current && !isMentionResidue(current, starterWritten.current)) return;
    starterWritten.current = starterText;
    if (current !== starterText) setText(starterText);
  }, [starterText]);

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
          if (!ids.includes(node.id)) { ids = [...ids, node.id]; setAttachmentIds(ids); if (starter) starterHeld.current.add(node.id); }
          added++;
        } catch (e) { failures.push(`${item instanceof File ? item.name : item.title}：${e instanceof Error ? e.message : "导入失败，请重试"}`); }
      }
      if (added) { await saveAttachments(project); if (same(project)) message.success(`已添加 ${added} 个附件`); }
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
  const sendDisabledReason = !text.trim() ? "先写下你想做的" : session.status !== "ready" ? "对话还在加载，请稍等" : session.switching ? "正在切换对话，请稍等" : reading ? "附件还在导入" :
    attachmentsUnsaved ? "附件还没保存好，保存后才能发送" : missing.length ? "有引用已从画布删除，请先移除" : starterBlocker;
  /**
   * `quick`: a question option or follow-up suggestion sent as it is (user feedback 2026-10-20: chips that only filled the
   * composer piled up there). It goes through the same chain as a typed message (save, outbox, retry key, rejection
   * handling) but carries no references and never touches the draft, its pins or its attachments.
   * `withSkill`: the skill picked from the 「which method」 quick replies; it goes on this send (state set alongside it
   * only reaches the next render).
   */
  const send = async (quick?: string, withSkill?: string) => {
    const draft = quick === undefined;
    if (sending || sendLock.current || (draft ? sendDisabledReason : session.status !== "ready" || !!session.switching || !quick.trim())) return;
    // A second click after the first one was already accepted gets a new message key, so the server could not tell them
    // apart: the same quick reply still on its way, or the last thing said with nothing back yet, is not sent again.
    if (!draft) {
      const said = quick.trim(), latestSaid = dialogueSections(store).current.at(-1);
      if (store.outbox.some(o => o.text === said) || (latestSaid?.role === "user" && latestSaid.text === said)) return;
    }
    sendLock.current = true;
    const project = projectId;
    // A fill-in card names its skill (no keyword routing), also on a conversation already bound to another method; the
    // server refuses that switch only while a production runs there, with its own message (shown like any refusal).
    const starterSkill = draft && starterConfig && skillKey === starterConfig.skill && skillOptions.some(s => s.key === skillKey) ? skillKey : undefined;
    const input = { text: draft ? text.trim() : quick.trim(), pinnedNodeIds: draft ? pinnedIds : [], attachmentNodeIds: draft ? attachmentIds.filter(id => !pinnedIds.includes(id)) : [], ...(maxCost !== undefined ? { maxCost } : {}),
      ...(withSkill ? { skillKey: withSkill } : chosenSkill ? { skillKey: chosenSkill.key } : starterSkill ? { skillKey: starterSkill } : {}),
      // The ceiling above is the remembered (or default) model's, so the model goes with it; a fixed or single-model scene sends none.
      ...(selectable && selectedModel ? { model: selectedModel.endpointId } : {}) };
    setSending(true); setComposerError(""); setSkillNotice("");
    // The first message names a canvas nobody named yet, so the list shows what each one is for; a name the user gave stays.
    const canvas = useCanvasStore.getState().projects.find(p => p.id === project);
    const suggested = !dialogueSections(store).current.length && canvas && studioCanvasHasDefaultTitle(canvas.title) ? studioTitleFromBrief(input.text) : undefined;
    if (suggested) useCanvasStore.getState().renameProject(project, suggested);
    try {
      // Pinned and attached nodes must exist in the saved document before the server reads them.
      await saveStudioDocument(project);
    } catch (e) { sendLock.current = false; if (same(project)) { setComposerError(e); setSending(false); } return; }
    if (!same(project)) { sendLock.current = false; return; }
    if (draft) { setText(""); setPinnedIds([]); setAttachmentIds([]); clearAssistantDraft(project); }
    try {
      const outcome = await session.send(input);
      if (!same(project)) return;
      if (outcome.state === "rejected") {
        // Definitely not accepted: give the draft back for editing (a quick reply only lands in an empty composer).
        setText(current => current.trim() ? current : input.text);
        if (draft) {
          setPinnedIds(current => current.length ? current : input.pinnedNodeIds);
          setAttachmentIds(current => current.length ? current : input.attachmentNodeIds);
        }
        const required = skillRequiredNotice(outcome.error, skillOptions);
        if (required) {
          setSkillChoices(required.choices.length ? required.choices : undefined); setSkillNotice(required.text);
          // The server may know skills this page has not loaded yet.
          void reloadStudioSkills().then(list => { if (mounted.current) setSkills(list); }).catch(() => undefined);
        } else setComposerError(budgetExceededError(outcome.error) ?? outcome.error);
      } else if (outcome.state === "sent") { setSkillChoices(undefined); if (draft) { setStarter(undefined); starterHeld.current.clear(); starterWritten.current = undefined; } }
      else if (outcome.state === "unknown") setComposerError("消息可能没发出去，点「重新发送」再试，不会重复发送");
    } finally { sendLock.current = false; if (same(project)) setSending(false); }
  };
  const stop = async () => {
    if (stopping) return;
    setStopping(true);
    try { await session.stop(); } catch (e) { message.error(e); } finally { if (mounted.current) setStopping(false); }
  };
  const compose = useCallback((value: string) => composer.current?.compose(value), []);

  // ── Canvas projection of server commands ─────────────────────────────────
  // Nodes (and the canvas commands that made them) projected but not on the server yet. The per-browser projection
  // record and the persisted canvas cursor only move past them once a save succeeds: a node recorded as projected is
  // never rebuilt (that record is how a deletion is remembered), so recording it before the save landed lost the node
  // for good when the save failed, while its task kept running (Codex 2026-10-19).
  const unsaved = useRef<{ project: string; ids: Set<string>; fromSeq?: number }>({ project: projectId, ids: new Set() });
  const unsavedFor = (project: string) => {
    if (unsaved.current.project !== project) unsaved.current = { project, ids: new Set() };
    return unsaved.current;
  };
  // A cursor below unsaved commands is counted in the sending conversation's seqs; another conversation starts its own.
  const shownThreadId = store.thread?.id;
  useEffect(() => { unsaved.current.fromSeq = undefined; }, [shownThreadId]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const scheduleSave = useCallback(() => {
    const project = projectId;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (!same(project)) return;
      const batch = unsavedFor(project);
      unsaved.current = { project, ids: new Set() };
      void saveStudioDocument(project).then(() => {
        rememberProjectedNodes(project, [...batch.ids]);
        if (same(project)) session.dispatch({ type: "canvas.unsaved", fromSeq: unsavedFor(project).fromSeq });
      }).catch(e => {
        // Not saved: the batch waits for the next successful save, and the cursor stays below it.
        const pending = unsavedFor(project);
        batch.ids.forEach(id => pending.ids.add(id));
        if (batch.fromSeq !== undefined) pending.fromSeq = Math.min(pending.fromSeq ?? batch.fromSeq, batch.fromSeq);
        message.error(e);
      });
    }, 300);
  }, [projectId, message]);
  useEffect(() => () => clearTimeout(saveTimer.current), []);
  /** After a projection: what changed is recorded once saved; what was already on the canvas is recorded now. */
  const recordProjection = (project: string, result: { projected: string[]; changed: boolean }, fromSeq?: number) => {
    const pending = unsavedFor(project);
    if (!result.changed) { rememberProjectedNodes(project, result.projected.filter(id => !pending.ids.has(id))); return; }
    result.projected.forEach(id => pending.ids.add(id));
    if (fromSeq !== undefined) {
      pending.fromSeq = Math.min(pending.fromSeq ?? fromSeq, fromSeq);
      session.dispatch({ type: "canvas.unsaved", fromSeq: pending.fromSeq });
    }
  };
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
    recordProjection(projectId, result, ops[0].seq);
    session.dispatch({ type: "canvas.ack", seq: ops[ops.length - 1].seq });
    // The assistant's new nodes come into view (no selection change).
    if (result.created.length && !ops.every(op => op.restore)) dispatchStudioCommand("reveal", result.created.join(","));
  }, [store.canvasOps]);
  // The homepage brief fills the composer once the thread has been read and is still empty — it can arrive after the
  // panel opened (the assistant opens by default), and a refresh after it was sent must not put it back.
  // 「Empty」 means no message of this thread's own: history imported from the old assistant (legacyNodeId) does not
  // count. The server used to import the homepage brief itself as 「之前的对话「创作想法」」, so every canvas started
  // from the home page looked like it had already talked and the brief was never sent (Codex real-environment retest
  // 2026-10-19; the demo mode has no such import).
  const briefApplied = useRef<string | undefined>(undefined);
  const autoSent = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!open || session.status !== "ready" || briefApplied.current === projectId) return;
    const entry = [...live.current.nodes, ...live.current.conversations].find(n => n.id === initialNodeId);
    const brief = initialPrompt || (entry?.metadata?.studioStart === "assistant" ? entry.metadata?.prompt || "" : "");
    if (!brief.trim()) return;
    briefApplied.current = projectId;
    if (talked || store.outbox.length) return;
    setText(current => current.trim() ? current : brief);
    // 「照这条视频…」 needs the video first: the recreation card says what is missing, keeps the user's words and leaves
    // the send to them — never the auto-send, even when the canvas fills both slots by itself.
    if (studioBriefNeedsReference(brief)) {
      openStarter("recreation");
      if (autoSent.current !== projectId) { autoSent.current = projectId; if (autoSend) onAutoSent?.(); }
    }
    // A brief saved as a canvas node (older home page) is a visible, removable pin; one kept with the conversation is not on the canvas.
    if (entry && assistantContextNodes(live.current.nodes).some(n => n.id === entry.id)) setPinnedIds(ids => ids.includes(entry.id) ? ids : [...ids, entry.id].slice(0, MAX_REFERENCES));
  }, [open, session.status, projectId, initialNodeId, initialPrompt, talked, store.outbox.length]);
  // Dialogue-first start: the brief typed on the home page goes out by itself, exactly once, into an empty thread.
  useEffect(() => {
    if (!open || !autoSend || autoSent.current === projectId || session.status !== "ready" || sending) return;
    if (talked || store.outbox.length || !text.trim()) { if (talked) onAutoSent?.(); return; }
    autoSent.current = projectId;
    onAutoSent?.();
    void send();
  }, [open, autoSend, session.status, text, talked, store.outbox.length, sending]);

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
    recordProjection(project, applyCanvasOps(ops));
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
        message.success("已采用这一版");
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
    if (current !== block.snapshot) throw new Error("你改过这段内容，没有覆盖");
    const node = assistantReplacementNode(target, block.field, block.content);
    setNodes(list => markStudioDescendants(list, target.id).map(n => n.id === target.id ? node : n));
    await saveStudioDocument(projectId);
    message.success(block.field === "prompt" ? "已更新节点提示词" : "已更新节点内容");
  };
  const approve = async (block: DialogueApprovalBlock, caps: { budgetCap: number; autoFixCap: number }, messageId: string) => {
    // The execution reads canvas references from the saved document. The save runs inside the session's confirmation guard,
    // so no conversation switch starts between it and the execution's answer (and none on its way lets this start).
    try { await session.approve(block, caps, messageId, () => saveStudioDocument(projectId)); }
    catch (e) {
      if (e instanceof ApiError && e.code === "STUDIO_PLAN_STALE") throw Object.assign(new Error("方案已更新，请看最新的报价"), { code: e.code, logId: e.logId });
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
  /** 「放进画布」 on a reply: a plain text node holding the reply; one already holding the same text is shown instead. */
  const placeText = async (reply: StudioDialogueMessage) => {
    const content = splitReplyActions(reply.text || "").prose.trim();
    if (!content) return;
    const title = studioTitleFromBrief(content.replace(/^[#>*\-\s]+/gm, "")) || "助手写的文字";
    const node = attachmentNode({ kind: "text", content, title }, live.current.nodes);
    const created = !live.current.nodes.some(n => n.id === node.id);
    if (created) {
      setNodes(list => list.some(n => n.id === node.id) ? list : [...list, placeStudioNode(node, list)]);
      await saveStudioDocument(projectId);
    }
    dispatchStudioCommand("reveal", node.id);
    message.success(created ? "已放进画布" : "画布上已经有这段文字");
  };
  const handlers: DialogueMessageHandlers = {
    onCompose: compose, onQuickReply: value => void send(value), quickReplyBusy: sending || session.status !== "ready",
    onRevise: () => composer.current?.focus(), onApprove: approve, onAdopt: adopt, onPlaceText: placeText,
    planReady: block => !!planForApproval(store, block), onBranch: session.branch, approvedCaps: block => approvedCaps(block, session.executions),
    verifyingApprovalId: session.verifying, onRecheck: session.recheck,
    skillLabel: plan => studioSkillBadge(skills, plan), completionActions: operator ? completionActions : undefined,
  };

  // ── Old four-mode conversations (read-only history with adoption) ──────────
  const legacyGroups: LegacyGroup[] = useMemo(() => {
    const server = dialogueSections(store).legacy;
    const ids = [...new Set([...conversations.map(c => c.id), ...server.map(m => m.legacyNodeId!)])];
    // A brief saved by the home page is a conversation stub with no turns, not a past conversation.
    return ids.filter(id => server.some(m => m.legacyNodeId === id) || conversations.find(c => c.id === id)?.metadata?.studio?.conversation?.turns?.length)
      .map(id => ({ id, node: conversations.find(c => c.id === id), messages: server.filter(m => m.legacyNodeId === id) }));
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

  // ── Starts: the opening cards and their fill-in cards (docs/ip-studio-new-canvas-and-threads.md §5) ─────────
  /** Opens a fill-in card. What the composer already holds stays (a typed draft, the home page brief); an empty composer gets the card's sentence. */
  const openStarter = (key: StarterKey) => {
    const config = studioStarter(key);
    // A required slot the canvas can fill in exactly one way is filled (the one video, the one photo); an optional one
    // is not, it would change what gets made.
    for (const slot of starterSlots(config)) {
      if (!slot.min || referenced.some(n => n.type === slot.type)) continue;
      const fit = contextNodes.filter(n => n.type === slot.type);
      if (fit.length === 1 && pin(fit[0])) starterHeld.current.add(fit[0].id);
    }
    // The card names its skill (the header label shows it; the message carries it), not the keywords of its sentence.
    chooseSkill(config.skill);
    starterWritten.current = undefined;
    setStarter({ key, options: starterDefaults(config), fields: {} }); setGuideOpen(false);
  };
  /**
   * 「换一个」: back to the four cards, as before the card. Its sentence, its skill and the material it picked leave the
   * message (an upload stays on the canvas, ready to be picked again); words the user wrote stay.
   */
  const leaveStarter = () => {
    const current = draft.current.text, held = starterHeld.current;
    if (current === starterWritten.current || isMentionResidue(current, starterWritten.current)) setText("");
    if (starter && skillKey === studioStarter(starter.key).skill) setSkillKey(undefined);
    setPinnedIds(ids => ids.filter(id => !held.has(id))); setAttachmentIds(ids => ids.filter(id => !held.has(id)));
    starterHeld.current = new Set(); starterWritten.current = undefined;
    setStarter(undefined);
  };
  const rewriteStarter = () => {
    if (starterText === undefined) return;
    starterWritten.current = starterText; setText(starterText);
    composer.current?.focus();
  };
  const unreference = (node: CanvasNodeData) => { setPinnedIds(ids => ids.filter(id => id !== node.id)); setAttachmentIds(ids => ids.filter(id => id !== node.id)); };
  const startWith = (value: string) => { setStarter(undefined); setText(value); composer.current?.focus(); };
  const pinType = (type: CanvasNodeData["type"]) => { for (const node of contextNodes.filter(n => n.type === type)) if (!pin(node)) break; };

  // ── 「新对话」 / 「历史对话」 (docs/ip-studio-new-canvas-and-threads.md §3.3) ──────────
  // What is being written stays: the text, its references and attachments, the model. What belonged to the conversation
  // that was left goes: a skill a card picked is dropped, the fill-in card and the guide close, its notices clear. An
  // empty conversation shows the opening cards again. Switching never sends anything: the home page brief and its
  // auto-send belong to the first open of the canvas only.
  const switchThread = async (run: () => Promise<boolean>) => {
    try {
      const switched = await run();
      if (!switched || !mounted.current) return switched;
      setSkillKey(undefined); setSkillChoices(undefined); setSkillNotice(""); setStarter(undefined); setGuideOpen(false); setCanvasNotice(""); setComposerError("");
      starterHeld.current.clear(); starterWritten.current = undefined;
      briefApplied.current = projectId;
      if (autoSent.current !== projectId) { autoSent.current = projectId; onAutoSent?.(); }
      requestAnimationFrame(() => composer.current?.focus());
      return true;
    } catch (e) { message.error(e); return false; }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  const { current } = dialogueSections(store);
  const empty = !current.length && !store.outbox.length;
  // The canvas gets its nodes from this conversation's events: no new one and no switch while it is still going.
  const threadBusyReason = session.status === "idle" || session.status === "loading" ? "对话还在加载，请稍等" : session.switching ? "正在切换对话，请稍等"
    : session.verifying ? DIALOGUE_VERIFYING : sending || session.confirming || dialogueThreadBusy(store) ? DIALOGUE_THREAD_BUSY : "";
  const threadActions = <StudioDialogueThreads currentThreadId={store.thread?.id} busyReason={threadBusyReason} empty={empty} listThreads={session.listThreads}
    onNew={() => switchThread(session.newThread)} onOpen={threadId => switchThread(() => session.openThread(threadId))}/>;
  const execution = store.execution && (executionActive(store.execution) || store.execution.threadId === store.thread?.id) ? store.execution : undefined;
  const checks = Object.values(store.checks);
  const streamNote = session.stream === "reconnecting" ? "连接中断，正在重连" : session.stream === "polling" ? "实时更新暂时不可用，每隔几秒刷新一次" : "";
  const modeSkill = boundSkill || chosenSkill;
  // The skills offered after a 400 STUDIO_SKILL_REQUIRED: the ones the server named, else every skill on the shelf.
  const skillReplies = skillChoices?.length ? skillChoices : skillOptions;
  const inventory = (["video", "image", "audio", "text"] as const).map(type => ({ type, nodes: contextNodes.filter(n => n.type === type) })).filter(entry => entry.nodes.length);
  const typeLabel = { video: "条视频", image: "张图片", audio: "段音频", text: "段文字" } as const;
  // With nodes referenced the cards work on them (unchanged by §5); without, the four fill-in cards.
  type StarterCard = { title: string; detail: string; Icon: typeof Video; tone: "video" | "image" | "text" | "flow"; run: () => void };
  const referenceStarters: StarterCard[] | undefined = pinnedIds.length > 1 ? [
    { title: "整理所选内容", detail: "汇总成一份可用的文字", Icon: FileText, tone: "text", run: () => startWith("整理这些节点的内容，汇总成一份可以直接用的文字。") },
    { title: "统一视觉风格", detail: "按所选素材出一张新图", Icon: Image, tone: "image", run: () => startWith("参考所选素材，出一张风格统一的新图。") },
    { title: "规划场景视频", detail: "保留人物和场景，规划一条视频", Icon: Video, tone: "video", run: () => startWith("参考所选素材，规划一条场景视频，保留人物和场景。") },
    { title: "串成创作流程", detail: "从这些节点往下搭", Icon: Workflow, tone: "flow", run: () => startWith("从这些节点往下，规划接下来要做的文字、图片和视频。") },
  ] : pinnedIds.length ? [
    { title: "修改节点内容", detail: "改写所选内容，保留核心设定", Icon: PenLine, tone: "text", run: () => startWith("改写所选节点的内容，保留核心设定，给我一版完整的修改稿。") },
    { title: "优化节点提示词", detail: "只改提示词，不重新生成", Icon: Image, tone: "image", run: () => startWith("优化所选节点的提示词，保留主体和核心设定，只给新提示词，不重新生成。") },
    { title: "复刻一条短视频", detail: "照参考视频的节奏，换成你的商品", Icon: Video, tone: "video", run: () => openStarter("recreation") },
    { title: "搭一套创作流程", detail: "从设定图一路做到视频", Icon: Workflow, tone: "flow", run: () => startWith("帮我把整套流程串起来：先写人物设定，再出三视图和细节图，最后做成场景视频。") },
  ] : undefined;
  // Three steps and one line about the current skill (§4.3); how credits, caps and attachments work is not explained here.
  const guide = <section id="studio-assistant-guide" className="studio-assistant-guide" aria-label="使用说明">
    <ol>
      <li><span><strong>说想法</strong>一句话说清要做什么，用 @ 引用画布上的素材。</span></li>
      <li><span><strong>看方案</strong>我列出要生成的内容和要花的积分，等你确认。</span></li>
      <li><span><strong>开始做</strong>结果一步步放进画布，中途随时可以插话或停下。</span></li>
    </ol>
    <p className="studio-helper-note">{modeSkill ? `${modeSkill.name}：${firstSentence(modeSkill.summary)}` : "全能创作：按你说的话和素材自动选择做法。"}</p>
  </section>;
  // 设计稿 Main 画板的头部：四角星标、标题、当前技能（紫色小胶囊），右边只有停靠和关闭。使用说明不再单占一个「?」：
  // 点这个技能胶囊展开（它本来就在说「这段对话怎么做」）。2026-10-21 起输入框下不再有技能和模型胶囊，当前做法只在这里。
  const titleExtra = <>
    <button type="button" className={`studio-assistant-mode${modeSkill ? " is-skill" : ""}`} aria-expanded={guideOpen} aria-controls="studio-assistant-guide"
      title={modeLabelTitle(modeSkill?.name)} onClick={() => setGuideOpen(v => !v)}>{modeSkill ? modeSkill.name : "全能创作"}</button>
    {demo && <em className="studio-dialogue-mock" title="演示数据，不是模型生成，也不扣积分">演示</em>}
  </>;
  // The real queue position of a step's task (the node's own queue ticket), never an estimate.
  const stepQueue = (step: StudioPlanExecutionStep) => {
    if (!execution) return undefined;
    const task = nodes.find(n => n.id === stepNodeId(execution, step))?.metadata?.studio?.task;
    return studioTaskQueued(task) && task?.queue && task.queue.position > 0 ? task.queue.position : undefined;
  };
  const subheader = streamNote || execution ? <>
    {streamNote && <div className="studio-assistant-status" role="status">{streamNote}</div>}
    {execution && <StudioDialogueExecution execution={execution} budget={executionBudget(store)} checks={checks} notice={canvasNotice} onControl={session.controlExecution} queueOf={stepQueue}/>}
  </> : undefined;
  return <StudioFloatingPanel title="创作助手" titleIcon={<span className="studio-assistant-mark" aria-hidden="true"><AiMark size={14}/></span>} titleExtra={titleExtra} actions={threadActions} subheader={subheader} className="studio-assistant-panel" open={open} onClose={onClose}
    width={480} utility dockable defaultDocked resizable layoutKey="assistant" footer={<>
      {skillNotice && <div className="studio-dialogue-skill-choice" role="group" aria-label="选一种做法">
        <p className="studio-dialogue-note" role="status">{skillNotice}</p>
        {!!skillReplies.length && <div className="studio-dialogue-suggestions">{skillReplies.map(s => <button key={s.key} type="button" title={s.summary || undefined}
          disabled={sending || !!sendDisabledReason} onClick={() => { chooseSkill(s.key); void send(undefined, s.key); }}><span>{s.name}</span></button>)}</div>}
      </div>}
      <StudioDialogueComposer ref={composer} projectId={projectId} text={text} onText={setText} contextNodes={contextNodes} pinnedIds={pinnedIds} attachmentIds={attachmentIds}
        onPin={pin} onUnpin={id => setPinnedIds(ids => ids.filter(value => value !== id))} onRemoveAttachment={id => setAttachmentIds(ids => ids.filter(value => value !== id))}
        onFiles={files => void addAttachments(files).catch(() => {})} onAssets={addAttachments} reading={reading} attachmentsUnsaved={attachmentsUnsaved} onRetrySave={() => void retryAttachmentSave()}
        sendDisabledReason={sendDisabledReason} sending={sending} onSend={() => void send()} canStop={!!store.activeTurnId} stopping={stopping} onStop={() => void stop()} demo={demo}
        compact={!empty} placeholder={empty ? undefined : "想改哪里，直接说"}/>
      {(composerError || missing.length > 0) && <p className="studio-assistant-error" role="alert"><span>{missing.length ? "部分引用已从画布删除，请移除后重新选择" : composerError}</span> <StudioErrorNotice error={missing.length ? "部分引用已从画布删除，请移除后重新选择" : composerError} autoReport={false} label="查看详情"/></p>}
    </>}>
    <div className="studio-assistant studio-dialogue">
      {guideOpen && guide}
      {!execution && canvasNotice && <p className="studio-dialogue-warning" role="status">{canvasNotice}</p>}
      {session.status === "loading" && <p className="studio-dialogue-note" role="status">正在读取这张画布的对话</p>}
      {session.status === "error" && <div className="studio-assistant-pending" role="alert"><p>对话没有读取成功。</p><StudioErrorNotice error={session.loadError} autoReport={false}/><Button onClick={() => void session.reload()}>重新读取</Button></div>}
      {empty && session.status !== "error" && !starter && <div className="studio-assistant-welcome">
        <h3 className="w-full max-w-full">想做点什么？</h3>
        {!!pinnedIds.length && <p>已选 {pinnedIds.length} 个节点</p>}
        {!!inventory.length && <div className="studio-assistant-inventory"><span>画布上有</span><div>
          {inventory.map(({ type, nodes: list }) => <button key={type} type="button" aria-pressed={list.every(n => pinnedIds.includes(n.id))} title={`在这条消息里引用这 ${list.length} ${typeLabel[type]}`} onClick={() => pinType(type)}>{list.length} {typeLabel[type]}</button>)}
        </div></div>}
        {referenceStarters ? <div className="studio-assistant-starters">{referenceStarters.map(({ title, detail, Icon, tone, run }) => <button key={title} type="button" data-tone={tone} onClick={run}>
          <span className="studio-assistant-starter-icon"><Icon size={20} aria-hidden="true"/></span>
          <span className="studio-assistant-starter-body"><strong>{title}</strong><span>{detail}</span></span>
          <ChevronRight size={16} aria-hidden="true"/></button>)}</div> : <StudioAssistantStarterCards onPick={openStarter}/>}
      </div>}
      {starter && starterConfig && <StudioAssistantStarterForm config={starterConfig} slots={starterNodes} options={starter.options} fields={starter.fields}
        edited={starterEdited && !sending && !store.outbox.length} onBack={leaveStarter} onRewrite={rewriteStarter}
        onOption={(id, value) => setStarter(current => current && { ...current, options: { ...current.options, [id]: value } })}
        onField={(id, value) => setStarter(current => current && { ...current, fields: { ...current.fields, [id]: value } })}
        onPick={() => composer.current?.mention()} onUpload={() => composer.current?.attach()} onRemove={unreference} onSubmit={() => void send()}/>}
      {!!legacyGroups.length && <details className="studio-dialogue-legacy" open={legacyOpen} onToggle={e => setLegacyOpen(e.currentTarget.open)}>
        <summary>之前的对话（{legacyGroups.length} 段）</summary>
        {legacyGroups.map(group => <StudioDialogueLegacy key={group.id} group={group} projectId={projectId} nodes={nodes} selectedIds={selectedIds} recovering={recovering === group.id}
          onEditStep={editLegacyStep} onApplyStep={applyLegacyStep} onRecover={id => void recoverLegacy(id)} onCompose={compose}/>)}
      </details>}
      {/* Keyed by conversation: its scroll-follow state and the branch note's loaded messages belong to one thread. */}
      <StudioDialogueTimeline key={store.thread?.id || "loading"} store={store} nodes={nodes} handlers={handlers} onRetry={id => void session.retry(id)} onLoadOlder={session.loadOlder} readThread={session.readThread}
        progress={execution && <StudioDialogueSteps execution={execution} queueOf={stepQueue}
          locate={step => { const id = stepNodeId(execution, step); return live.current.nodes.some(n => n.id === id) ? id : undefined; }}/>}/>
    </div>
  </StudioFloatingPanel>;
}
