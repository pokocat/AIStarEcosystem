"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronRight, ImageIcon, Library, Mic, Plus, RefreshCw, Sparkles, Trash2, Upload, Wand2, X } from "lucide-react";
import type { DirectorAsset, DirectorAssetKind, DirectorAssistantScope, DirectorEpisode, DirectorWork } from "@ai-star-eco/types";
import { DirectorApi, IpStudioApi } from "../api";
import { useStudioApp } from "../studio-errors";
import { LibraryReferencePicker } from "../library-reference-picker";
import type { WorkbenchProps } from "./director-workbench";
import { Field, InlineError, OutdatedNote, Spinner, VersionStrip, adopted, assetRefs, chooseDirectorBilling, clearDrafts, costText, errorText, failed, hasDrafts, kindLabel, newRequestId, runningTask, useBusy, useDraft, DirectorSheet, ZoomableImage, type AssetRef } from "./director-shared";
import { VoiceDialog, VoicePanel } from "./director-voice";
import { useAssistant } from "./director-assistant";

const KINDS: DirectorAssetKind[] = ["character", "scene", "prop"];

export function DirectorAssets(props: WorkbenchProps) {
  const { work, apply, setError } = props;
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
  // 助手卡片上的「查看版本」：打开那项资产的详情，比较新生成的参考图。
  const reveal = useAssistant()?.reveal;
  useEffect(() => { if (reveal?.type === "asset" && work.assets.some(a => a.id === reveal.id)) setOpenId(reveal.id); }, [reveal]); // eslint-disable-line react-hooks/exhaustive-deps
  const waiting = work.assets.filter(a => a.image.adoptedBy === "auto");
  // 资产一次按全剧提取：同一人物、场景在各集是同一个，不会因为分集提取而前后不一致。
  const extract = () => void run("extract", async () => {
    const cost = work.pricing.textMax;
    const billing = await chooseDirectorBilling("asset-extract");
    apply(await DirectorApi.runTask(work.id, { type: "extract", targetId: null, clientRequestId: newRequestId(), billing, maxCost: cost }));
  }, failed(setError, work.assets.length ? "重新提取全剧资产" : "提取全剧资产"));
  // 一次给所有还没有参考图的资产各出一张：只出画面的（排除仅声音出场）、没在生成的。
  const { modal } = useStudioApp();
  const missing = work.assets.filter(a => !a.image.adoptedId && !a.description.includes("只出声音") && !runningTask(work, `asset:${a.id}`))
    .sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
  const generateAll = () => {
    const total = missing.length * work.pricing.image;
    modal.confirm({
      title: `为 ${missing.length} 项资产生成参考图？`,
      content: <div className="director-batch-confirm"><p>{missing.map(a => a.name).join("、")}</p>
        <p className="director-muted">每项一张，{costText(total, work.pricing.mock)}。生成后逐张确认，分镜图会照着确认过的参考图画。</p></div>,
      okText: "开始生成", cancelText: "取消",
      onOk: () => run("all", async () => {
        const billing = await chooseDirectorBilling("image", total);
        const failures: string[] = [];
        for (const a of missing) {
          try { apply(await DirectorApi.runTask(work.id, { type: "asset-image", targetId: a.id, clientRequestId: newRequestId(), billing, maxCost: work.pricing.image })); }
          catch (e) { failures.push(`${a.name}：${errorText(e)}`); }
        }
        if (failures.length) setError({ action: "生成全部参考图", error: `${missing.length} 项里有 ${failures.length} 项没有提交成功：${failures.join("；")}`,
          next: "其余的已经开始生成。没提交成功的，按上面的原因处理后在那项资产上单独点「生成」。" });
      }, failed(setError, "生成全部参考图")),
    });
  };
  const confirmAll = () => void run("confirm", async () => apply(await DirectorApi.edit(work.id, "assets.confirm", null, null, { assetIds: waiting.map(a => a.id) })), failed(setError, "确认全部参考图"));

  if (work.episodes.length === 0) return <div className="director-panel director-empty-panel"><p>请先在「剧本」完成剧本并拆分集。</p></div>;
  return <div className="director-assets">
    <div className="director-toolbar">
      <div className="director-segmented director-kind-tabs" role="tablist" aria-label="资产类型">
        {(["all", ...KINDS] as const).map(k => <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}>
          {k === "all" ? "全部" : kindLabel[k]}<small>{k === "all" ? scoped.length : scoped.filter(a => a.kind === k).length}</small></button>)}
      </div>
      <span className="director-spacer"/>
      {extracting ? <Spinner label="资产提取中"/> : <>
        <button type="button" className={work.assets.length ? "ip-brand-secondary" : "ip-brand-button"} disabled={!!busy} onClick={extract}><Wand2 size={15}/>{work.assets.length ? "重新提取全剧资产" : "提取全剧资产"}</button>
      </>}
      <button type="button" className="ip-brand-secondary" onClick={() => setAdding(true)} title="补上提取漏掉的角色、场景或道具"><Plus size={15}/>添加资产</button>
      {missing.length > 0 && <button type="button" className="ip-brand-button" disabled={!!busy} onClick={generateAll}
        title={`给还没有参考图的 ${missing.length} 项资产各生成一张，${costText(missing.length * work.pricing.image, work.pricing.mock)}`}><Wand2 size={15}/>生成全部参考图<small className="director-count">{missing.length}</small></button>}
    </div>
    <InlineError message={extractError}/>
    {waiting.length > 0 && <div className="director-confirm-bar"><span>{waiting.length} 张参考图待确认。分镜图将以此为参考，请确认后再继续。</span>
      <button type="button" className="ip-brand-button" disabled={!!busy} onClick={confirmAll}><Check size={15}/>全部确认</button></div>}
    {adding && <AddAsset {...props} onClose={() => setAdding(false)}/>}
    {shown.length === 0 ? <div className="director-panel director-empty-panel"><p>{!work.assets.length ? "暂无资产。点「提取全剧资产」，从正文识别角色、场景和道具。" : scoped.length ? "这一类暂无资产。" : "暂无资产。"}</p></div> :
      <div className="director-asset-grid">{[...shown].sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind)).map(a => <AssetTile key={a.id} {...props} asset={a} onOpen={() => setOpenId(a.id)}/>)}</div>}
    {open && <DirectorSheet onClose={() => setOpenId(null)} label="资产详情"><AssetCard key={open.id} {...props} asset={open} onLeave={() => setOpenId(null)}/></DirectorSheet>}
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
  }, failed(setError, `生成「${asset.name}」的参考图`));
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
      <small className={`director-tile-status ${tone}`}>{status}</small>
      {asset.kind === "character" && <button type="button" className={`director-voice-chip ${asset.voice || asset.voiceDesc ? "is-set" : ""}`} onClick={() => setVoiceOpen(true)}
        aria-label={asset.voice || asset.voiceDesc ? `${asset.name}的音色已设置，点开修改` : `设置${asset.name}的音色`} title={asset.voice || asset.voiceDesc ? "音色已设置，点开修改" : "设置角色音色"}><Mic size={14}/></button>}
      {asset.image.adoptedBy === "auto" && !generating && <button type="button" className="ip-brand-button" disabled={!!busy} onClick={() => void run("confirm", async () => apply(await DirectorApi.edit(work.id, "assets.confirm", null, null, { assetIds: [asset.id] })), failed(setError, `确认「${asset.name}」的参考图`))}><Check size={13}/>确认</button>}
      {!asset.image.adoptedId && !audioOnly && !generating && <button type="button" className="ip-brand-button" disabled={!!busy} title={costText(work.pricing.image, work.pricing.mock)} onClick={generate}><Wand2 size={13}/>生成</button>}
    </footer>
    {!generating && <InlineError message={asset.image.error?.message}/>}
    {voiceOpen && <VoiceDialog work={work} asset={asset} apply={apply} onClose={() => setVoiceOpen(false)}/>}
  </article>;
}

/** 资产被哪些片段用着：每个片段一行，「前往」跳到那个片段。错误弹窗和资产详情共用。 */
export function AssetRefList({ refs, onGo }: { refs: AssetRef[]; onGo: (ref: AssetRef) => void }) {
  return <ul className="studio-failure-refs">{refs.map(r => <li key={r.clipId}>
    <span title={r.title}>第 {r.episodeNo} 集 · 片段 {r.order}{r.title ? `「${r.title}」` : ""}</span>
    <small>{[r.linked ? "关联资产" : "", r.lines ? `${r.lines} 句台词` : ""].filter(Boolean).join(" · ")}</small>
    <button type="button" onClick={() => onGo(r)}>前往</button>
  </li>)}</ul>;
}

/** 资产出现在哪几集：每集一个开关。外层用 div 不用 Field 的 label，否则点标题文字会误触第一个按钮。 */
function EpisodePicker({ episodes, value, onChange }: { episodes: DirectorEpisode[]; value: string[]; onChange: (ids: string[]) => void }) {
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter(x => x !== id) : episodes.map(e => e.id).filter(x => x === id || value.includes(x)));
  return <div className="director-chips" role="group" aria-label="出现在">
    {episodes.map(e => <button key={e.id} type="button" aria-pressed={value.includes(e.id)} title={e.title} onClick={() => toggle(e.id)}>第 {e.no} 集</button>)}
  </div>;
}

function AddAsset({ work, apply, setError, onClose }: WorkbenchProps & { onClose: () => void }) {
  const [kind, setKind] = useState<DirectorAssetKind>("character");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // 默认全剧：手动补的多半是提取漏掉的常驻角色或场景，只在个别集出现的取消勾选即可。
  const [episodeIds, setEpisodeIds] = useState(() => work.episodes.map(e => e.id));
  const { busy, run } = useBusy();
  const save = () => void run("add", async () => { apply(await DirectorApi.edit(work.id, "asset.create", null, null, { kind, name, description, episodeIds })); onClose(); }, failed(setError, `添加${kindLabel[kind]}「${name.trim() || "未命名"}」`, "填好的内容还在，按原因修改后再点「添加」。"));
  return <section className="director-panel director-add">
    <div className="director-segmented" role="group" aria-label="类型">{KINDS.map(k => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{kindLabel[k]}</button>)}</div>
    <Field label="名称"><input value={name} maxLength={40} onChange={e => setName(e.target.value)}/></Field>
    <Field label="外观与设定"><textarea rows={3} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)}/></Field>
    <div className="director-field"><span>出现在</span><EpisodePicker episodes={work.episodes} value={episodeIds} onChange={setEpisodeIds}/></div>
    <div className="director-actions"><button type="button" className="ip-brand-secondary" onClick={onClose}>取消</button>
      <button type="button" className="ip-brand-button" disabled={!!busy || !name.trim() || !episodeIds.length} onClick={save}>添加</button>
      {!episodeIds.length && <small className="director-muted">至少选一集</small>}</div>
  </section>;
}

function AssetCard({ work, asset, apply, setError, focusClip, onLeave }: WorkbenchProps & { asset: DirectorAsset; onLeave: () => void }) {
  const { modal } = useStudioApp();
  const assistant = useAssistant();
  // 问助手要关掉详情抽屉（它盖在助手上面）；讨论和建议都在助手里，建议卡片能直接看对比。
  const ask = (scope: DirectorAssistantScope) => { assistant?.ask(scope); onLeave(); };
  const prefix = `${work.id}:asset:${asset.id}:`;
  // 没保存的修改切走再回来还在，编辑框也保持打开。
  const [editing, setEditing] = useState(() => hasDrafts(prefix));
  const [name, setName] = useDraft(prefix + "name", asset.name);
  const [description, setDescription] = useDraft(prefix + "description", asset.description);
  const [prompt, setPrompt] = useDraft(prefix + "prompt", asset.prompt);
  // 没改过就跟着服务端走（重新提取会补集数），只有改过才随保存提交；切走再回来草稿还在。
  const [episodeIds, setEpisodeIds, episodesEdited] = useDraft(prefix + "episodeIds", asset.episodeIds);
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
  }, failed(setError, `生成「${asset.name}」的参考图`));
  const upload = (f: File) => void run("upload", async () => {
    const result = await IpStudioApi.uploadImage(f);
    apply(await DirectorApi.edit(work.id, "asset.upload", asset.id, null, { key: result.key }));
  }, failed(setError, `上传「${asset.name}」的参考图`, "参考图没有变。换一张 PNG 或 JPG 图片再试。"));
  const [picking, setPicking] = useState(false);
  const save = () => void run("save", async () => {
    const data: Record<string, unknown> = { name, description };
    if (prompt !== asset.prompt) data.prompt = prompt;
    if (episodesEdited) data.episodeIds = episodeIds;
    const next = await DirectorApi.edit(work.id, "asset.update", asset.id, asset.rev, data);
    clearDrafts(prefix); apply(next);
    setEditing(false);
  }, failed(setError, `保存「${asset.name}」的修改`, "改过的内容还在编辑框里，按原因调整后再点「保存」。"));
  const resetPrompt = () => void run("reset", async () => apply(await DirectorApi.edit(work.id, "asset.update", asset.id, asset.rev, { resetPrompt: true })), failed(setError, `恢复「${asset.name}」的自动提示词`));
  const refs = assetRefs(work, asset.id);
  // 还被片段用着就不能删：先说清是哪些片段、怎么解除，不发删除请求；本地数据过时时服务端照样拒绝，弹同一个弹窗。
  const blocked = (list: AssetRef[], error?: unknown) => setError({
    action: `删除「${asset.name}」`,
    error: error ?? { code: "DIRECTOR_ASSET_IN_USE", message: `「${asset.name}」还用在 ${list.length} 个片段里，资产没有删除。` },
    extra: close => <AssetRefList refs={list} onGo={r => { close(); focusClip({ clipId: r.clipId, assetId: asset.id, open: r.linked ? "assets" : "editor" }); }}/>,
    next: <>{list.some(r => r.linked) && <p>点片段旁的「前往」，在打开的「关联资产」里点「{asset.name}」后面的「解除关联」。</p>}
      {list.some(r => !r.linked) && <p>只在台词里出现的，在打开的「编辑镜头」里把这些台词的说话人换掉并保存。</p>}
      <p>都处理完后回到这里再删除。</p></>,
  });
  const remove = () => refs.length ? blocked(refs) : modal.confirm({ title: `删除「${asset.name}」？`, content: "它的参考图版本会一起删除，不能恢复。", okText: "删除", okButtonProps: { danger: true }, cancelText: "取消",
    onOk: () => run("delete", async () => apply(await DirectorApi.edit(work.id, "asset.delete", asset.id, null)), (message, e) => {
      const fromServer = (e as { code?: string; details?: { clips?: AssetRef[] } } | undefined);
      if (fromServer?.code === "DIRECTOR_ASSET_IN_USE") blocked(fromServer.details?.clips?.length ? fromServer.details.clips : refs, e);
      else setError({ action: `删除「${asset.name}」`, error: e ?? message });
    }) });
  const nos = work.episodes.filter(e => asset.episodeIds.includes(e.id)).map(e => e.no);
  const appears = nos.length === 0 ? "" : nos.length === work.episodes.length && nos.length > 1 ? "全剧" : `第 ${nos.join("、")} 集`;
  return <article className={`director-asset-card ${asset.image.adoptedBy === "auto" ? "is-pending" : ""}`}>
    <div className={`director-asset-image kind-${asset.kind}`}>
      {current?.url ? <ZoomableImage src={current.url} alt={asset.name}/> : <div className="director-asset-placeholder"><ImageIcon size={22}/><span>{audioOnly ? "仅声音出场，无需参考图" : "暂无参考图"}</span></div>}
      {generating && <div className="director-asset-overlay"><Spinner label="生成中"/></div>}
      {asset.image.adoptedBy === "auto" && <span className="director-tag is-warn">待确认</span>}
      {asset.image.adoptedCheck === "outdated" && <span className="director-tag is-warn">需更新</span>}
      {current?.mock && <span className="director-tag">测试图</span>}
    </div>
    <div className="director-asset-body">
      {!editing ? <header className="director-asset-head">
        <div className="director-asset-title">
          <h4 title={asset.name}><span className="director-kind">{kindLabel[asset.kind]}</span>{asset.name}</h4>
          <small>{[appears, asset.libraryObjectId ? "已关联资产库" : "", asset.aliases.length ? `别名：${asset.aliases.join("、")}` : ""].filter(Boolean).join(" · ")}</small>
        </div>
        <div className="director-asset-head-actions">
          {assistant && <button type="button" className="director-ask-ai" onClick={() => ask({ kind: "asset", assetId: asset.id })}
            title="完善外观设定、出图提示词或音色，比如「更疲惫但别显老」「保留长相，只换服装」"><Sparkles size={13}/>AI 完善</button>}
          <button type="button" className="ip-brand-text-button" onClick={() => setEditing(true)}>编辑</button>
          <button type="button" className="ip-brand-text-button director-danger director-icon-button" aria-label={`删除${asset.name}`} title="删除" onClick={remove}><Trash2 size={14}/></button>
        </div>
      </header> : <>
        <Field label="名称"><input value={name} maxLength={40} onChange={e => setName(e.target.value)}/></Field>
        <Field label="外观与设定" hint="修改描述后，出图提示词同步更新（单独编辑过的除外）"><textarea rows={4} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)}/></Field>
        <Field label="出图提示词"><textarea className="director-prompt" rows={6} maxLength={4000} value={prompt} onChange={e => setPrompt(e.target.value)}/></Field>
        <div className="director-field"><span>出现在</span><EpisodePicker episodes={work.episodes} value={episodeIds} onChange={setEpisodeIds}/>
          {!episodeIds.length && <small>{episodesEdited ? "至少选一集" : "还没指定出现的集，不改也能保存"}</small>}</div>
        <div className="director-card-actions">
          <button type="button" className="ip-brand-button" disabled={!!busy || (episodesEdited && !episodeIds.length)} onClick={save}>保存</button>
          <button type="button" className="ip-brand-secondary" onClick={() => { setEditing(false); clearDrafts(prefix); }}><X size={14}/>取消</button>
        </div>
      </>}
      {!editing && <p className="director-asset-desc">{asset.description || "暂无描述"}</p>}
      {!editing && <section className="director-sheet-section director-asset-refs" aria-label="用在哪些片段">
        <h5>用在哪些片段<small>{refs.length ? `${refs.length} 个` : "没有片段在用"}</small></h5>
        {refs.length > 0 && <AssetRefList refs={refs} onGo={r => focusClip({ clipId: r.clipId, assetId: asset.id, open: r.linked ? "assets" : "editor" })}/>}
        {refs.length > 0 && <small className="director-muted">要删除这项资产，先在这些片段里解除关联（「前往」后在「关联资产」里操作）。</small>}
      </section>}
      {!editing && !audioOnly && <section className="director-sheet-section" aria-label="参考图">
        <h5>参考图</h5>
        <InlineError message={asset.image.error?.message}/>
        <OutdatedNote slot={asset.image} what="张参考图" onRegenerate={generating ? undefined : generate} disabled={!!busy}/>
        <VersionStrip slot={asset.image} label={asset.name} disabled={!!busy} onAdopt={id => void run("adopt", async () => apply(await DirectorApi.edit(work.id, "asset.adopt", asset.id, null, { candidateId: id })), failed(setError, `换用「${asset.name}」的这版参考图`))}/>
        {asset.kind === "character" && <CharacterRef work={work} asset={asset} apply={apply} setError={setError} disabled={!!busy || !!generating}/>}
        {assistant && current && <button type="button" className="director-ask-ai director-self-start" onClick={() => ask({ kind: "image", assetId: asset.id })}
          title="说说这张哪里要改，助手改出图提示词；生成新版本前会说清费用，原图保留"><Wand2 size={13}/>围绕这张图修改</button>}
        <div className="director-card-actions">
          {asset.image.adoptedBy === "auto" && <button type="button" className="ip-brand-button" disabled={!!busy} onClick={() => void run("confirm", async () => apply(await DirectorApi.edit(work.id, "assets.confirm", null, null, { assetIds: [asset.id] })), failed(setError, `确认「${asset.name}」的参考图`))}><Check size={14}/>确认使用</button>}
          <button type="button" className={asset.image.adoptedId ? "ip-brand-secondary" : "ip-brand-button"} disabled={!!busy || !!generating} onClick={generate}>
            <Wand2 size={14}/>{generating ? "生成中" : asset.image.candidates.length ? "重新生成" : "生成参考图"}</button>
          <button type="button" className="ip-brand-secondary" disabled={!!busy || !!generating} onClick={() => setPicking(true)} title="这项资产就是资产库里已有的那一项，直接用它的图"><Library size={14}/>关联已有资产</button>
          <button type="button" className="ip-brand-secondary" disabled={!!busy || !!generating} onClick={() => file.current?.click()} title="上传的图直接作为参考图"><Upload size={14}/>上传图片</button>
          <span className="director-spacer"/>
          <small className="director-cost">{work.pricing.mock ? costText(0, true) : `每张${costText(work.pricing.image, false)}`}</small>
        </div>
        <button type="button" className="director-disclosure" aria-expanded={showPrompt} onClick={() => setShowPrompt(s => !s)}>
          <ChevronRight size={14}/>出图提示词{asset.promptCustom && <em>已自定义</em>}</button>
        {showPrompt && <pre className="director-prompt">{asset.prompt}</pre>}
        {showPrompt && asset.promptCustom && <button type="button" className="ip-brand-text-button director-self-start" disabled={!!busy} onClick={resetPrompt}><RefreshCw size={13}/>恢复自动生成</button>}
      </section>}
      <input ref={file} type="file" accept="image/png,image/jpeg" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }}/>
      <LinkLibrary work={work} asset={asset} apply={apply} open={picking} onClose={() => setPicking(false)}/>
      {!editing && asset.kind === "character" && <VoicePanel work={work} asset={asset} apply={apply}/>}
    </div>
  </article>;
}

/**
 * 角色的形象参考照片：只在生成或重新生成设定图时作为图1交给模型，只取长相，版式按设定集重新画。
 * 想直接用某张图当角色图，用「上传图片」或「关联已有资产」。
 */
function CharacterRef({ work, asset, apply, setError, disabled }: Pick<WorkbenchProps, "work" | "apply" | "setError"> & { asset: DirectorAsset; disabled: boolean }) {
  const { busy, run } = useBusy();
  const file = useRef<HTMLInputElement>(null);
  const ref = asset.refImage;
  const upload = (f: File) => void run("ref", async () => {
    const result = await IpStudioApi.uploadImage(f);
    apply(await DirectorApi.edit(work.id, "asset.setRef", asset.id, null, { key: result.key }));
  }, failed(setError, `上传「${asset.name}」的形象参考`, "形象参考没有变。换一张 PNG 或 JPG 照片再试。"));
  const clear = () => void run("ref", async () => apply(await DirectorApi.edit(work.id, "asset.clearRef", asset.id, null)), failed(setError, `移除「${asset.name}」的形象参考`));
  return <div className="director-ref">
    {ref?.url ? <img src={ref.url} alt={`${asset.name}的形象参考`}/> : <span className="director-ref-empty"><ImageIcon size={16}/></span>}
    <div className="director-ref-text">
      <strong>形象参考{ref ? "" : "（可选）"}</strong>
      <small>{ref ? "生成设定图时照着它画长相，改了参考要重新生成" : "生成设定图时可以照着一张照片画长相"}</small>
    </div>
    <div className="director-ref-actions">
      <button type="button" className="ip-brand-text-button" disabled={disabled || !!busy} onClick={() => file.current?.click()}>上传</button>
      {ref && <button type="button" className="ip-brand-text-button" disabled={disabled || !!busy} onClick={clear}>移除</button>}
    </div>
    <input ref={file} type="file" accept="image/png,image/jpeg" hidden onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }}/>
  </div>;
}

/** 关联已有资产：只交资产库对象 id 和选定版本，图和描述由服务端按本人资产库读；所选版本的图直接作为参考图。 */
function LinkLibrary({ work, asset, apply, open, onClose }: { work: DirectorWork; asset: DirectorAsset; apply: WorkbenchProps["apply"]; open: boolean; onClose: () => void }) {
  return <LibraryReferencePicker open={open} objectsOnly max={1} query={asset.name} onClose={onClose}
    title={`「${asset.name}」关联已有资产`} confirmLabel="关联"
    intro={`选资产库里的同一个${kindLabel[asset.kind]}，它选中版本的图直接作为参考图，分镜图和视频照着它画。名字保留剧本里的叫法。`}
    onAssets={async picked => {
      const ref = picked[0]?.metadata?.libraryReference as { objectId: string; versionId?: string } | undefined;
      if (!ref) return;
      apply(await DirectorApi.edit(work.id, "asset.link", asset.id, null, { objectId: ref.objectId, versionId: ref.versionId ?? null }));
    }}/>;
}
