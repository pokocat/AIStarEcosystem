"use client";

// ─────────────────────────────────────────────────────────────────────────────
// AI 导演台 · 全能创作助手（docs/ai-director-assistant.md）。
// 一部作品一份连续对话，剧本 / 资产 / 分镜三处共用；每条消息绑定发送时的对象，建议只作用于那个对象。
// 建议先看、可对比，用户点「采用」才写入（服务端写入前核对原文，之后改过的不覆盖），采用后可撤销。
// 采用文字永远不触发收费的出图；「生成新版本」是单独的按钮，先说清范围和费用。
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode, RefObject } from "react";
import { ArrowUp, Check, ChevronRight, History, Loader2, MessageSquarePlus, Move, PanelRightOpen, Undo2, X } from "lucide-react";
import { Tooltip } from "antd";
import { createPortal } from "react-dom";
import type { DirectorAssistantMessage, DirectorAssistantScope, DirectorAssistantThread, DirectorProposal, DirectorWork } from "@ai-star-eco/types";
import type { EnterpriseBillingSelection } from "@ai-star-eco/types/enterprise";
import { ApiError } from "@ai-star-eco/api-client";
import { SelectField } from "@ai-star-eco/ui/ui/select-field";
import { formatDateTime } from "@/lib/datetime";
import { DirectorApi } from "../api";
import { AiMark } from "../studio-ai-icon";
import { useStudioApp } from "../studio-errors";
import { adopted, chooseDirectorBilling, costText, errorText, hasDrafts, newRequestId, peekDraft, runningTask, saveDrafts, useDraft } from "./director-shared";
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
  /** 内容旁入口的浮层对话：同一时间只有一个，挂在点开它的那个入口上（key）。 */
  inline: InlineAsk | null;
  openInline: (key: string, scope: DirectorAssistantScope, opts?: { draft?: string; hint?: string }) => void;
  closeInline: () => void;
  /** 浮层里发出的消息编号：浮层只显示这几条和它们的回复，不显示之前的对话。 */
  noteSent: (clientId: string) => void;
  work: DirectorWork;
  apply: (w: DirectorWork) => void;
}

/**
 * 浮层对话（2026-10-29 用户：点内容旁的入口不要展开成侧边栏，也不要带着之前的对话记录）。
 * 消息照样进这部作品的连续对话（侧边栏历史里也看得到），浮层只显示这次打开以后发的那几条。
 */
export type InlineAsk = { key: string; scope: DirectorAssistantScope; draft?: string; hint?: string; sent: string[]; nonce: number };

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
  const [inline, setInline] = useState<InlineAsk | null>(null);
  // 换工作区就回到那个工作区的默认对象，浮层也关掉；对话本身不断。
  useEffect(() => { setExplicit(null); setInline(null); }, [tab]);
  const openInline = useCallback((key: string, scope: DirectorAssistantScope, opts?: { draft?: string; hint?: string }) => {
    setInline(cur => cur?.key === key && opts?.draft === undefined ? { ...cur, scope, nonce: Date.now() }
      : { key, scope, draft: opts?.draft, hint: opts?.hint, sent: [], nonce: Date.now() });
  }, []);
  const closeInline = useCallback(() => setInline(null), []);
  const noteSent = useCallback((id: string) => setInline(cur => cur && !cur.sent.includes(id) ? { ...cur, sent: [...cur.sent, id] } : cur), []);
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
        // 分镜图也带本集剧本（服务端照着剧本改提示词），所以先存本集正文没保存的修改，和改提示词的入口一样（2026-10-29 review P2）。
        if (scope.which === "board" && scope.clipId) { const ep = w.clips.find(c => c.id === scope.clipId)?.episodeId; await saveEpisode(ep); await saveClip(scope.clipId); }
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
      // 可能是从分镜图弹窗里的浮层对话点的，要盖住浮层（1010）。
      zIndex: 1100,
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
    inline, openInline, closeInline, noteSent, work, apply,
  }), [open, setOpen, scope, explicitScope, ask, preview, startPreview, reveal, show, focusToken, draftPrefill, act, regenerate, findProposal, prepareScope, scriptLocked, inline, openInline, closeInline, noteSent, work, apply]);
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
    case "image": return s.which === "board" ? `${clipBase} · 分镜图` : asset ? `${asset.name} · 资产图` : "资产图";
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
      <span className="director-assistant-mark" aria-hidden><AiMark size={14}/></span>
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

/** 「重新发送」「继续调整」去哪儿：侧边栏里是助手输入框，浮层里是浮层自己的输入框。 */
const FollowUp = createContext<((scope: DirectorAssistantScope, draft: string) => void) | null>(null);

function Message({ work, msg }: { work: DirectorWork; msg: DirectorAssistantMessage }) {
  const ctl = useAssistant()!;
  const followUp = useContext(FollowUp) ?? ctl.ask;
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
      followUp(msg.scope, prior?.role === "user" ? prior.text : "");
    }}>重新发送</button>
  </div>;
  return <div className="director-msg is-ai">
    <p>{msg.text}</p>
    {msg.visual === "prompt-only" && <small className="director-msg-note">当前文字模型不能看图，以上意见只根据这张图的提示词。</small>}
    {msg.range && <small className="director-msg-note">{msg.range}。</small>}
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
    if ((p.description && !asset.promptCustom) || p.prompt) { if (asset.image.adoptedId) out.push("已有的资产图会标为「需更新」；要新图请点「生成新版本」。"); }
  }
  return out;
}

function ProposalCard({ work, msg, p }: { work: DirectorWork; msg: DirectorAssistantMessage; p: DirectorProposal }) {
  const ctl = useAssistant()!;
  const followUp = useContext(FollowUp) ?? ctl.ask;
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
        <button type="button" className="ip-brand-text-button" disabled={!!busy} onClick={() => followUp(msg.scope, "")}>继续调整</button>
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

/**
 * 输入框旁的模型选择：侧边栏和浮层同一个。改的是这部作品的文本模型（和「作品设置」里的是同一项），
 * 写剧本、拆分集、写分镜也会跟着用它；可选范围、不可用的标法和作品设置一致。回复期间不能换。
 */
function AssistantModelPicker({ work, apply, disabled }: { work: DirectorWork; apply: (w: DirectorWork) => void; disabled?: boolean }) {
  const models = work.textModels ?? [];
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!models.length) return null;
  const value = work.settings.textModel ?? "";
  const fallback = models.find(m => m.isDefault);
  const current = models.find(m => value ? m.endpointId === value : m.isDefault);
  const tip = "这部作品的文本模型，和「作品设置」里的是同一项：写剧本、拆分集、写分镜也用它。";
  // 后台固定了模型：只显示是哪个，不给选。
  if (work.textModelMode === "fixed") return <span className="director-model-picker is-fixed" title={tip}>{current?.name ?? "默认模型"}</span>;
  const unavailable = !!value && !models.some(m => m.endpointId === value);
  return <span className="director-model-picker" title={error || tip}>
    <SelectField aria-label="对话模型" value={value} disabled={disabled || busy} className={error ? "is-error" : undefined}
      onChange={async e => {
        const next = e.target.value;
        setBusy(true); setError("");
        try { apply(await DirectorApi.patchWork(work.id, { settings: { textModel: next || null } })); }
        catch (err) { setError(`模型没有换成：${errorText(err)}`); }
        finally { setBusy(false); }
      }}>
      <option value="">默认{fallback ? `（${fallback.name}）` : ""}</option>
      {unavailable && <option value={value} disabled>原模型已不可用</option>}
      {models.map(m => <option key={m.endpointId} value={m.endpointId} disabled={!work.pricing.mock && !m.tokenPricing}>{m.name}{!work.pricing.mock && !m.tokenPricing ? " · 暂不可用" : ""}</option>)}
    </SelectField>
    {busy && <Loader2 size={12} className="ip-loading-icon" aria-label="正在切换模型"/>}
    {error && <small className="director-model-picker-error" role="alert">{error}</small>}
  </span>;
}

type SendBody = { type: "assistant"; clientRequestId: string; options: { message: string; scope: DirectorAssistantScope; threadId: string | null }; billing?: EnterpriseBillingSelection; maxCost: number };

/**
 * 发一条消息：侧边栏和浮层共用。一次发送（编号 + 完整正文，含发送时的范围和付款方）记在本浏览器：
 * 收起助手、关掉浮层、刷新、切换范围后都按原请求恢复，服务端认出是同一条，不重复建任务、不重复扣费。明确被拒才作废。
 */
function useAssistantSender(work: DirectorWork, apply: (w: DirectorWork) => void) {
  const ctl = useAssistant()!;
  const pkey = `director-assistant:pending:${work.id}`;
  const [pending, setPending] = useState<PendingRequest<SendBody> | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const received = (id: string) => async () => {
    const w = await DirectorApi.getWork(work.id);
    return w.assistant?.threads.some(t => t.messages.some(m => m.clientId === id)) ? w : null;
  };
  const show = (e: unknown) => setError(e instanceof ApiError ? errorText(e) : e instanceof Error ? e.message : String(e));
  const deliverIt = async (p: PendingRequest<SendBody>, done?: (message: string) => void) => {
    ctl.setSubmittingScope(p.body.options.scope);
    setSending(true); setError("");
    try {
      apply(await deliver(pkey, p, b => DirectorApi.runTask(work.id, b), received(p.id)));
      setPending(null); done?.(p.body.options.message);
    } catch (e) {
      if (!(e instanceof UncertainError)) setPending(null);
      show(e);
    } finally { setSending(false); ctl.setSubmittingScope(null); }
  };
  /** created：请求编号定下来时（还没送达）；done：送达以后。 */
  const send = async (message: string, scope: DirectorAssistantScope, threadId: string | null, hooks: { created?: (id: string) => void; done?: (message: string) => void } = {}) => {
    const prior = readPending<SendBody>(pkey);
    if (prior) {
      // 同一句话：按原请求（原编号、原范围）恢复；改了内容就先处理掉那一条。
      if (prior.body.options.message === message) { setPending(prior); hooks.created?.(prior.id); return void deliverIt(prior, hooks.done); }
      setPending(prior);
      setError("上一条消息还没确认是否送达，请先按原请求核对送达状态，再发新的消息。"); return;
    }
    ctl.setSubmittingScope(scope);
    setSending(true); setError("");
    let p: PendingRequest<SendBody>;
    try {
      const ready = await ctl.prepareScope(scope);
      const billing = await chooseDirectorBilling("script", work.pricing.textMax);
      const id = newRequestId();
      p = { id, at: new Date().toISOString(), body: { type: "assistant", clientRequestId: id, options: { message, scope: ready, threadId }, billing, maxCost: work.pricing.textMax } };
      writePending(pkey, p);
      setPending(p);
      hooks.created?.(id);
    } catch (e) {
      ctl.setSubmittingScope(null);
      setSending(false);
      show(e);
      return;
    }
    setSending(false);
    await deliverIt(p, hooks.done);
  };
  const discard = () => { clearPending(pkey); ctl.setSubmittingScope(null); setPending(null); setError(""); };
  return { pkey, pending, setPending, sending, error, setError, received, deliverIt, send, discard };
}

/** 没确认送达的那一条：按原请求重发，或者（不冻结正文的范围）放弃。 */
function PendingRetry({ work, sender, done }: { work: DirectorWork; sender: ReturnType<typeof useAssistantSender>; done?: (message: string) => void }) {
  const { pending } = sender;
  if (!pending || sender.sending || !sender.error) return null;
  const msg = pending.body.options.message;
  return <div className="director-assistant-pending" role="group" aria-label="没确认送达的消息">
    <small title={msg}>「{msg.slice(0, 30)}{msg.length > 30 ? "…" : ""}」· {scopeLabel(work, pending.body.options.scope)}</small>
    <button type="button" className="ip-brand-secondary" onClick={() => void sender.deliverIt(pending, done)}>按原请求重新发送</button>
    {!["script", "selection"].includes(pending.body.options.scope.kind) && <button type="button" className="ip-brand-text-button" onClick={sender.discard}>不发了</button>}
  </div>;
}

function Composer({ work, apply, tab, episodeId, threadId, replying }: { work: DirectorWork; apply: (w: DirectorWork) => void; tab: AssistantTab; episodeId: string | null; threadId: string | null; replying: boolean }) {
  const ctl = useAssistant()!;
  const key = `${work.id}:assistant:draft`;
  const [text, setText] = useDraft(key, "");
  const sender = useAssistantSender(work, apply);
  const { sending, error } = sender;
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
  // 打开面板 / 刷新后：上次有没确认送达的消息，先问服务端收到没有。
  useEffect(() => {
    const p = readPending<SendBody>(sender.pkey);
    if (!p) return;
    sender.setPending(p);
    if (!text.trim()) setText(p.body.options.message);
    void sender.received(p.id)().then(w => { if (w) { clearPending(sender.pkey); sender.setPending(null); apply(w); clearSent(p.body.options.message); } }).catch(() => {});
  }, [work.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const send = () => {
    const message = text.trim();
    if (!message || busy) return;
    void sender.send(message, scope, threadId, { done: clearSent });
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
      onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}/>
    {error && <p className="director-assistant-send-error" role="alert">{error}</p>}
    <PendingRetry work={work} sender={sender} done={clearSent}/>
    <footer>
      <AssistantModelPicker work={work} apply={apply} disabled={busy}/>
      <small>{work.pricing.mock ? "测试模式，免费" : `按实际用量结算，每轮最多 ${work.pricing.textMax.toLocaleString("zh-CN")} 积分`}</small>
      <span className="director-spacer"/>
      <button type="button" className="director-assistant-send" aria-label="发送" disabled={busy || !text.trim()} onClick={send}
        title={replying ? "等这条回复完成" : "发送（Enter）"}>{sending ? <Loader2 size={16} className="ip-loading-icon"/> : <ArrowUp size={16}/>}</button>
    </footer>
  </div>;
}

type AskAIProps = {
  /** 可以是函数：点下去那一刻才取（如正文的光标位置），不用每次移动光标都重画按钮。 */
  scope: DirectorAssistantScope | (() => DirectorAssistantScope);
  /** 讨论的是哪段内容，拼进悬停提示和读屏名称：「和助手讨论{what}」。 */
  what: string;
  /** 能帮着做什么，悬停时显示在第二行，浮层里没说话时也显示。 */
  hint?: string;
  draft?: string;
  className?: string;
  /** 浮层的编号。不给就按这个入口自动生成；别处（比如选中正文后的「问 AI」）要在同一个入口上打开浮层时显式给。 */
  inlineKey?: string;
  /** 转到侧边栏助手之后（比如关掉盖在助手上面的抽屉、弹窗）。浮层本身就在抽屉里打开，不用关。 */
  onAsked?: () => void;
};

/** 浮层里没说话时给的几句开头：点了填进输入框，不直接发（发送要扣积分）。 */
function quickAsks(s: DirectorAssistantScope): string[] {
  switch (s.kind) {
    case "selection": return ["润色这段，保留原意和人物口吻", "扩写这段，补上动作和细节", "这段更紧凑一些"];
    case "script": return ["这一集哪里不够吸引人？", "续写下一场", "对白更口语一些"];
    case "storyboard": return ["这一集的节奏怎么样？", "哪些镜头可以合并？"];
    case "clip": return ["节奏更紧凑一些", "加一个反应特写"];
    case "prompt": return ["动作和表情写得更具体", "精简一些，突出重点"];
    case "asset": return ["外观写得更具体，方便出图", "补全音色描述"];
    case "image": return s.which === "board" ? ["这张分镜图哪里和剧本对不上？", "提示词怎么改更好？"] : ["这张图哪里和设定不符？", "提示词怎么改更好？"];
    case "work": return ["整体节奏怎么样？"];
  }
}

/** 浮层里这次发出的一条：用户的话和紧跟着的助手回复（在哪段对话里都找）。 */
function exchangeOf(work: DirectorWork, clientId: string): { user: DirectorAssistantMessage; reply?: DirectorAssistantMessage } | null {
  for (const t of work.assistant?.threads ?? []) {
    const i = t.messages.findIndex(m => m.clientId === clientId);
    if (i >= 0) { const next = t.messages[i + 1]; return { user: t.messages[i], reply: next?.role === "assistant" ? next : undefined }; }
  }
  return null;
}

/**
 * 浮层顶部「正在看」：这一轮讨论的内容本身（用户眼前的版本，含没保存的修改），图片类直接放缩略图。
 * 只是给人看的预览，发送时服务端照常按范围读素材。
 */
function scopePreview(work: DirectorWork, s: DirectorAssistantScope): { label: string; text: string; image?: string | null } | null {
  const draft = (key: string, saved: string) => peekDraft<string>(`${work.id}:${key}`) ?? saved;
  const clip = s.clipId ? work.clips.find(c => c.id === s.clipId) : undefined;
  const asset = s.assetId ? work.assets.find(a => a.id === s.assetId) : undefined;
  const episodeText = (id: string | null | undefined) => id === "draft" ? draft("draft", work.draft)
    : (() => { const ep = work.episodes.find(e => e.id === id); return ep ? draft(`ep:${ep.id}:content`, ep.content) : ""; })();
  switch (s.kind) {
    case "selection": return s.text ? { label: "选中的正文", text: s.text } : null;
    case "script": {
      const text = episodeText(s.episodeId);
      if (!text.trim()) return work.idea ? { label: "创意", text: work.idea } : null;
      // 光标附近一段（长正文时助手也是读这附近）。
      const at = Math.min(Math.max(0, s.focusAt ?? 0), text.length);
      const from = Math.max(0, at - 120);
      return { label: s.focusAt ? "正文 · 光标附近" : "正文", text: (from > 0 ? "…" : "") + text.slice(from, from + 400) };
    }
    case "storyboard": {
      const clips = work.clips.filter(c => c.episodeId === s.episodeId).sort((a, b) => a.order - b.order);
      return clips.length ? { label: `本集 ${clips.length} 个片段`, text: clips.map(c => `片段 ${c.order}「${c.title}」${c.shots.length} 镜`).join("\n") } : null;
    }
    case "clip": return clip ? { label: `片段 ${clip.order} 的镜头`, text: clip.shots.map((x, i) => `${i + 1}. ${x.size} · ${x.durationSec} 秒 · ${x.still}`).join("\n") } : null;
    case "prompt": {
      if (!clip) return null;
      const board = s.which === "board";
      return { label: board ? "分镜图提示词" : "视频提示词", text: draft(`clip:${clip.id}:prompt:${board ? "board" : "video"}`, board ? clip.boardPrompt : clip.videoPrompt) };
    }
    case "asset": return asset ? { label: "外观设定", text: draft(`asset:${asset.id}:description`, asset.description), image: adopted(asset.image)?.url } : null;
    case "image":
      if (s.which === "board") return clip ? { label: "分镜图", text: clip.boardPrompt, image: adopted(clip.board)?.url } : null;
      return asset ? { label: "资产图", text: asset.description, image: adopted(asset.image)?.url } : null;
    case "work": return { label: "作品", text: work.logline || work.idea };
  }
}

function ScopePreview({ preview }: { preview: NonNullable<ReturnType<typeof scopePreview>> }) {
  const [open, setOpen] = useState(false);
  const long = preview.text.length > 160 || preview.text.split("\n").length > 3;
  return <section className={`director-inline-ask-context ${open ? "is-open" : ""}`} aria-label="正在看的内容">
    {preview.image && <img src={preview.image} alt=""/>}
    <div>
      <span>{preview.label}</span>
      {preview.text.trim() ? <p>{preview.text}</p> : <p className="is-empty">（还是空的）</p>}
      {long && <button type="button" onClick={() => setOpen(v => !v)}>{open ? "收起" : "展开全部"}</button>}
    </div>
  </section>;
}

/** 点在这些地方不算「点到浮层外面」：浮层本身、它的入口，以及从浮层里弹出来的确认框、下拉、提示。 */
const INLINE_KEEP = ".director-inline-ask-pop, .director-ask-ai, .aep-select-menu, .ant-modal-root, .ant-modal-wrap, .ant-select-dropdown, .ant-dropdown, .ant-tooltip, .ant-message, .ant-notification";

/**
 * 内容旁入口的浮层对话：只针对这一处内容，只显示这次打开以后说的话和回复，不带之前的对话记录。
 * 建议卡片和侧边栏一样（先看、可对比、采用才写入、能撤销）。点浮层外面、按 Esc 或右上角关闭；
 * 想接着长聊点「在助手里继续」，转到侧边栏。
 */
function InlineAssistant({ inline, anchor, onAsked, onDrag, tip }: { inline: InlineAsk; anchor: RefObject<HTMLButtonElement | null>; onAsked?: () => void; onDrag?: (e: ReactPointerEvent) => void; tip?: ReactNode }) {
  const ctl = useAssistant()!;
  const { work, apply } = ctl;
  const sender = useAssistantSender(work, apply);
  const [text, setText] = useState(inline.draft ?? "");
  const [local, setLocal] = useState<Record<string, string>>({});
  const input = useRef<HTMLTextAreaElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const replying = !!runningTask(work, "assistant");
  const busy = sender.sending || replying;
  useEffect(() => {
    if (inline.draft !== undefined) setText(inline.draft);
    const raf = window.requestAnimationFrame(() => input.current?.focus());
    return () => window.cancelAnimationFrame(raf);
  }, [inline.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const close = useCallback(() => { ctl.closeInline(); anchor.current?.focus(); }, [ctl, anchor]);
  useEffect(() => {
    const down = (e: PointerEvent) => {
      const t = e.target as Element | null;
      // 点到别的 AI 入口时由那个入口接手（换成它自己的浮层），这里不抢先关。
      if (!t?.closest || t.closest(INLINE_KEEP)) return;
      ctl.closeInline();
    };
    const key = (e: KeyboardEvent) => {
      // 弹窗或下拉菜单（模型选择）开着时，Esc 先关它们。
      if (e.key !== "Escape" || document.querySelector(".ant-modal-wrap, .aep-select-menu")) return;
      e.stopPropagation(); close();
    };
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("keydown", key, true);
    return () => { document.removeEventListener("pointerdown", down, true); document.removeEventListener("keydown", key, true); };
  }, [ctl, close, anchor]);
  const items = inline.sent.map(id => ({ id, ex: exchangeOf(work, id) }));
  const last = items[items.length - 1]?.ex;
  useEffect(() => {
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [items.length, last?.reply?.status, last?.reply?.id]);
  const send = () => {
    const message = text.trim();
    if (!message || busy) return;
    void sender.send(message, inline.scope, work.assistant?.current ?? null, {
      created: id => { setLocal(m => ({ ...m, [id]: message })); ctl.noteSent(id); },
      done: m => setText(cur => cur.trim() === m ? "" : cur),
    });
  };
  const toSidebar = () => {
    ctl.ask(inline.scope, text.trim() ? text : undefined);
    ctl.closeInline();
    onAsked?.();
  };
  const label = scopeLabel(work, inline.scope);
  const preview = scopePreview(work, inline.scope);
  const quick = quickAsks(inline.scope);
  const linked = linkedText(work, inline.scope, canSeeImages(work));
  return <div className="director-inline-ask" role="dialog" aria-label={`AI 对话：${label}`}>
    <header onPointerDown={onDrag} title="按住标题栏可以拖动">
      <span className="director-inline-ask-handle" aria-hidden/>
      <span className="director-inline-ask-mark" aria-hidden><AiMark size={16}/></span>
      <div className="director-inline-ask-title"><b title={label}>{label}</b><small title={linked}>会参考：{linked}</small></div>
      <button type="button" className="director-inline-ask-more" aria-label="在助手里继续" onClick={toSidebar} title="转到侧边栏的创作助手，可以看历史对话"><PanelRightOpen size={14}/><span>在助手里继续</span></button>
      <button type="button" className="director-inline-ask-close" aria-label="关闭" onClick={close}><X size={16}/></button>
    </header>
    {tip}
    <FollowUp.Provider value={(_scope, draft) => { setText(draft); input.current?.focus(); }}>
      <div className="director-inline-ask-list" ref={list} aria-live="polite">
        {preview && <ScopePreview preview={preview}/>}
        {!items.length ? <div className="director-inline-ask-empty">
          <p>{inline.hint || "说说你想怎么改，我先给建议，你看过对比再决定用不用。"}</p>
          <div className="director-inline-ask-quick">{quick.map(q => <button key={q} type="button" onClick={() => { setText(q); input.current?.focus(); }}>
            <AiMark size={11}/><span>{q}</span></button>)}</div>
        </div> : items.map(({ id, ex }) => <div key={id} className="director-inline-ask-turn">
          <div className="director-msg is-user"><p>{ex?.user.text ?? local[id]}</p></div>
          {ex?.reply ? <Message work={work} msg={ex.reply}/>
            : sender.pending?.id === id && sender.sending ? <div className="director-msg is-ai is-pending" role="status"><Loader2 size={14} className="ip-loading-icon"/><span>正在发送</span></div> : null}
        </div>)}
      </div>
    </FollowUp.Provider>
    {sender.error && <p className="director-assistant-send-error" role="alert">{sender.error}</p>}
    <PendingRetry work={work} sender={sender} done={m => setText(cur => cur.trim() === m ? "" : cur)}/>
    <div className="director-inline-ask-compose">
      <textarea ref={input} rows={3} maxLength={2000} aria-label="和 AI 说" value={text} onChange={e => setText(e.target.value)}
        placeholder={replying ? "AI 正在回复，回复完成后再发送" : `想怎么改？比如「${quick[0]}」`}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}/>
      <footer>
        <AssistantModelPicker work={work} apply={apply} disabled={busy}/>
        <small>{work.pricing.mock ? "测试模式，免费" : `按实际用量结算，每轮最多 ${work.pricing.textMax.toLocaleString("zh-CN")} 积分`} · Enter 发送，Shift+Enter 换行</small>
        <button type="button" className="director-assistant-send" aria-label="发送" disabled={busy || !text.trim()} onClick={send}
          title={replying ? "等这条回复完成" : "发送（Enter）"}>{sender.sending ? <Loader2 size={16} className="ip-loading-icon"/> : <ArrowUp size={16}/>}</button>
      </footer>
    </div>
  </div>;
}

/**
 * 内容旁的 AI 入口：紫色小圆钮，只有图标，点了在旁边弹出只针对这段内容的浮层对话（不展开侧边栏、不带之前的对话）。
 * 没有常驻文字，所以悬停提示和读屏名称都要说清讨论的是哪段内容。只管「问 AI」：
 * 生成、重写、一键制作这些实际操作用各自的按钮。没在工作台里时不显示。
 */
export function AskAI({ scope, what, hint, draft, className, inlineKey, onAsked }: AskAIProps) {
  const ctl = useAssistant();
  const auto = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  // 层级：盖住侧边栏（880）和资产抽屉（900），但在弹窗（1000，确认框、付款确认）下面；
  // 入口本身在导演台弹窗里（分镜图弹窗）时要盖住那个弹窗，才看得见。
  const [z, setZ] = useState(990);
  const [box, setBox] = useState<WindowBox | null>(null);
  const key = inlineKey ?? auto;
  const open = ctl?.inline?.key === key;
  // 打开时（点这个入口，或选中正文后的「问 AI」在这个入口上打开）贴着入口定位；关掉就忘掉位置。
  useEffect(() => {
    if (!open) { setBox(null); return; }
    const a = anchor.current;
    if (!a) return;
    setZ(a.closest(".director-dialog-backdrop") ? 1010 : 990);
    setBox(b => b ?? initialBox(a.getBoundingClientRect()));
  }, [open]);
  if (!ctl) return null;
  const name = `和助手讨论${what}`;
  const resolve = () => typeof scope === "function" ? scope() : scope;
  return <>
    <Tooltip title={<span className="director-ask-ai-tip"><b>{name}</b>{hint && <span>{hint}</span>}</span>} placement="topRight" mouseEnterDelay={0.2} open={open ? false : undefined}>
      <button ref={anchor} type="button" className={`director-ask-ai ${open ? "is-current" : ""} ${className ?? ""}`} aria-label={name} aria-expanded={open} aria-haspopup="dialog"
        onClick={() => {
          if (open) return ctl.closeInline();
          ctl.openInline(key, resolve(), { draft, hint });
        }}><AiMark size={14}/></button>
    </Tooltip>
    {open && ctl.inline && box && typeof document !== "undefined" && createPortal(
      <InlineWindow box={box} setBox={setBox} z={z}>
        {(drag, tip) => <InlineAssistant inline={ctl.inline!} anchor={anchor} onAsked={onAsked} onDrag={drag} tip={tip}/>}
      </InlineWindow>, document.body)}
  </>;
}

/** 浮层窗口的位置和大小。打开时贴着入口（上方或下方用 bottom / top 定），拖过、缩放过以后一律用 top。 */
type WindowBox = { left: number; top?: number; bottom?: number; width: number; height?: number };
type Edge = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
const SIZE_KEY = "director-inline-ask:size";
/** 拖动、缩放的引导只出现到用户第一次真的拖过 / 缩过，或点了「知道了」（本浏览器记住，只是个人习惯）。 */
const TIP_KEY = "director-inline-ask:tip-seen";
const MIN_W = 400, MIN_H = 320, GAP = 8;
const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * 打开时的位置：默认右边对齐入口往左展开，入口靠左（左栏里）放不下就左边对齐往右展开；
 * 入口上下哪边空间大放哪边。宽高沿用这个浏览器上次拖出来的大小（只是个人习惯，存不了也照常用默认）。
 */
function initialBox(r: DOMRect): WindowBox {
  const vw = window.innerWidth, vh = window.innerHeight;
  let saved: { width?: number; height?: number } = {};
  try { saved = JSON.parse(window.localStorage.getItem(SIZE_KEY) ?? "{}") ?? {}; } catch { /* 没有就用默认 */ }
  const width = clamp(saved.width ?? 580, MIN_W, vw - 32);
  const left = clamp(r.right - width >= 16 ? r.right - width : r.left, 16, vw - width - 16);
  const above = r.top - GAP - 16, below = vh - r.bottom - GAP - 16;
  const room = Math.max(above, below);
  const height = saved.height ? clamp(saved.height, MIN_H, room) : undefined;
  return above >= below ? { left, bottom: vh - r.top + GAP, width, height } : { left, top: r.bottom + GAP, width, height };
}

/**
 * 浮层的窗口：桌面上按住标题栏拖动，拖四边和四角改大小（不超出屏幕，最小 400×320），松手记住大小；
 * 手机上是贴底的大面板（样式覆盖定位），不拖不缩。
 */
function InlineWindow({ box, setBox, z, children }: { box: WindowBox; setBox: (b: WindowBox) => void; z: number; children: (drag: (e: ReactPointerEvent) => void, tip: ReactNode) => ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState(() => {
    if (typeof document === "undefined" || document.documentElement.dataset.layout !== "desktop") return false;
    try { return window.localStorage.getItem(TIP_KEY) !== "1"; } catch { return true; }
  });
  const tipDone = () => { setTip(false); try { window.localStorage.setItem(TIP_KEY, "1"); } catch { /* 存不了下次再提示 */ } };
  const start = (e: ReactPointerEvent, edge: Edge | "move") => {
    if (document.documentElement.dataset.layout !== "desktop" || e.button !== 0 || !el.current) return;
    if (edge === "move" && (e.target as Element).closest("button, a, input, textarea, select")) return;
    e.preventDefault();
    const r = el.current.getBoundingClientRect(), sx = e.clientX, sy = e.clientY;
    const vw = window.innerWidth, vh = window.innerHeight;
    const sized = edge !== "move" || box.height !== undefined;
    let last: WindowBox = { left: r.left, top: r.top, width: r.width, height: sized ? r.height : undefined };
    document.body.classList.add(edge === "move" ? "is-dragging-inline-ask" : "is-resizing-inline-ask");
    const move = (ev: PointerEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      let { left, top, width, height } = { left: r.left, top: r.top, width: r.width, height: r.height };
      if (edge === "move") {
        // 标题栏始终留在屏幕里，拿得回来。
        left = clamp(r.left + dx, 120 - r.width, vw - 120);
        top = clamp(r.top + dy, GAP, vh - 64);
      } else {
        if (edge.includes("e")) width = clamp(r.width + dx, MIN_W, vw - r.left - GAP);
        if (edge.includes("w")) { width = clamp(r.width - dx, MIN_W, r.right - GAP); left = r.right - width; }
        if (edge.includes("s")) height = clamp(r.height + dy, MIN_H, vh - r.top - GAP);
        if (edge.includes("n")) { height = clamp(r.height - dy, MIN_H, r.bottom - GAP); top = r.bottom - height; }
      }
      last = { left, top, width, height: sized ? height : undefined };
      setBox(last);
    };
    const up = (ev: PointerEvent) => {
      // 真的拖动过（不只是点了一下标题栏）就算学会了，引导不再出现。
      if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) > 4) tipDone();
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      document.body.classList.remove("is-dragging-inline-ask", "is-resizing-inline-ask");
      if (edge !== "move") try { window.localStorage.setItem(SIZE_KEY, JSON.stringify({ width: Math.round(last.width), height: Math.round(last.height ?? 0) || undefined })); } catch { /* 存不了就算了 */ }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const vh = typeof window === "undefined" ? 900 : window.innerHeight;
  // 没手动定高时按内容长，最高到屏幕边（贴入口时是入口那一侧的剩余空间）。
  const maxHeight = box.height !== undefined ? undefined
    : box.top !== undefined ? vh - box.top - GAP : vh - (box.bottom ?? 0) - GAP;
  const style: CSSProperties = { zIndex: z, left: box.left, width: box.width, top: box.top, bottom: box.top === undefined ? box.bottom : undefined,
    height: box.height, maxHeight: maxHeight !== undefined ? Math.min(720, maxHeight) : undefined };
  return <div ref={el} className={`ip-brand-surface director-inline-ask-pop ${box.height !== undefined ? "is-sized" : ""}`} style={style}>
    {children(e => start(e, "move"), tip ? <div className="director-inline-ask-tip" role="note">
      <Move size={14} aria-hidden/><span>按住标题栏可以拖到别处，拖四边或右下角可以调整大小</span>
      <button type="button" onClick={tipDone}>知道了</button>
    </div> : null)}
    {(["n", "s", "e", "w", "ne", "nw", "se", "sw"] as Edge[]).map(edge => <span key={edge} className={`director-inline-ask-grip is-${edge}`} aria-hidden onPointerDown={e => start(e, edge)}/>)}
  </div>;
}

/**
 * 在输入框（或一段只读内容）右下角挂一个 AI 入口。内容右侧留出按钮的宽度，
 * 所以文字（包括滚到中间、最后一行）、滚动条和拖拽缩放手柄都不会被盖住。
 */
export function AiField({ children, className, ...ask }: AskAIProps & { children: ReactNode }) {
  const ctl = useAssistant();
  return <div className={`director-ai-field ${ctl ? "has-ai" : ""} ${className ?? ""}`}>{children}<AskAI {...ask} className="is-corner"/></div>;
}
