"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ImageIcon, Mic, Plus, Upload, Wand2 } from "lucide-react";
import type { DirectorAsset, DirectorAssetKind } from "@ai-star-eco/types";
import { DirectorApi, IpStudioApi } from "../api";
import { useStudioApp } from "../studio-errors";
import type { WorkbenchProps } from "./director-workbench";
import { DIRECTOR_MEDIA_SHORTAGE, Field, InlineError, Spinner, adopted, chooseDirectorBilling, costText, errorText, failed, kindLabel, newRequestId, runningTask, useBusy } from "./director-shared";
import { VoiceDialog } from "./director-voice";
import { useAssistant } from "./director-assistant";
import { confirmDirectorAction } from "./director-antd";
import { DirectorAssetStudio, EpisodePicker, IMAGE_USES, ImageInput, imageProblem } from "./director-asset-studio";

const KINDS: DirectorAssetKind[] = ["character", "scene", "prop"];

export function DirectorAssets(props: WorkbenchProps) {
  const { work, apply, setError } = props;
  const [kind, setKind] = useState<DirectorAssetKind | "all">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const { busy, run } = useBusy();
  const extracting = work.tasks.find(t => t.status === "running" && t.target.startsWith("extract"));
  const extractError = work.textError?.task === "extract" ? work.textError.message : null;
  // 资产全剧共用、一次提取，这里不再按集筛选；每张卡片写出现在哪几集。商品在「商品」工作区，不在这里。
  const scoped = work.assets.filter(a => a.kind !== "product");
  const shown = scoped.filter(a => kind === "all" || a.kind === kind);
  const open = scoped.find(a => a.id === openId);
  const sortedShown = [...shown].sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
  // 助手卡片上的「查看版本」：打开那项资产的详情，比较新生成的资产图。
  const reveal = useAssistant()?.reveal;
  useEffect(() => { if (reveal?.type === "asset" && work.assets.some(a => a.id === reveal.id)) setOpenId(reveal.id); }, [reveal]); // eslint-disable-line react-hooks/exhaustive-deps
  const waiting = scoped.filter(a => a.image.adoptedBy === "auto");
  // 资产一次按全剧提取：同一人物、场景在各集是同一个，不会因为分集提取而前后不一致。
  // 全剧一次读不完时分批提取：有的集提取过、有的没有，按钮就写「继续提取」，服务端从第一个没提取的集接着读。
  const budget = work.pricing.textChars ?? 0;
  const batched = budget > 0 && work.episodes.reduce((n, e) => n + e.content.length, 0) > budget;
  const leftover = batched && scoped.length > 0 ? work.episodes.filter(e => !e.extracted).length : 0;
  const extractLabel = leftover > 0 && leftover < work.episodes.length ? `继续提取剩下 ${leftover} 集` : scoped.length ? "重新提取全剧资产" : "提取全剧资产";
  const extract = () => void run("extract", async () => {
    const cost = work.pricing.textMax;
    const billing = await chooseDirectorBilling("asset-extract");
    apply(await DirectorApi.runTask(work.id, { type: "extract", targetId: null, clientRequestId: newRequestId(), billing, maxCost: cost }));
  }, failed(setError, extractLabel));
  // 一次给所有还没有资产图的资产各出一张：只出画面的（排除仅声音出场）、没在生成的。
  const { modal } = useStudioApp();
  const missing = scoped.filter(a => !a.image.adoptedId && !a.description.includes("只出声音") && !runningTask(work, `asset:${a.id}`))
    .sort((a, b) => KINDS.indexOf(a.kind) - KINDS.indexOf(b.kind));
  const generateAll = () => {
    const total = missing.length * work.pricing.image;
    confirmDirectorAction(modal, {
      title: `为 ${missing.length} 项资产生成资产图？`,
      content: <div className="director-batch-confirm"><p>{missing.map(a => a.name).join("、")}</p>
        <p className="director-muted">每项一张，{costText(total, work.pricing.mock)}。生成后逐张确认，分镜图将以确认后的资产图为参考。</p></div>,
      okText: "开始生成", cancelText: "取消",
    }, () => void run("all", async () => {
      const billing = await chooseDirectorBilling("image", total);
      const failures: string[] = [];
      for (const a of missing) {
        try { apply(await DirectorApi.runTask(work.id, { type: "asset-image", targetId: a.id, clientRequestId: newRequestId(), billing, maxCost: work.pricing.image })); }
        catch (e) { failures.push(`${a.name}：${errorText(e)}`); }
      }
      if (failures.length) setError({ action: "生成全部资产图", error: `${missing.length} 项中有 ${failures.length} 项提交失败：${failures.join("；")}`,
        next: "其余资产图已开始生成。提交失败的，请按上述原因处理后，在对应资产上点击「生成」。" });
    }, failed(setError, "生成全部资产图", undefined, undefined, DIRECTOR_MEDIA_SHORTAGE)));
  };
  const confirmAll = () => void run("confirm", async () => apply(await DirectorApi.edit(work.id, "assets.confirm", null, null, { assetIds: waiting.map(a => a.id) })), failed(setError, "确认全部资产图"));

  if (work.episodes.length === 0) return <div className="director-panel director-empty-panel"><p>请先在「剧本」完成剧本并拆分集。</p></div>;
  return <div className="director-assets">
    <div className="director-toolbar">
      <div className="director-segmented director-kind-tabs" role="tablist" aria-label="资产类型">
        {(["all", ...KINDS] as const).map(k => <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => setKind(k)}>
          {k === "all" ? "全部" : kindLabel[k]}<small>{k === "all" ? scoped.length : scoped.filter(a => a.kind === k).length}</small></button>)}
      </div>
      <span className="director-spacer"/>
      {extracting ? <Spinner label="资产提取中"/> : <>
        <button type="button" className={scoped.length ? "ip-brand-secondary" : "ip-brand-button"} disabled={!!busy} onClick={extract}><Wand2 size={15}/>{extractLabel}</button>
      </>}
      <button type="button" className="ip-brand-secondary" onClick={() => setAdding(true)} title="补充提取时遗漏的角色、场景或道具，可使用自己的图片"><Plus size={15}/>添加资产</button>
      {missing.length > 0 && <button type="button" className="ip-brand-button" disabled={!!busy} onClick={generateAll}
        title={`为暂无资产图的 ${missing.length} 项资产各生成一张，${costText(missing.length * work.pricing.image, work.pricing.mock)}`}><Wand2 size={15}/>生成全部资产图<small className="director-count">{missing.length}</small></button>}
    </div>
    <InlineError message={extractError}/>
    {waiting.length > 0 && <div className="director-confirm-bar"><span>{waiting.length} 张资产图待确认。分镜图将以此为参考，请确认后继续。</span>
      <button type="button" className="ip-brand-button" disabled={!!busy} onClick={confirmAll}><Check size={15}/>全部确认</button></div>}
    {adding && <AddAsset {...props} onClose={() => setAdding(false)}/>}
    {shown.length === 0 ? <div className="director-panel director-empty-panel"><p>{!scoped.length ? "暂无资产。点击「提取全剧资产」，从正文识别角色、场景和道具。" : "此类暂无资产。"}</p></div> :
      <div className="director-asset-grid">{sortedShown.map(a => <AssetTile key={a.id} {...props} asset={a} onOpen={() => setOpenId(a.id)}/>)}</div>}
    {open && <DirectorAssetStudio {...props} asset={open} list={sortedShown.some(a => a.id === open.id) ? sortedShown : scoped} onSelect={setOpenId} onClose={() => setOpenId(null)}/>}
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
  const status = generating ? "生成中" : audioOnly ? "仅声音出场" : !asset.image.adoptedId ? "缺少资产图" : asset.image.adoptedCheck === "outdated" ? "需更新" : asset.image.adoptedBy === "auto" ? "待确认" : "已确认";
  const viewCount = Object.values(asset.views ?? {}).filter(slot => slot?.adoptedId).length;
  const variantNote = asset.forms?.length ? `${asset.forms.length + 1} 个形态` : viewCount ? `四视图 ${viewCount + 1}/4` : "";
  const tone = status === "已确认" ? "is-done" : status === "缺少资产图" ? "is-error" : status === "待确认" || status === "需更新" ? "is-warn" : "";
  const generate = () => void run("gen", async () => {
    const cost = work.pricing.image;
    const billing = await chooseDirectorBilling("image", cost);
    apply(await DirectorApi.runTask(work.id, { type: "asset-image", targetId: asset.id, clientRequestId: newRequestId(), billing, maxCost: cost }));
  }, failed(setError, `生成「${asset.name}」的资产图`, undefined, undefined, DIRECTOR_MEDIA_SHORTAGE));
  return <article className={`director-asset-tile ${tone} kind-${asset.kind}`}>
    <button type="button" className="director-asset-tile-open" onClick={onOpen} aria-label={`查看${asset.name}`}>
      <span className="director-asset-tile-image">
        {current?.url ? <img src={current.url} alt=""/> : <span className="director-asset-placeholder"><ImageIcon size={20}/>{audioOnly ? "仅声音出场" : "暂无资产图"}</span>}
        {generating && <span className="director-asset-overlay"><Spinner label="生成中"/></span>}
        <span className="director-kind is-floating">{kindLabel[asset.kind]}</span>
        {current?.mock && <span className="director-kind is-floating is-right">测试图</span>}
        {current && !current.mock && current.source === "upload" && <span className="director-kind is-floating is-right">已上传</span>}
      </span>
      <span className="director-asset-tile-copy">
        <b title={asset.name}>{asset.name}{appears && <small>{appears}</small>}</b>
        <span title={asset.description}>{asset.description || "暂无描述"}</span>
        {variantNote && <em className="director-asset-tile-variants">{variantNote}</em>}
      </span>
    </button>
    <footer>
      <small className={`director-tile-status ${tone}`}>{status}</small>
      {asset.kind === "character" && <button type="button" className={`director-voice-chip ${asset.voice || asset.voiceDesc ? "is-set" : ""}`} onClick={() => setVoiceOpen(true)}
        aria-label={asset.voice || asset.voiceDesc ? `${asset.name}的音色已设置，点击修改` : `设置${asset.name}的音色`} title={asset.voice || asset.voiceDesc ? "音色已设置，点击修改" : "设置角色音色"}><Mic size={14}/></button>}
      {asset.image.adoptedBy === "auto" && !generating && <button type="button" className="ip-brand-button" disabled={!!busy} onClick={() => void run("confirm", async () => apply(await DirectorApi.edit(work.id, "assets.confirm", null, null, { assetIds: [asset.id] })), failed(setError, `确认「${asset.name}」的资产图`))}><Check size={13}/>确认</button>}
      {!asset.image.adoptedId && !audioOnly && !generating && <button type="button" className="ip-brand-button" disabled={!!busy} title={costText(work.pricing.image, work.pricing.mock)} onClick={generate}><Wand2 size={13}/>生成</button>}
    </footer>
    {!generating && <InlineError message={asset.image.error?.message}/>}
    {voiceOpen && <VoiceDialog work={work} asset={asset} apply={apply} onClose={() => setVoiceOpen(false)}/>}
  </article>;
}

function AddAsset({ work, apply, setError, onClose }: WorkbenchProps & { onClose: () => void }) {
  const [kind, setKind] = useState<DirectorAssetKind>("character");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // 默认全剧：手动补的多半是提取漏掉的常驻角色或场景，只在个别集出现的取消勾选即可。
  const [episodeIds, setEpisodeIds] = useState(() => work.episodes.map(e => e.id));
  // 可以直接用自己的图建资产：图先上传拿到 key，点「添加」时和资产一起提交，用法必须选清楚。
  const [image, setImage] = useState<{ key: string; url: string; name: string }>();
  const [use, setUse] = useState<keyof typeof IMAGE_USES>("asset");
  const [imageError, setImageError] = useState("");
  const pick = useRef<HTMLInputElement>(null);
  const { busy, run } = useBusy();
  const choose = (f: File) => {
    const problem = imageProblem(f);
    setImageError(problem);
    if (problem) return;
    void run("image", async () => {
      const result = await IpStudioApi.uploadImage(f);
      setImage({ key: result.key, url: result.url, name: f.name });
      setName(n => n.trim() ? n : f.name.replace(/\.[^.]+$/, "").slice(0, 40));
    }, message => setImageError(`图片上传失败：${message}`));
  };
  const save = () => void run("add", async () => {
    apply(await DirectorApi.edit(work.id, "asset.create", null, null, { kind, name, description, episodeIds, ...(image ? { image: { key: image.key, use } } : {}) }));
    onClose();
  }, failed(setError, `添加${kindLabel[kind]}「${name.trim() || "未命名"}」`, "已填写的内容和图片已保留，请按原因修改后点击「添加」。"));
  return <section className="director-panel director-add" aria-label="添加资产">
    <div className="director-segmented" role="group" aria-label="类型">{KINDS.map(k => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)}>{kindLabel[k]}</button>)}</div>
    <Field label="名称"><input value={name} maxLength={40} onChange={e => setName(e.target.value)}/></Field>
    <Field label="外观与设定"><textarea rows={3} maxLength={2000} value={description} onChange={e => setDescription(e.target.value)}/></Field>
    <div className="director-field"><span>图片（选填）</span>
      <div className="director-own-image">
        {image ? <img src={image.url} alt="已上传的图片"/> : <span className="director-ref-empty"><ImageIcon size={18}/></span>}
        <div className="director-own-image-text">
          <strong title={image?.name}>{busy === "image" ? "正在上传图片…" : image ? image.name : "使用自己的图片"}</strong>
          <small>支持手机照片，上传后选择用途。</small>
        </div>
        <div className="director-ref-actions">
          <button type="button" className="ip-brand-secondary" disabled={!!busy} onClick={() => pick.current?.click()}><Upload size={14}/>{image ? "换一张" : "上传图片"}</button>
          {image && <button type="button" className="ip-brand-text-button" disabled={!!busy} onClick={() => setImage(undefined)}>移除</button>}
        </div>
      </div>
      <ImageInput input={pick} onFile={choose} label="选择资产图片"/>
      <InlineError message={imageError}/>
      {image && <div className="director-image-use" role="radiogroup" aria-label="图片用途">
        {(Object.keys(IMAGE_USES) as (keyof typeof IMAGE_USES)[]).map(k => <label key={k} className={`director-check ${use === k ? "is-on" : ""}`}>
          <input type="radio" name="director-image-use" checked={use === k} onChange={() => setUse(k)}/>
          <span><b>{IMAGE_USES[k].label}</b><small>{k === "ref" ? `生成资产图时由 AI 参照此图（${kind === "character" ? "取长相" : "取外观"}），上传时不生成，不消耗积分` : IMAGE_USES[k].note}</small></span>
        </label>)}
      </div>}
    </div>
    <div className="director-field"><span>出现在</span><EpisodePicker episodes={work.episodes} value={episodeIds} onChange={setEpisodeIds}/></div>
    <div className="director-actions"><button type="button" className="ip-brand-secondary" onClick={onClose}>取消</button>
      <button type="button" className="ip-brand-button" disabled={!!busy || !name.trim() || !episodeIds.length} onClick={save}>添加</button>
      {(!name.trim() || !episodeIds.length) && <small className="director-muted">{!name.trim() ? "请填写名称" : "至少选择一集"}</small>}</div>
  </section>;
}
