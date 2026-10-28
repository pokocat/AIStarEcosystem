"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 写剧本前的创意对话（docs/ai-director-assistant.md §7）：剧本页在还没有剧本时的主界面。
// AI 看用户的想法，最多问 brief.maxRounds 轮（每轮最多两个问题，带可点的选项），信息够了提前结束；
// 到上限按已有信息和合理默认收敛。用户随时可以「跳过，直接生成剧本」。
// 每次发送都按 director-pending 记下原请求：刷新、断网后按同一编号恢复，不重复受理、不重复扣费。
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Check, FastForward, Loader2, RotateCcw, Sparkles } from "lucide-react";
import type { DirectorBrief, DirectorBriefMessage, DirectorTaskType, DirectorWork } from "@ai-star-eco/types";
import type { EnterpriseBillingSelection } from "@ai-star-eco/types/enterprise";
import { ApiError } from "@ai-star-eco/api-client";
import { DirectorApi } from "../api";
import { chooseDirectorBilling, costText, errorText, newRequestId, runningTask, useDraft, clearDrafts, peekDraft } from "./director-shared";
import { clearPending, deliver, readPending, UncertainError, writePending } from "./director-pending";
import type { PendingRequest } from "./director-pending";
import { GenreTone } from "./director-script";

type Body = { type: DirectorTaskType; clientRequestId: string; options: Record<string, unknown>; billing?: EnterpriseBillingSelection; maxCost: number };

const EMPTY: DirectorBrief = { status: "asking", rounds: 0, maxRounds: 3, messages: [], summary: "", genre: "", tone: "", title: "" };

export function BriefChat({ work, apply, setError, openSettings, onPaste }: { work: DirectorWork; apply: (w: DirectorWork) => void; setError: (m: string) => void;
  openSettings?: () => void; onPaste: () => void }) {
  const brief = work.brief ?? EMPTY;
  const key = `director-brief:pending:${work.id}`;
  const [text, setText] = useDraft(`${work.id}:brief:draft`, "");
  const [picks, setPicks] = useState<Record<number, string>>({});
  const [sending, setSending] = useState(false);
  const [error, setLocalError] = useState("");
  const [pending, setPendingState] = useState<PendingRequest<Body> | null>(null);
  const [genre, setGenre] = useState(work.genre ?? brief.genre ?? "");
  const [tone, setTone] = useState(work.tone ?? brief.tone ?? "");
  const listRef = useRef<HTMLDivElement>(null);
  const asking = runningTask(work, "brief");
  const writing = runningTask(work, "script");
  const cost = work.pricing.textMax;
  const lastAi = [...brief.messages].reverse().find(m => m.role === "assistant");
  const lastIndex = brief.messages.length - 1;
  const openQuestions = lastAi && lastAi.status === "done" && brief.messages[lastIndex]?.id === lastAi.id ? lastAi.questions ?? [] : [];
  const roundsLeft = Math.max(0, brief.maxRounds - brief.rounds);
  // AI 整理出来的题材 / 调性，用户没另选时跟着走
  useEffect(() => { if (!work.genre && brief.genre) setGenre(brief.genre); if (!work.tone && brief.tone) setTone(brief.tone); }, [brief.genre, brief.tone]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPicks({}); }, [lastAi?.id]);
  useEffect(() => { const el = listRef.current; if (el) el.scrollTop = el.scrollHeight; }, [brief.messages.length, lastAi?.status]);

  const received = (body: Body) => async () => {
    const w = await DirectorApi.getWork(work.id);
    const ok = body.type === "brief" ? w.brief?.messages.some(m => m.clientId === body.clientRequestId)
      : w.brief?.status === "writing" || w.brief?.status === "done" || !!w.draft.trim() || w.episodes.length > 0;
    return ok ? w : null;
  };

  /** 发一次：body 为已记下的原请求（恢复）或 null（新请求，由 make 生成并先记下再发）。 */
  const run = async (body: Body | null, make: () => Promise<Body>) => {
    if (sending) return false;
    setSending(true); setLocalError("");
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
      if (e instanceof UncertainError) setLocalError(e.message);
      else { setPendingState(null); setLocalError(errorText(e)); }
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

  // 进来就开始：AI 先看想法、决定问什么。编号按作品固定，刷新不会再开一轮；企业付款要先选付款方，就等用户点。
  const autoStarted = useRef(false);
  const enterprise = process.env.NEXT_PUBLIC_ENTERPRISE_ENABLED === "1";
  const canOpen = !!work.idea.trim() && brief.status === "asking" && !brief.messages.some(m => m.status !== "failed") && !asking && !writing;
  useEffect(() => {
    if (!canOpen || autoStarted.current || enterprise || readPending(key)) return;
    autoStarted.current = true;
    void run(null, () => newBody("brief", { message: "" }, `open-${work.id}`.slice(0, 48)));
  }, [canOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const blocked = "上一条还没确认是否送达，请先点「按原请求重新发送」或「不发了」。";
  const answer = () => {
    const parts = openQuestions.map((q, i) => picks[i] ? `${q.q} ${picks[i]}` : "").filter(Boolean);
    const message = [...parts, text.trim()].filter(Boolean).join("\n");
    if (!message) return;
    // 有没确认送达的请求：同一句话按原请求恢复；不同的话先处理掉那一条，不另起新请求。
    const p = readPending<Body>(key);
    if (p && !(p.body.type === "brief" && p.body.options.message === message)) { setLocalError(blocked); return; }
    const typed = text.trim();
    void run(p ? p.body : null, () => newBody("brief", { message })).then(ok => {
      // 只在输入框还是刚发出去的内容时清空；发送期间又写的留着。
      if (ok && (peekDraft<string>(`${work.id}:brief:draft`) ?? "").trim() === typed) setText("");
    });
  };
  const generate = (skip: boolean) => {
    const p = readPending<Body>(key);
    if (p && p.body.type !== "script") { setLocalError(blocked); return; }
    void run(p ? p.body : null, () => newBody("script", { idea: work.idea, genre, tone, ...(skip ? { skip: true } : {}) }));
  };

  if (!work.idea.trim()) return <IdeaFirst work={work} apply={apply} setError={setError} onPaste={onPaste}/>;
  const ready = brief.status === "ready";
  const answeredRounds = brief.messages.filter(m => m.role === "user").length;
  return <section className="director-panel director-brief" aria-label="写剧本前的创意对话">
    <header className="director-brief-head">
      <div><h3><Sparkles size={16}/>先聊几句，再写剧本</h3>
        <p>{ready ? "信息够了，可以开始写剧本。" : `AI 最多问 ${brief.maxRounds} 轮，每轮不超过两个问题，信息够了会提前结束。`}
          {!ready && brief.rounds > 0 && <b>已问 {brief.rounds} 轮{roundsLeft > 0 ? `，最多还问 ${roundsLeft} 轮` : "，不再追问"}</b>}</p></div>
      <button type="button" className={ready ? "ip-brand-secondary" : "ip-brand-button"} disabled={sending || !!writing} onClick={() => generate(true)}
        title="不再回答问题：按你的想法和已经回答的内容，没说的由 AI 补齐，直接写剧本"><FastForward size={15}/>{answeredRounds ? "不聊了，直接生成剧本" : "跳过，直接生成剧本"}</button>
    </header>
    <div className="director-brief-list" ref={listRef} aria-live="polite">
      <div className="director-msg is-user"><p>{work.idea}</p><span className="director-msg-scope">你的想法</span></div>
      {brief.messages.map(m => <BriefMessage key={m.id} work={work} m={m} picks={m.id === lastAi?.id && openQuestions.length ? picks : undefined}
        onPick={(i, v) => setPicks(prev => ({ ...prev, [i]: prev[i] === v ? "" : v }))}/>)}
      {brief.messages.length === 0 && !sending && !pending && <div className="director-msg is-ai"><p>{enterprise ? "点「开始聊」，我先看看你的想法，问一两个关键问题。" : "正在准备…"}</p>
        {enterprise && <button type="button" className="ip-brand-button director-self-start" onClick={() => void run(null, () => newBody("brief", { message: "" }, `open-${work.id}`.slice(0, 48)))}>开始聊</button>}</div>}
    </div>
    {ready && <div className="director-brief-ready" role="status">
      <h4><Check size={15}/>可以开始写剧本了</h4>
      {brief.summary && <p>{brief.summary}</p>}
      <GenreTone genre={genre} tone={tone} setGenre={setGenre} setTone={setTone}/>
      <div className="director-start-settings">
        <span><small>画面风格</small>{work.settings.style}</span><span><small>画幅</small>{work.settings.aspectRatio}</span>
        {openSettings && <button type="button" className="ip-brand-text-button" onClick={openSettings}>修改</button>}
      </div>
      <div className="director-actions">
        <button type="button" className="ip-brand-button" disabled={sending || !!writing} onClick={() => generate(false)}>{sending ? <><Loader2 size={15} className="ip-loading-icon"/>提交中</> : <><Sparkles size={15}/>生成剧本</>}</button>
        <span className="director-cost">{work.pricing.mock ? costText(0, true) : `最多 ${cost.toLocaleString("zh-CN")} 积分，按用量结算`}</span>
      </div>
      <small className="director-muted">还想补充，直接在下面说；会按你补充的重新整理，不会再问很多。</small>
    </div>}
    {pending && error && <div className="director-warn" role="alert">
      <span>{error}</span>
      <button type="button" disabled={sending} onClick={() => void run(pending.body, async () => pending.body)}><RotateCcw size={13}/>按原请求重新发送</button>
      <button type="button" disabled={sending} onClick={() => { clearPending(key); setPendingState(null); setLocalError(""); }}>不发了</button>
    </div>}
    {!pending && error && <div className="ip-brand-error director-inline-error" role="alert"><span>{error}</span><button type="button" onClick={() => setLocalError("")}>关闭</button></div>}
    <div className="director-brief-composer">
      <textarea rows={2} maxLength={2000} aria-label="回答或补充" value={text} onChange={e => setText(e.target.value)} disabled={!!writing}
        placeholder={openQuestions.length ? "点上面的选项，或者直接写你的想法。说「你决定」就直接开始写" : "补充你的想法，或者说「直接写」"}
        onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); answer(); } }}/>
      <button type="button" className="director-assistant-send" aria-label="发送" disabled={sending || !!asking || !!writing || (!text.trim() && !Object.values(picks).some(Boolean))} onClick={answer}>
        {sending ? <Loader2 size={16} className="ip-loading-icon"/> : <ArrowUp size={16}/>}</button>
    </div>
    <footer className="director-brief-foot">
      <small>{work.pricing.mock ? "测试模式，免费" : `每轮最多 ${cost.toLocaleString("zh-CN")} 积分，按用量结算`}</small>
      <span className="director-spacer"/>
      <button type="button" className="ip-brand-text-button" onClick={onPaste}>已有剧本？改为粘贴</button>
    </footer>
  </section>;
}

function BriefMessage({ work, m, picks, onPick }: { work: DirectorWork; m: DirectorBriefMessage; picks?: Record<number, string>; onPick: (i: number, v: string) => void }) {
  if (m.role === "user") return <div className="director-msg is-user"><p>{m.text}</p></div>;
  if (m.status === "pending") return <div className="director-msg is-ai is-pending" role="status"><Loader2 size={14} className="ip-loading-icon"/><span>AI 正在看你的想法</span></div>;
  if (m.status === "failed") return <div className="director-msg is-ai is-failed" role="alert"><p>{m.error || "这一轮没有回复成功"}</p><small>可以再发一次，或者直接生成剧本。</small></div>;
  void work;
  return <div className="director-msg is-ai">
    {m.text && <p>{m.text}</p>}
    {(m.questions ?? []).map((q, i) => <div key={i} className="director-brief-q">
      <b>{q.q}</b>
      {q.options.length > 0 && <div className="director-chips" role="group" aria-label={q.q}>
        {q.options.map(o => <button key={o} type="button" disabled={!picks} aria-pressed={picks?.[i] === o} onClick={() => onPick(i, o)}>{o}</button>)}
      </div>}
    </div>)}
  </div>;
}

/** 作品没有创意（从空白新建）：先写一句想法，再开始对话。 */
function IdeaFirst({ work, apply, setError, onPaste }: { work: DirectorWork; apply: (w: DirectorWork) => void; setError: (m: string) => void; onPaste: () => void }) {
  const [idea, setIdea] = useDraft(`${work.id}:idea`, "");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!idea.trim() || busy) return;
    setBusy(true);
    try { apply(await DirectorApi.patchWork(work.id, { idea: idea.trim() })); clearDrafts(`${work.id}:idea`); }
    catch (e) { setError(e instanceof ApiError ? errorText(e) : String(e)); }
    finally { setBusy(false); }
  };
  return <section className="director-panel director-brief">
    <header className="director-brief-head"><div><h3><Sparkles size={16}/>先说说你想拍什么</h3><p>一句话就行，AI 会问一两个关键问题，再写剧本。</p></div></header>
    <textarea rows={4} maxLength={2000} aria-label="你的想法" value={idea} onChange={e => setIdea(e.target.value)} autoFocus
      placeholder="例如：凌晨的快递分拣站，夜班分拣员周小满发现一个寄给十年后自己的包裹。"/>
    <div className="director-actions">
      <button type="button" className="ip-brand-button" disabled={busy || !idea.trim()} onClick={() => void save()}>开始聊</button>
      <span className="director-spacer"/>
      <button type="button" className="ip-brand-text-button" onClick={onPaste}>已有剧本？改为粘贴</button>
    </div>
  </section>;
}
