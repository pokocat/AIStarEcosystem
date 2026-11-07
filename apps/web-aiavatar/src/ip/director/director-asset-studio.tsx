"use client";
import { IMAGE_UPLOAD_ACCEPT } from '@ai-star-eco/api-client/image-upload-policy';

import Link from "next/link";
import { useEffect, useRef, useState, type RefObject } from "react";
import { ArrowLeft, Check, ChevronRight, ImageIcon, Library, Loader2, Plus, RefreshCw, Trash2, Upload, Wand2, X } from "lucide-react";
import type { DirectorAsset, DirectorAssetForm, DirectorEpisode, DirectorMediaSlot, DirectorSceneView, DirectorTaskType, DirectorWork } from "@ai-star-eco/types";
import { DirectorApi, IpStudioApi } from "../api";
import { useStudioApp } from "../studio-errors";
import { LibraryReferencePicker } from "../library-reference-picker";
import { assetsHref } from "../assets-hub-shared";
import type { WorkbenchProps } from "./director-workbench";
import { DIRECTOR_MEDIA_SHORTAGE, Field, InlineError, OutdatedNote, Spinner, VersionStrip, adopted, assetRefs, chooseDirectorBilling, clearDrafts, costText, dialogFocus, failed, hasDrafts, kindLabel, newRequestId, runningTask, useBusy, useDraft, useEscape, ZoomableImage, type AssetRef } from "./director-shared";
import { VoicePanel } from "./director-voice";
import { AiField } from "./director-assistant";

export const SCENE_VIEWS: { key: DirectorSceneView; label: string }[] = [
  { key: "reverse", label: "反打" }, { key: "left", label: "左立面" }, { key: "right", label: "右立面" },
];
const EMPTY_SLOT: DirectorMediaSlot = { candidates: [], adoptedId: null, adoptedBy: null, error: null };
type Variant = { type: "all" } | { type: "main" } | { type: "form"; id: string } | { type: "view"; view: DirectorSceneView };

const IMAGE_ACCEPT = IMAGE_UPLOAD_ACCEPT;
/** Camera originals are prepared by IpStudioApi.uploadImage; do not reject before conversion. */
export function imageProblem(f: File) {
  return f.size ? "" : "图片文件为空，请重新选择";
}

/** 隐藏的文件选择框：选好后交给 onFile，清空 value 让同一张图能再选一次。 */
export function ImageInput({ input, onFile, label }: { input: RefObject<HTMLInputElement | null>; onFile: (f: File) => void; label: string }) {
  return <input ref={input} type="file" accept={IMAGE_ACCEPT} hidden aria-label={label}
    onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) onFile(f); }}/>;
}

/** 一张图在资产里的两种用法，说法全页一致。 */
export const IMAGE_USES = {
  asset: { label: "直接作为资产图", note: "分镜图和视频将直接使用此图，不经 AI 生成，不消耗积分" },
  ref: { label: "作为参考图", note: "生成资产图时由 AI 参照此图，上传时不生成，不消耗积分" },
} as const;

/** 资产被哪些片段用着：每个片段一行，「前往」跳到那个片段。错误弹窗和资产详情共用。 */
export function AssetRefList({ refs, onGo }: { refs: AssetRef[]; onGo: (ref: AssetRef) => void }) {
  return <ul className="studio-failure-refs">{refs.map(r => <li key={r.clipId}>
    <span title={r.title}>第 {r.episodeNo} 集 · 片段 {r.order}{r.title ? `「${r.title}」` : ""}</span>
    <small>{[r.linked ? "关联资产" : "", r.lines ? `${r.lines} 句台词` : ""].filter(Boolean).join(" · ")}</small>
    <button type="button" onClick={() => onGo(r)}>前往</button>
  </li>)}</ul>;
}

/** 资产出现在哪几集：每集一个开关。外层用 div 不用 Field 的 label，否则点标题文字会误触第一个按钮。 */
export function EpisodePicker({ episodes, value, onChange }: { episodes: DirectorEpisode[]; value: string[]; onChange: (ids: string[]) => void }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(x => x !== id) : episodes.map(e => e.id).filter(x => x === id || value.includes(x)));
  return <div className="director-chips" role="group" aria-label="出现在">
    {episodes.map(e => <button key={e.id} type="button" aria-pressed={value.includes(e.id)} title={e.title} onClick={() => toggle(e.id)}>第 {e.no} 集</button>)}
  </div>;
}

/**
 * 资产详情弹窗（2026-11-04 用户要求，照 AID 的素材编辑页）：上面一排切换资产，左边大图，右边资料。
 * 标签切主形象 / 各形态，或场景的全部视角 / 主视 / 反打 / 左立面 / 右立面。生成、上传和图下面的生成记录都只对当前标签生效；
 * 「全部视角」只是总览，没有自己的生成记录，点一格进那个视角。
 */
export function DirectorAssetStudio(props: WorkbenchProps & { asset: DirectorAsset; list: DirectorAsset[]; onSelect: (id: string) => void; onClose: () => void }) {
  const { asset, list, onSelect, onClose } = props;
  useEscape(onClose);
  const selected = useRef<HTMLButtonElement>(null);
  useEffect(() => { selected.current?.scrollIntoView?.({ inline: "center", block: "nearest" }); }, [asset.id]);
  return <div className="director-sheet-backdrop director-studio-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="director-studio" role="dialog" aria-modal="true" aria-label="资产详情" ref={dialogFocus} tabIndex={-1}>
      <header className="director-studio-top">
        <button type="button" className="director-studio-back" onClick={onClose}><ArrowLeft size={16}/>返回</button>
        <nav className="director-studio-film" aria-label="切换资产">{list.map(a => {
          const img = adopted(a.image);
          return <button key={a.id} type="button" ref={a.id === asset.id ? selected : undefined} aria-current={a.id === asset.id ? "true" : undefined} title={a.name} onClick={() => onSelect(a.id)}>
            <span>{img?.url ? <img src={img.url} alt=""/> : <ImageIcon size={16}/>}</span><b>{a.name}</b>
          </button>;
        })}</nav>
        <button type="button" className="director-studio-close" aria-label="关闭" onClick={onClose}><X size={18}/></button>
      </header>
      <AssetWorkspace key={asset.id} {...props}/>
    </div>
  </div>;
}

function AssetWorkspace({ work, asset, apply, setError, focusClip, onClose }: WorkbenchProps & { asset: DirectorAsset; onClose: () => void }) {
  const { modal } = useStudioApp();
  // 没保存的修改切走再回来还在，编辑框也保持打开。
  const prefix = `${work.id}:asset:${asset.id}:`;
  const [editing, setEditing] = useState(() => hasDrafts(prefix));
  const [name, setName] = useDraft(prefix + "name", asset.name);
  const [description, setDescription] = useDraft(prefix + "description", asset.description);
  const [prompt, setPrompt] = useDraft(prefix + "prompt", asset.prompt);
  // 没改过就跟着服务端走（重新提取会补集数），只有改过才随保存提交；切走再回来草稿还在。
  const [episodeIds, setEpisodeIds, episodesEdited] = useDraft(prefix + "episodeIds", asset.episodeIds);
  const [showPrompt, setShowPrompt] = useState(false);
  const audioOnly = asset.description.includes("只出声音");
  const [variant, setVariant] = useState<Variant>(asset.kind === "scene" && !audioOnly ? { type: "all" } : { type: "main" });
  const [addingForm, setAddingForm] = useState(false);
  const [picking, setPicking] = useState(false);
  const { busy, run } = useBusy();
  const file = useRef<HTMLInputElement>(null);
  const variantFile = useRef<HTMLInputElement>(null);
  const form = variant.type === "form" ? asset.forms?.find(f => f.id === variant.id) : undefined;
  const mainImage = !!asset.image.adoptedId;
  const overview = variant.type === "all";
  // 形态被删了（或别处改了）就回到主形象，不显示一个对不上的标签。
  // 全部视角里的按钮看场景到了哪一步：还没有主视图就做主视图，有了就做其他三个视角。
  const active: Exclude<Variant, { type: "all" }> = variant.type === "form" && !form ? { type: "main" }
    : variant.type === "all" ? (mainImage ? { type: "view", view: SCENE_VIEWS[0].key } : { type: "main" }) : variant;
  const slot: DirectorMediaSlot = active.type === "main" ? asset.image : active.type === "form" ? form!.image : asset.views?.[active.view] ?? EMPTY_SLOT;
  const target = active.type === "main" ? `asset:${asset.id}` : active.type === "form" ? `form:${active.id}` : `views:${asset.id}`;
  const generating = runningTask(work, target);
  const viewsGenerating = runningTask(work, `views:${asset.id}`);
  const current = adopted(slot);
  const label = active.type === "main" ? asset.name : active.type === "form" ? `${asset.name}·${form!.name}` : `${asset.name}·${SCENE_VIEWS.find(v => v.key === active.view)!.label}`;
  const refs = assetRefs(work, asset.id);
  const mainActive = active.type === "main";
  const anyView = SCENE_VIEWS.some(v => asset.views?.[v.key]?.candidates.length);

  const task = (type: DirectorTaskType, targetId: string, action: string) => void run("gen", async () => {
    const cost = work.pricing.image;
    const billing = await chooseDirectorBilling("image", cost);
    apply(await DirectorApi.runTask(work.id, { type, targetId, clientRequestId: newRequestId(), billing, maxCost: cost }));
  }, failed(setError, action, undefined, undefined, DIRECTOR_MEDIA_SHORTAGE));
  const generate = () => active.type === "main" ? task("asset-image", asset.id, `生成「${asset.name}」的资产图`)
    : active.type === "form" ? task("form-image", active.id, `生成「${label}」的形态图`)
    : task("scene-views", asset.id, `生成「${asset.name}」的四视图`);
  const adoptVersion = (id: string) => void run("adopt", async () => apply(active.type === "main" ? await DirectorApi.edit(work.id, "asset.adopt", asset.id, null, { candidateId: id })
    : active.type === "form" ? await DirectorApi.edit(work.id, "form.adopt", active.id, null, { candidateId: id })
    : await DirectorApi.edit(work.id, "view.adopt", asset.id, null, { view: active.view, candidateId: id })), failed(setError, `切换「${label}」的图片版本`));
  // 直接上传作为资产图：不生成、不扣积分。已有资产图时先说清会替换、原来的留在历史里，再上传。
  const upload = (f: File) => {
    const problem = imageProblem(f);
    if (problem) { setError({ action: `上传「${asset.name}」的资产图`, error: problem, next: "资产图未更改。" }); return; }
    const send = () => void run("upload", async () => {
      const result = await IpStudioApi.uploadImage(f);
      apply(await DirectorApi.edit(work.id, "asset.upload", asset.id, null, { key: result.key }));
    }, failed(setError, `上传「${asset.name}」的资产图`, "资产图未更改，请更换 PNG 或 JPG 图片后重试。"));
    if (!asset.image.adoptedId) return send();
    modal.confirm({ title: `用这张图替换「${asset.name}」的资产图？`, okText: "替换", cancelText: "取消", onOk: send,
      content: <div className="director-batch-confirm"><p>原资产图保留在历史版本中，可随时切换回来。</p>
        {refs.length > 0 && <p className="director-muted">已生成的分镜图和视频不会自动重新生成，将标记为「需更新」。</p>}</div> });
  };
  const uploadVariant = (f: File) => {
    const problem = imageProblem(f);
    if (problem) { setError({ action: `上传「${label}」的图`, error: problem, next: "图片未更改。" }); return; }
    void run("upload", async () => {
      const result = await IpStudioApi.uploadImage(f);
      apply(active.type === "form" ? await DirectorApi.edit(work.id, "form.upload", active.id, null, { key: result.key })
        : await DirectorApi.edit(work.id, "view.upload", asset.id, null, { view: (active as { view: DirectorSceneView }).view, key: result.key }));
    }, failed(setError, `上传「${label}」的图`, "图片未更改，请更换 PNG 或 JPG 图片后重试。"));
  };
  const save = () => void run("save", async () => {
    const data: Record<string, unknown> = { name, description };
    if (prompt !== asset.prompt) data.prompt = prompt;
    if (episodesEdited) data.episodeIds = episodeIds;
    const next = await DirectorApi.edit(work.id, "asset.update", asset.id, asset.rev, data);
    clearDrafts(prefix); apply(next);
    setEditing(false);
  }, failed(setError, `保存「${asset.name}」的修改`, "修改内容已保留，请按原因调整后点击「保存」。"));
  const resetPrompt = () => void run("reset", async () => apply(await DirectorApi.edit(work.id, "asset.update", asset.id, asset.rev, { resetPrompt: true })), failed(setError, `恢复「${asset.name}」的自动提示词`));
  // 还被片段用着就不能删：先说清是哪些片段、怎么解除，不发删除请求；本地数据过时时服务端照样拒绝，弹同一个弹窗。
  const blocked = (list: AssetRef[], error?: unknown) => setError({
    action: `删除「${asset.name}」`,
    error: error ?? { code: "DIRECTOR_ASSET_IN_USE", message: `「${asset.name}」仍被 ${list.length} 个片段使用，资产未删除。` },
    extra: close => <AssetRefList refs={list} onGo={r => { close(); focusClip({ clipId: r.clipId, assetId: asset.id, open: r.linked ? "assets" : "editor" }); }}/>,
    next: <>{list.some(r => r.linked) && <p>点击片段旁的「前往」，在打开的「关联资产」中点击「{asset.name}」旁的「解除关联」。</p>}
      {list.some(r => !r.linked) && <p>仅在台词中出现的，请在打开的「编辑镜头」中更换这些台词的说话人并保存。</p>}
      <p>处理完成后，返回此处删除。</p></>,
  });
  const remove = () => refs.length ? blocked(refs) : modal.confirm({ title: `删除「${asset.name}」？`, content: "其资产图的所有版本将一并删除，删除后无法恢复。", okText: "删除", okButtonProps: { danger: true }, cancelText: "取消",
    onOk: () => run("delete", async () => apply(await DirectorApi.edit(work.id, "asset.delete", asset.id, null)), (message, e) => {
      const fromServer = (e as { code?: string; details?: { clips?: AssetRef[] } } | undefined);
      if (fromServer?.code === "DIRECTOR_ASSET_IN_USE") blocked(fromServer.details?.clips?.length ? fromServer.details.clips : refs, e);
      else setError({ action: `删除「${asset.name}」`, error: e ?? message });
    }) });
  const nos = work.episodes.filter(e => asset.episodeIds.includes(e.id)).map(e => e.no);
  const appears = nos.length === 0 ? "" : nos.length === work.episodes.length && nos.length > 1 ? "全剧" : `第 ${nos.join("、")} 集`;
  const formClips = (id: string) => work.clips.filter(c => c.assetForms?.[asset.id] === id).length;
  const viewShots = (view: DirectorSceneView) => work.clips.filter(c => c.assetIds.includes(asset.id)).reduce((n, c) => n + c.shots.filter(s => s.sceneView === view).length, 0);
  const viewCount = (mainImage ? 1 : 0) + SCENE_VIEWS.filter(v => asset.views?.[v.key]?.adoptedId).length;
  const emptyNote = audioOnly ? "仅声音出场，无需资产图" : active.type === "main" ? "暂无资产图"
    : active.type === "form" ? (mainImage ? "此形态暂无图片" : "请先生成主形象，形态图将以其为参考") : (mainImage ? "此视角暂无图片" : "请先生成主视图，其他视角将以其为参考");

  return <div className="director-studio-body">
    <section className="director-studio-stage" aria-label={overview ? "全部视角" : mainActive ? "资产图" : `${label}的图`}>
      {!audioOnly && asset.kind !== "prop" && <div className="director-studio-tabs" role="tablist" aria-label={asset.kind === "scene" ? "视角" : "形态"}>
        {asset.kind === "scene" && <button type="button" role="tab" aria-selected={overview} title={`已有 ${viewCount} 个视角的图，共 4 个`} onClick={() => setVariant({ type: "all" })}>全部视角<small>{viewCount}/4</small></button>}
        <button type="button" role="tab" aria-selected={!overview && mainActive} onClick={() => setVariant({ type: "main" })}>{asset.kind === "scene" ? "主视" : "主形象"}{asset.kind === "scene" && runningTask(work, `asset:${asset.id}`) && <Loader2 size={12} className="ip-loading-icon"/>}</button>
        {asset.kind === "character" && asset.forms?.map(f => {
          const used = formClips(f.id);
          return <button key={f.id} type="button" role="tab" aria-selected={active.type === "form" && active.id === f.id} title={used ? `${used} 个片段使用此形态` : "暂无片段使用此形态"} onClick={() => setVariant({ type: "form", id: f.id })}>
            {f.name}{used > 0 && <small>{used}</small>}{runningTask(work, `form:${f.id}`) && <Loader2 size={12} className="ip-loading-icon"/>}</button>;
        })}
        {asset.kind === "character" && <button type="button" className="director-studio-tab-add" onClick={() => setAddingForm(true)}><Plus size={13}/>添加形态</button>}
        {asset.kind === "scene" && SCENE_VIEWS.map(v => {
          const used = viewShots(v.key);
          return <button key={v.key} type="button" role="tab" aria-selected={!overview && active.type === "view" && active.view === v.key} title={used ? `${used} 个镜头使用此视角` : "暂无镜头使用此视角"} onClick={() => setVariant({ type: "view", view: v.key })}>
            {v.label}{used > 0 && <small>{used}</small>}{viewsGenerating && <Loader2 size={12} className="ip-loading-icon"/>}</button>;
        })}
      </div>}
      {overview ? <SceneViewsOverview work={work} asset={asset} onPick={setVariant} shots={viewShots}/> : <>
        <div className={`director-studio-media kind-${asset.kind}`}>
          {current?.url ? <ZoomableImage src={current.url} alt={label}/> : <div className="director-asset-placeholder"><ImageIcon size={26}/><span>{emptyNote}</span></div>}
          {generating && <div className="director-asset-overlay"><Spinner label="生成中"/></div>}
          <div className="director-studio-tags">
            {slot.adoptedBy === "auto" && <span className="director-tag is-warn">待确认</span>}
            {slot.adoptedCheck === "outdated" && <span className="director-tag is-warn">需更新</span>}
            {current?.mock && <span className="director-tag">测试图</span>}
            {current && !current.mock && current.source !== "generated" && <span className="director-tag is-source">{current.source === "upload" ? "已上传" : "资产库"}</span>}
          </div>
        </div>
        <div className="director-studio-history" aria-label="生成记录" role="group">
          <h5>生成记录{slot.candidates.length > 0 && <small>{slot.candidates.length}</small>}</h5>
          {slot.candidates.length > 1 || slot.candidates.some(m => m.stale) ? <VersionStrip slot={slot} label={label} disabled={!!busy} onAdopt={adoptVersion}/>
            : <p>{slot.candidates.length ? "生成或上传新版本后，可在此切换。" : "生成或上传后，各版本保留在此。"}</p>}
        </div>
      </>}
      {!audioOnly && <div className="director-studio-actions">
        {overview && mainImage && <InlineError message={asset.image.error?.message}/>}
        <InlineError message={active.type === "view" ? asset.viewsError?.message : slot.error?.message}/>
        {!overview && <OutdatedNote slot={slot} what="张图" onRegenerate={generating ? undefined : generate} disabled={!!busy}/>}
        <div className="director-card-actions">
          {asset.image.adoptedBy === "auto" && (mainActive || overview) && <button type="button" className="ip-brand-button" disabled={!!busy} onClick={() => void run("confirm", async () => apply(await DirectorApi.edit(work.id, "assets.confirm", null, null, { assetIds: [asset.id] })), failed(setError, `确认「${asset.name}」的资产图`))}><Check size={14}/>确认使用</button>}
          <button type="button" className={slot.adoptedId ? "ip-brand-secondary" : "ip-brand-button"} disabled={!!busy || !!generating || (active.type !== "main" && !mainImage)} onClick={generate}
            title={active.type === "view" ? "以主视图为准，一次生成反打、左立面、右立面三张" : undefined}>
            <Wand2 size={14}/>{generating ? "生成中" : active.type === "view" ? (anyView ? "重新生成三个视角" : "生成三个视角") : slot.candidates.length ? "重新生成" : active.type === "form" ? "生成形态图" : overview ? "生成主视图" : "生成资产图"}</button>
          {mainActive && <button type="button" className="ip-brand-secondary" disabled={!!busy || !!generating} onClick={() => setPicking(true)} title="使用资产库中同一项资产的图片作为资产图"><Library size={14}/>关联已有资产</button>}
          {mainActive ? <button type="button" className="ip-brand-secondary" disabled={!!busy || !!generating} onClick={() => file.current?.click()} title={IMAGE_USES.asset.note}><Upload size={14}/>直接上传作为资产图</button>
            : !overview && <button type="button" className="ip-brand-secondary" disabled={!!busy || !!generating} onClick={() => variantFile.current?.click()}><Upload size={14}/>上传图片</button>}
          <span className="director-spacer"/>
          <small className="director-cost">{work.pricing.mock ? costText(0, true) : active.type === "view" ? `三张共${costText(work.pricing.image, false)}` : `每张${costText(work.pricing.image, false)}`}</small>
        </div>
      </div>}
    </section>

    <aside className="director-studio-panel" aria-label="资料">
      {!editing ? <header className="director-asset-head">
        <div className="director-asset-title">
          <h4 title={asset.name}><span className="director-kind">{kindLabel[asset.kind]}</span>{asset.name}</h4>
          <small>{[appears, asset.aliases.length ? `别名：${asset.aliases.join("、")}` : ""].filter(Boolean).join(" · ")}</small>
          {(asset.libraryEntryId || asset.libraryObjectId) && <Link className="director-library-link" href={assetsHref(asset.kind === "product" ? "prop" : asset.kind, work.id)}>{asset.libraryObjectId ? "已关联资产库" : "已在资产库"}</Link>}
        </div>
        <div className="director-asset-head-actions">
          <button type="button" className="ip-brand-text-button" onClick={() => setEditing(true)}>编辑</button>
          <button type="button" className="ip-brand-text-button director-danger director-icon-button" aria-label={`删除${asset.name}`} title="删除" onClick={remove}><Trash2 size={14}/></button>
        </div>
      </header> : <>
        <Field label="名称"><input value={name} maxLength={40} onChange={e => setName(e.target.value)}/></Field>
        <Field label="外观与设定" hint="修改描述后，出图提示词同步更新（单独编辑过的除外）"><textarea rows={4} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)}/></Field>
        <Field label="出图提示词"><textarea className="director-prompt" rows={6} maxLength={4000} value={prompt} onChange={e => setPrompt(e.target.value)}/></Field>
        <div className="director-field"><span>出现在</span><EpisodePicker episodes={work.episodes} value={episodeIds} onChange={setEpisodeIds}/>
          {!episodeIds.length && <small>{episodesEdited ? "至少选择一集" : "尚未指定出现的集，可直接保存"}</small>}</div>
        <div className="director-card-actions">
          <button type="button" className="ip-brand-button" disabled={!!busy || (episodesEdited && !episodeIds.length)} onClick={save}>保存</button>
          <button type="button" className="ip-brand-secondary" onClick={() => { setEditing(false); clearDrafts(prefix); }}><X size={14}/>取消</button>
        </div>
      </>}
      {/* 一项资产一个入口：有资产图就带上图讨论（能改外观、提示词、音色，也能按这张图出新版本），没有图只改文字。 */}
      {!editing && <AiField scope={adopted(asset.image) && !audioOnly ? { kind: "image", assetId: asset.id } : { kind: "asset", assetId: asset.id }} what={adopted(asset.image) && !audioOnly ? `「${asset.name}」和它的资产图` : `「${asset.name}」`} onAsked={onClose}
        hint={adopted(asset.image) && !audioOnly ? "可完善外观设定、出图提示词或音色，也可说明资产图需修改之处；生成新版本前会显示费用，原图保留" : "可完善外观设定、出图提示词或音色，例如「更疲惫但别显老」"}>
        <p className="director-asset-desc director-ai-field-body">{asset.description || "暂无描述"}</p>
      </AiField>}
      {addingForm && <FormEditor work={work} asset={asset} apply={apply} setError={setError} onClose={() => setAddingForm(false)} onCreated={id => setVariant({ type: "form", id })}/>}
      {!editing && form && <FormEditor key={form.id} work={work} asset={asset} form={form} apply={apply} setError={setError}/>}
      {!editing && <section className="director-sheet-section director-asset-refs" aria-label="用在哪些片段">
        <h5>用在哪些片段<small>{refs.length ? `${refs.length} 个` : "暂无片段使用"}</small></h5>
        {refs.length > 0 && <AssetRefList refs={refs} onGo={r => focusClip({ clipId: r.clipId, assetId: asset.id, open: r.linked ? "assets" : "editor" })}/>}
        {refs.length > 0 && <small className="director-muted">如需删除此资产，请先在这些片段中解除关联（点击「前往」，在「关联资产」中操作）。</small>}
      </section>}
      {!editing && !audioOnly && (mainActive || overview) && <section className="director-sheet-section" aria-label="出图提示词">
        <button type="button" className="director-disclosure" aria-expanded={showPrompt} onClick={() => setShowPrompt(s => !s)}>
          <ChevronRight size={14}/>出图提示词{asset.promptCustom && <em>已自定义</em>}</button>
        {showPrompt && <pre className="director-prompt">{asset.prompt}</pre>}
        {showPrompt && asset.promptCustom && <button type="button" className="ip-brand-text-button director-self-start" disabled={!!busy} onClick={resetPrompt}><RefreshCw size={13}/>恢复自动生成</button>}
      </section>}
      {!editing && !audioOnly && (mainActive || overview) && <AssetReference work={work} asset={asset} apply={apply} setError={setError} disabled={!!busy || !!generating}/>}
      <ImageInput input={file} onFile={upload} label={`直接上传「${asset.name}」的资产图`}/>
      <ImageInput input={variantFile} onFile={uploadVariant} label={`上传「${label}」的图`}/>
      <LinkLibrary work={work} asset={asset} apply={apply} open={picking} onClose={() => setPicking(false)}/>
      {!editing && asset.kind === "character" && <VoicePanel work={work} asset={asset} apply={apply}/>}
    </aside>
  </div>;
}

/**
 * 场景的全部视角：主视图在上面最大，其他三个视角并排在下面。一格一个视角，点进去才看大图、换版本、单独上传，
 * 所以这里不放生成记录，免得看起来对整组生效。每格都是 16:9，整组 4:3 时四张图左右正好对齐。
 */
function SceneViewsOverview({ work, asset, onPick, shots }: { work: DirectorWork; asset: DirectorAsset; onPick: (v: Variant) => void; shots: (view: DirectorSceneView) => number }) {
  const viewsBusy = !!runningTask(work, `views:${asset.id}`);
  const tile = (slot: DirectorMediaSlot, name: string, busy: boolean, used: number, pick: Variant, main?: boolean) => {
    const img = adopted(slot);
    const count = [used ? `${used} 镜` : "", slot.candidates.length > 1 ? `${slot.candidates.length} 版` : ""].filter(Boolean).join(" · ");
    return <button key={name} type="button" className={`director-view-tile${main ? " is-main" : ""}`} aria-label={`查看${name}`} title="查看大图和此视角的生成记录" onClick={() => onPick(pick)}>
      {img?.url ? <img src={img.url} alt=""/> : <span className="director-view-empty"><ImageIcon size={main ? 26 : 18}/>{main && "暂无主视图"}</span>}
      {busy && <span className="director-asset-overlay"><Spinner label="生成中"/></span>}
      <span className="director-studio-tags">
        {slot.adoptedBy === "auto" && <span className="director-tag is-warn">待确认</span>}
        {slot.adoptedCheck === "outdated" && <span className="director-tag is-warn">需更新</span>}
        {img?.stale && <span className="director-tag is-warn">需更新</span>}
      </span>
      <span className="director-view-label"><b>{name}</b>{count && <small>{count}</small>}</span>
    </button>;
  };
  return <div className="director-views-frame"><div className="director-views">
    {tile(asset.image, "主视", !!runningTask(work, `asset:${asset.id}`), work.clips.filter(c => c.assetIds.includes(asset.id)).reduce((n, c) => n + c.shots.filter(s => !s.sceneView).length, 0), { type: "main" }, true)}
    <div className="director-views-row">{SCENE_VIEWS.map(v => tile(asset.views?.[v.key] ?? EMPTY_SLOT, v.label, viewsBusy, shots(v.key), { type: "view", view: v.key }))}</div>
  </div></div>;
}

/** 新建或修改一个形态：名字和「和平时不一样的地方」。不传 form 是新建。 */
function FormEditor({ work, asset, form, apply, setError, onClose, onCreated }: Pick<WorkbenchProps, "work" | "apply" | "setError"> & { asset: DirectorAsset; form?: DirectorAssetForm; onClose?: () => void; onCreated?: (id: string) => void }) {
  const [name, setName] = useState(form?.name ?? "");
  const [description, setDescription] = useState(form?.description ?? "");
  const { busy, run } = useBusy();
  const { modal } = useStudioApp();
  const dirty = !form || name !== form.name || description !== form.description;
  const save = () => void run("form", async () => {
    if (form) { apply(await DirectorApi.edit(work.id, "form.update", form.id, null, { name, description })); return; }
    const next = await DirectorApi.edit(work.id, "form.create", asset.id, null, { name, description });
    apply(next);
    const created = next.assets.find(a => a.id === asset.id)?.forms?.find(f => f.name === name.trim());
    if (created) onCreated?.(created.id);
    onClose?.();
  }, failed(setError, form ? `保存形态「${name}」` : `添加形态「${name}」`, "已填写的内容已保留，请按原因修改后保存。"));
  const remove = () => {
    if (!form) return;
    const used = work.clips.filter(c => c.assetForms?.[asset.id] === form.id).length;
    modal.confirm({ title: `删除形态「${form.name}」？`, okText: "删除", okButtonProps: { danger: true }, cancelText: "取消",
      content: used ? `有 ${used} 个片段正在使用此形态。删除后这些片段将改用主形象，已有的分镜图和视频将标记为「需更新」。` : "其图片将一并删除，删除后无法恢复。",
      onOk: () => run("form", async () => apply(await DirectorApi.edit(work.id, "form.delete", form.id, null)), failed(setError, `删除形态「${form.name}」`)) });
  };
  return <section className="director-sheet-section director-form-editor" aria-label={form ? `形态「${form.name}」` : "添加形态"}>
    <h5>{form ? "此形态" : "添加形态"}<small>用于换装、受伤、变身等，无需另建角色</small></h5>
    <Field label="名称"><input value={name} maxLength={20} placeholder="例如：半妖态、婚礼礼服" onChange={e => setName(e.target.value)}/></Field>
    <Field label="和平时不一样的地方"><textarea rows={3} maxLength={1000} placeholder="例如：白色长裙换成染血的盔甲，左脸有一道新伤" value={description} onChange={e => setDescription(e.target.value)}/></Field>
    <div className="director-card-actions">
      <button type="button" className="ip-brand-button" disabled={!!busy || !name.trim() || !dirty} onClick={save}>{form ? "保存" : "添加"}</button>
      {onClose && <button type="button" className="ip-brand-secondary" disabled={!!busy} onClick={onClose}>取消</button>}
      {form && <button type="button" className="ip-brand-text-button director-danger" disabled={!!busy} onClick={remove}>删除形态</button>}
    </div>
  </section>;
}

/**
 * 参考图（角色、场景、道具都有）：只在生成或重新生成资产图时作为图1交给 AI，角色取长相，场景、道具取外观，
 * 版式照旧重画。它不是资产图：上传不会替换已采用的资产图，也不会自己发起生成。想直接用某张图，用「直接上传作为资产图」。
 */
function AssetReference({ work, asset, apply, setError, disabled }: Pick<WorkbenchProps, "work" | "apply" | "setError"> & { asset: DirectorAsset; disabled: boolean }) {
  const { busy, run } = useBusy();
  const file = useRef<HTMLInputElement>(null);
  const ref = asset.refImage;
  const takes = asset.kind === "character" ? "长相" : "外观";
  const upload = (f: File) => {
    const problem = imageProblem(f);
    if (problem) { setError({ action: `上传「${asset.name}」的参考图`, error: problem, next: "参考图未更改。" }); return; }
    void run("ref", async () => {
      const result = await IpStudioApi.uploadImage(f);
      apply(await DirectorApi.edit(work.id, "asset.setRef", asset.id, null, { key: result.key }));
    }, failed(setError, `上传「${asset.name}」的参考图`, "参考图未更改，请更换 PNG 或 JPG 图片后重试。"));
  };
  const clear = () => void run("ref", async () => apply(await DirectorApi.edit(work.id, "asset.clearRef", asset.id, null)), failed(setError, `移除「${asset.name}」的参考图`));
  return <section className="director-sheet-section" aria-label="参考图">
    <h5>参考图<small>{ref ? "已设置" : "选填"}</small></h5>
    <div className="director-ref">
      {ref?.url ? <img src={ref.url} alt={`${asset.name}的参考图`}/> : <span className="director-ref-empty"><ImageIcon size={16}/></span>}
      <div className="director-ref-text">
        <strong>{busy ? "正在上传参考图…" : ref ? `生成资产图时参照其${takes}` : `生成资产图时由 AI 参照一张图（取${takes}）`}</strong>
        <small>{ref ? (asset.image.adoptedId ? "不会替换当前资产图，点击「重新生成」时将参照此图。" : "点击「生成资产图」时将参照此图。")
          : "不会替换当前资产图，不消耗积分。"}</small>
      </div>
      <div className="director-ref-actions">
        <button type="button" className="ip-brand-secondary" disabled={disabled || !!busy} onClick={() => file.current?.click()}><Upload size={14}/>{ref ? "更换参考图" : "上传作为参考图"}</button>
        {ref && <button type="button" className="ip-brand-text-button" disabled={disabled || !!busy} onClick={clear}>移除</button>}
      </div>
    </div>
    <ImageInput input={file} onFile={upload} label={`上传「${asset.name}」的参考图`}/>
  </section>;
}

/** 关联已有资产：只交资产库对象 id 和选定版本，图和描述由服务端按本人资产库读；所选版本的图直接作为资产图。 */
function LinkLibrary({ work, asset, apply, open, onClose }: { work: DirectorWork; asset: DirectorAsset; apply: WorkbenchProps["apply"]; open: boolean; onClose: () => void }) {
  return <LibraryReferencePicker open={open} objectsOnly objectKind={asset.kind} max={1} query={asset.name} onClose={onClose}
    excludeObject={o => o.sources.some(s => s.origin === "director" && s.projectId === work.id && s.nodeId === asset.id)}
    title={`「${asset.name}」关联已有资产`} confirmLabel="关联"
    intro={`从资产库选择同一个${kindLabel[asset.kind]}，所选版本的图片将直接作为资产图，用于生成分镜图和视频。名称保留剧本中的叫法。`}
    onAssets={async picked => {
      const ref = picked[0]?.metadata?.libraryReference as { objectId: string; versionId?: string } | undefined;
      if (!ref) return;
      apply(await DirectorApi.edit(work.id, "asset.link", asset.id, null, { objectId: ref.objectId, versionId: ref.versionId ?? null }));
    }}/>;
}
