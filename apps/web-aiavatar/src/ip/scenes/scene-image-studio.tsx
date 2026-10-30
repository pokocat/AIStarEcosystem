"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, Download, ExternalLink, FolderOpen, ImagePlus, Loader2, Mountain, Package, PencilLine, Plus, RotateCcw, Shirt, SlidersHorizontal, Sparkles, Square, Undo2, Upload, UserRound, X } from "lucide-react";
import type { IpImageAsset, IpProject, IpRun } from "@ai-star-eco/types";
import type { StudioCapabilities } from "@ai-star-eco/types/ip-studio-workflow";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { cancelRun, fetchModels, readRun, type IpModelOption } from "@/canvas-bridge/api";
import { studioCapabilities, submitStudioRun } from "@/canvas-bridge/studio-api";
import { isStudioBillingCancelled } from "@/canvas-bridge/studio-billing-cancel";
import { prepareStudioImageUpload } from "@/canvas-bridge/studio-image-file";
import { downloadMedia } from "@/canvas-bridge/download-media";
import type { CanvasNodeData } from "@/canvas/types/canvas";
import { IpStudioApi } from "../api";
import { LibraryReferencePicker } from "../library-reference-picker";
import { studioErrorMetadata, useStudioFailure } from "../studio-errors";
import { useStudioList } from "../studio-gallery";
import { studioImageResolution, studioImageSizeLabel } from "../studio-generation-controls";
import { StudioSelect } from "../studio-select";
import { HubTabBar } from "@/components/hub/ui";
import { FREE_SCENE_ID, findImageScene, useSceneCatalog, type ImageScene } from "./scene-catalog";
import { addImageRow, applyRun, createSceneDraft, imageRows, listSceneDrafts, patchNode, resubmitRow, rowUploads, saveDraftDoc, submissionRejected, type SceneUpload } from "./scene-drafts";
import { SceneEmpty, SceneExample, SceneList, SceneNoModel, SceneOptions, SceneRecent, SceneThumb, sceneFailureText, sceneHintText, sceneOptionValues } from "./scene-layout";

const FALLBACK_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9"];
const POLL_MS = 1500;

function readQuery() {
  if (typeof window === "undefined") return { scene: undefined, draft: undefined };
  const q = new URLSearchParams(window.location.search);
  return { scene: q.get("scene") || undefined, draft: q.get("draft") || undefined };
}
function writeQuery(scene: string, draft?: string) {
  const q = new URLSearchParams({ scene, ...(draft ? { draft } : {}) });
  window.history.replaceState(window.history.state, "", `/image?${q}`);
}

/** 「AI 图片」：选场景 → 放参考图 → 描述已写好 → 生成。草稿是一张普通画布，可以随时去画布里继续。 */
export function SceneImageStudio() {
  const auth = useRequireAuth();
  const ready = auth === "ok";
  const showFailure = useStudioFailure();
  // 场景目录在服务端（ipstudio/scenes.json），出图描述也在服务端拼，这一页不再自己写一份。
  const { catalog, error: catalogError, retry: retryCatalog } = useSceneCatalog(ready);
  const catalogRef = useRef(catalog); catalogRef.current = catalog;
  const [sceneId, setSceneId] = useState(FREE_SCENE_ID);
  const scene = findImageScene(catalog, sceneId) ?? findImageScene(catalog, FREE_SCENE_ID);
  const [slots, setSlots] = useState<(SceneUpload | undefined)[]>([]);
  // 用户写的只是补充要求；场景描述藏在场景标签后面，想改的人点「改完整描述」。
  const [supplement, setSupplement] = useState("");
  const [custom, setCustom] = useState<string>();
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tab, setTab] = useState<"results" | "example">("example");
  const [uploading, setUploading] = useState<number>();
  const [picking, setPicking] = useState<number>();
  const [models, setModels] = useState<IpModelOption[]>();
  const [caps, setCaps] = useState<StudioCapabilities>();
  const [modelId, setModelId] = useState<string>();
  const [ratio, setRatio] = useState("3:4");
  const [size, setSize] = useState<string>();
  const [count, setCount] = useState(1);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  // 正在提交（含等用户确认费用）的那一行：这时候还谈不上「结果没确认」。
  const [submitting, setSubmitting] = useState<string>();
  const [draft, setDraft] = useState<IpProject>();
  const [opening, setOpening] = useState<string>();
  const [live, setLive] = useState<Record<string, IpRun>>({});
  const [viewing, setViewing] = useState<{ url: string; key?: string; name: string }>();
  const draftRef = useRef<IpProject>(undefined);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const imageIds = useMemo(() => new Set(catalog?.image.map(s => s.id) ?? []), [catalog]);
  const loadDrafts = useCallback(() => listSceneDrafts(imageIds), [imageIds]);
  const drafts = useStudioList(loadDrafts, ready && !!catalog);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef(0);

  const pickScene = useCallback((next: ImageScene, keepInputs = false) => {
    setSceneId(next.id);
    setRatio(next.ratio);
    setHint("");
    if (!keepInputs) {
      setSupplement(""); setCustom(undefined); setPicked({});
      // 同一位置的参考图跟着走（换个人物场景时照片不用重放），多出来的位丢掉。
      setSlots(old => next.refs.map((_, i) => old[i]));
    }
    writeQuery(next.id, draftRef.current?.id);
  }, []);

  const showDraft = useCallback((project: IpProject | undefined) => {
    draftRef.current = project; setDraft(project); setLive({});
  }, []);

  const openDraft = useCallback(async (id: string) => {
    setOpening(id);
    try {
      const project = await IpStudioApi.getProject(id);
      showDraft(project);
      const from = findImageScene(catalogRef.current, project.sceneId);
      const latest = imageRows(project.doc)[0];
      // 接着上次做：场景、比例和那次用的参考图都放回来，再生成一次就是一下的事。
      if (from) { setSceneId(from.id); setRatio(latest?.metadata?.studio?.request?.aspectRatio || from.ratio);
        const used = latest ? rowUploads(project.doc, latest) : [];
        setSlots(from.refs.map((_, i) => used[i])); }
      setSupplement(""); setCustom(undefined); setTab(latest ? "results" : "example");
      writeQuery(from?.id ?? FREE_SCENE_ID, project.id);
    } catch (e) { showFailure({ action: "打开草稿", error: e }); }
    finally { setOpening(undefined); }
  }, [showDraft, showFailure]);

  // 地址栏里的场景 / 草稿：首页卡片和「最近」都靠它直达。进页面时读一次存下来 ——
  // 登录状态晚一拍才就绪，先同步场景会把地址里的草稿号写掉，之后就再也读不到了。
  const entry = useRef(readQuery());
  useEffect(() => {
    if (catalog) pickScene(findImageScene(catalog, entry.current.scene) ?? findImageScene(catalog, FREE_SCENE_ID)!);
  }, [catalog, pickScene]);
  useEffect(() => {
    const id = entry.current.draft;
    if (!ready || !catalog || !id) return;
    entry.current = { ...entry.current, draft: undefined };
    void openDraft(id);
  }, [ready, catalog, openDraft]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    void Promise.all([fetchModels(), studioCapabilities()]).then(([m, c]) => { if (active) { setModels(m.image); setCaps(c); } })
      .catch(e => { if (active) { setModels([]); showFailure({ action: "读取图片模型", error: e }); } });
    return () => { active = false; };
  }, [ready, showFailure]);

  /** 文档一次只存一份：后一次保存基于前一次的结果，不会拿旧版本去覆盖。 */
  const persist = useCallback((mutate: (doc: IpProject["doc"]) => IpProject["doc"]) => {
    const job = queue.current.then(async () => {
      const current = draftRef.current;
      if (!current) throw new Error("草稿还没准备好");
      const saved = await saveDraftDoc(current, mutate(current.doc));
      draftRef.current = saved; setDraft(saved);
      return saved;
    });
    queue.current = job.catch(() => undefined);
    return job;
  }, []);

  // 接着看已经受理的任务：只读运行记录，绝不重新提交。
  const draftId = draft?.id;
  useEffect(() => {
    if (!draftId) return;
    let alive = true, ticking = false;
    const tick = async () => {
      if (ticking) return; ticking = true;
      try {
        const pending = imageRows(draftRef.current?.doc ?? { nodes: [], connections: [], viewport: { x: 0, y: 0, k: 1 } })
          .filter(n => n.metadata?.status === "loading" && n.metadata.studio?.runId);
        for (const row of pending) {
          const run = await readRun(row.metadata!.studio!.runId!);
          if (!alive) return;
          if (run.status === "running") { setLive(l => ({ ...l, [row.id]: run })); continue; }
          await persist(doc => patchNode(applyRun(doc, row.id, run), row.id, n => ({ ...n, metadata: { ...n.metadata,
            status: run.status === "done" ? "success" : "error", ...(run.status === "failed" ? { errorDetails: run.errorMessage || "生成失败", errorCode: run.errorCode, errorLogId: run.logId } : { errorDetails: undefined }) } })));
          setLive(l => { const next = { ...l }; delete next[row.id]; return next; });
          if (run.status === "done") drafts.reload();
        }
      } catch { /* 网络抖一下下次再读；任务本身不受影响 */ }
      finally { ticking = false; }
    };
    void tick();
    const timer = setInterval(() => void tick(), POLL_MS);
    return () => { alive = false; clearInterval(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftId, persist]);

  const candidates = useMemo(() => models ?? [], [models]);
  const chosen = (caps?.imageModelMode !== "fixed" && modelId ? candidates.find(m => m.endpointId === modelId) : undefined) || candidates.find(m => m.isDefault) || candidates[0];
  const ratios = chosen?.capability?.imageRatios?.length ? chosen.capability.imageRatios : FALLBACK_RATIOS;
  const usedRatio = ratios.includes(ratio) ? ratio : ratios[0];
  const sizes = chosen?.capability?.imageSizes?.filter(s => s.aspectRatio === usedRatio) ?? [];
  const usedSize = sizes.some(s => s.size === size) ? size : sizes[0]?.size;
  const counts = chosen?.capability?.imageBatchCounts?.filter(c => [1, 2, 4].includes(c)).length ? chosen.capability.imageBatchCounts!.filter(c => [1, 2, 4].includes(c)) : [1, 2, 4];
  const usedCount = counts.includes(count) ? count : counts[0];
  const unit = chosen?.imageResolutionCosts?.[studioImageResolution(usedSize) || ""] ?? chosen?.creditCost ?? caps?.imageCost ?? 0;
  const quote = caps?.mock ? 0 : unit * usedCount;
  const maxChars = chosen?.capability?.imagePromptMaxChars || 2000;
  const isFree = scene?.id === FREE_SCENE_ID;
  // 用户自己写的那部分有多长：完整描述按模型上限，补充要求另有个短上限，真正发出去的整段由服务端拼并把关。
  const ownText = custom ?? supplement;
  const ownLimit = custom !== undefined || isFree ? maxChars : 500;
  const missing = scene ? scene.refs.findIndex((r, i) => r.required && !slots[i]) : -1;
  const blocker = !scene ? "正在读取场景…" : !models ? "正在读取模型…" : !caps?.mock && !chosen ? "还没有可用的图片模型"
    : missing >= 0 ? `先放${scene.refs[missing].label}` : isFree && !supplement.trim() ? "写一句想要的画面"
    : ownText.length > ownLimit ? `最多 ${ownLimit} 字` : "";

  const upload = async (index: number, file: File) => {
    setUploading(index); setHint("");
    try {
      const result = await IpStudioApi.uploadImage(await prepareStudioImageUpload(file));
      setSlots(old => { const next = [...old]; next[index] = { key: result.key, url: result.url, name: result.fileName || file.name }; return next; });
    } catch (e) { showFailure({ action: "上传参考图", error: e, next: "换一张 JPG 或 PNG 图片再试。" }); }
    finally { setUploading(undefined); }
  };

  type RowInput = Parameters<typeof addImageRow>[1];
  const generate = async () => {
    if (busy || !scene) return;
    if (blocker) { setHint(blocker); return; }
    // 描述由服务端按场景拼（同一份目录、同一套校验）；缺什么它会直接说，就地显示。
    let prompt: string;
    try {
      const options = sceneOptionValues(scene.options, picked);
      prompt = (await IpStudioApi.composeScene({ kind: "image", sceneId: scene.id, text: supplement, ...(custom !== undefined ? { custom } : {}),
        filled: slots.flatMap((s, i) => s ? [i] : []), ...(options ? { options } : {}) })).text;
    } catch (e) { setHint(sceneHintText(e, "描述没准备好，请再点一次")); return; }
    const refs = scene.refs.flatMap((r, i) => slots[i] ? [{ upload: slots[i]!, label: r.label }] : []);
    void submitRow({ title: scene.title, prompt, refs, ratio: usedRatio, count: usedCount, size: usedSize, model: caps?.mock ? undefined : chosen?.endpointId, maxCost: quote });
  };
  /** 失败了（没扣积分）就在原来那一行按原样再来一次：同样的图、描述和设置，新的请求编号。 */
  const retry = (row: CanvasNodeData) => { if (row.metadata?.studio?.request) void submitRow(row.id); };
  const submitRow = async (input: RowInput | string) => {
    if (busy) return;
    setBusy(true); setHint("");
    let nodeId: string | undefined; let posted = false;
    try {
      if (!draftRef.current) {
        showDraft(await createSceneDraft(scene!.title, scene!.id));
        writeQuery(scene!.id, draftRef.current!.id);
        drafts.reload();
      }
      const project = draftRef.current!;
      let request: Parameters<typeof submitStudioRun>[1] | undefined;
      await persist(doc => {
        if (typeof input === "string") {
          const again = resubmitRow(doc, input);
          if (!again) throw new Error("这一行已经不在了，请重新生成");
          request = again.request; nodeId = input;
          return again.doc;
        }
        const row = addImageRow(doc, input);
        request = row.request; nodeId = row.nodeId;
        return row.doc;
      });
      setSubmitting(nodeId);
      posted = true; setTab("results");
      const run = await submitStudioRun(project.id, request!);
      await persist(doc => applyRun(doc, nodeId!, run));
    } catch (e) {
      if (nodeId && isStudioBillingCancelled(e)) { await persist(doc => patchNode(doc, nodeId!, () => undefined)).catch(() => undefined); return; }
      const rejected = submissionRejected(e, posted);
      if (nodeId) await persist(doc => patchNode(doc, nodeId!, n => ({ ...n, metadata: { ...n.metadata, ...studioErrorMetadata(e),
        status: rejected ? "error" : "loading", ...(rejected ? {} : { errorDetails: "提交结果没有确认，点「确认原任务」查一下，不会重复扣费" }) } }))).catch(() => undefined);
      showFailure({ action: "生成图片", error: e, next: rejected ? "改一下再试；积分没有扣。" : "这次提交可能已经被受理，点「确认原任务」查一下，不要直接重新生成。" });
    } finally { setBusy(false); setSubmitting(undefined); }
  };

  /** 同一个请求编号再交一次：服务端认得它，已受理就返回原任务，不会再扣一次。 */
  const confirmOriginal = async (row: CanvasNodeData) => {
    const request = row.metadata?.studio?.request; const project = draftRef.current;
    if (!request || !project || busy) return;
    setBusy(true);
    try {
      const run = await submitStudioRun(project.id, request);
      await persist(doc => patchNode(applyRun(doc, row.id, run), row.id, n => ({ ...n, metadata: { ...n.metadata, status: "loading", errorDetails: undefined } })));
    } catch (e) { showFailure({ action: "确认原任务", error: e }); }
    finally { setBusy(false); }
  };

  const reuse = (row: CanvasNodeData) => {
    const request = row.metadata?.studio?.request;
    if (!request) return;
    if (!scene) return;
    if (draftRef.current) { const used = rowUploads(draftRef.current.doc, row); setSlots(scene.refs.map((_, i) => used[i])); }
    // 原样再做一次：把那次真正发出去的整段描述放进「完整描述」，补充要求清空。
    if (scene.id === FREE_SCENE_ID) setSupplement(request.prompt); else { setCustom(request.prompt); setSupplement(""); }
    if (request.aspectRatio) setRatio(request.aspectRatio);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (auth === "no-platform" || drafts.notEnrolled) return <PlatformGateScreen/>;
  const rows = draft ? imageRows(draft.doc) : [];
  if (catalogError && !catalog) return <main className="ip-brand-surface scene-studio scene-image-studio"><div className="scene-loading">场景目录没读出来<button type="button" className="ip-brand-secondary" onClick={retryCatalog}>重新加载</button></div></main>;
  if (!catalog || !scene) return <main className="ip-brand-surface scene-studio scene-image-studio"><div className="scene-loading"><Loader2 size={20} className="studio-gallery-spinner"/>正在读取场景</div></main>;
  const free = findImageScene(catalog, FREE_SCENE_ID);
  const listGroups = catalog.imageGroups.map(g => ({ id: g.id, title: g.title, items: catalog.image.filter(s => s.group === g.id && s.id !== FREE_SCENE_ID) }));
  const sampleCovers = ["face-turnaround", "ip-sheet", "scene-swap"].flatMap(id => findImageScene(catalog, id) ?? []);

  return <main className="ip-brand-surface scene-studio scene-image-studio" data-studio-overlay-root>
    <SceneList heading="AI 图片" current={scene.id} onPick={id => { const next = findImageScene(catalog, id); if (next) pickScene(next); }} top={free} groups={listGroups}/>

    <section className="scene-composer" aria-label="图片设置">
      <header className="scene-composer-head">
        <SceneThumb id={scene.id} title={scene.title} cover={scene.coverUrl} size={52}/>
        <div><strong>{scene.title}</strong><small>{scene.description}</small></div>
        <button type="button" className="scene-new" onClick={() => { showDraft(undefined); pickScene(scene); writeQuery(scene.id); }}><Plus size={16}/>新建</button>
      </header>

      <div className="scene-composer-body">
        <div className="scene-ref-count">{slots.filter(Boolean).length} / {scene.refs.length}</div>
        <div className="scene-ref-row" role="group" aria-label="参考图">
          {scene.refs.map((ref, i) => {
            const slot = slots[i];
            const Icon = refIcon(ref.label);
            return <div key={`${scene.id}-${i}`} className={`scene-ref${slot ? " is-filled" : ""}`}>
              {slot ? <>
                <img src={slot.url} alt={ref.label}/><span className="scene-ref-index">图{i + 1}</span>
                <button type="button" className="scene-ref-remove" aria-label={`移除${ref.label}`} onClick={() => setSlots(old => { const next = [...old]; next[i] = undefined; return next; })}><X size={13}/></button>
              </> : <button type="button" className="scene-ref-add" disabled={uploading !== undefined} aria-label={`上传${ref.label}`} title={ref.hint}
                onClick={() => { uploadTarget.current = i; fileInput.current?.click(); }}
                onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) void upload(i, file); }}>
                {uploading === i ? <Loader2 size={20} className="studio-gallery-spinner"/> : <><Icon size={30} strokeWidth={1.2}/><span className="scene-ref-upload"><Upload size={11}/></span></>}
              </button>}
              <span className="scene-ref-label" title={ref.hint}>{slot ? ref.label : `添加${ref.label}`}{!ref.required && <small>（可选）</small>}</span>
              {!slot && <button type="button" className="scene-ref-library" onClick={() => setPicking(i)}>从资产库选</button>}
            </div>;
          })}
          <input ref={fileInput} type="file" accept=".jpg,.jpeg,.png" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(uploadTarget.current, file); }}/>
        </div>

        <SceneOptions groups={scene.options} value={picked} onPick={(key, choice) => setPicked(old => ({ ...old, [key]: choice }))}/>
        <div className="scene-ask">
          {!isFree && custom === undefined && <span className="scene-skill-chip" title={scene.prompt}><Sparkles size={14}/>{scene.title}</span>}
          {custom !== undefined
            ? <textarea aria-label="完整描述" value={custom} onChange={e => setCustom(e.target.value)} className="is-full"/>
            : <textarea aria-label={isFree ? "想要的画面" : "补充要求"} value={supplement} placeholder={scene.hint} onChange={e => setSupplement(e.target.value)}/>}
          {custom !== undefined && <textarea aria-label="补充要求" className="is-extra" value={supplement} placeholder="还有要补充的，写在这里" onChange={e => setSupplement(e.target.value)}/>}
          <footer>
            {!isFree && (custom === undefined
              ? <button type="button" onClick={() => setCustom(scene.prompt)}><PencilLine size={13}/>改完整描述</button>
              : <button type="button" onClick={() => setCustom(undefined)}><Undo2 size={13}/>用回场景描述</button>)}
            <small className={ownText.length > ownLimit ? "is-over" : undefined}>{ownText.length} / {ownLimit}</small>
          </footer>
        </div>
      </div>

      <div className="scene-settings">
        {caps?.imageModelMode !== "fixed" && candidates.length > 1 && <label className="scene-setting"><span>模型</span>
          <StudioSelect label="图片模型" compact value={chosen?.endpointId || ""} onChange={setModelId} options={candidates.map(m => ({ value: m.endpointId, label: m.name }))}/></label>}
        <div className="scene-setting scene-setting-panel-host">
          <button type="button" className="scene-setting-toggle" aria-expanded={settingsOpen} aria-controls="scene-image-settings" onClick={() => setSettingsOpen(v => !v)}>
            <span>图片设置</span><strong><SlidersHorizontal size={13}/>{[usedRatio, studioImageSizeLabel(usedSize), `${usedCount} 张`].filter(Boolean).join(" · ")}</strong><ChevronDown size={14}/>
          </button>
          {settingsOpen && <ImageSettingsPanel ratios={ratios} ratio={usedRatio} onRatio={setRatio} sizes={sizes} size={usedSize} onSize={setSize}
            counts={counts} count={usedCount} onCount={setCount} onClose={() => setSettingsOpen(false)}/>}
        </div>
      </div>
      {models && !candidates.length && !caps?.mock && <SceneNoModel kind="图片"/>}
      {hint && <p className="scene-hint" role="status">{hint}</p>}
      {/* 不能生成时按钮就地写原因（先放什么、先写什么），不让人对着一个灰按钮猜。 */}
      <button type="button" className="scene-go" aria-label="立即生成图片" title={blocker || (caps?.mock ? "测试响应，不扣积分" : `预计 ${quote} 积分`)} disabled={busy || !!blocker} onClick={() => void generate()}>
        {busy ? <Loader2 size={18} className="studio-gallery-spinner"/> : null}<span>立即生成图片</span>
        <small>{blocker || (caps?.mock ? "测试响应 · 免费" : `预计 ${quote} 积分`)}</small>
      </button>
    </section>

    <section className="scene-results" aria-label="生成结果">
      <header><div className="scene-tabs" role="tablist" aria-label="结果与示例">
          <button type="button" role="tab" aria-selected={tab === "results"} onClick={() => setTab("results")}>生成结果{rows.length ? <small>{rows.length}</small> : null}</button>
          <button type="button" role="tab" aria-selected={tab === "example"} onClick={() => setTab("example")}>参考示例</button></div>
        {draft && <Link className="scene-link" href={`/projects/${encodeURIComponent(draft.id)}`}><FolderOpen size={15}/>在画布中继续</Link>}</header>
      {tab === "example" ? (isFree
          ? <SceneEmpty title="图片创作" note={<>放参考图，说说想要的画面；不知道怎么写，就从左边选一个场景。</>} covers={sampleCovers}/>
          : <SceneExample id={scene.id} title={`${scene.title}效果示例`} note={scene.description} cover={scene.coverUrl} examples={scene.examples}/>)
        : opening ? <div className="scene-loading"><Loader2 size={20} className="studio-gallery-spinner"/>正在打开草稿</div>
        : rows.length ? <ol className="scene-row-list">{rows.map(row => <ImageRow key={row.id} row={row} run={live[row.id]} busy={busy} submitting={submitting === row.id}
          onView={setViewing} onReuse={() => reuse(row)} onRetry={() => retry(row)} onConfirm={() => void confirmOriginal(row)}
          onStop={() => { const id = row.metadata?.studio?.runId; if (id) void cancelRun(id).catch(e => showFailure({ action: "停止生成", error: e })); }}/>)}</ol>
        : <SceneEmpty title="还没有生成" note={<>放好参考图，点「立即生成图片」，结果会出现在这里。</>} covers={[]}/>}
    </section>

    <SceneRecent drafts={drafts.data} loading={drafts.loading} current={draft?.id} onOpen={id => void openDraft(id)}/>

    {picking !== undefined && <div className="scene-picker-host"><LibraryReferencePicker open max={1} title="从资产库选一张图" intro="选一张图片做参考，原文件不会被改动。" confirmLabel="用这张"
      onClose={() => setPicking(undefined)} onAssets={async assets => {
        const image = assets.find((a): a is IpImageAsset => a.kind === "image" && !!a.data.storageKey);
        if (!image) throw new Error("请选择一张带图片的资产");
        const index = picking;
        setSlots(old => { const next = [...old]; next[index] = { key: image.data.storageKey!, url: image.data.dataUrl, name: image.title }; return next; });
      }}/></div>}
    {viewing && <div className="scene-viewer" role="dialog" aria-modal="true" aria-label="查看大图" onClick={() => setViewing(undefined)}>
      <img src={viewing.url} alt={viewing.name} onClick={e => e.stopPropagation()}/>
      <div onClick={e => e.stopPropagation()}><button type="button" onClick={() => void downloadMedia(viewing.url, viewing.name, undefined, viewing.key)}><Download size={16}/>下载</button><button type="button" onClick={() => setViewing(undefined)}><X size={16}/>关闭</button></div>
    </div>}
    <HubTabBar/>
  </main>;
}

function ImageRow({ row, run, busy, submitting, onView, onReuse, onRetry, onConfirm, onStop }: {
  row: CanvasNodeData; run?: IpRun; busy: boolean; submitting: boolean; onView: (image: { url: string; key?: string; name: string }) => void;
  onReuse: () => void; onRetry: () => void; onConfirm: () => void; onStop: () => void;
}) {
  const meta = row.metadata;
  const request = meta?.studio?.request;
  const images = (meta?.images || []).filter(i => i.status === "success" && i.content);
  const loading = meta?.status === "loading";
  const accepted = !!meta?.studio?.runId;
  const position = run?.queue?.position;
  // 图片阶段不显示百分比（不是真进度），只说在排队还是在生成。
  const failure = meta?.status === "error" ? sceneFailureText(meta.errorCode, meta.errorDetails) : undefined;
  const state = loading ? (submitting && !accepted ? "正在提交" : !accepted ? "提交结果没有确认" : position && position > 0 ? `排队中，前面还有 ${position - 1} 个` : "正在生成")
    : failure ? failure : `${images.length} 张`;
  return <li className={`scene-row is-${meta?.status || "idle"}`}>
    <div className="scene-row-meta"><strong>{row.title}</strong><span>{[request?.aspectRatio, request?.count ? `${request.count} 张` : undefined].filter(Boolean).join(" · ")}</span>
      <span className="scene-row-state" role={loading ? "status" : undefined} title={failure && meta?.errorDetails !== failure ? `${meta?.errorDetails || ""}${meta?.errorLogId ? `（记录号 ${meta.errorLogId}）` : ""}` : undefined}>{loading && <Loader2 size={14} className="studio-gallery-spinner"/>}{state}</span></div>
    {request?.prompt && <p className="scene-row-prompt" title={request.prompt}>{request.prompt}</p>}
    <div className="scene-row-images">
      {images.map((image, i) => <button type="button" key={image.id} onClick={() => onView({ url: image.content!, key: image.storageKey, name: `${row.title}-${i + 1}` })} aria-label={`查看第 ${i + 1} 张`}>
        <img src={image.content} alt={`${row.title}第 ${i + 1} 张`} loading="lazy"/></button>)}
      {loading && Array.from({ length: Math.max(0, (request?.count || 1) - images.length) }, (_, i) => <span key={`wait-${i}`} className="scene-row-placeholder"/>)}
    </div>
    <div className="scene-row-actions">
      {loading && accepted && <button type="button" onClick={onStop}><Square size={13}/>停止</button>}
      {loading && !accepted && !submitting && <button type="button" disabled={busy} onClick={onConfirm}><RotateCcw size={13}/>确认原任务</button>}
      {meta?.status === "error" && request && <button type="button" className="is-primary" disabled={busy} onClick={onRetry}><RotateCcw size={13}/>重新生成</button>}
      {images[0] && <button type="button" onClick={() => void downloadMedia(images[0].content!, row.title, undefined, images[0].storageKey)}><Download size={13}/>下载</button>}
      {request && <button type="button" onClick={onReuse}><ExternalLink size={13}/>用这段描述再做</button>}
    </div>
  </li>;
}

/** 参考图位的占位图标：看名字是人、商品、衣服还是场景。 */
function refIcon(label: string) {
  if (/脸|人物|面孔|模特|人/.test(label)) return UserRound;
  if (/商品/.test(label)) return Package;
  if (/服装|面料|印花/.test(label)) return Shirt;
  if (/场景/.test(label)) return Mountain;
  return ImagePlus;
}

const ratioLabel = (r: string) => r === "1:1" ? "方图" : r;
/** 图片设置：比例画成小方块，清晰度和张数是几个按钮，就地展开在设置栏上方。 */
function ImageSettingsPanel({ ratios, ratio, onRatio, sizes, size, onSize, counts, count, onCount, onClose }: {
  ratios: string[]; ratio: string; onRatio: (r: string) => void; sizes: { size: string; aspectRatio: string }[]; size?: string; onSize: (s: string) => void;
  counts: number[]; count: number; onCount: (n: number) => void; onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: PointerEvent) => { if (e.target instanceof Node && !panel.current?.parentElement?.contains(e.target)) onClose(); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", escape);
    panel.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", escape); };
  }, [onClose]);
  return <div ref={panel} id="scene-image-settings" className="scene-settings-panel" role="group" aria-label="图片设置">
    <h3>图片比例</h3>
    <div className="scene-ratio-grid">{ratios.map(r => { const [w, h] = r.split(":").map(Number), k = 26 / Math.max(w, h);
      return <button key={r} type="button" aria-pressed={r === ratio} onClick={() => onRatio(r)}><i style={{ width: Math.round(w * k), height: Math.round(h * k) }}/>{ratioLabel(r)}</button>; })}</div>
    {sizes.length > 1 && <><h3>清晰度</h3><div className="scene-choice-row">{sizes.map(s => <button key={s.size} type="button" aria-pressed={s.size === size} onClick={() => onSize(s.size)} title={s.size.replace("x", " × ")}>{studioImageSizeLabel(s.size)}</button>)}</div></>}
    <h3>生成张数</h3>
    <div className="scene-choice-row">{counts.map(c => <button key={c} type="button" aria-pressed={c === count} onClick={() => onCount(c)}>{c} 张</button>)}</div>
  </div>;
}
