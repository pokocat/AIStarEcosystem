"use client";

import { useRef, useState } from "react";
import { Check, ImageIcon, Mic, Plus, RefreshCw, Trash2, Upload, Wand2, X } from "lucide-react";
import type { DirectorAsset, DirectorAssetKind } from "@ai-star-eco/types";
import { DirectorApi, IpStudioApi } from "../api";
import { useStudioApp } from "../studio-errors";
import type { WorkbenchProps } from "./director-workbench";
import { Field, InlineError, OutdatedNote, Spinner, VersionStrip, adopted, chooseDirectorBilling, clearDrafts, costText, hasDrafts, kindLabel, newRequestId, runningTask, useBusy, useDraft, DirectorSheet } from "./director-shared";
import { VoiceDialog, VoicePanel } from "./director-voice";

const KINDS: DirectorAssetKind[] = ["character", "scene", "prop"];

export function DirectorAssets(props: WorkbenchProps) {
  const { work, episodeId, apply, setError } = props;
  const [kind, setKind] = useState<DirectorAssetKind | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const { busy, run } = useBusy();
  const extracting = work.tasks.find(t => t.status === "running" && t.target.startsWith("extract"));
  const extractError = work.textError?.task === "extract" ? work.textError.message : null;
  // 资产全剧共用、一次提取，这里不再按集筛选；每张卡片写出现在哪几集。
  const scoped = work.assets;
  const shown = scoped.filter(a => kind === "all" || a.kind === kind);
  const open = work.assets.find(a => a.id === openId);
  const waiting = work.assets.filter(a => a.image.adoptedBy === "auto");
  // 资产一次按全剧提取：同一人物、场景在各集是同一个，不会因为分集提取而前后不一致。
  const extract = () => void run("extract", async () => {
    const cost = work.pricing.textMax;
    const billing = await chooseDirectorBilling("asset-extract", cost);
    apply(await DirectorApi.runTask(work.id, { type: "extract", targetId: null, clientRequestId: newRequestId(), billing, maxCost: cost }));
  }, setError);
  const confirmAll = () => void run("confirm", async () => apply(await DirectorApi.edit(work.id, "assets.confirm", null, null, { assetIds: waiting.map(a => a.id) })), setError);

  if (work.episodes.length === 0) return <div className="director-panel director-empty-panel"><p>请先在「剧本」完成剧本并拆分集。</p></div>;
  return <div className="director-assets">
    <div className="director-toolbar">
      <div className="director-kind-tabs" role="tablist" aria-label="资产类型">
        {(["all", ...KINDS] as const).map(k => <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}>
          {k === "all" ? "全部" : kindLabel[k]}<small>{k === "all" ? scoped.length : scoped.filter(a => a.kind === k).length}</small></button>)}
      </div>
      <span className="director-spacer"/>
      {extracting ? <Spinner label="资产提取中"/> : <>
        <button type="button" className={work.assets.length ? "ip-brand-secondary" : "ip-brand-button"} disabled={!!busy} onClick={extract}><Wand2 size={15}/>{work.assets.length ? "重新提取全剧资产" : "提取全剧资产"}</button>
        <span className="director-cost">{costText(work.pricing.textMax, work.pricing.mock)}</span>
      </>}
      <button type="button" className="ip-brand-secondary" onClick={() => setAdding(true)}><Plus size={15}/>添加</button>
    </div>
    <InlineError message={extractError}/>
    {waiting.length > 0 && <div className="director-confirm-bar"><span>{waiting.length} 张参考图待确认。分镜图将以此为参考，请确认后再继续。</span>
      <button type="button" className="ip-brand-button" disabled={!!busy} onClick={confirmAll}><Check size={15}/>全部确认</button></div>}
    {adding && <AddAsset {...props} onClose={() => setAdding(false)}/>}
    {shown.length === 0 ? <div className="director-panel director-empty-panel"><p>{!work.assets.length ? "暂无资产。点击「提取」，从正文识别角色、场景和道具。" : scoped.length ? "这一类暂无资产。" : "暂无资产。"}</p></div> :
      <div className="director-asset-grid">{[...shown].sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind)).map(a => <AssetTile key={a.id} {...props} asset={a} onOpen={() => setOpenId(a.id)}/>)}</div>}
    {open && <DirectorSheet onClose={() => setOpenId(null)} label="资产详情"><AssetCard key={open.id} {...props} asset={open}/></DirectorSheet>}
  </div>;
}

/** 等高的资产卡：图、名字、两行描述、一行状态；详情（编辑、提示词、版本、声音）点开再看。 */
function AssetTile({ work, asset, apply, setError, onOpen }: WorkbenchProps & { asset: DirectorAsset; onOpen: () => void }) {
  const { busy, run } = useBusy();
  const [voiceOpen, setVoiceOpen] = useState(false);
  const current = adopted(asset.image);
  const generating = runningTask(work, `asset:${asset.id}`);
  const audioOnly = asset.description.includes("只出声音");
  const nos = work.episodes.filter(e => asset.episodeIds.includes(e.id)).map(e => e.no);
  const appears = nos.length === 0 ? "" : nos.length === work.episodes.length && nos.length > 1 ? "全剧" : `第 ${nos.join("、")} 集`;
  const status = generating ? "生成中" : audioOnly ? "仅声音出场" : !asset.image.adoptedId ? "缺少参考图" : asset.image.adoptedCheck === "outdated" ? "需更新" : asset.image.adoptedBy === "auto" ? "待确认" : "已确认";
  const tone = status === "已确认" ? "is-done" : status === "缺少参考图" ? "is-error" : status === "待确认" || status === "需更新" ? "is-warn" : "";
  const generate = () => void run("gen", async () => {
    const cost = work.pricing.image;
    const billing = await chooseDirectorBilling("image", cost);
    apply(await DirectorApi.runTask(work.id, { type: "asset-image", targetId: asset.id, clientRequestId: newRequestId(), billing, maxCost: cost }));
  }, setError);
  return <article className={`director-asset-tile ${tone} kind-${asset.kind}`}>
    <button type="button" className="director-asset-tile-open" onClick={onOpen} aria-label={`查看${asset.name}`}>
      <span className="director-asset-tile-image">
        {current?.url ? <img src={current.url} alt=""/> : <span className="director-asset-placeholder"><ImageIcon size={20}/>{audioOnly ? "仅声音出场" : "暂无参考图"}</span>}
        {generating && <span className="director-asset-overlay"><Spinner label="生成中"/></span>}
        <span className="director-kind is-floating">{kindLabel[asset.kind]}</span>
        {current?.mock && <span className="director-kind is-floating is-right">测试图</span>}
      </span>
      <span className="director-asset-tile-copy">
        <b title={asset.name}>{asset.name}{appears && <small>{appears}</small>}</b>
        <span title={asset.description}>{asset.description || "暂无描述"}</span>
      </span>
    </button>
    <footer>
      <small className={tone}>{status}</small>
      <span className="director-spacer"/>
      {asset.kind === "character" && <button type="button" className={`director-voice-chip ${asset.voice || asset.voiceDesc ? "is-set" : ""}`} onClick={() => setVoiceOpen(true)} title={asset.voice || asset.voiceDesc ? "已设置音色，点开修改" : "设置角色音色"}><Mic size={13}/>音色</button>}
      {asset.image.adoptedBy === "auto" && !generating && <button type="button" className="ip-brand-button" disabled={!!busy} onClick={() => void run("confirm", async () => apply(await DirectorApi.edit(work.id, "assets.confirm", null, null, { assetIds: [asset.id] })), setError)}><Check size={13}/>确认</button>}
      {!asset.image.adoptedId && !audioOnly && !generating && <button type="button" className="ip-brand-button" disabled={!!busy} title={costText(work.pricing.image, work.pricing.mock)} onClick={generate}><Wand2 size={13}/>生成</button>}
    </footer>
    {voiceOpen && <VoiceDialog work={work} asset={asset} apply={apply} onClose={() => setVoiceOpen(false)}/>}
  </article>;
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
        <h4 title={asset.name}><span className="director-kind">{kindLabel[asset.kind]}</span>{asset.name}{asset.aliases.length > 0 && <small>别名：{asset.aliases.join("、")}</small>}</h4>
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
          {asset.kind !== "character" && <button type="button" className="ip-brand-secondary director-icon-button" disabled={!!busy} aria-label="上传参考图" title="上传参考图" onClick={() => file.current?.click()}><Upload size={14}/></button>}
          <button type="button" className="ip-brand-text-button" onClick={() => setEditing(true)}>编辑</button>
          <button type="button" className="ip-brand-text-button director-danger" aria-label={`删除${asset.name}`} onClick={remove}><Trash2 size={14}/></button>
        </>}
        <input ref={file} type="file" accept="image/png,image/jpeg" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }}/>
      </div>
      {!editing && !audioOnly && asset.kind === "character" && <CharacterRef work={work} asset={asset} apply={apply} setError={setError} disabled={!!busy || !!generating}/>}
      {!editing && !audioOnly && <small className="director-cost">{work.pricing.mock ? costText(0, true) : `每张${costText(work.pricing.image, false)}`}</small>}
      {!editing && asset.kind === "character" && <VoicePanel work={work} asset={asset} apply={apply}/>}
    </div>
  </article>;
}

/**
 * 角色的形象参考照片。照片不会直接当角色图用：生成或重新生成设定图时作为图1交给模型，只取长相，
 * 版式按设定集重新画。分镜和视频认的始终是系统生成的设定图，前后才对得上。
 */
function CharacterRef({ work, asset, apply, setError, disabled }: Pick<WorkbenchProps, "work" | "apply" | "setError"> & { asset: DirectorAsset; disabled: boolean }) {
  const { busy, run } = useBusy();
  const file = useRef<HTMLInputElement>(null);
  const ref = asset.refImage;
  const upload = (f: File) => void run("ref", async () => {
    const result = await IpStudioApi.uploadImage(f);
    apply(await DirectorApi.edit(work.id, "asset.setRef", asset.id, null, { key: result.key }));
  }, setError);
  const clear = () => void run("ref", async () => apply(await DirectorApi.edit(work.id, "asset.clearRef", asset.id, null)), setError);
  return <div className="director-ref">
    {ref?.url ? <img src={ref.url} alt={`${asset.name}的形象参考`}/> : <span className="director-ref-empty"><ImageIcon size={16}/></span>}
    <div className="director-ref-text">
      <strong>形象参考{ref ? "" : "（可选）"}</strong>
      <small>{ref ? "生成设定图时照着它画长相，改了参考要重新生成" : "上传一张照片，生成设定图时照着它画长相"}</small>
    </div>
    <div className="director-ref-actions">
      <button type="button" className="ip-brand-text-button" disabled={disabled || !!busy} onClick={() => file.current?.click()}>{ref ? "更换" : "上传"}</button>
      {ref && <button type="button" className="ip-brand-text-button" disabled={disabled || !!busy} onClick={clear}>移除</button>}
    </div>
    <input ref={file} type="file" accept="image/png,image/jpeg" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }}/>
  </div>;
}
