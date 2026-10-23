"use client";

import { useRef, useState } from "react";
import { Check, ImageIcon, Plus, RefreshCw, Trash2, Upload, Wand2, X } from "lucide-react";
import type { DirectorAsset, DirectorAssetKind } from "@ai-star-eco/types";
import { DirectorApi, IpStudioApi } from "../api";
import { useStudioApp } from "../studio-errors";
import type { WorkbenchProps } from "./director-workbench";
import { Field, InlineError, OutdatedNote, Spinner, VersionStrip, adopted, chooseDirectorBilling, clearDrafts, costText, hasDrafts, kindLabel, newRequestId, runningTask, useBusy, useDraft } from "./director-shared";
import { VoicePanel } from "./director-voice";

const KINDS: DirectorAssetKind[] = ["character", "scene", "prop"];

export function DirectorAssets(props: WorkbenchProps) {
  const { work, episodeId, apply, setError } = props;
  const [filter, setFilter] = useState<"episode" | "all">("episode");
  const [adding, setAdding] = useState(false);
  const { busy, run } = useBusy();
  const ep = work.episodes.find(e => e.id === episodeId);
  const extracting = work.tasks.find(t => t.status === "running" && t.target.startsWith("extract"));
  const extractError = work.textError?.task === "extract" ? work.textError.message : null;
  const usedHere = new Set(work.clips.filter(c => c.episodeId === episodeId).flatMap(c => c.assetIds));
  const shown = work.assets.filter(a => filter === "all" || !ep || a.episodeIds.includes(ep.id) || usedHere.has(a.id));
  const waiting = work.assets.filter(a => a.image.adoptedBy === "auto");
  const extract = (scope: "episode" | "all") => void run("extract", async () => {
    const cost = work.pricing.textMax;
    const billing = await chooseDirectorBilling("asset-extract", cost);
    apply(await DirectorApi.runTask(work.id, { type: "extract", targetId: scope === "episode" ? ep?.id ?? null : null, clientRequestId: newRequestId(), billing, maxCost: cost }));
  }, setError);
  const confirmAll = () => void run("confirm", async () => apply(await DirectorApi.edit(work.id, "assets.confirm", null, null, { assetIds: waiting.map(a => a.id) })), setError);

  if (work.episodes.length === 0) return <div className="director-panel director-empty-panel"><p>请先在「剧本」完成剧本并拆分集。</p></div>;
  return <div className="director-assets">
    <div className="director-toolbar">
      <div className="director-segmented" role="group" aria-label="显示范围">
        <button type="button" aria-pressed={filter === "episode"} onClick={() => setFilter("episode")}>第 {ep?.no ?? 1} 集</button>
        <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>全部（{work.assets.length}）</button>
      </div>
      <span className="director-spacer"/>
      {extracting ? <Spinner label="资产提取中"/> : <>
        <button type="button" className="ip-brand-button" disabled={!!busy} onClick={() => extract("episode")}><Wand2 size={15}/>{work.assets.length ? `补充提取第 ${ep?.no} 集` : `提取第 ${ep?.no} 集资产`}</button>
        {work.episodes.length > 1 && <button type="button" className="ip-brand-secondary" disabled={!!busy} onClick={() => extract("all")}>提取全剧</button>}
        <span className="director-cost">{costText(work.pricing.textMax, work.pricing.mock)}</span>
      </>}
      <button type="button" className="ip-brand-secondary" onClick={() => setAdding(true)}><Plus size={15}/>添加</button>
    </div>
    <InlineError message={extractError}/>
    {waiting.length > 0 && <div className="director-confirm-bar"><span>{waiting.length} 张参考图待确认。分镜图将以此为参考，请确认后再继续。</span>
      <button type="button" className="ip-brand-button" disabled={!!busy} onClick={confirmAll}><Check size={15}/>全部确认</button></div>}
    {adding && <AddAsset {...props} onClose={() => setAdding(false)}/>}
    {shown.length === 0 ? <div className="director-panel director-empty-panel"><p>{work.assets.length ? "本集暂无关联资产。可切换到「全部」，或重新提取。" : "暂无资产。点击「提取」，从正文识别角色、场景和道具。"}</p></div> :
      KINDS.map(kind => {
        const list = shown.filter(a => a.kind === kind);
        if (!list.length) return null;
        return <section key={kind} className="director-asset-group"><h3>{kindLabel[kind]}<small>{list.length}</small></h3>
          <div className="director-asset-grid">{list.map(a => <AssetCard key={a.id} {...props} asset={a}/>)}</div></section>;
      })}
  </div>;
}

function AddAsset({ work, episodeId, apply, setError, onClose }: WorkbenchProps & { onClose: () => void }) {
  const [kind, setKind] = useState<DirectorAssetKind>("character");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const { busy, run } = useBusy();
  const save = () => void run("add", async () => { apply(await DirectorApi.edit(work.id, "asset.create", null, null, { kind, name, description, episodeId })); onClose(); }, setError);
  return <section className="director-panel director-add">
    <div className="director-segmented" role="group" aria-label="类型">{KINDS.map(k => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{kindLabel[k]}</button>)}</div>
    <Field label="名称"><input value={name} maxLength={40} onChange={e => setName(e.target.value)}/></Field>
    <Field label="外观与设定"><textarea rows={3} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)}/></Field>
    <div className="director-actions"><button type="button" className="ip-brand-secondary" onClick={onClose}>取消</button>
      <button type="button" className="ip-brand-button" disabled={!!busy || !name.trim()} onClick={save}>添加</button></div>
  </section>;
}

function AssetCard({ work, asset, apply, setError }: WorkbenchProps & { asset: DirectorAsset }) {
  const { modal } = useStudioApp();
  const prefix = `${work.id}:asset:${asset.id}:`;
  // 没保存的修改切走再回来还在，编辑框也保持打开。
  const [editing, setEditing] = useState(() => hasDrafts(prefix));
  const [name, setName] = useDraft(prefix + "name", asset.name);
  const [description, setDescription] = useDraft(prefix + "description", asset.description);
  const [prompt, setPrompt] = useDraft(prefix + "prompt", asset.prompt);
  const [showPrompt, setShowPrompt] = useState(false);
  const { busy, run } = useBusy();
  const file = useRef<HTMLInputElement>(null);
  const target = `asset:${asset.id}`;
  const generating = runningTask(work, target);
  const current = adopted(asset.image);
  const audioOnly = asset.description.includes("只出声音");
  const generate = () => void run("gen", async () => {
    const cost = work.pricing.image;
    const billing = await chooseDirectorBilling("image", cost);
    apply(await DirectorApi.runTask(work.id, { type: "asset-image", targetId: asset.id, clientRequestId: newRequestId(), billing, maxCost: cost }));
  }, setError);
  const upload = (f: File) => void run("upload", async () => {
    const result = await IpStudioApi.uploadImage(f);
    apply(await DirectorApi.edit(work.id, "asset.upload", asset.id, null, { key: result.key }));
  }, setError);
  const save = () => void run("save", async () => {
    const data: Record<string, unknown> = { name, description };
    if (prompt !== asset.prompt) data.prompt = prompt;
    const next = await DirectorApi.edit(work.id, "asset.update", asset.id, asset.rev, data);
    clearDrafts(prefix); apply(next);
    setEditing(false);
  }, setError);
  const resetPrompt = () => void run("reset", async () => apply(await DirectorApi.edit(work.id, "asset.update", asset.id, asset.rev, { resetPrompt: true })), setError);
  const remove = () => modal.confirm({ title: `删除「${asset.name}」？`, content: "其参考图版本将一并移除。如有片段正在使用，请先取消关联。", okText: "删除", okButtonProps: { danger: true }, cancelText: "取消",
    onOk: () => run("delete", async () => apply(await DirectorApi.edit(work.id, "asset.delete", asset.id, null)), setError) });
  return <article className={`director-asset-card ${asset.image.adoptedBy === "auto" ? "is-pending" : ""}`}>
    <div className={`director-asset-image kind-${asset.kind}`}>
      {current?.url ? <img src={current.url} alt={asset.name}/> : <div className="director-asset-placeholder"><ImageIcon size={22}/><span>{audioOnly ? "仅声音出场，无需参考图" : "暂无参考图"}</span></div>}
      {generating && <div className="director-asset-overlay"><Spinner label="生成中"/></div>}
      {asset.image.adoptedBy === "auto" && <span className="director-tag is-warn">待确认</span>}
      {asset.image.adoptedCheck === "outdated" && <span className="director-tag is-warn">需更新</span>}
      {current?.mock && <span className="director-tag">测试图</span>}
    </div>
    <div className="director-asset-body">
      {!editing ? <>
        <h4 title={asset.name}>{asset.name}{asset.aliases.length > 0 && <small>别名：{asset.aliases.join("、")}</small>}</h4>
        <p className="director-clamp" title={asset.description}>{asset.description || "暂无描述"}</p>
      </> : <>
        <Field label="名称"><input value={name} maxLength={40} onChange={e => setName(e.target.value)}/></Field>
        <Field label="外观与设定" hint="修改描述后，出图提示词同步更新（单独编辑过的除外）"><textarea rows={4} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)}/></Field>
      </>}
      <button type="button" className="director-disclosure" aria-expanded={showPrompt || editing} onClick={() => setShowPrompt(s => !s)}>出图提示词{asset.promptCustom && <em>已自定义</em>}</button>
      {(showPrompt || editing) && (editing ? <textarea className="director-prompt" rows={6} maxLength={4000} value={prompt} onChange={e => setPrompt(e.target.value)} aria-label="出图提示词"/> :
        <pre className="director-prompt">{asset.prompt}</pre>)}
      {asset.promptCustom && !editing && <button type="button" className="ip-brand-text-button" disabled={!!busy} onClick={resetPrompt}><RefreshCw size={13}/>恢复自动生成</button>}
      <InlineError message={asset.image.error?.message}/>
      <OutdatedNote slot={asset.image} what="张参考图" onRegenerate={audioOnly || generating ? undefined : generate} disabled={!!busy}/>
      <VersionStrip slot={asset.image} label={asset.name} disabled={!!busy} onAdopt={id => void run("adopt", async () => apply(await DirectorApi.edit(work.id, "asset.adopt", asset.id, null, { candidateId: id })), setError)}/>
      <div className="director-card-actions">
        {editing ? <>
          <button type="button" className="ip-brand-button" disabled={!!busy} onClick={save}>保存</button>
          <button type="button" className="ip-brand-secondary" onClick={() => { setEditing(false); clearDrafts(prefix); }}><X size={14}/>取消</button>
        </> : <>
          {asset.image.adoptedBy === "auto" && <button type="button" className="ip-brand-button" disabled={!!busy} onClick={() => void run("confirm", async () => apply(await DirectorApi.edit(work.id, "assets.confirm", null, null, { assetIds: [asset.id] })), setError)}><Check size={14}/>确认</button>}
          {!audioOnly && <button type="button" className={asset.image.adoptedId ? "ip-brand-secondary" : "ip-brand-button"} disabled={!!busy || !!generating} onClick={generate} title={costText(work.pricing.image, work.pricing.mock)}>
            <Wand2 size={14}/>{asset.image.candidates.length ? "重新生成" : "生成参考图"}</button>}
          <button type="button" className="ip-brand-secondary" disabled={!!busy} onClick={() => file.current?.click()}><Upload size={14}/>上传</button>
          <button type="button" className="ip-brand-text-button" onClick={() => setEditing(true)}>编辑</button>
          <button type="button" className="ip-brand-text-button director-danger" aria-label={`删除${asset.name}`} onClick={remove}><Trash2 size={14}/></button>
        </>}
        <input ref={file} type="file" accept="image/png,image/jpeg" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }}/>
      </div>
      {!editing && !audioOnly && <small className="director-cost">{work.pricing.mock ? costText(0, true) : `每张${costText(work.pricing.image, false)}`}</small>}
      {!editing && asset.kind === "character" && <VoicePanel work={work} asset={asset} apply={apply}/>}
    </div>
  </article>;
}
