"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AI 导演台 · 全能创作助手（docs/ai-director-assistant.md）。
// 一部作品一份连续对话，剧本 / 资产 / 分镜三处共用；每条消息绑定发送时的对象，建议只作用于那个对象。
// 建议先看、可对比，用户点「采用」才写入（服务端写入前核对原文，之后改过的不覆盖），采用后可撤销。
// 采用文字永远不触发收费的出图；「生成新版本」是单独的按钮，先说清范围和费用。
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowUp, Check, ChevronRight, History, Loader2, MessageSquarePlus, Sparkles, Undo2, X } from "lucide-react";
import type { DirectorAssistantMessage, DirectorAssistantScope, DirectorAssistantThread, DirectorProposal, DirectorWork } from "@ai-star-eco/types";
import type { EnterpriseBillingSelection } from "@ai-star-eco/types/enterprise";
import { ApiError } from "@ai-star-eco/api-client";
import { SelectField } from "@ai-star-eco/ui/ui/select-field";
import { formatDateTime } from "@/lib/datetime";
import { DirectorApi } from "../api";
import { useStudioApp } from "../studio-errors";
import { chooseDirectorBilling, costText, errorText, hasDrafts, newRequestId, peekDraft, runningTask, saveDrafts, useDraft } from "./director-shared";
import { diffText, shotChanges } from "./director-text";
import { clearPending, deliver, readPending, UncertainError, uncertain, writePending } from "./director-pending";
import type { PendingRequest } from "./director-pending";
import type { DiffPart } from "./director-text";

export type AssistantTab = "script" | "assets" | "storyboard";

type Reveal = { type: "asset" | "board"; id: string; nonce: number };

export interface AssistantApi {
  scriptLocked: (target: string) => boolean;
  setSubmittingScope: (scope: DirectorAssistantScope | null) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  /** 下一条消息针对的对象：入口点过来的，或者当前工作区的默认对象。 */
  scope: DirectorAssistantScope;
  explicit: boolean;
  /** 从内容旁的入口打开助手：带上对象，可预填一句话，光标放进输入框。 */
  ask: (scope: DirectorAssistantScope, draft?: string) => void;
  setScope: (scope: DirectorAssistantScope | null) => void;
  /** 正在剧本里预览的那条建议。 */
  preview: { messageId: string; proposalId: string } | null;
  setPreview: (p: { messageId: string; proposalId: string } | null) => void;
  /** 在剧本里预览一条剧本建议：切到剧本页、那一集，正文处显示原文和建议的对比。 */
  startPreview: (messageId: string, p: DirectorProposal) => void;
  /** 让资产页 / 分镜页打开某个资产详情或分镜图弹窗（比较新生成的版本）。 */
  reveal: Reveal | null;
  show: (type: Reveal["type"], id: string) => void;
  focusToken: number;
  draftPrefill: { text: string; nonce: number } | null;
  act: (messageId: string, p: DirectorProposal, op: "apply" | "dismiss" | "undo") => Promise<void>;
  /**
   * 发送前把这一轮涉及的、用户眼前还没保存的修改先存上（正文、镜头、提示词、资产），
   * 助手读到的就是用户看到的内容；选区按保存后的正文重新核对位置。返回可以发送的范围。
   */
  prepareScope: (scope: DirectorAssistantScope) => Promise<DirectorAssistantScope>;
  regenerate: (messageId: string, p: DirectorProposal) => Promise<void>;
  findProposal: (messageId: string, proposalId: string) => DirectorProposal | undefined;
}

const Ctx = createContext<AssistantApi | null>(null);
export const AssistantProvider = ({ value, children }: { value: AssistantApi; children: ReactNode }) => <Ctx.Provider value={value}>{children}</Ctx.Provider>;
/** 没在工作台里（单测里单独渲染组件）时返回 null，入口按钮就不显示。 */
export function useAssistant() { return useContext(Ctx); }

const OPEN_KEY = "director-assistant:open";
const EMPTY_WORK = { id: "", draft: "", episodes: [], assistant: null } as unknown as DirectorWork;

function defaultScope(work: DirectorWork, tab: AssistantTab, episodeId: string | null): DirectorAssistantScope {
  if (tab === "storyboard" && episodeId) return { kind: "storyboard", episodeId };
  if (tab === "assets") return { kind: "work" };
  if (work.episodes.length) return { kind: "script", episodeId: episodeId ?? work.episodes[0].id };
  return { kind: "script", episodeId: work.draft.trim() ? "draft" : null };
}


export function useAssistantController({ work: maybeWork, apply, tab, episodeId, goTab, pickEpisode }: {
  /** 作品还没加载时也要调用（hook 不能放在条件后面），这时返回的对象不会被用到。 */
  work: DirectorWork | undefined; apply: (w: DirectorWork) => void; tab: AssistantTab; episodeId: string | null;
  goTab: (t: AssistantTab) => void; pickEpisode: (id: string) => void;
}): AssistantApi {
  const { modal } = useStudioApp();
  const [open, setOpenState] = useState(false);
  useEffect(() => {
    // 桌面默认打开，用户关过就记住；手机端默认关，点按钮全屏打开。
    let saved: string | null = null;
    try { saved = window.localStorage.getItem(OPEN_KEY); } catch { /* 存储不可用就按默认 */ }
    // 手机上它是全屏的，进页面不自动打开，只在点了按钮或内容旁的入口时打开。
    const desktop = document.documentElement.dataset.layout === "desktop";
    setOpenState(desktop && (saved ? saved === "1" : window.innerWidth >= 1280));
  }, []);
  const setOpen = useCallback((v: boolean) => {
    setOpenState(v);
    try { window.localStorage.setItem(OPEN_KEY, v ? "1" : "0"); } catch { /* 忽略 */ }
  }, []);
  const [explicitScope, setExplicit] = useState<DirectorAssistantScope | null>(null);
  // 换工作区就回到那个工作区的默认对象；对话本身不断。
  useEffect(() => { setExplicit(null); }, [tab]);
  const [preview, setPreview] = useState<{ messageId: string; proposalId: string } | null>(null);
  const [reveal, setReveal] = useState<Reveal | null>(null);
  const [focusToken, setFocusToken] = useState(0);
  const [draftPrefill, setPrefill] = useState<{ text: string; nonce: number } | null>(null);
  const work = maybeWork ?? EMPTY_WORK;
  const workRef = useRef(work);
  workRef.current = work;
  const [submittingScope, setSubmittingScope] = useState<DirectorAssistantScope | null>(null);
  const scriptLocked = useCallback((target: string) => {
    const matches = (s: DirectorAssistantScope | undefined | null) => !!s && (s.kind === "script" || s.kind === "selection") && s.episodeId === target;
    if (matches(submittingScope)) return true;
    const pending = readPending<{ options: { scope: DirectorAssistantScope } }>(`director-assistant:pending:${work.id}`);
    if (matches(pending?.body.options.scope)) return true;
    return work.assistant?.threads.some(t => t.messages.some(m => m.status === "pending" && matches(m.scope))) ?? false;
  }, [work, submittingScope]);

  const ask = useCallback((scope: DirectorAssistantScope, draft?: string) => {
    setExplicit(scope);
    setOpen(true);
    if (draft !== undefined) setPrefill({ text: draft, nonce: Date.now() });
    setFocusToken(n => n + 1);
  }, [setOpen]);

  const findProposal = useCallback((messageId: string, proposalId: string) => {
    for (const t of workRef.current.assistant?.threads ?? []) for (const m of t.messages)
      if (m.id === messageId) return m.proposals?.find(p => p.id === proposalId);
    return undefined;
  }, []);

  /** 采用前把这处没保存的修改先存上：剧本自动存；片段和资产有没保存的修改就先让用户处理，不替他决定。 */
  const saveLocalEdits = useCallback(async (p: DirectorProposal) => {
    const w = workRef.current;
    if (p.type.startsWith("script.") && p.target) {
      if (p.target === "draft") {
        const key = `${w.id}:draft`;
        const text = peekDraft<string>(key);
        if (text !== undefined) apply(await saveDrafts({ [key]: text }, () => DirectorApi.patchWork(w.id, { draft: text, draftRev: w.draftRev })));
        return;
      }
      const ep = w.episodes.find(e => e.id === p.target);
      const prefix = `${w.id}:ep:${p.target}:`;
      if (ep && hasDrafts(prefix)) {
        const saved = { [prefix + "title"]: peekDraft<string>(prefix + "title") ?? ep.title, [prefix + "summary"]: peekDraft<string>(prefix + "summary") ?? ep.summary,
          [prefix + "content"]: peekDraft<string>(prefix + "content") ?? ep.content };
        apply(await saveDrafts(saved, () => DirectorApi.edit(w.id, "episode.update", ep.id, ep.rev, { title: saved[prefix + "title"], summary: saved[prefix + "summary"], content: saved[prefix + "content"] })));
      }
      return;
    }
    if (p.clipId && hasDrafts(`${w.id}:clip:${p.clipId}:`)) throw new Error(`${p.targetLabel}有没保存的修改，请先保存或撤销，再采用助手的建议`);
    if (p.assetId && hasDrafts(`${w.id}:asset:${p.assetId}:`)) throw new Error(`${p.targetLabel}有没保存的修改，请先保存或撤销，再采用助手的建议`);
  }, [apply]);

  const prepareScope = useCallback(async (scope: DirectorAssistantScope) => {
    let w = workRef.current;
    const save = async (next: Promise<DirectorWork>) => { w = await next; apply(w); };
    const saveEpisode = async (target: string | null | undefined) => {
      if (!target) return;
      if (target === "draft") {
        const k = `${w.id}:draft`, text = peekDraft<string>(k);
        if (text !== undefined) await save(saveDrafts({ [k]: text }, () => DirectorApi.patchWork(w.id, { draft: text, draftRev: w.draftRev })));
        return;
      }
      const ep = w.episodes.find(e => e.id === target), prefix = `${w.id}:ep:${target}:`;
      if (ep && hasDrafts(prefix)) {
        const saved = { [prefix + "title"]: peekDraft<string>(prefix + "title") ?? ep.title, [prefix + "summary"]: peekDraft<string>(prefix + "summary") ?? ep.summary,
          [prefix + "content"]: peekDraft<string>(prefix + "content") ?? ep.content };
        await save(saveDrafts(saved, () => DirectorApi.edit(w.id, "episode.update", ep.id, ep.rev, { title: saved[prefix + "title"], summary: saved[prefix + "summary"], content: saved[prefix + "content"] })));
      }
    };
    const saveClip = async (clipId: string) => {
      const clip = w.clips.find(c => c.id === clipId);
      if (!clip) return;
      const pre = `${w.id}:clip:${clipId}:`;
      if (!hasDrafts(pre)) return;
      const data: Record<string, unknown> = {};
      const took: Record<string, unknown> = {};
      for (const k of ["prompt:board", "prompt:video", "edit:title", "edit:summary", "edit:assets", "edit:shots"]) { const v = peekDraft(pre + k); if (v !== undefined) took[pre + k] = v; }
      const board = peekDraft<string>(pre + "prompt:board"), video = peekDraft<string>(pre + "prompt:video");
      if (board !== undefined) data.boardPrompt = board;
      if (video !== undefined) data.videoPrompt = video;
      for (const f of ["title", "summary"] as const) { const v = peekDraft<string>(pre + "edit:" + f); if (v !== undefined) data[f] = v; }
      const assets = peekDraft<string[]>(pre + "edit:assets");
      if (assets !== undefined) data.assetIds = assets;
      const shots = peekDraft<Array<Record<string, unknown> & { durationText: string }>>(pre + "edit:shots");
      if (shots !== undefined) {
        if (shots.some(x => !(Number(x.durationText) > 0))) throw new Error(`片段 ${clip.order} 有镜头时长没填好，改好或撤销后再发送`);
        data.shots = shots.map(({ durationText, ...x }) => ({ ...x, durationSec: Number(durationText) }));
      }
      await save(saveDrafts(took, () => DirectorApi.edit(w.id, "clip.update", clip.id, clip.rev, data)));
    };
    const saveAsset = async (assetId: string) => {
      const a = w.assets.find(x => x.id === assetId), pre = `${w.id}:asset:${assetId}:`;
      if (!a || !hasDrafts(pre)) return;
      const data: Record<string, unknown> = { name: peekDraft<string>(pre + "name") ?? a.name, description: peekDraft<string>(pre + "description") ?? a.description };
      const prompt = peekDraft<string>(pre + "prompt");
      if (prompt !== undefined && prompt !== a.prompt) data.prompt = prompt;
      await save(saveDrafts({ [pre + "name"]: data.name, [pre + "description"]: data.description, ...(prompt !== undefined ? { [pre + "prompt"]: prompt } : {}) },
        () => DirectorApi.edit(w.id, "asset.update", a.id, a.rev, data)));
    };
    switch (scope.kind) {
      case "script": case "selection": await saveEpisode(scope.episodeId); break;
      case "storyboard":
        await saveEpisode(scope.episodeId);
        for (const c of w.clips.filter(c => c.episodeId === scope.episodeId)) await saveClip(c.id);
        break;
      case "clip": case "prompt":
        if (scope.clipId) { const ep = w.clips.find(c => c.id === scope.clipId)?.episodeId; await saveEpisode(ep); await saveClip(scope.clipId); }
        break;
      case "image":
        if (scope.which === "board" && scope.clipId) await saveClip(scope.clipId);
        else if (scope.assetId) await saveAsset(scope.assetId);
        break;
      case "asset": if (scope.assetId) await saveAsset(scope.assetId); break;
      default: break;
    }
    if (scope.kind !== "selection" || !scope.text) return scope;
    // 选区必须仍在原位置；改过就重选，不按同名文字重新定位。
    const content = scope.episodeId === "draft" ? w.draft : w.episodes.find(e => e.id === scope.episodeId)?.content ?? "";
    const start = scope.start ?? -1, end = scope.end ?? -1;
    if (start >= 0 && content.slice(start, end) === scope.text) return scope;
    throw new Error("选中的段落改过了，请在正文里重新选择要修改的地方");
  }, [apply]);

  const act = useCallback(async (messageId: string, p: DirectorProposal, op: "apply" | "dismiss" | "undo") => {
    if (op !== "dismiss" && p.type.startsWith("script.") && p.target && scriptLocked(p.target)) throw new Error("AI 正在处理这份正文，请等回复完成后再修改");
    if (op === "apply") await saveLocalEdits(p);
    apply(await DirectorApi.edit(workRef.current.id, `assistant.${op}`, null, null, { messageId, proposalId: p.id }));
    if (op !== "undo") setPreview(cur => cur?.messageId === messageId && cur.proposalId === p.id ? null : cur);
  }, [apply, saveLocalEdits, scriptLocked]);

  const regenerate = useCallback((messageId: string, p: DirectorProposal) => new Promise<void>((resolve, reject) => {
    const w = workRef.current;
    const board = p.type === "clip.prompt";
    const targetId = board ? p.clipId! : p.assetId!;
    const cost = w.pricing.image;
    modal.confirm({
      title: "按新提示词生成新版本？",
      content: <div className="director-batch-confirm">
        <p>{p.status === "open" ? "先采用这条文字修改，再" : ""}按修改后的提示词、以当前这张为参考生成一张新图。</p>
        <p className="director-muted">这不是局部精确修改，画面其他部分也可能有变化。原图保留，生成后可以对比再决定用哪张。</p>
        <p>{costText(cost, w.pricing.mock)}</p>
      </div>,
      okText: "生成新版本", cancelText: "取消",
      onCancel: () => resolve(),
      onOk: async () => {
        try {
          if (p.status === "open") await act(messageId, p, "apply");
          // 结果不确定时记着这一次（编号 + 正文），再点「生成新版本」按原请求恢复，不会多出一张、不会重复扣费。
          const pkey = `director-assistant:regen:${w.id}:${messageId}:${p.id}`;
          type RegenBody = { type: "board" | "asset-image"; targetId: string; clientRequestId: string; options: { baseOnCurrent: boolean }; billing?: EnterpriseBillingSelection; maxCost: number };
          let req = readPending<RegenBody>(pkey);
          if (!req) {
            const billing = await chooseDirectorBilling("image", cost);
            const id = newRequestId();
            req = { id, at: new Date().toISOString(), body: { type: board ? "board" : "asset-image", targetId, clientRequestId: id, options: { baseOnCurrent: true }, billing, maxCost: cost } };
            writePending(pkey, req);
          }
          const target = `${board ? "board" : "asset"}:${targetId}`;
          apply(await deliver(pkey, req, b => DirectorApi.runTask(w.id, b), async () => {
            const latest = await DirectorApi.getWork(w.id);
            return latest.tasks.some(t => t.target === target && t.status === "running") ? latest : null;
          }));
          resolve();
        } catch (e) { reject(e); }
      },
    });
  }), [act, apply, modal]);

  const show = useCallback((type: Reveal["type"], id: string) => {
    const w = workRef.current;
    if (type === "board") {
      const clip = w.clips.find(c => c.id === id);
      if (clip) pickEpisode(clip.episodeId);
      goTab("storyboard");
    } else goTab("assets");
    setReveal({ type, id, nonce: Date.now() });
  }, [goTab, pickEpisode]);

  const startPreview = useCallback((messageId: string, p: DirectorProposal) => {
    if (p.target && p.target !== "draft") pickEpisode(p.target);
    goTab("script");
    setPreview({ messageId, proposalId: p.id });
  }, [goTab, pickEpisode]);

  const scope = explicitScope ?? defaultScope(work, tab, episodeId);
  return useMemo(() => ({
    open, setOpen, scope, explicit: !!explicitScope, ask, setScope: setExplicit, preview, setPreview, startPreview, reveal, show, focusToken, draftPrefill, act, regenerate, findProposal, prepareScope, scriptLocked, setSubmittingScope,
  }), [open, setOpen, scope, explicitScope, ask, preview, startPreview, reveal, show, focusToken, draftPrefill, act, regenerate, findProposal, prepareScope, scriptLocked]);
}

// ── 对象说明 ────────────────────────────────────────────────────────────────

export function scopeLabel(work: DirectorWork, s: DirectorAssistantScope): string {
  const ep = s.episodeId && s.episodeId !== "draft" ? work.episodes.find(e => e.id === s.episodeId) : undefined;
  const clip = s.clipId ? work.clips.find(c => c.id === s.clipId) : undefined;
  const clipEp = clip ? work.episodes.find(e => e.id === clip.episodeId) : undefined;
  const clipBase = clip ? `${clipEp ? `第 ${clipEp.no} 集 · ` : ""}片段 ${clip.order}` : "片段";
  const asset = s.assetId ? work.assets.find(a => a.id === s.assetId) : undefined;
  const kind = asset ? { character: "角色", scene: "场景", prop: "道具" }[asset.kind] : "";
  switch (s.kind) {
    case "work": return "整部作品";
    case "script": return ep ? `第 ${ep.no} 集 · ${ep.title}` : s.episodeId === "draft" ? "剧本（未拆集）" : "创意与剧本";
    case "selection": return `${ep ? `第 ${ep.no} 集` : "剧本"} · 已选正文`;
    case "storyboard": return ep ? `第 ${ep.no} 集 · 全部片段` : "本集分镜";
    case "clip": return `${clipBase} · 镜头`;
    case "prompt": return `${clipBase} · ${s.which === "board" ? "分镜图提示词" : "视频提示词"}`;
    case "asset": return asset ? `${kind} · ${asset.name}` : "资产";
    case "image": return s.which === "board" ? `${clipBase} · 分镜图` : asset ? `${asset.name} · 参考图` : "参考图";
  }
}

/** 这一轮助手会读到哪些内容（与服务端组装的素材一致），让用户知道它知道什么。 */
function linkedText(work: DirectorWork, s: DirectorAssistantScope, canSee: boolean): string {
  const base = [work.outline ? "故事大纲" : "", work.assets.length ? "人物与资产设定" : ""].filter(Boolean);
  const join = (xs: string[]) => [...base, ...xs].join("、");
  switch (s.kind) {
    case "work": return join(["分集摘要"]);
    case "script": return join([work.episodes.length || work.draft.trim() ? "当前正文" : "创意"]);
    case "selection": return join(["本集正文", "选中的段落"]);
    case "storyboard": return join(["本集剧本", "本集全部片段的镜头和提示词"]);
    case "clip": return join(["本集剧本", "这个片段的镜头", "关联资产"]);
    case "prompt": return join(["这个片段的镜头", "当前提示词", "关联资产"]);
    case "asset": return join(["外观设定", "出图提示词", "出场集数"]);
    case "image": return join([canSee ? "当前这张图" : "这张图的提示词（当前模型不能看图）", "出图提示词"]);
  }
}

function sameScope(a: DirectorAssistantScope, b: DirectorAssistantScope) {
  return a.kind === b.kind && (a.episodeId ?? null) === (b.episodeId ?? null) && (a.clipId ?? null) === (b.clipId ?? null)
    && (a.assetId ?? null) === (b.assetId ?? null) && (a.which ?? null) === (b.which ?? null) && (a.text ?? null) === (b.text ?? null);
}

/** 输入框上的「范围」可选项：当前工作区里常用的几个对象。 */
function scopeOptions(work: DirectorWork, tab: AssistantTab, episodeId: string | null, current: DirectorAssistantScope): DirectorAssistantScope[] {
  const out: DirectorAssistantScope[] = [current];
  const add = (s: DirectorAssistantScope) => { if (!out.some(x => sameScope(x, s))) out.push(s); };
  if (tab === "script") add(defaultScope(work, "script", episodeId));
  if (tab === "storyboard" && episodeId) {
    add({ kind: "storyboard", episodeId });
    work.clips.filter(c => c.episodeId === episodeId).sort((a, b) => a.order - b.order).forEach(c => add({ kind: "clip", clipId: c.id }));
  }
  if (tab === "assets") work.assets.forEach(a => add({ kind: "asset", assetId: a.id }));
  add({ kind: "work" });
  return out;
}

function canSeeImages(work: DirectorWork) {
  const m = (work.textModels ?? []).find(x => work.settings.textModel ? x.endpointId === work.settings.textModel : x.isDefault);
  return !!m?.supportsVision && !work.pricing.mock;
}

// ── 面板 ────────────────────────────────────────────────────────────────────

export function DirectorAssistantPanel({ work, apply, tab, episodeId }: { work: DirectorWork; apply: (w: DirectorWork) => void; tab: AssistantTab; episodeId: string | null }) {
  const ctl = useAssistant()!;
  const store = work.assistant;
  const thread = store?.threads.find(t => t.id === store.current) ?? null;
  const replying = runningTask(work, "assistant");
  const [historyOpen, setHistoryOpen] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);
  const count = thread?.messages.length ?? 0;
  const lastStatus = thread?.messages[count - 1]?.status;
  // 新消息、回复回来时滚到底；用户往上翻历史时不打扰（只在条数或最后一条状态变化时滚）。
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    // 卡片里的对比、图片排版完再滚一次，停在最新一条的底部。
    const raf = window.requestAnimationFrame(() => { el.scrollTop = el.scrollHeight; });
    return () => window.cancelAnimationFrame(raf);
  }, [count, lastStatus, thread?.id]);

  const threadOp = async (op: "assistant.newThread" | "assistant.openThread", threadId?: string) => {
    try { apply(await DirectorApi.edit(work.id, op, null, null, threadId ? { threadId } : {})); setHistoryOpen(false); setError(""); }
    catch (e) { setError(errorText(e)); }
  };
  const canSee = canSeeImages(work);
  return <aside className="director-assistant" aria-label="全能创作助手">
    <header className="director-assistant-head">
      <Sparkles size={18} className="director-assistant-mark" aria-hidden/>
      <h3>全能创作助手</h3>
      <span className="director-spacer"/>
      <button type="button" className="director-assistant-tool" disabled={!!replying || !thread?.messages.length} onClick={() => void threadOp("assistant.newThread")}
        title={replying ? "回复完成后再开新对话" : "开一段新对话，之前的对话留在历史里"}><MessageSquarePlus size={15}/><span>新对话</span></button>
      <button type="button" className="director-assistant-tool is-icon" aria-label="历史对话" aria-expanded={historyOpen} disabled={!store?.threads.length} onClick={() => setHistoryOpen(v => !v)}><History size={15}/></button>
      <button type="button" className="director-assistant-tool is-icon" aria-label="收起助手" onClick={() => ctl.setOpen(false)}><X size={16}/></button>
      {historyOpen && store && <ThreadHistory threads={store.threads} current={store.current} disabled={!!replying} onPick={id => void threadOp("assistant.openThread", id)} onClose={() => setHistoryOpen(false)}/>}
    </header>
    <div className="director-assistant-context">
      <b>正在讨论：{scopeLabel(work, ctl.scope)}</b>
      <small>已关联：{linkedText(work, ctl.scope, canSee)}</small>
    </div>
    <div className="director-assistant-list" ref={listRef} aria-live="polite">
      {!thread?.messages.length ? <AssistantWelcome work={work} tab={tab}/> : thread.messages.map(m => <Message key={m.id} work={work} msg={m}/>)}
    </div>
    {error && <div className="director-assistant-error" role="alert">{error}<button type="button" onClick={() => setError("")}>关闭</button></div>}
    <Composer work={work} apply={apply} tab={tab} episodeId={episodeId} threadId={thread?.id ?? null} replying={!!replying}/>
  </aside>;
}

function ThreadHistory({ threads, current, disabled, onPick, onClose }: { threads: DirectorAssistantThread[]; current: string | null; disabled: boolean; onPick: (id: string) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return <div className="director-assistant-history" role="dialog" aria-label="历史对话">
    <h4>历史对话</h4>
    <ul>{threads.map(t => <li key={t.id}><button type="button" aria-current={t.id === current ? "true" : undefined} disabled={disabled || t.id === current} onClick={() => onPick(t.id)}>
      <b title={t.title || "新对话"}>{t.title || "新对话"}</b><small>{t.messages.length} 条 · {formatDateTime(t.updatedAt)}</small></button></li>)}</ul>
    {disabled && <p className="director-muted">回复完成后可以切换。</p>}
  </div>;
}

function AssistantWelcome({ work, tab }: { work: DirectorWork; tab: AssistantTab }) {
  const noScript = !work.draft.trim() && !work.episodes.length;
  const tips = noScript ? []
    : tab === "storyboard" ? ["这一段先给手部特写，再切人物反应", "别直接揭示秘密，留到下一段", "缩短对白，保留动作"]
      : tab === "assets" ? ["陈德茂更疲惫一点，但别显老", "保留长相，只换成冬天的衣服", "这个场景再旧一些"]
        : ["先看看这个开头，哪里不够吸引人？", "只改对白，其他别动", "续写下一场"];
  return <div className="director-assistant-welcome">
    <p>{noScript ? "写剧本前的问答在剧本页进行，也可以在那里直接生成。有了剧本以后，在这里继续评价、续写和局部修改。" : "选中正文、点镜头或图片旁的「AI」按钮，我就知道你要改哪里。讨论的时候我只给分析和方向，你说「改」我才给修改建议，采用前都能先对比。"}</p>
    {tips.length > 0 && <ul>{tips.map(t => <li key={t}>{t}</li>)}</ul>}
  </div>;
}

function Message({ work, msg }: { work: DirectorWork; msg: DirectorAssistantMessage }) {
  const ctl = useAssistant()!;
  const label = msg.scope.label || scopeLabel(work, msg.scope);
  if (msg.role === "user") return <div className="director-msg is-user">
    <p>{msg.text}</p>
    <span className="director-msg-scope" title={msg.scope.kind === "selection" && msg.scope.text ? msg.scope.text : label}>{label}</span>
  </div>;
  if (msg.status === "pending") {
    const task = work.tasks.find(t => t.id === msg.runId);
    return <div className="director-msg is-ai is-pending" role="status"><Loader2 size={14} className="ip-loading-icon"/><span>正在思考</span><Elapsed since={task?.createdAt}/></div>;
  }
  if (msg.status === "failed") return <div className="director-msg is-ai is-failed" role="alert">
    <p>{msg.error || "助手没有回复成功"}</p>
    <button type="button" className="ip-brand-text-button" onClick={() => {
      const thread = work.assistant?.threads.find(t => t.messages.some(m => m.id === msg.id));
      const i = thread?.messages.findIndex(m => m.id === msg.id) ?? -1;
      const prior = i > 0 ? thread!.messages[i - 1] : undefined;
      ctl.ask(msg.scope, prior?.role === "user" ? prior.text : "");
    }}>重新发送</button>
  </div>;
  return <div className="director-msg is-ai">
    <p>{msg.text}</p>
    {msg.visual === "prompt-only" && <small className="director-msg-note">当前文字模型不能看图，以上意见只根据这张图的提示词。</small>}
    {(msg.proposals ?? []).map(p => <ProposalCard key={p.id} work={work} msg={msg} p={p}/>)}
    {(msg.dropped ?? 0) > 0 && <small className="director-msg-note">另有 {msg.dropped} 条建议对不上原文或超出这次的修改范围，已略过。</small>}
  </div>;
}

function Elapsed({ since }: { since?: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(t); }, []);
  const start = since ? Date.parse(since) : NaN;
  if (!Number.isFinite(start)) return null;
  const sec = Math.max(0, Math.floor((now - start) / 1000));
  return <small>已用时 {Math.floor(sec / 60)}:{String(sec % 60).padStart(2, "0")}</small>;
}

// ── 建议卡片 ────────────────────────────────────────────────────────────────

/** 前后对比：删掉的划线标红、新加的标绿。没改的长段落默认折叠成前后几个字，改动一眼能找到；可以展开看全文。 */
export function Diff({ parts, className }: { parts: DiffPart[]; className?: string }) {
  const [full, setFull] = useState(false);
  const KEEP = 36;
  const foldable = parts.some(d => d.kind === "same" && d.text.length > KEEP * 2 + 10);
  return <div className={`director-diff ${className ?? ""}`}>
    <p>{parts.map((d, i) => {
      if (d.kind === "del") return <del key={i}>{d.text}</del>;
      if (d.kind === "add") return <ins key={i}>{d.text}</ins>;
      if (full || d.text.length <= KEEP * 2 + 10) return <span key={i}>{d.text}</span>;
      const head = i === 0 ? "" : d.text.slice(0, KEEP), tail = i === parts.length - 1 ? "" : d.text.slice(-KEEP);
      return <span key={i}>{head}<em className="director-diff-fold">…</em>{tail}</span>;
    })}</p>
    {foldable && <button type="button" className="director-diff-toggle" onClick={() => setFull(v => !v)}>{full ? "只看改动" : "展开全文"}</button>}
  </div>;
}

/** 采用后会连带影响什么：让用户事先知道，不偷偷重生成。 */
export function proposalImpacts(work: DirectorWork, p: DirectorProposal): string[] {
  const out: string[] = [];
  if (p.type.startsWith("script.") && p.target && p.target !== "draft" && work.clips.some(c => c.episodeId === p.target))
    out.push("本集已有分镜：采用后会提示分镜需要更新，不会自动重新生成。");
  const clip = p.clipId ? work.clips.find(c => c.id === p.clipId) : undefined;
  if (p.type === "clip.shots" && clip) {
    out.push(clip.boardPromptCustom ? "分镜图提示词是你改过的，不会跟着镜头变；需要的话让助手一起改。" : "分镜图提示词会按新镜头自动更新。");
    out.push(clip.videoPromptCustom ? "视频提示词是你改过的，不会跟着镜头变；需要的话让助手一起改。" : "视频提示词会按新镜头自动更新。");
    if (clip.board.adoptedId) out.push("已有的分镜图会标为「需更新」，不会自动重新生成。");
    if (clip.video.adoptedId) out.push("已有的片段视频会标为「需更新」，不会自动重新生成。");
  }
  if (p.type === "clip.prompt" && clip) {
    if (p.which === "board" && clip.board.adoptedId) out.push("已有的分镜图会标为「需更新」；要新图请点「生成新版本」。");
    if (p.which === "video" && clip.video.adoptedId) out.push("已有的片段视频会标为「需更新」，不会自动重新生成。");
    out.push("采用后这份提示词按「已自定义」保存，镜头再改时不会自动同步。");
  }
  const asset = p.assetId ? work.assets.find(a => a.id === p.assetId) : undefined;
  if (p.type === "asset.update" && asset) {
    if (p.description && !p.prompt && !asset.promptCustom) out.push("出图提示词会按新设定自动更新。");
    if ((p.description && !asset.promptCustom) || p.prompt) { if (asset.image.adoptedId) out.push("已有的参考图会标为「需更新」；要新图请点「生成新版本」。"); }
  }
  return out;
}

function ProposalCard({ work, msg, p }: { work: DirectorWork; msg: DirectorAssistantMessage; p: DirectorProposal }) {
  const ctl = useAssistant()!;
  const [busy, setBusy] = useState<string>();
  const [error, setLocalError] = useState("");
  const [showOriginal, setShowOriginal] = useState(false);
  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key); setLocalError("");
    try { await fn(); } catch (e) { setLocalError(e instanceof Error && !(e instanceof ApiError) ? e.message : errorText(e)); }
    finally { setBusy(undefined); }
  };
  const previewing = ctl.preview?.messageId === msg.id && ctl.preview.proposalId === p.id;
  const script = p.type === "script.replace";
  const targetEpisode = p.target && p.target !== "draft" ? work.episodes.find(e => e.id === p.target) : undefined;
  const genTarget = p.type === "clip.prompt" ? `board:${p.clipId}` : `asset:${p.assetId}`;
  const generating = p.regenerate ? runningTask(work, genTarget) : undefined;
  const impacts = p.status === "open" ? proposalImpacts(work, p) : [];
  const title = { "script.replace": "局部修改", "script.append": "续写", "script.draft": "剧本草稿", "idea.update": "整理后的创意", "clip.shots": "调整镜头",
    "clip.prompt": p.which === "board" ? "分镜图提示词" : "视频提示词", "asset.update": "外观与提示词" }[p.type];
  const canPreview = script && (!!targetEpisode || p.target === "draft");
  return <article className={`director-proposal is-${p.status}`}>
    <header><b>{p.targetLabel} · {title}</b>{p.note && <small title={p.note}>{p.note}</small>}</header>
    <div className="director-proposal-body">
      {p.type === "script.replace" && <>
        <p className="director-proposal-text">{p.replacement || "（删掉这段）"}</p>
        <button type="button" className="director-disclosure" aria-expanded={showOriginal} onClick={() => setShowOriginal(v => !v)}><ChevronRight size={13}/>对比原文</button>
        {showOriginal && <Diff parts={diffText(p.original ?? "", p.replacement ?? "")}/>}
      </>}
      {p.type === "script.append" && <p className="director-proposal-text is-add">{p.text}</p>}
      {p.type === "script.draft" && <>
        {(p.title || p.logline) && <p className="director-proposal-meta">{[p.title && `《${p.title}》`, p.logline].filter(Boolean).join(" ")}</p>}
        <p className="director-proposal-text is-clamp">{p.content}</p>
      </>}
      {p.type === "idea.update" && <Diff parts={diffText(work.idea, p.text ?? "")}/>}
      {p.type === "clip.shots" && <ShotDiff work={work} p={p}/>}
      {p.type === "clip.prompt" && <Diff className="is-prompt" parts={diffText(p.before?.text ?? "", p.text ?? "")}/>}
      {p.type === "asset.update" && <>
        {p.description && <div className="director-proposal-field"><span>外观与设定</span><Diff parts={diffText(p.before?.description ?? "", p.description)}/></div>}
        {p.prompt && <div className="director-proposal-field"><span>出图提示词</span><Diff className="is-prompt" parts={diffText(p.before?.prompt ?? "", p.prompt)}/></div>}
        {p.voiceDesc && <div className="director-proposal-field"><span>音色</span><Diff parts={diffText(p.before?.voiceDesc ?? "", p.voiceDesc)}/></div>}
      </>}
    </div>
    {impacts.length > 0 && <ul className="director-proposal-impacts">{impacts.map(t => <li key={t}>{t}</li>)}</ul>}
    {error && <p className="director-proposal-error" role="alert">{error}</p>}
    <footer>
      {p.status === "open" && <>
        {canPreview
          ? <button type="button" className={previewing ? "ip-brand-secondary" : "ip-brand-button"} disabled={!!busy} onClick={() => previewing ? ctl.setPreview(null) : ctl.startPreview(msg.id, p)}>{previewing ? "正在预览" : "预览修改"}</button>
          : <button type="button" className="ip-brand-button" disabled={!!busy} onClick={() => void run("apply", () => ctl.act(msg.id, p, "apply"))}>{busy === "apply" ? "采用中" : "采用"}</button>}
        {script && <button type="button" className="ip-brand-secondary" disabled={!!busy} onClick={() => void run("apply", () => ctl.act(msg.id, p, "apply"))}>直接采用</button>}
        {p.regenerate && <button type="button" className="ip-brand-secondary" disabled={!!busy || !!generating} onClick={() => void run("gen", () => ctl.regenerate(msg.id, p))}
          title="采用文字后，以当前这张为参考生成一张新图（另外计费）">采用并生成新版本</button>}
        <button type="button" className="ip-brand-text-button" disabled={!!busy} onClick={() => ctl.ask(msg.scope, "")}>继续调整</button>
        <span className="director-spacer"/>
        <button type="button" className="ip-brand-text-button" disabled={!!busy} onClick={() => void run("dismiss", () => ctl.act(msg.id, p, "dismiss"))}>不用了</button>
      </>}
      {p.status === "applied" && <>
        <span className="director-proposal-state is-done"><Check size={13}/>已采用</span>
        {p.regenerate && (generating ? <span className="director-proposal-state"><Loader2 size={13} className="ip-loading-icon"/>新版本生成中</span>
          : <button type="button" className="ip-brand-secondary" disabled={!!busy} onClick={() => void run("gen", () => ctl.regenerate(msg.id, p))}>生成新版本</button>)}
        {p.regenerate && !generating && <button type="button" className="ip-brand-text-button" onClick={() => ctl.show(p.type === "clip.prompt" ? "board" : "asset", p.type === "clip.prompt" ? p.clipId! : p.assetId!)}>查看版本</button>}
        <span className="director-spacer"/>
        {p.undoable && <button type="button" className="ip-brand-text-button" disabled={!!busy} onClick={() => void run("undo", () => ctl.act(msg.id, p, "undo"))}><Undo2 size={13}/>撤销</button>}
      </>}
      {p.status === "dismissed" && <span className="director-proposal-state">没有采用</span>}
    </footer>
  </article>;
}

function ShotDiff({ work, p }: { work: DirectorWork; p: DirectorProposal }) {
  const name = (id: string | null) => id ? work.assets.find(a => a.id === id)?.name ?? "未知角色" : "旁白";
  const lines = (d: { speakerId: string | null; text: string }[]) => d.map(l => `${name(l.speakerId)}：${l.text}`).join("\n");
  const changes = shotChanges(p.beforeShots ?? [], p.shots ?? []);
  const kept = changes.filter(c => c.kind === "same").length;
  return <div className="director-shot-diff">
    {changes.filter(c => c.kind !== "same").map((c, i) => <div key={i} className={`director-shot-diff-item is-${c.kind}`}>
      {c.kind === "removed" ? <><b>删掉原第 {c.beforeNo} 镜</b><p>{c.before.size} · {c.before.still}</p></> :
        c.kind === "added" ? <><b>新增第 {c.no} 镜 · {c.shot.durationSec} 秒 · {c.shot.size}</b><p>{c.shot.still}</p>{c.shot.action && <small>{c.shot.action}</small>}{c.shot.dialogue.length > 0 && <small>{lines(c.shot.dialogue)}</small>}</> :
          c.kind === "changed" ? <><b>第 {c.no} 镜 · 改了{c.fields.join("、")}</b>
            {c.fields.includes("景别") && <Diff parts={diffText(c.before.size, c.shot.size)}/>}
            {c.fields.includes("时长") && <Diff parts={diffText(`${c.before.durationSec} 秒`, `${c.shot.durationSec} 秒`)}/>}
            {c.fields.includes("分镜画面") && <Diff parts={diffText(c.before.still, c.shot.still)}/>}
            {c.fields.includes("动作") && <Diff parts={diffText(c.before.action, c.shot.action)}/>}
            {c.fields.includes("机位") && <Diff parts={diffText(c.before.camera, c.shot.camera)}/>}
            {c.fields.includes("台词") && <Diff parts={diffText(lines(c.before.dialogue), lines(c.shot.dialogue))}/>}</> : null}
    </div>)}
    <small className="director-muted">共 {p.shots?.length ?? 0} 镜，约 {Math.round((p.shots ?? []).reduce((n, s) => n + s.durationSec, 0) * 10) / 10} 秒{kept ? `，${kept} 镜不变` : ""}</small>
  </div>;
}

// ── 输入框 ──────────────────────────────────────────────────────────────────

function Composer({ work, apply, tab, episodeId, threadId, replying }: { work: DirectorWork; apply: (w: DirectorWork) => void; tab: AssistantTab; episodeId: string | null; threadId: string | null; replying: boolean }) {
  const ctl = useAssistant()!;
  const key = `${work.id}:assistant:draft`;
  const [text, setText] = useDraft(key, "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  // 一次发送（编号 + 完整正文，含发送时的范围和付款方）记在本浏览器：收起助手、刷新、切换范围后都按原请求恢复，
  // 服务端认出是同一条，不重复建任务、不重复扣费。明确被拒才作废。
  const pkey = `director-assistant:pending:${work.id}`;
  type Body = { type: "assistant"; clientRequestId: string; options: { message: string; scope: DirectorAssistantScope; threadId: string | null }; billing?: EnterpriseBillingSelection; maxCost: number };
  const [pending, setPending] = useState<PendingRequest<Body> | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (ctl.focusToken) input.current?.focus(); }, [ctl.focusToken]);
  useEffect(() => { if (ctl.draftPrefill) { setText(ctl.draftPrefill.text); input.current?.focus(); } }, [ctl.draftPrefill]); // eslint-disable-line react-hooks/exhaustive-deps
  const scope = ctl.scope;
  const options = scopeOptions(work, tab, episodeId, scope);
  const busy = sending || replying;
  // 发出去之后清输入框：只在框里还是发出去的那句时清；等回复期间用户又写了下一句，留着。
  const clearSent = (message: string) => {
    const cur = peekDraft<string>(key);
    if (cur === undefined || cur.trim() === message) setText("");
  };
  const received = (id: string) => async () => {
    const w = await DirectorApi.getWork(work.id);
    return w.assistant?.threads.some(t => t.messages.some(m => m.clientId === id)) ? w : null;
  };
  // 打开面板 / 刷新后：上次有没确认送达的消息，先问服务端收到没有。
  useEffect(() => {
    const p = readPending<Body>(pkey);
    if (!p) return;
    setPending(p);
    if (!text.trim()) setText(p.body.options.message);
    void received(p.id)().then(w => { if (w) { clearPending(pkey); setPending(null); apply(w); clearSent(p.body.options.message); } }).catch(() => {});
  }, [work.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const deliverIt = async (p: PendingRequest<Body>) => {
    ctl.setSubmittingScope(p.body.options.scope);
    setSending(true); setError("");
    try {
      apply(await deliver(pkey, p, b => DirectorApi.runTask(work.id, b), received(p.id)));
      setPending(null); clearSent(p.body.options.message);
    } catch (e) {
      if (!(e instanceof UncertainError)) setPending(null);
      setError(e instanceof ApiError ? errorText(e) : e instanceof Error ? e.message : String(e));
    } finally { setSending(false); ctl.setSubmittingScope(null); }
  };
  const send = async () => {
    const message = text.trim();
    if (!message || busy) return;
    const prior = readPending<Body>(pkey);
    if (prior) {
      // 同一句话：按原请求（原编号、原范围）恢复；改了内容就先处理掉那一条。
      if (prior.body.options.message === message) return void deliverIt(prior);
      setError("上一条消息还没确认是否送达，请先按原请求核对送达状态，再发新的消息。"); return;
    }
    ctl.setSubmittingScope(scope);
    setSending(true); setError("");
    let p: PendingRequest<Body>;
    try {
      const ready = await ctl.prepareScope(scope);
      const billing = await chooseDirectorBilling("script", work.pricing.textMax);
      const id = newRequestId();
      p = { id, at: new Date().toISOString(), body: { type: "assistant", clientRequestId: id, options: { message, scope: ready, threadId }, billing, maxCost: work.pricing.textMax } };
      writePending(pkey, p);
      setPending(p);
    } catch (e) {
      ctl.setSubmittingScope(null);
      setSending(false);
      setError(e instanceof ApiError ? errorText(e) : e instanceof Error ? e.message : String(e));
      return;
    }
    setSending(false);
    await deliverIt(p);
  };
  const label = scopeLabel(work, scope);
  return <div className="director-assistant-composer">
    <div className="director-assistant-scope">
      <span className="director-scope-chip" title={scope.kind === "selection" && scope.text ? scope.text : label}>
        <SelectField className="director-scope-select" aria-label="这条消息针对" value={String(Math.max(0, options.findIndex(o => sameScope(o, scope))))}
          onChange={e => ctl.setScope(options[Number(e.target.value)])}>
          {options.map((o, i) => <option key={i} value={String(i)}>{scopeLabel(work, o)}</option>)}
        </SelectField>
        {ctl.explicit && <button type="button" className="director-scope-clear" aria-label="换回当前页面的默认范围" onClick={() => ctl.setScope(null)}><X size={12}/></button>}
      </span>
      {scope.kind === "selection" && scope.text && <small className="director-scope-quote" title={scope.text}>「{scope.text.slice(0, 40)}{scope.text.length > 40 ? "…" : ""}」</small>}
    </div>
    <textarea ref={input} rows={3} maxLength={2000} aria-label="和助手说" placeholder={replying ? "助手正在回复，你可以继续改内容，回复完成后再发送" : "说说你的想法，或者要怎么改。Enter 发送，Shift+Enter 换行"}
      value={text} onChange={e => setText(e.target.value)}
      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}/>
    {error && <p className="director-assistant-send-error" role="alert">{error}</p>}
    {pending && !sending && error && <div className="director-assistant-pending" role="group" aria-label="没确认送达的消息">
      <small title={pending.body.options.message}>「{pending.body.options.message.slice(0, 30)}{pending.body.options.message.length > 30 ? "…" : ""}」· {scopeLabel(work, pending.body.options.scope)}</small>
      <button type="button" className="ip-brand-secondary" onClick={() => void deliverIt(pending)}>按原请求重新发送</button>
      {!["script", "selection"].includes(pending.body.options.scope.kind) && <button type="button" className="ip-brand-text-button" onClick={() => { clearPending(pkey); ctl.setSubmittingScope(null); setPending(null); setError(""); }}>不发了</button>}
    </div>}
    <footer>
      <small>{work.pricing.mock ? "测试模式，免费" : `按实际用量结算，每轮最多 ${work.pricing.textMax.toLocaleString("zh-CN")} 积分`}</small>
      <span className="director-spacer"/>
      <button type="button" className="director-assistant-send" aria-label="发送" disabled={busy || !text.trim()} onClick={() => void send()}
        title={replying ? "等这条回复完成" : "发送（Enter）"}>{sending ? <Loader2 size={16} className="ip-loading-icon"/> : <ArrowUp size={16}/>}</button>
    </footer>
  </div>;
}

/** 内容旁的入口：小按钮，点了带上对象打开助手。没在工作台里时不显示。 */
export function AskAI({ scope, label = "AI 修改", draft, className, title }: { scope: DirectorAssistantScope; label?: string; draft?: string; className?: string; title?: string }) {
  const ctl = useAssistant();
  if (!ctl) return null;
  return <button type="button" className={`director-ask-ai ${className ?? ""}`} title={title ?? "带上这个对象和助手讨论"} onClick={() => ctl.ask(scope, draft)}><Sparkles size={13}/>{label}</button>;
}

