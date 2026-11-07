"use client";

// 带货短剧的商品工作区（docs/ai-director-commerce-plan.md）。
// 商品资料在个人资产库（kind=product，这里叫商品库）；作品里只存快照、选中的那张图和这部剧的植入想法。
// 商品图只来自商品库，不用 AI 生成；片段关联商品后，选中的那张图会作为分镜图和视频的参考图。

import { useCallback, useEffect, useRef, useState } from "react";
import { IMAGE_UPLOAD_ACCEPT } from "@ai-star-eco/api-client/image-upload-policy";
import { ArrowLeft, ArrowRight, Check, ImageIcon, Loader2, MoreHorizontal, PackageOpen, Pencil, Plus, RefreshCw, Search, ShoppingBag, Star, Trash2, Upload, X } from "lucide-react";
import type { DirectorAsset, DirectorAssistantScope, DirectorWork, LibraryObject } from "@ai-star-eco/types";
import { addLibraryVersion, createLibraryObject, deleteLibraryObject, editLibraryObject, libraryObjects, mainLibraryVersion, readLibraryObject } from "@/canvas-bridge/asset-library";
import { DirectorApi, IpStudioApi } from "../api";
import { AiMark } from "../studio-ai-icon";
import { normalizeStudioError, useStudioApp } from "../studio-errors";
import { useAssistant } from "./director-assistant";
import { confirmDirectorAction } from "./director-antd";
import { AssetRefList } from "./director-asset-studio";
import { InlineError, ZoomableImage, adopted, assetRefs, dialogFocus, errorText, failed, useBusy, useEscape, type AssetRef } from "./director-shared";
import type { WorkbenchProps } from "./director-workbench";

const PLACEMENT_MAX = 300;
const NAME_MAX = 40;
const DESCRIPTION_MAX = 2000;
const IMAGES_MAX = 8;

export function productsOf(work: DirectorWork) {
  return work.assets.filter(a => a.kind === "product");
}

/**
 * 剧本里能不能认出这件商品：按名字和别名找正文，再加上提取资产时记下的出现集。
 * 中文商品名的主体在后面，剧本里常写简称（「恒温保温杯」写成「保温杯」，「玫瑰香水」写成「香水」），所以名字结尾两个字以上也算。
 * 这只是界面上的提示，认错了也不影响生成。
 */
export function productMentions(work: DirectorWork, asset: DirectorAsset): { episodes: number[]; inDraft: boolean } {
  const names = new Set([asset.name, ...asset.aliases].filter(n => n.trim().length >= 2));
  for (const run of asset.name.match(/[\u4e00-\u9fff]{2,}/g) ?? []) for (let i = 0; i <= run.length - 2; i++) names.add(run.slice(i));
  const said = (text: string) => [...names].some(n => text.includes(n));
  return {
    episodes: work.episodes.filter(e => said(e.content) || asset.episodeIds.includes(e.id)).map(e => e.no),
    inDraft: !work.episodes.length && said(work.draft),
  };
}

const isDesktop = () => document.documentElement.dataset.layout === "desktop";

/** 手机上打开弹窗不把焦点放进输入框：键盘一弹就把商品盖住了，要搜再点。 */
function libraryFocus(el: HTMLElement | null) {
  const cleanup = dialogFocus(el);
  if (el && !isDesktop()) el.focus({ preventScroll: true });
  return cleanup;
}

/** 商品库和本剧的这件商品还一样吗：名称、说明变了，或者多了新图，才算有更新。读不到（已删除）是 gone。 */
export function libraryDiff(asset: DirectorAsset, object: LibraryObject): "same" | "changed" {
  const keys = new Set(asset.image.candidates.map(m => m.key));
  const changed = object.name.slice(0, NAME_MAX) !== asset.name || object.description.trim() !== asset.description
    || object.versions.some(v => !keys.has(v.storageKey));
  return changed ? "changed" : "same";
}

function hasScript(work: DirectorWork) {
  return !!work.draft.trim() || work.episodes.length > 0;
}

/** 这件商品现在到哪一步了：一行字，卡片和测试共用。 */
export function productStatus(work: DirectorWork, asset: DirectorAsset): { text: string; tone: "done" | "todo" | "idle" } {
  const clips = work.clips.filter(c => c.assetIds.includes(asset.id)).length;
  const { episodes, inDraft } = productMentions(work, asset);
  const where = episodes.length ? (episodes.length === work.episodes.length && episodes.length > 1 ? "全剧" : `第 ${episodes.join("、")} 集`) : inDraft ? "剧本" : "";
  if (clips) return { text: `${where ? `已写入${where} · ` : ""}用于 ${clips} 个片段`, tone: "done" };
  if (where) return { text: `已写入${where}`, tone: "done" };
  if (!hasScript(work)) return { text: "生成剧本时写入剧情", tone: "idle" };
  return { text: "剧本中尚未写到", tone: "todo" };
}

// ── 商品工作区 ────────────────────────────────────────────────────────────

export function DirectorProducts(props: WorkbenchProps) {
  const { work } = props;
  const products = productsOf(work);
  const [library, setLibrary] = useState<{ edit?: string } | null>(null);
  return <div className="director-products">
    <header className="director-products-head">
      <div>
        <h2>本剧商品{products.length > 0 && <small>{products.length}</small>}</h2>
        <p>这些商品将写入剧情，商品图用作分镜图和视频的参考图。</p>
      </div>
      {products.length > 0 && <button type="button" className="ip-brand-secondary" onClick={() => setLibrary({})}><ShoppingBag size={15}/>从商品库添加</button>}
    </header>
    {products.length === 0 ? <div className="director-products-empty">
      <span aria-hidden><PackageOpen size={26} strokeWidth={1.5}/></span>
      <h3>暂无商品</h3>
      <p>选择要植入的商品，例如男主角手中的保温杯、女主角常用的香水。</p>
      <button type="button" className="ip-brand-button" onClick={() => setLibrary({})}><Plus size={15}/>添加商品</button>
    </div> : <div className="director-product-grid">
      {products.map(p => <ProductCard key={p.id} {...props} asset={p} onEdit={id => setLibrary({ edit: id })}/>)}
    </div>}
    {library && <ProductLibrary work={work} apply={props.apply} initialEdit={library.edit} onClose={() => setLibrary(null)}/>}
  </div>;
}

function ProductCard({ work, asset, apply, setError, focusClip, goTab, pickEpisode, episodeId, onEdit }: WorkbenchProps & { asset: DirectorAsset; onEdit: (objectId: string) => void }) {
  const { busy, run } = useBusy();
  const { modal } = useStudioApp();
  const current = adopted(asset.image);
  const status = productStatus(work, asset);
  const candidates = asset.image.candidates;
  const [placement, setPlacement] = useState(asset.placement ?? "");
  const saved = useRef(asset.placement ?? "");
  const [flash, setFlash] = useState("");
  useEffect(() => { if (!flash) return; const timer = window.setTimeout(() => setFlash(""), 2000); return () => window.clearTimeout(timer); }, [flash]);
  useEffect(() => { if ((asset.placement ?? "") !== saved.current) { saved.current = asset.placement ?? ""; setPlacement(saved.current); } }, [asset.placement]);
  const savePlacement = () => {
    const next = placement.trim();
    if (next === saved.current) return;
    void run("placement", async () => { apply(await DirectorApi.edit(work.id, "asset.update", asset.id, asset.rev, { placement: next })); saved.current = next; setPlacement(next); setFlash("已保存"); },
      failed(setError, `保存「${asset.name}」的植入想法`, "输入框中的内容已保留，请重试。"));
  };
  const pick = (id: string) => { if (id !== asset.image.adoptedId) void run("adopt", async () => apply(await DirectorApi.edit(work.id, "asset.adopt", asset.id, null, { candidateId: id })), failed(setError, `更换「${asset.name}」的参考图`)); };
  const [library, setLibrary] = useState<"same" | "changed" | "gone" | null>(null);
  useEffect(() => {
    if (!asset.libraryObjectId) return;
    let live = true;
    readLibraryObject(asset.libraryObjectId).then(o => { if (live) setLibrary(libraryDiff(asset, o)); })
      .catch(e => { if (live && normalizeStudioError(e).code === "IP_LIBRARY_NOT_FOUND") setLibrary("gone"); });
    return () => { live = false; };
  }, [asset.libraryObjectId, asset.rev]); // eslint-disable-line react-hooks/exhaustive-deps
  const sync = () => void run("sync", async () => { apply(await DirectorApi.edit(work.id, "product.add", null, null, { objectId: asset.libraryObjectId })); setFlash("已更新"); }, failed(setError, `更新「${asset.name}」`, "本剧已有的商品资料和图片保持不变。"));
  const refs = assetRefs(work, asset.id);
  // 状态行能点：写进了片段就去那个片段，只写进了剧本就去那一集的正文。
  const firstClip = refs.find(r => r.linked);
  const firstEpisode = work.episodes.find(e => productMentions(work, asset).episodes.includes(e.no));
  const goToUse = firstClip ? () => focusClip({ clipId: firstClip.clipId, assetId: asset.id, open: "assets" })
    : status.tone === "done" ? () => { if (firstEpisode) pickEpisode(firstEpisode.id); goTab("script"); } : null;
  const blocked = (list: AssetRef[], error?: unknown) => setError({
    action: `从本剧移除「${asset.name}」`,
    error: error ?? { code: "DIRECTOR_ASSET_IN_USE", message: `「${asset.name}」仍用于 ${list.length} 个片段，未移除。` },
    extra: close => <AssetRefList refs={list} onGo={r => { close(); focusClip({ clipId: r.clipId, assetId: asset.id, open: "assets" }); }}/>,
    next: <p>请点击片段旁的「前往」，在「关联资产」中解除「{asset.name}」的关联，全部解除后再移除。</p>,
  });
  const remove = () => refs.length ? blocked(refs) : confirmDirectorAction(modal, {
    title: `从本剧移除「${asset.name}」？`, content: "仅从本剧移除，商品库中的商品保留，剧本正文不变。", okText: "移除", cancelText: "取消", okButtonProps: { danger: true },
  }, () => void run("remove", async () => apply(await DirectorApi.edit(work.id, "asset.delete", asset.id, null)), (message, e) => {
    const server = e as { code?: string; details?: { clips?: AssetRef[] } } | undefined;
    if (server?.code === "DIRECTOR_ASSET_IN_USE") blocked(server.details?.clips?.length ? server.details.clips : refs, e);
    else setError({ action: `从本剧移除「${asset.name}」`, error: e ?? message });
  }));
  return <article className="director-product-card">
    <div className="director-product-media">
      <div className="director-product-image">{current?.url ? <ZoomableImage src={current.url} alt={asset.name}/> : <span className="director-product-noimage"><ImageIcon size={20}/></span>}</div>
      {candidates.length > 1 && <div className="director-product-thumbs" role="radiogroup" aria-label={`选择「${asset.name}」的参考图`}>
        {candidates.map((m, i) => <button key={m.id} type="button" role="radio" aria-checked={m.id === asset.image.adoptedId} aria-label={`第 ${i + 1} 张`} disabled={!!busy}
          title={m.id === asset.image.adoptedId ? "分镜图和视频以此图为参考" : "设为参考图"} onClick={() => pick(m.id)}>{m.url ? <img src={m.url} alt=""/> : <ImageIcon size={12}/>}</button>)}
      </div>}
      {candidates.length > 1 && <small className="director-product-thumbs-note">选中的图片用作参考图</small>}
    </div>
    <div className="director-product-body">
      <header>
        <h3 title={asset.name}>{asset.name}</h3>
        <ProductMenu name={asset.name} busy={!!busy} canEdit={!!asset.libraryObjectId && library !== "gone"} onEdit={() => onEdit(asset.libraryObjectId!)} onRemove={remove}/>
      </header>
      {asset.description ? <p className="director-product-desc" title={asset.description}>{asset.description}</p> : <p className="director-product-desc is-empty">暂无商品说明</p>}
      {library === "changed" && <button type="button" className="director-product-outdated" disabled={!!busy} onClick={sync}><RefreshCw size={12}/>商品库有更新，点击同步到本剧</button>}
      {library === "gone" && <p className="director-product-gone">商品库中已删除此商品，本剧继续使用已添加的内容。</p>}
      <label className="director-product-idea">
        <span>植入想法<em>选填</em>{flash ? <i className="director-product-saved" role="status"><Check size={12}/>{flash}</i> : placement.length > PLACEMENT_MAX - 50 ? <i>{placement.length}/{PLACEMENT_MAX}</i> : null}</span>
        <textarea rows={2} maxLength={PLACEMENT_MAX} value={placement} placeholder="谁在什么情节中如何使用。留空由 AI 安排" onChange={e => setPlacement(e.target.value)} onBlur={savePlacement}/>
      </label>
      <footer>
        {goToUse ? <button type="button" className={`director-product-status is-${status.tone}`} title={firstClip ? "前往用到它的片段" : "前往剧本"} onClick={goToUse}><i aria-hidden/>{status.text}<ArrowRight size={12} aria-hidden/></button>
          : <span className={`director-product-status is-${status.tone}`}><i aria-hidden/>{status.text}</span>}
        <WriteIntoScript work={work} asset={asset} placement={placement} episodeId={episodeId} done={status.tone === "done"}/>
      </footer>
    </div>
  </article>;
}

/** 卡片右上角的「更多」。和作品卡片同一种写法：键盘可达，Esc 或焦点离开时收起。 */
function ProductMenu({ name, busy, canEdit, onEdit, onRemove }: { name: string; busy: boolean; canEdit: boolean; onEdit: () => void; onRemove: () => void }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = (focus: boolean) => { const el = ref.current; if (!el?.open) return; el.open = false; if (focus) el.querySelector("summary")?.focus(); };
  const item = (fn: () => void) => () => { close(true); fn(); };
  return <details ref={ref} className="director-work-menu director-product-menu" onKeyDown={e => { if (e.key === "Escape") { e.stopPropagation(); close(true); } }}
    onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) close(false); }}>
    <summary aria-label={`商品 ${name} 的更多操作`} title="更多"><MoreHorizontal size={16}/></summary>
    <div role="menu">
      {canEdit && <button type="button" role="menuitem" onClick={item(onEdit)}><Pencil size={14}/>在商品库编辑</button>}
      <button type="button" role="menuitem" className="director-danger" disabled={busy} onClick={item(onRemove)}><Trash2 size={14}/>从本剧移除</button>
    </div>
  </details>;
}

/** 已有剧本时把商品写进去：交给创作助手出修改建议，用户逐条采用，可以撤销。 */
function WriteIntoScript({ work, asset, placement, episodeId, done }: { work: DirectorWork; asset: DirectorAsset; placement: string; episodeId: string | null; done: boolean }) {
  const ctl = useAssistant();
  const ref = useRef<HTMLDetailsElement>(null);
  if (!ctl || !hasScript(work)) return null;
  const idea = placement.trim();
  const ask = (scope: DirectorAssistantScope) => {
    if (ref.current) ref.current.open = false;
    ctl.ask(scope, `把商品「${asset.name}」自然写进这一段剧情${idea ? `：${idea}` : "，选一个合适的情节"}。只改必要的句子，不改主线。`);
  };
  const label = <><AiMark size={13}/>写入剧本</>;
  const className = `director-product-write ${done ? "is-quiet" : ""}`;
  const tip = "创作助手将给出修改建议，逐条采用后写入正文";
  if (work.episodes.length <= 1) {
    const only = work.episodes[0]?.id ?? "draft";
    return <button type="button" className={className} title={tip} onClick={() => ask({ kind: "script", episodeId: only })}>{label}</button>;
  }
  const { episodes } = productMentions(work, asset);
  return <details ref={ref} className="director-product-episodes" onKeyDown={e => { if (e.key === "Escape" && ref.current) { e.stopPropagation(); ref.current.open = false; } }}
    onBlur={e => { if (ref.current && !e.currentTarget.contains(e.relatedTarget as Node | null)) ref.current.open = false; }}>
    <summary className={className} title={tip}>{label}</summary>
    <div role="menu" aria-label="写入哪一集">
      {work.episodes.map(e => <button key={e.id} type="button" role="menuitem" className={e.id === episodeId ? "is-current" : undefined} onClick={() => ask({ kind: "script", episodeId: e.id })}>
        <span title={e.title}>第 {e.no} 集{e.title ? ` · ${e.title}` : ""}</span>{episodes.includes(e.no) && <small>已写到</small>}
      </button>)}
    </div>
  </details>;
}

// ── 剧本页顶部的商品栏 ────────────────────────────────────────────────────

export function CommerceStrip({ work, goTab }: Pick<WorkbenchProps, "work" | "goTab">) {
  if (!work.settings.commerce) return null;
  const products = productsOf(work);
  if (!products.length) return <div className="director-commerce-strip is-empty" role="status">
    <ShoppingBag size={15}/><span>尚未添加商品，生成的剧本不会植入商品。</span>
    <button type="button" className="ip-brand-text-button" onClick={() => goTab("products")}>添加商品</button>
  </div>;
  const shown = products.slice(0, 4);
  return <div className="director-commerce-strip">
    <span className="director-commerce-strip-label"><ShoppingBag size={15}/>{hasScript(work) ? "本剧商品" : "写入剧情的商品"}</span>
    <ul>{shown.map(p => { const image = adopted(p.image); return <li key={p.id} title={p.name}>{image?.url ? <img src={image.url} alt=""/> : <i/>}<span>{p.name}</span></li>; })}
      {products.length > shown.length && <li className="is-more">+{products.length - shown.length}</li>}</ul>
    <button type="button" className="ip-brand-text-button" onClick={() => goTab("products")}>管理</button>
  </div>;
}

// ── 商品库 ────────────────────────────────────────────────────────────────

type Draft = { key: string; url: string; versionId?: string };

function ProductLibrary({ work, apply, initialEdit, onClose }: { work: DirectorWork; apply: WorkbenchProps["apply"]; initialEdit?: string; onClose: () => void }) {
  const [view, setView] = useState<"list" | "form">(initialEdit ? "form" : "list");
  const [editing, setEditing] = useState<LibraryObject | null>(null);
  const [items, setItems] = useState<LibraryObject[]>([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const epoch = useRef(0);
  const { modal } = useStudioApp();
  // 表单里有没保存的内容时，离开前先问一句：选好的图和写的说明不能因为按了 Esc 就没了。
  const dirty = useRef(false);
  const guard = (leave: () => void) => {
    if (view !== "form" || !dirty.current) { leave(); return; }
    confirmDirectorAction(modal, { title: "放弃未保存的内容？", content: "这件商品的图片和说明还没有保存。", okText: "放弃", cancelText: "继续编辑", okButtonProps: { danger: true } }, () => { dirty.current = false; leave(); });
  };
  const close = () => guard(onClose);
  const back = () => guard(() => { setEditing(null); setView("list"); });
  const added = new Set(productsOf(work).map(p => p.libraryObjectId));
  const allAdded = items.length > 0 && items.every(o => added.has(o.id));
  const load = useCallback(async (nextPage: number, keyword: string) => {
    const id = ++epoch.current;
    setLoading(true); setLoadError("");
    try {
      const result = await libraryObjects({ kind: "product", query: keyword || undefined, page: nextPage });
      if (id !== epoch.current) return;
      setItems(old => nextPage === 0 ? result.items : [...old, ...result.items]);
      setPage(nextPage); setHasMore(result.hasMore);
    } catch (e) { if (id === epoch.current) setLoadError(errorText(e)); }
    finally { if (id === epoch.current) setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(0, query.trim()), query ? 180 : 0);
    return () => window.clearTimeout(timer);
  }, [query, load]);
  useEffect(() => {
    if (!initialEdit) return;
    readLibraryObject(initialEdit).then(setEditing).catch(e => { setLoadError(errorText(e)); setView("list"); });
  }, [initialEdit]);
  useEscape(() => { if (adding) return; if (view === "form" && !initialEdit) back(); else close(); });
  const toggle = (id: string) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const addSelected = async () => {
    setAdding(true); setAddError("");
    const failures: { id: string; text: string }[] = [];
    for (const id of selected) {
      try { apply(await DirectorApi.edit(work.id, "product.add", null, null, { objectId: id })); }
      catch (e) { failures.push({ id, text: `${items.find(x => x.id === id)?.name ?? id}：${errorText(e)}` }); }
    }
    setAdding(false);
    // 没加上的留在选中状态，点一下就能重试；加上的不用再选。
    if (failures.length) { setAddError(`${failures.length} 件商品添加失败。${failures.map(f => f.text).join("；")}`); setSelected(failures.map(f => f.id)); return; }
    onClose();
  };
  const onSaved = async (saved: LibraryObject) => {
    setItems(old => old.some(x => x.id === saved.id) ? old.map(x => x.id === saved.id ? saved : x) : [saved, ...old]);
    // 改的是本剧已有的商品：顺手同步到本剧，界面上看到的就是刚保存的。
    if (added.has(saved.id)) apply(await DirectorApi.edit(work.id, "product.add", null, null, { objectId: saved.id }));
    if (initialEdit) { onClose(); return; }
    if (!added.has(saved.id)) setSelected(s => s.includes(saved.id) ? s : [...s, saved.id]);
    setEditing(null); setView("list");
  };
  const onDeleted = (id: string) => { setItems(old => old.filter(x => x.id !== id)); setSelected(s => s.filter(x => x !== id)); if (initialEdit) onClose(); else { setEditing(null); setView("list"); } };
  return <div className="director-dialog-backdrop" role="presentation" onMouseDown={e => e.target === e.currentTarget && !adding && close()}>
    <div className={`director-dialog director-product-library ${view === "form" ? "is-form" : ""}`} role="dialog" aria-modal="true" aria-labelledby="director-product-library-title" ref={libraryFocus} tabIndex={-1}>
      {view === "form" ? (initialEdit && !editing && !loadError
        ? <div className="director-product-library-loading"><Loader2 size={20} className="ip-loading-icon"/>加载中…</div>
        : <ProductForm key={editing?.id ?? "new"} object={editing} backable={!initialEdit} onBack={back} onClose={close} onDirty={v => { dirty.current = v; }} onSaved={onSaved} onDeleted={onDeleted} usedHere={!!editing && added.has(editing.id)}/>) : <>
        <header><h2 id="director-product-library-title">商品库</h2><button type="button" aria-label="关闭" onClick={onClose} disabled={adding}><X size={18}/></button></header>
        {(loading || items.length > 0 || !!query.trim()) && <div className="director-product-library-tools">
          <label className="director-product-search"><Search size={15} aria-hidden/><input aria-label="搜索商品" placeholder="搜索商品名称或说明" value={query} onChange={e => setQuery(e.target.value)}/></label>
          <button type="button" className="ip-brand-secondary" onClick={() => { setEditing(null); setView("form"); }}><Plus size={15}/>新建商品</button>
        </div>}
        <div className="director-product-library-list">
          <InlineError message={loadError}/>
          {!loading && !loadError && items.length === 0 ? <div className="director-products-empty is-compact">
            <span aria-hidden><PackageOpen size={24} strokeWidth={1.5}/></span>
            <h3>{query.trim() ? "未找到商品" : "商品库暂无商品"}</h3>
            <p>{query.trim() ? "请更换关键词，或新建商品。" : "上传商品图并填写名称和说明，可用于所有带货短剧。"}</p>
            <button type="button" className="ip-brand-button" autoFocus onClick={() => { setEditing(null); setView("form"); }}><Plus size={15}/>新建商品</button>
          </div> : <div className="director-product-tiles">
            {items.map(o => <ProductTile key={o.id} object={o} added={added.has(o.id)} selected={selected.includes(o.id)} onToggle={() => toggle(o.id)} onEdit={() => { setEditing(o); setView("form"); }}/>)}
            {loading && items.length === 0 && Array.from({ length: 6 }, (_, i) => <div key={i} className="director-product-tile is-skeleton" aria-hidden/>)}
          </div>}
          {hasMore && <div className="director-product-more"><button type="button" className="ip-brand-secondary" disabled={loading} onClick={() => void load(page + 1, query.trim())}>{loading ? "加载中…" : "加载更多"}</button></div>}
        </div>
        <InlineError message={addError}/>
        <footer>
          <span className="director-product-picked" aria-live="polite">{selected.length ? `已选 ${selected.length} 件` : allAdded ? "所有商品均已在本剧" : items.length ? "选择商品" : ""}</span>
          <button type="button" className="ip-brand-secondary" onClick={onClose} disabled={adding}>取消</button>
          {items.length > 0 && <button type="button" className="ip-brand-button" disabled={!selected.length || adding} onClick={() => void addSelected()}>{adding ? <><Loader2 size={15} className="ip-loading-icon"/>添加中</> : "添加到本剧"}</button>}
        </footer>
      </>}
    </div>
  </div>;
}

function ProductTile({ object, added, selected, onToggle, onEdit }: { object: LibraryObject; added: boolean; selected: boolean; onToggle: () => void; onEdit: () => void }) {
  const main = mainLibraryVersion(object) ?? object.versions[0];
  return <article className={`director-product-tile ${selected ? "is-selected" : ""} ${added ? "is-added" : ""}`}>
    <button type="button" className="director-product-tile-pick" aria-pressed={selected} disabled={added} onClick={onToggle} aria-label={added ? `${object.name}，已在本剧` : `选择${object.name}`}>
      <span className="director-product-tile-image">{main?.url ? <img src={main.url} alt="" loading="lazy"/> : <ImageIcon size={20}/>}
        {!added && <i className={`director-product-tile-check ${selected ? "" : "is-empty"}`} aria-hidden>{selected && <Check size={13} strokeWidth={3}/>}</i>}
        {added && <em>已在本剧</em>}
      </span>
      <b title={object.name}>{object.name}</b>
      <small title={object.description}>{object.description || `${object.versions.length} 张图`}</small>
    </button>
    <button type="button" className="director-product-tile-edit" aria-label={`编辑${object.name}`} title="编辑" onClick={onEdit}><Pencil size={13}/></button>
  </article>;
}

function ProductForm({ object, backable, usedHere, onBack, onClose, onDirty, onSaved, onDeleted }: { object: LibraryObject | null; backable: boolean; usedHere: boolean; onBack: () => void; onClose: () => void; onDirty: (dirty: boolean) => void; onSaved: (o: LibraryObject) => Promise<void>; onDeleted: (id: string) => void }) {
  const { modal } = useStudioApp();
  const [name, setName] = useState(object?.name ?? "");
  const [description, setDescription] = useState(object?.description ?? "");
  const [images, setImages] = useState<Draft[]>(() => (object?.versions ?? []).map(v => ({ key: v.storageKey, url: v.url, versionId: v.id })));
  const [mainKey, setMainKey] = useState<string | undefined>(() => object ? (mainLibraryVersion(object) ?? object.versions[0])?.storageKey : undefined);
  const [uploading, setUploading] = useState<{ done: number; total: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  // 保存分几步（建对象或改资料、加图）。中途失败重试时接着用已存好的那一项：不多建一件商品，也不拿旧的修改时间去核对，否则会被当成别的页面改过。
  const created = useRef<LibraryObject | null>(null);
  const locked = saving || !!uploading;
  const main = mainKey ?? images[0]?.key;
  const [dragging, setDragging] = useState(false);
  const originalMain = object ? (mainLibraryVersion(object) ?? object.versions[0])?.storageKey : undefined;
  const changed = name !== (object?.name ?? "") || description !== (object?.description ?? "") || main !== originalMain
    || images.length !== (object?.versions.length ?? 0) || images.some(i => !i.versionId);
  useEffect(() => { onDirty(changed); return () => onDirty(false); }, [changed]); // eslint-disable-line react-hooks/exhaustive-deps
  const upload = async (files: File[]) => {
    const room = IMAGES_MAX - images.length;
    const picked = files.filter(f => f.size > 0).slice(0, room);
    if (files.length > room) setError(`一件商品最多 ${IMAGES_MAX} 张图，超出部分未上传。`); else setError("");
    if (!picked.length) return;
    setUploading({ done: 0, total: picked.length });
    for (let i = 0; i < picked.length; i++) {
      try {
        const r = await IpStudioApi.uploadImage(picked[i]);
        setImages(old => old.some(x => x.key === r.key) ? old : [...old, { key: r.key, url: r.url }]);
        if (!name.trim() && !object && i === 0) setName(picked[i].name.replace(/\.[^.]+$/, "").slice(0, NAME_MAX));
      } catch (e) { setError(`「${picked[i].name}」上传失败：${errorText(e)}`); }
      setUploading({ done: i + 1, total: picked.length });
    }
    setUploading(null);
  };
  const save = async () => {
    if (locked) return;
    setSaving(true); setError("");
    try {
      const base = created.current ?? object;
      let current = base
        ? await editLibraryObject(base.id, { name: name.trim(), description: description.trim(), ...(created.current ? {} : { updatedAt: base.updatedAt }) })
        : await createLibraryObject({ kind: "product", name: name.trim(), description: description.trim() });
      created.current = current;
      const existing = new Set(current.versions.map(v => v.storageKey));
      for (const image of images) if (!existing.has(image.key)) current = await addLibraryVersion(current.id, image.key, false);
      const keep = new Set(images.map(i => i.key));
      for (const v of current.versions) if (!keep.has(v.storageKey)) current = await editLibraryObject(current.id, { removeVersionId: v.id });
      const chosen = current.versions.find(v => v.storageKey === main);
      if (chosen && chosen.id !== current.mainVersionId) current = await editLibraryObject(current.id, { mainVersionId: chosen.id });
      await onSaved(current);
    } catch (e) { setError(errorText(e)); setSaving(false); }
  };
  const remove = () => confirmDirectorAction(modal, {
    title: `从商品库删除「${object?.name}」？`, content: usedHere ? "已添加到作品的商品仍可使用，但无法再从商品库同步。" : "删除后无法添加到新作品。已添加到作品的商品仍可使用。", okText: "删除", cancelText: "取消", okButtonProps: { danger: true },
  }, () => { void (async () => { try { await deleteLibraryObject(object!.id); onDeleted(object!.id); } catch (e) { setError(errorText(e)); } })(); });
  const ready = !!name.trim() && images.length > 0;
  const missing = [images.length ? "" : "商品图", name.trim() ? "" : "商品名称"].filter(Boolean).join("、");
  return <>
    <header>
      <div className="director-product-form-title">
        {backable && <button type="button" aria-label="返回商品库" onClick={onBack} disabled={locked}><ArrowLeft size={18}/></button>}
        <h2 id="director-product-library-title">{object ? "编辑商品" : "新建商品"}</h2>
      </div>
      <button type="button" aria-label="关闭" onClick={onClose} disabled={locked}><X size={18}/></button>
    </header>
    <div className="director-product-form">
      <div className="director-field director-product-form-images">
        <span>商品图<em>主图默认用作参考图，建议包含正面和包装</em></span>
        <div className={`director-product-uploads ${dragging ? "is-dragging" : ""}`}
          onDragOver={e => { e.preventDefault(); if (!locked) setDragging(true); }} onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); if (!locked) void upload(Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"))); }}>
          {images.map(image => <div key={image.key} className={`director-product-upload ${image.key === main ? "is-main" : ""}`}>
            <img src={image.url} alt=""/>
            {image.key === main ? <em>主图</em> : <button type="button" className="director-product-upload-main" disabled={locked} onClick={() => setMainKey(image.key)} aria-label="设为主图" title="设为主图"><Star size={13}/></button>}
            <button type="button" className="director-product-upload-remove" disabled={locked || (!!object && images.length <= 1)} onClick={() => setImages(old => old.filter(x => x.key !== image.key))} aria-label="移除这张图" title={object && images.length <= 1 ? "至少保留一张商品图" : "移除"}><X size={13}/></button>
          </div>)}
          {images.length < IMAGES_MAX && <button type="button" className="director-product-upload-add" disabled={locked} onClick={() => input.current?.click()}>
            {uploading ? <><Loader2 size={18} className="ip-loading-icon"/><small>上传中 {uploading.done}/{uploading.total}</small></> : <><Upload size={18}/><small>上传图片</small></>}
          </button>}
        </div>
        <input ref={input} type="file" accept={IMAGE_UPLOAD_ACCEPT} multiple hidden aria-label="选择商品图片" onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ""; if (files.length) void upload(files); }}/>
        <small>支持多选和拖放。分镜图和视频以商品图为参考，请使用清晰、完整、无遮挡的图片。</small>
      </div>
      <div className="director-product-form-fields">
        <label className="director-field"><span>商品名称</span>
          <input value={name} maxLength={NAME_MAX} onChange={e => setName(e.target.value)} placeholder="例如：恒温保温杯" disabled={saving} autoFocus={!object && isDesktop()}/>
        </label>
        <label className="director-field"><span>商品说明<em>选填</em></span>
          <textarea rows={6} maxLength={DESCRIPTION_MAX} value={description} onChange={e => setDescription(e.target.value)} disabled={saving} placeholder="卖点、外观和用法，例如：316 不锈钢内胆，12 小时保温，磨砂深蓝杯身"/>
          <small>AI 写剧本时以这里的内容为依据。涉及功效、价格的台词，发布前请核对。</small>
        </label>
      </div>
    </div>
    <InlineError message={error}/>
    <footer>
      {object && <button type="button" className="ip-brand-text-button director-danger director-product-delete" disabled={locked} onClick={remove}><Trash2 size={14}/>删除商品</button>}
      <span className="director-spacer"/>
      {!ready && <span className="director-product-missing">待补充：{missing}</span>}
      <button type="button" className="ip-brand-secondary" disabled={locked} onClick={backable ? onBack : onClose}>取消</button>
      <button type="button" className="ip-brand-button" disabled={locked || !ready} onClick={() => void save()}>{saving ? <><Loader2 size={15} className="ip-loading-icon"/>保存中</> : "保存"}</button>
    </footer>
  </>;
}
