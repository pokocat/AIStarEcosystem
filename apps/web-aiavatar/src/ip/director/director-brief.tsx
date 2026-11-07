"use client";

// ────────────────────────────────────────────────────────────────────────
// 写剧本前的准备（docs/ai-director-assistant.md §7）。问答都在全能创作助手里，主区只显示已经确认的内容和「生成剧本」：
// 1. 先确认基本要素：形式（多集短剧 / 长剧 / 单集短片）、集数、每集时长、题材、调性。这一步不调模型、不扣积分。
// 2. 确认后 AI 再问还不清楚的（主角、冲突、结局……），一次问齐，最多两轮；每题可选、可写，也可以交给 AI 决定（借鉴 AID Studio 的问题包）。
// 3. 用户随时可以跳过，直接生成。集数多时先写全剧大纲和前几集，后面的集接着写（ScriptMore）。
// 每次发送都按 director-pending 记下原请求：刷新、断网后按同一编号恢复，不重复受理、不重复扣费。
// ────────────────────────────────────────────────────────────────────────

import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Check, ChevronRight, Loader2, MessageSquare, PenLine, RotateCcw, Sparkles } from "lucide-react";
import type { DirectorBrief, DirectorBriefMessage, DirectorFormat, DirectorTaskType, DirectorWork } from "@ai-star-eco/types";
import type { EnterpriseBillingSelection } from "@ai-star-eco/types/enterprise";
import { DirectorApi } from "../api";
import { useAssistant } from "./director-assistant";
import { AiWorking, type DirectorFail, chooseDirectorBilling, costText, errorText, failed, newRequestId, runningTask, useBusy, useDraft, peekDraft } from "./director-shared";
import { clearPending, deliver, readPending, UncertainError, writePending } from "./director-pending";
import type { PendingRequest } from "./director-pending";
import { Chips, GenreTone } from "./director-script";

type Body = { type: DirectorTaskType; clientRequestId: string; options: Record<string, unknown>; billing?: EnterpriseBillingSelection; maxCost: number };

const EMPTY: DirectorBrief = { status: "asking", rounds: 0, maxRounds: 2, messages: [], summary: "", genre: "", tone: "", title: "" };
/** 用户把这一题交给 AI：和「你决定」同样的意思，只是可以按题选。 */
const AI_DECIDE = "AI 决定";

const KINDS: { key: DirectorFormat["kind"]; label: string }[] = [{ key: "series", label: "多集短剧" }, { key: "long", label: "长剧" }, { key: "single", label: "单集短片" }];
const EPISODE_CHOICES: Record<"series" | "long", number[]> = { series: [3, 5, 10, 20], long: [3, 6, 12, 24] };
const SECOND_CHOICES: Record<DirectorFormat["kind"], number[]> = { series: [60, 90, 120, 180], long: [180, 300, 600, 1200], single: [60, 180, 300, 600] };
const DEFAULTS: Record<DirectorFormat["kind"], DirectorFormat> = {
  series: { kind: "series", episodes: 3, seconds: 90 }, long: { kind: "long", episodes: 6, seconds: 300 }, single: { kind: "single", episodes: 1, seconds: 180 },
};
const CN_DIGITS: Record<string, number> = { 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };

export function secondsText(s: number) { return s % 60 === 0 ? `${s / 60} 分钟` : `${s} 秒`; }
export function formatText(f: DirectorFormat) {
  const kind = KINDS.find(k => k.key === f.kind)?.label ?? "";
  return f.kind === "single" ? `${kind} · 约 ${secondsText(f.seconds)}` : `${kind} · ${f.episodes} 集 · 每集 ${secondsText(f.seconds)}`;
}

/** 想法里已经写了集数或时长的，预先选好，用户不用再选一遍。 */
export function guessFormat(idea: string): DirectorFormat {
  const eps = /(\d{1,3}|[一两二三四五六七八九十])\s*集/.exec(idea);
  const episodes = eps ? (Number(eps[1]) || CN_DIGITS[eps[1]] || 0) : 0;
  const dur = /(\d{1,3})\s*(分钟|秒)/.exec(idea);
  const seconds = dur ? Number(dur[1]) * (dur[2] === "分钟" ? 60 : 1) : 0;
  const kind: DirectorFormat["kind"] = /单集|短片|单片|微电影|一集/.test(idea) || episodes === 1 ? "single" : /长剧|连续剧/.test(idea) || seconds >= 300 ? "long" : "series";
  const base = DEFAULTS[kind];
  return { kind, episodes: kind === "single" ? 1 : Math.min(200, episodes || base.episodes), seconds: seconds >= 15 && seconds <= 3600 ? seconds : base.seconds };
}

export function briefStage(work: DirectorWork) { return !work.draft.trim() && work.episodes.length === 0; }

type BriefApi = ReturnType<typeof useBriefController>;
const BriefContext = createContext<BriefApi | null>(null);
export const useBrief = () => useContext(BriefContext);

function useBriefController(work: DirectorWork, apply: (w: DirectorWork) => void) {
  const brief = work.brief ?? EMPTY;
  const key = `director-brief:pending:${work.id}`;
  const [text, setText] = useDraft(`${work.id}:brief:draft`, "");
  const [picks, setPicks] = useState<Record<number, string>>({});
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPendingState] = useState<PendingRequest<Body> | null>(null);
  const [genre, setGenre] = useState(work.genre ?? brief.genre ?? "");
  const [tone, setTone] = useState(work.tone ?? brief.tone ?? "");
  const [picked, setPicked] = useState<DirectorFormat | null>(null);
  const saved = work.settings.format ?? null;
  const format = picked ?? saved ?? guessFormat(work.idea);
  const asking = runningTask(work, "brief");
  const writing = runningTask(work, "script");
  const cost = work.pricing.textMax;
  const lastAi = [...brief.messages].reverse().find(m => m.role === "assistant");
  const lastIndex = brief.messages.length - 1;
  const openQuestions = lastAi && lastAi.status === "done" && brief.messages[lastIndex]?.id === lastAi.id ? lastAi.questions ?? [] : [];
  // AI 整理出来的题材 / 调性，用户没另选时跟着走
  useEffect(() => { if (!work.genre && brief.genre) setGenre(brief.genre); if (!work.tone && brief.tone) setTone(brief.tone); }, [brief.genre, brief.tone]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPicks({}); }, [lastAi?.id]);

  const received = (body: Body) => async () => {
    const w = await DirectorApi.getWork(work.id);
    const ok = body.type === "brief" ? w.brief?.messages.some(m => m.clientId === body.clientRequestId)
      : w.brief?.status === "writing" || w.brief?.status === "done" || !!w.draft.trim() || w.episodes.length > 0;
    return ok ? w : null;
  };

  /** 发一次：body 为已记下的原请求（恢复）或 null（新请求，由 make 生成并先记下再发）。 */
  const run = async (body: Body | null, make: () => Promise<Body>) => {
    setSending(true); setError("");
    try {
      let req = body ? readPending<Body>(key) : null;
      if (!req || req.body.clientRequestId !== body?.clientRequestId) {
        const b = body ?? await make();
        req = { id: b.clientRequestId, body: b, at: new Date().toISOString() };
        writePending(key, req);
      }
      setPendingState(req);
      apply(await deliver(key, req, b => DirectorApi.runTask(work.id, b), received(req.body)));
      setPendingState(null);
      return true;
    } catch (e) {
      if (e instanceof UncertainError) setError(e.message);
      else { setPendingState(null); setError(errorText(e)); }
      return false;
    } finally { setSending(false); }
  };

  // 刷新 / 回到页面时：上次有没确认送达的请求，先看服务端收到没有。
  useEffect(() => {
    const p = readPending<Body>(key);
    if (!p) return;
    setPendingState(p);
    void received(p.body)().then(w => { if (w) { clearPending(key); setPendingState(null); apply(w); } }).catch(() => {});
  }, [work.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const newBody = async (type: DirectorTaskType, options: Record<string, unknown>, id = newRequestId()): Promise<Body> =>
    ({ type, clientRequestId: id, options, billing: await chooseDirectorBilling("script", cost), maxCost: cost });

  /** 选的形式还没存就先存：写剧本和 AI 提问都要读它。 */
  const saveFormat = async () => {
    if (saved && saved.kind === format.kind && saved.episodes === format.episodes && saved.seconds === format.seconds) return true;
    try { apply(await DirectorApi.patchWork(work.id, { settings: { format } })); setPicked(null); return true; }
    catch (e) { setError(errorText(e)); return false; }
  };

  const blocked = "上一条消息的送达状态尚未确认，请点击「按原请求重新发送」或「放弃发送」。";
  const busy = sending || !!asking || !!writing;
  /** 确认基本要素。第一次确认后 AI 接着问；之后再改只保存，不另开一轮。 */
  const confirm = async () => {
    if (sending) return;
    if (!await saveFormat()) return;
    if (brief.messages.length > 0 || busy) return;
    void run(null, () => newBody("brief", { message: "", genre, tone }, `open-${work.id}`.slice(0, 48)));
  };
  const answer = async () => {
    if (sending) return;
    const parts = openQuestions.map((q, i) => picks[i] ? `${q.q} ${picks[i]}` : "").filter(Boolean);
    const message = [...parts, text.trim()].filter(Boolean).join("\n");
    if (!message) return;
    // 有没确认送达的请求：同一句话按原请求恢复；不同的话先处理掉那一条，不另起新请求。
    const p = readPending<Body>(key);
    if (p && !(p.body.type === "brief" && p.body.options.message === message)) { setError(blocked); return; }
    if (!await saveFormat()) return;
    const typed = text.trim();
    const ok = await run(p ? p.body : null, () => newBody("brief", { message, genre, tone }));
    // 只在输入框还是刚发出去的内容时清空；发送期间又写的留着。
    if (ok && (peekDraft<string>(`${work.id}:brief:draft`) ?? "").trim() === typed) setText("");
  };
  const generate = async (skip: boolean) => {
    if (sending) return;
    const p = readPending<Body>(key);
    if (p && p.body.type !== "script") { setError(blocked); return; }
    if (!await saveFormat()) return;
    void run(p ? p.body : null, () => newBody("script", { idea: work.idea, genre, tone, ...(skip ? { skip: true } : {}) }));
  };
  /** 还没有想法时，输入框里写的就是想法：存下来再确认基本要素。 */
  const saveIdea = async () => {
    const idea = text.trim();
    if (!idea || sending) return;
    setSending(true); setError("");
    try { apply(await DirectorApi.patchWork(work.id, { idea })); setText(""); }
    catch (e) { setError(errorText(e)); }
    finally { setSending(false); }
  };
  return { work, brief, format, setFormat: setPicked, confirmed: !!saved, genre, tone, setGenre, setTone, text, setText, picks,
    pick: (i: number, v: string) => setPicks(prev => ({ ...prev, [i]: prev[i] === v ? "" : v })),
    sending, error, clearError: () => setError(""), pending, openQuestions, lastAi, asking, writing, busy, cost, confirm, answer, generate, saveIdea,
    resend: () => { if (pending) void run(pending.body, async () => pending.body); },
    dropPending: () => { clearPending(key); setPendingState(null); setError(""); },
  };
}

export function BriefProvider({ work, apply, children }: { work: DirectorWork; apply: (w: DirectorWork) => void; children: ReactNode }) {
  const api = useBriefController(work, apply);
  const ctl = useAssistant();
  const stage = briefStage(work);
  // 桌面进来就把助手打开：问答在那里。只开这一次，不改用户记住的开关。
  const shown = useRef(false);
  const show = ctl?.showPanel;
  useEffect(() => {
    if (!stage || shown.current || document.documentElement.dataset.layout !== "desktop") return;
    shown.current = true;
    show?.();
  }, [stage, show]);
  return <BriefContext.Provider value={api}>{children}</BriefContext.Provider>;
}

// ── 主区：已经确认的内容 ────────────────────────────────────────────────

export function BriefDesk({ work, apply, openSettings, onPaste }: { work: DirectorWork; apply: (w: DirectorWork) => void; openSettings?: () => void; onPaste: () => void }) {
  // 工作台里已经包了一层；单独用（比如只渲染剧本页）时自己带上。
  if (!useBrief()) return <BriefProvider work={work} apply={apply}><BriefDeskBody openSettings={openSettings} onPaste={onPaste}/></BriefProvider>;
  return <BriefDeskBody openSettings={openSettings} onPaste={onPaste}/>;
}

function BriefDeskBody({ openSettings, onPaste }: { openSettings?: () => void; onPaste: () => void }) {
  const b = useBrief()!;
  const ctl = useAssistant();
  const { work, brief, format, confirmed } = b;
  const hasIdea = !!work.idea.trim();
  const ready = brief.status === "ready";
  const style = [b.genre, b.tone].filter(Boolean).join(" · ");
  return <section className="director-panel director-brief-desk" aria-label="写剧本前的准备">
    <header className="director-brief-head"><div>
      <h3><Sparkles size={16}/>写剧本前的准备</h3>
      <p>{!hasIdea ? "在全能创作助手中描述你想拍的故事。已有剧本可直接粘贴或上传。" : ready ? "信息已足够，可以生成剧本。" : "请在全能创作助手中确认以下内容，也可直接生成。"}</p>
    </div></header>
    {hasIdea && <dl className="director-brief-facts">
      <div><dt>想法</dt><dd>{work.idea}</dd></div>
      <div><dt>形式</dt><dd>{confirmed ? formatText(format) : <span className="director-muted">待确认（当前选择：{formatText(format)}）</span>}</dd></div>
      <div><dt>题材与调性</dt><dd>{style || <span className="director-muted">由 AI 决定</span>}</dd></div>
      <div><dt>画面</dt><dd>{work.settings.style} · {work.settings.aspectRatio}{openSettings && <button type="button" className="ip-brand-text-button" onClick={openSettings}>修改</button>}</dd></div>
      {ready && brief.summary && <div><dt>创作要求</dt><dd className="director-brief-summary">{brief.summary}</dd></div>}
    </dl>}
    {format.episodes > 3 && hasIdea && <p className="director-muted">集数较多时，将先写全剧大纲和前几集，其余各集可继续写。</p>}
    <div className="director-actions">
      {hasIdea && <button type="button" className={ready ? "ip-brand-button" : "ip-brand-secondary"} disabled={b.busy} onClick={() => void b.generate(!ready)}
        title={ready ? undefined : "根据你的想法和已回答的内容生成，未提及的部分由 AI 补充"}>{b.sending ? <Loader2 size={15} className="ip-loading-icon"/> : <Sparkles size={15}/>}{ready ? "生成剧本" : "跳过问答，生成剧本"}</button>}
      {hasIdea && <span className="director-cost">{work.pricing.mock ? costText(0, true) : "按实际用量结算"}</span>}
      {ctl && !ctl.open && <button type="button" className="ip-brand-button" onClick={() => ctl.setOpen(true)}><MessageSquare size={15}/>打开创作助手</button>}
      <span className="director-spacer"/>
      <button type="button" className="ip-brand-text-button" onClick={onPaste}><PenLine size={14}/>粘贴或上传剧本</button>
    </div>
    {b.error && !ctl?.open && <div className="ip-brand-error director-inline-error" role="alert"><span>{b.error}</span><button type="button" onClick={b.clearError}>关闭</button></div>}
  </section>;
}

// ── 助手里：基本要素和问答 ───────────────────────────────────────────────

function Choice<T extends string | number>({ label, options, value, onChange, text }: { label: string; options: readonly T[]; value: T; onChange: (v: T) => void; text: (v: T) => string }) {
  return <div className="director-field"><span>{label}</span><div className="director-chips" role="group" aria-label={label}>
    {options.map(o => <button key={String(o)} type="button" aria-pressed={value === o} onClick={() => onChange(o)}>{text(o)}</button>)}
  </div></div>;
}

function BriefEssentials({ openSettings }: { openSettings?: () => void }) {
  const b = useBrief()!;
  const { format: f, confirmed, work, brief } = b;
  const [editing, setEditing] = useState(false);
  const [custom, setCustom] = useState("");
  useEffect(() => { setEditing(false); }, [confirmed]);
  const style = [b.genre, b.tone].filter(Boolean).join(" · ");
  if (confirmed && !editing) return <div className="director-msg is-ai director-brief-confirmed">
    <p><Check size={13}/>{formatText(f)}{style ? ` · ${style}` : ""}</p>
    {brief.status !== "writing" && !b.writing && <button type="button" className="ip-brand-text-button" onClick={() => setEditing(true)}>修改</button>}
  </div>;
  const setKind = (kind: DirectorFormat["kind"]) => { setCustom(""); b.setFormat(DEFAULTS[kind]); };
  const episodes = f.kind === "single" ? [] : EPISODE_CHOICES[f.kind];
  return <div className="director-msg is-ai director-brief-essentials" role="group" aria-label="基本要素">
    <p>请确认作品的基本要素。</p>
    <Choice label="形式" options={KINDS.map(k => k.key)} value={f.kind} onChange={setKind} text={k => KINDS.find(x => x.key === k)!.label}/>
    {f.kind !== "single" && <div className="director-field"><span>集数</span><div className="director-chips" role="group" aria-label="集数">
      {episodes.map(n => <button key={n} type="button" aria-pressed={f.episodes === n && !custom} onClick={() => { setCustom(""); b.setFormat({ ...f, episodes: n }); }}>{n} 集</button>)}
      <input aria-label="自定义集数" inputMode="numeric" placeholder="其他" value={custom || (episodes.includes(f.episodes) ? "" : String(f.episodes))}
        onChange={e => { const v = e.target.value.replace(/\D/g, "").slice(0, 3); setCustom(v); const n = Number(v); if (n >= 1 && n <= 200) b.setFormat({ ...f, episodes: n }); }}/>
    </div></div>}
    <Choice label={f.kind === "single" ? "时长" : "每集时长"} options={SECOND_CHOICES[f.kind]} value={f.seconds} onChange={s => b.setFormat({ ...f, seconds: s })} text={secondsText}/>
    <GenreTone genre={b.genre} tone={b.tone} setGenre={b.setGenre} setTone={b.setTone}/>
    <div className="director-start-settings">
      <span><small>画面</small>{work.settings.style} · {work.settings.aspectRatio}</span>
      {openSettings && <button type="button" className="ip-brand-text-button" onClick={openSettings}>修改</button>}
    </div>
    <div className="director-actions"><button type="button" className="ip-brand-button" disabled={b.sending} onClick={() => { void b.confirm(); setEditing(false); }}>确认</button></div>
  </div>;
}

function BriefMessageView({ m, active }: { m: DirectorBriefMessage; active: boolean }) {
  const b = useBrief()!;
  if (m.role === "user") return <div className="director-msg is-user"><p>{m.text}</p></div>;
  if (m.status === "pending") return <div className="director-msg is-ai is-pending" role="status"><Loader2 size={14} className="ip-loading-icon"/><span>AI 正在分析你的想法</span></div>;
  if (m.status === "failed") return <div className="director-msg is-ai is-failed" role="alert"><p>{m.error || "本轮回复失败"}</p><small>可重新发送，或直接生成剧本。</small></div>;
  return <div className="director-msg is-ai">
    {m.text && <p>{m.text}</p>}
    {(m.questions ?? []).map((q, i) => <div key={i} className="director-brief-q">
      <b>{q.q}</b>
      <div className="director-chips" role="group" aria-label={q.q}>
        {[...q.options, AI_DECIDE].map(o => <button key={o} type="button" disabled={!active} aria-pressed={active && b.picks[i] === o} onClick={() => b.pick(i, o)}>{o}</button>)}
      </div>
    </div>)}
  </div>;
}

/** 全能创作助手里的这一段：有了剧本以后换回助手的普通对话。 */
export function BriefThread({ openSettings }: { openSettings?: () => void }) {
  const b = useBrief()!;
  const { work, brief, openQuestions, lastAi } = b;
  const list = useRef<HTMLDivElement>(null);
  const hasIdea = !!work.idea.trim();
  // 基本要素还没确认时从头看起；有了问答才滚到最新一条。
  useEffect(() => { const el = list.current; if (el && brief.messages.length) el.scrollTop = el.scrollHeight; }, [brief.messages.length, lastAi?.status]);
  const ready = brief.status === "ready";
  const canSend = hasIdea ? !!b.text.trim() || Object.values(b.picks).some(Boolean) : !!b.text.trim();
  const send = () => { if (hasIdea) void b.answer(); else void b.saveIdea(); };
  return <>
    <div className="director-assistant-list" ref={list} aria-live="polite">
      {!hasIdea ? <div className="director-msg is-ai"><p>请用一句话描述你想拍的故事。</p></div> : <>
        <div className="director-msg is-user"><p>{work.idea}</p></div>
        <BriefEssentials openSettings={openSettings}/>
        {brief.messages.map(m => <BriefMessageView key={m.id} m={m} active={m.id === lastAi?.id && openQuestions.length > 0}/>)}
        {ready && !b.writing && <div className="director-brief-ready">
          <h4><Check size={15}/>信息已足够，可以写剧本</h4>
          {brief.summary && <p>{brief.summary}</p>}
          <div className="director-actions">
            <button type="button" className="ip-brand-button" disabled={b.busy} onClick={() => void b.generate(false)}>{b.sending ? <Loader2 size={15} className="ip-loading-icon"/> : <Sparkles size={15}/>}生成剧本</button>
          </div>
        </div>}
        {b.writing && <div className="director-msg is-ai is-pending" role="status"><Loader2 size={14} className="ip-loading-icon"/><span>AI 正在写剧本</span></div>}
      </>}
    </div>
    {b.pending && b.error && <div className="director-warn director-brief-notice" role="alert">
      <span>{b.error}</span>
      <button type="button" disabled={b.sending} onClick={b.resend}><RotateCcw size={13}/>按原请求重新发送</button>
      <button type="button" disabled={b.sending} onClick={b.dropPending}>放弃发送</button>
    </div>}
    {!b.pending && b.error && <div className="director-assistant-error" role="alert">{b.error}<button type="button" onClick={b.clearError}>关闭</button></div>}
    {(!hasIdea || b.confirmed || brief.messages.length > 0) && <div className="director-brief-composer">
      <textarea rows={2} maxLength={2000} aria-label={hasIdea ? "回答或补充" : "你的想法"} value={b.text} onChange={e => b.setText(e.target.value)} disabled={!!b.writing}
        placeholder={!hasIdea ? "例如：凌晨的快递分拣站，夜班分拣员发现一个寄给十年后自己的包裹" : openQuestions.length ? "选择上方选项，或输入你的想法。输入「你决定」将直接开始写剧本" : "补充你的想法，或输入「直接写」"}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }}/>
      <button type="button" className="director-assistant-send" aria-label="发送" disabled={b.busy || !canSend} onClick={send}>
        {b.sending ? <Loader2 size={16} className="ip-loading-icon"/> : <ArrowUp size={16}/>}</button>
    </div>}
  </>;
}

/** 有了剧本以后，助手里还能回看当时确认过的内容。 */
export function BriefHistory({ work }: { work: DirectorWork }) {
  const messages = work.brief?.messages ?? [];
  const [open, setOpen] = useState(false);
  const format = work.settings.format;
  const lines = useMemo(() => messages.filter(m => m.status === "done" && m.text), [messages]);
  if (!lines.length && !format) return null;
  return <div className={`director-outline director-brief-history ${open ? "is-open" : ""}`}>
    <button type="button" className="director-outline-head" aria-expanded={open} onClick={() => setOpen(v => !v)}>
      <b>写剧本前确认的内容</b>{format && <span>{formatText(format)}</span>}<ChevronRight size={16} className="director-outline-chevron"/>
    </button>
    {open && <div className="director-outline-body">{lines.map(m => <p key={m.id} className={m.role === "user" ? "is-user" : ""}>{m.text}</p>)}</div>}
  </div>;
}

// ── 集数多时接着写 ───────────────────────────────────────────────────────

export function ScriptMore({ work, apply, setError }: { work: DirectorWork; apply: (w: DirectorWork) => void; setError: DirectorFail }) {
  const { busy, run } = useBusy();
  const p = work.scriptProgress;
  const running = runningTask(work, "script-more");
  const start = useCallback(() => void run("more", async () => {
    const cost = work.pricing.textMax;
    const billing = await chooseDirectorBilling("script", cost);
    apply(await DirectorApi.runTask(work.id, { type: "script-more", clientRequestId: newRequestId(), options: {}, billing, maxCost: cost }));
  }, failed(setError, "继续写剧本")), [work.id, work.pricing.textMax]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!p || p.written >= p.total) return null;
  const from = p.written + 1, to = p.nextTo ?? from;
  const range = to > from ? `第 ${from}–${to} 集` : `第 ${from} 集`;
  if (running) return <AiWorking compact title={`AI 正在写${range}`} task={running} detail="按全剧大纲继续写，完成后追加在已有内容之后。"/>;
  return <div className="director-script-more" role="group" aria-label="继续写剧本">
    <span>全剧 {p.total} 集，已写 {p.written} 集</span>
    <button type="button" className="ip-brand-secondary" disabled={!!busy} onClick={start}>{busy ? <Loader2 size={15} className="ip-loading-icon"/> : <PenLine size={15}/>}继续写{range}</button>
    <span className="director-cost">{work.pricing.mock ? costText(0, true) : "按实际用量结算"}</span>
  </div>;
}
