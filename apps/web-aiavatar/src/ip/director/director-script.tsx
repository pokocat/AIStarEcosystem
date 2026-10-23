"use client";

import { useState } from "react";
import { PenLine, Scissors, Sparkles } from "lucide-react";
import type { DirectorEpisode } from "@ai-star-eco/types";
import { DirectorApi } from "../api";
import type { WorkbenchProps } from "./director-workbench";
import { Field, InlineError, Spinner, chooseDirectorBilling, clearDrafts, costText, newRequestId, runningTask, useBusy, useDraft } from "./director-shared";

export function DirectorScript(props: WorkbenchProps) {
  const { work, episodeId } = props;
  const writing = runningTask(work, "script");
  const splitting = runningTask(work, "split");
  const textError = work.textError && ["script", "split"].includes(work.textError.task ?? "") ? work.textError.message : null;
  if (work.episodes.length > 0) {
    const ep = work.episodes.find(e => e.id === episodeId) ?? work.episodes[0];
    return <EpisodeEditor key={ep.id + ":" + ep.rev} {...props} ep={ep}/>;
  }
  if (writing) return <div className="director-panel director-wait"><Spinner label="剧本生成中，完成后自动显示。可关闭页面，后台继续"/></div>;
  if (!work.draft.trim()) return <><InlineError message={textError}/><StartScript {...props}/></>;
  return <><InlineError message={textError}/><DraftEditor key={work.draftRev} {...props} splitting={!!splitting}/></>;
}

function StartScript({ work, apply, setError }: WorkbenchProps) {
  const [idea, setIdea] = useDraft(`${work.id}:idea`, work.idea);
  const [paste, setPaste] = useDraft(`${work.id}:paste`, "");
  const { busy, run } = useBusy();
  const write = () => void run("write", async () => {
    const cost = work.pricing.textMax;
    const billing = await chooseDirectorBilling("script", cost);
    const next = await DirectorApi.runTask(work.id, { type: "script", clientRequestId: newRequestId(), options: { idea: idea.trim() }, billing, maxCost: cost });
    clearDrafts(`${work.id}:idea`); apply(next);
  }, setError);
  const save = () => void run("paste", async () => { const next = await DirectorApi.patchWork(work.id, { draft: paste, draftRev: work.draftRev }); clearDrafts(`${work.id}:paste`); apply(next); }, setError);
  return <div className="director-two">
    <section className="director-panel">
      <h3><Sparkles size={16}/>AI 生成剧本</h3>
      <Field label="创意" hint="写明主角、事件和基调。生成分场剧本，可随时修改。">
        <textarea rows={6} maxLength={2000} value={idea} onChange={e => setIdea(e.target.value)} placeholder="例如：深夜的旧书店，店员林夏发现一封写给自己的红信封。"/>
      </Field>
      <div className="director-actions"><button type="button" className="ip-brand-button" disabled={!!busy || !idea.trim()} onClick={write}>生成剧本</button>
        <span className="director-cost">{work.pricing.mock ? costText(0, true) : `最多 ${work.pricing.textMax.toLocaleString("zh-CN")} 积分，按用量结算`}</span></div>
    </section>
    <section className="director-panel">
      <h3><PenLine size={16}/>导入剧本</h3>
      <Field label="剧本正文" hint="免费。保存后可直接作为一集，或由 AI 拆分为多集。">
        <textarea rows={6} maxLength={60000} value={paste} onChange={e => setPaste(e.target.value)} placeholder="场次、动作与对白"/>
      </Field>
      <div className="director-actions"><button type="button" className="ip-brand-secondary" disabled={!!busy || !paste.trim()} onClick={save}>保存</button></div>
    </section>
  </div>;
}

function DraftEditor({ work, apply, setError, splitting }: WorkbenchProps & { splitting: boolean }) {
  const draftKey = `${work.id}:draft`;
  const [text, setText, dirty] = useDraft(draftKey, work.draft);
  const [count, setCount] = useState("");
  const { busy, run } = useBusy();
  const persist = async () => { const w = await DirectorApi.patchWork(work.id, { draft: text, draftRev: work.draftRev }); clearDrafts(draftKey); return w; };
  const save = () => run("save", async () => apply(await persist()), setError);
  const asEpisode = () => void run("one", async () => {
    let w = work;
    if (dirty) w = await persist();
    apply(await DirectorApi.edit(w.id, "draft.asEpisode", null, null));
  }, setError);
  const split = () => void run("split", async () => {
    let w = work;
    if (dirty) { w = await persist(); apply(w); }
    const cost = work.pricing.textMax;
    const billing = await chooseDirectorBilling("script", cost);
    apply(await DirectorApi.runTask(w.id, { type: "split", clientRequestId: newRequestId(), options: count ? { episodeCount: Number(count) } : {}, billing, maxCost: cost }));
  }, setError);
  return <section className="director-panel">
    <div className="director-panel-head"><h3>剧本</h3>{work.logline && <p>{work.logline}</p>}</div>
    <textarea className="director-script-text" aria-label="剧本正文" value={text} onChange={e => setText(e.target.value)} disabled={splitting} maxLength={60000}/>
    <div className="director-actions">
      <button type="button" className="ip-brand-secondary" disabled={!dirty || !!busy || splitting} onClick={() => void save()}>{dirty ? "保存" : "已保存"}</button>
      {dirty && <span className="director-unsaved">未保存</span>}
      <span className="director-spacer"/>
      {splitting ? <Spinner label="拆分中，正文保持不变"/> : <>
        <button type="button" className="ip-brand-secondary" disabled={!!busy || !text.trim()} onClick={asEpisode}>作为一集</button>
        <label className="director-inline-field">分为<input inputMode="numeric" value={count} placeholder="自动" onChange={e => setCount(e.target.value.replace(/\D/g, "").slice(0, 2))}/>集</label>
        <button type="button" className="ip-brand-button" disabled={!!busy || !text.trim()} onClick={split}><Scissors size={15}/>AI 拆分</button>
        <span className="director-cost">{costText(work.pricing.textMax, work.pricing.mock)}</span>
      </>}
    </div>
    <p className="director-dialog-note">拆分只划定每集范围，不改写正文。拆分后在左侧选择分集编辑。</p>
  </section>;
}

function EpisodeEditor({ work, ep, apply, setError, goTab }: WorkbenchProps & { ep: DirectorEpisode }) {
  const prefix = `${work.id}:ep:${ep.id}:`;
  const [title, setTitle, t] = useDraft(prefix + "title", ep.title);
  const [summary, setSummary, s] = useDraft(prefix + "summary", ep.summary);
  const [content, setContent, c] = useDraft(prefix + "content", ep.content);
  const { busy, run } = useBusy();
  const dirty = t || s || c;
  const save = () => void run("save", async () => {
    const next = await DirectorApi.edit(work.id, "episode.update", ep.id, ep.rev, { title, summary, content });
    clearDrafts(prefix); apply(next);
  }, setError);
  const clips = work.clips.filter(c => c.episodeId === ep.id).length;
  return <section className="director-panel">
    <div className="director-episode-head">
      <span className="director-episode-no">第 {ep.no} 集</span>
      <input aria-label="集名" value={title} maxLength={60} onChange={e => setTitle(e.target.value)}/>
    </div>
    <Field label="本集摘要"><textarea rows={2} maxLength={1000} value={summary} onChange={e => setSummary(e.target.value)}/></Field>
    {ep.planStale && <div className="director-warn">正文在规划后有修改，片段可能与正文不一致。可在「分镜」重新规划（已有分镜图的片段需先删除）。<button type="button" onClick={() => goTab("storyboard")}>前往分镜</button></div>}
    <Field label="正文"><textarea className="director-script-text" value={content} maxLength={60000} onChange={e => setContent(e.target.value)}/></Field>
    <div className="director-actions">
      <button type="button" className="ip-brand-button" disabled={!dirty || !!busy} onClick={save}>{dirty ? "保存" : "已保存"}</button>
      {dirty && <><span className="director-unsaved">未保存</span><button type="button" className="ip-brand-text-button" onClick={() => { setTitle(ep.title); setSummary(ep.summary); setContent(ep.content); }}>撤销</button></>}
      <span className="director-spacer"/>
      <span className="director-cost">{clips ? `已规划 ${clips} 个片段` : "待规划片段"}</span>
    </div>
  </section>;
}
