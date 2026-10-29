"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Download, ExternalLink, FolderOpen, ImagePlus, Loader2, Plus, RotateCcw, Square, Undo2, X } from "lucide-react";
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
import { IMAGE_DRAFT_SUFFIX, freeImageScene, imageScene, imageSceneGroups, imageScenes, sceneFromDraftName, type ImageScene } from "./scene-catalog";
import { addImageRow, applyRun, createSceneDraft, imageRows, listSceneDrafts, patchNode, saveDraftDoc, submissionRejected, type SceneUpload } from "./scene-drafts";
import { SceneEmpty, SceneList, SceneNoModel, SceneRecent, SceneThumb } from "./scene-layout";

const loadDrafts = () => listSceneDrafts(IMAGE_DRAFT_SUFFIX);
const ALL_SCENES = [freeImageScene, ...imageScenes];
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
  const [scene, setScene] = useState<ImageScene>(freeImageScene);
  const [slots, setSlots] = useState<(SceneUpload | undefined)[]>([]);
  const [prompt, setPrompt] = useState(freeImageScene.prompt);
  const [uploading, setUploading] = useState<number>();
  const [picking, setPicking] = useState<number>();
  const [models, setModels] = useState<IpModelOption[]>();
  const [caps, setCaps] = useState<StudioCapabilities>();
  const [modelId, setModelId] = useState<string>();
  const [ratio, setRatio] = useState(freeImageScene.ratio);
  const [size, setSize] = useState<string>();
  const [count, setCount] = useState(1);
  const [hint, setHint] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<IpProject>();
  const [opening, setOpening] = useState<string>();
  const [live, setLive] = useState<Record<string, IpRun>>({});
  const [viewing, setViewing] = useState<{ url: string; key?: string; name: string }>();
  const draftRef = useRef<IpProject>(undefined);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const drafts = useStudioList(loadDrafts, ready);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef(0);

  const pickScene = useCallback((next: ImageScene, keepInputs = false) => {
    setScene(next);
    setRatio(next.ratio);
    setHint("");
    if (!keepInputs) {
      setPrompt(next.prompt);
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
      const fromName = sceneFromDraftName(project.name, IMAGE_DRAFT_SUFFIX, ALL_SCENES);
      const latest = imageRows(project.doc)[0];
      if (fromName) { setScene(fromName); setRatio(latest?.metadata?.studio?.request?.aspectRatio || fromName.ratio); setSlots(fromName.refs.map(() => undefined)); }
      setPrompt(latest?.metadata?.studio?.request?.prompt ?? fromName?.prompt ?? "");
      writeQuery((fromName || scene).id, project.id);
    } catch (e) { showFailure({ action: "打开草稿", error: e }); }
    finally { setOpening(undefined); }
  }, [scene, showDraft, showFailure]);

  // 地址栏里的场景 / 草稿：首页卡片和「最近」都靠它直达。进页面时读一次存下来 ——
  // 登录状态晚一拍才就绪，先同步场景会把地址里的草稿号写掉，之后就再也读不到了。
  const entry = useRef(readQuery());
  useEffect(() => { pickScene(imageScene(entry.current.scene) || freeImageScene); }, [pickScene]);
  useEffect(() => {
    const id = entry.current.draft;
    if (!ready || !id) return;
    entry.current = { ...entry.current, draft: undefined };
    void openDraft(id);
  }, [ready, openDraft]);

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
  const missing = scene.refs.findIndex((r, i) => r.required && !slots[i]);
  const blocker = !models ? "正在读取模型…" : !caps?.mock && !chosen ? "还没有可用的图片模型"
    : missing >= 0 ? `先放「${scene.refs[missing].label}」` : !prompt.trim() ? "写一句想要的画面" : prompt.length > maxChars ? `描述最多 ${maxChars} 字` : "";

  const upload = async (index: number, file: File) => {
    setUploading(index); setHint("");
    try {
      const result = await IpStudioApi.uploadImage(await prepareStudioImageUpload(file));
      setSlots(old => { const next = [...old]; next[index] = { key: result.key, url: result.url, name: result.fileName || file.name }; return next; });
    } catch (e) { showFailure({ action: "上传参考图", error: e, next: "换一张 JPG 或 PNG 图片再试。" }); }
    finally { setUploading(undefined); }
  };

  const generate = async () => {
    if (busy) return;
    if (blocker) { setHint(blocker); return; }
    setBusy(true); setHint("");
    let nodeId: string | undefined; let posted = false;
    try {
      if (!draftRef.current) {
        showDraft(await createSceneDraft(scene.title, IMAGE_DRAFT_SUFFIX));
        writeQuery(scene.id, draftRef.current!.id);
        drafts.reload();
      }
      const project = draftRef.current!;
      const refs = scene.refs.flatMap((r, i) => slots[i] ? [{ upload: slots[i]!, label: r.label }] : []);
      let request: Parameters<typeof submitStudioRun>[1] | undefined;
      await persist(doc => {
        const row = addImageRow(doc, { title: scene.title, prompt: prompt.trim(), refs, ratio: usedRatio, count: usedCount, size: usedSize,
          model: caps?.mock ? undefined : chosen?.endpointId, maxCost: quote });
        request = row.request; nodeId = row.nodeId;
        return row.doc;
      });
      posted = true;
      const run = await submitStudioRun(project.id, request!);
      await persist(doc => applyRun(doc, nodeId!, run));
    } catch (e) {
      if (nodeId && isStudioBillingCancelled(e)) { await persist(doc => patchNode(doc, nodeId!, () => undefined)).catch(() => undefined); return; }
      const rejected = submissionRejected(e, posted);
      if (nodeId) await persist(doc => patchNode(doc, nodeId!, n => ({ ...n, metadata: { ...n.metadata, ...studioErrorMetadata(e),
        status: rejected ? "error" : "loading", ...(rejected ? {} : { errorDetails: "提交结果没有确认，点「确认原任务」查一下，不会重复扣费" }) } }))).catch(() => undefined);
      showFailure({ action: "生成图片", error: e, next: rejected ? "改一下再试；积分没有扣。" : "这次提交可能已经被受理，点「确认原任务」查一下，不要直接重新生成。" });
    } finally { setBusy(false); }
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
    setPrompt(request.prompt);
    if (request.aspectRatio) setRatio(request.aspectRatio);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (auth === "no-platform" || drafts.notEnrolled) return <PlatformGateScreen/>;
  const rows = draft ? imageRows(draft.doc) : [];
  const listGroups = imageSceneGroups.map(g => ({ id: g.id, title: g.title, items: imageScenes.filter(s => s.group === g.id) }));

  return <main className="ip-brand-surface scene-studio scene-image-studio" data-studio-overlay-root>
    <SceneList heading="AI 图片" current={scene.id} onPick={id => pickScene(imageScene(id) || freeImageScene)} top={freeImageScene} groups={listGroups}/>

    <section className="scene-composer" aria-label="图片设置">
      <header className="scene-composer-head">
        <SceneThumb id={scene.id} title={scene.title} size={52}/>
        <div><strong>{scene.title}</strong><small>{scene.description}</small></div>
        <button type="button" className="scene-new" onClick={() => { showDraft(undefined); pickScene(scene); writeQuery(scene.id); }}><Plus size={16}/>新建</button>
      </header>

      <div className="scene-composer-body">
        <div className="scene-ref-row" role="group" aria-label="参考图">
          {scene.refs.map((ref, i) => {
            const slot = slots[i];
            return <div key={`${scene.id}-${i}`} className={`scene-ref${slot ? " is-filled" : ""}`}>
              {slot ? <>
                <img src={slot.url} alt={ref.label}/><span className="scene-ref-index">图{i + 1}</span>
                <button type="button" className="scene-ref-remove" aria-label={`移除${ref.label}`} onClick={() => setSlots(old => { const next = [...old]; next[i] = undefined; return next; })}><X size={13}/></button>
              </> : <button type="button" className="scene-ref-add" disabled={uploading !== undefined} aria-label={`上传${ref.label}`}
                onClick={() => { uploadTarget.current = i; fileInput.current?.click(); }}
                onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); const file = e.dataTransfer.files[0]; if (file) void upload(i, file); }}>
                {uploading === i ? <Loader2 size={20} className="studio-gallery-spinner"/> : <ImagePlus size={20}/>}
              </button>}
              <span className="scene-ref-label" title={ref.hint}>{ref.label}{!ref.required && <small>（可选）</small>}</span>
              {!slot && <button type="button" className="scene-ref-library" onClick={() => setPicking(i)}>从资产库选</button>}
            </div>;
          })}
          <input ref={fileInput} type="file" accept=".jpg,.jpeg,.png" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(uploadTarget.current, file); }}/>
        </div>

        <label className="scene-prompt">
          <span className="scene-field-label">想要的画面{prompt !== scene.prompt && scene.prompt && <button type="button" onClick={() => setPrompt(scene.prompt)}><Undo2 size={13}/>恢复默认描述</button>}</span>
          <textarea value={prompt} maxLength={maxChars + 200} onChange={e => setPrompt(e.target.value)}
            placeholder={scene.refs.length ? "描述想要的画面，参考图按「图1、图2」称呼" : "描述想要的画面"}/>
          <small className={prompt.length > maxChars ? "is-over" : undefined}>{prompt.length} / {maxChars}</small>
        </label>
        {scene.prompt.includes("【") && <p className="scene-tip">方括号【…】里的内容换成你自己的，效果更好。</p>}
      </div>

      <div className="scene-settings">
        {caps?.imageModelMode !== "fixed" && candidates.length > 1 && <label className="scene-setting"><span>模型</span>
          <StudioSelect label="图片模型" compact value={chosen?.endpointId || ""} onChange={setModelId} options={candidates.map(m => ({ value: m.endpointId, label: m.name }))}/></label>}
        <label className="scene-setting"><span>比例</span>
          <StudioSelect label="画面比例" compact value={usedRatio} onChange={setRatio} options={ratios.map(r => ({ value: r, label: r }))}/></label>
        {sizes.length > 1 && <label className="scene-setting"><span>清晰度</span>
          <StudioSelect label="清晰度" compact value={usedSize || ""} onChange={setSize} options={sizes.map(s => ({ value: s.size, label: studioImageSizeLabel(s.size) || s.size }))}/></label>}
        <label className="scene-setting"><span>张数</span>
          <StudioSelect label="生成张数" compact value={String(usedCount)} onChange={v => setCount(Number(v))} options={counts.map(c => ({ value: String(c), label: `${c} 张` }))}/></label>
      </div>
      {models && !candidates.length && !caps?.mock && <SceneNoModel kind="图片"/>}
      {hint && <p className="scene-hint" role="status">{hint}</p>}
      <button type="button" className="scene-go" aria-label="立即生成图片" title={caps?.mock ? "测试响应，不扣积分" : chosen ? `预计 ${quote} 积分` : undefined} disabled={busy || (!!models && !caps?.mock && !chosen)} onClick={() => void generate()}>
        {busy ? <Loader2 size={18} className="studio-gallery-spinner"/> : null}<span>立即生成图片</span>
        <small>{caps?.mock ? "测试响应 · 免费" : chosen ? `预计 ${quote} 积分` : ""}</small>
      </button>
    </section>

    <section className="scene-results" aria-label="生成结果">
      <header><h2>{draft ? draft.name.replace(IMAGE_DRAFT_SUFFIX, "") : "生成结果"}</h2>
        {draft && <Link className="scene-link" href={`/projects/${encodeURIComponent(draft.id)}`}><FolderOpen size={15}/>在画布中继续</Link>}</header>
      {opening ? <div className="scene-loading"><Loader2 size={20} className="studio-gallery-spinner"/>正在打开草稿</div>
        : rows.length ? <ol className="scene-row-list">{rows.map(row => <ImageRow key={row.id} row={row} run={live[row.id]} busy={busy}
          onView={setViewing} onReuse={() => reuse(row)} onConfirm={() => void confirmOriginal(row)}
          onStop={() => { const id = row.metadata?.studio?.runId; if (id) void cancelRun(id).catch(e => showFailure({ action: "停止生成", error: e })); }}/>)}</ol>
        : <SceneEmpty title="图片创作" note={<>选一个场景，放好参考图，描述已经帮你写好了。<br/>点「立即生成图片」，结果会出现在这里。</>}
          covers={[imageScenes[3], imageScenes[0], imageScenes[9]]}/>}
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

function ImageRow({ row, run, busy, onView, onReuse, onConfirm, onStop }: {
  row: CanvasNodeData; run?: IpRun; busy: boolean; onView: (image: { url: string; key?: string; name: string }) => void;
  onReuse: () => void; onConfirm: () => void; onStop: () => void;
}) {
  const meta = row.metadata;
  const request = meta?.studio?.request;
  const images = (meta?.images || []).filter(i => i.status === "success" && i.content);
  const loading = meta?.status === "loading";
  const accepted = !!meta?.studio?.runId;
  const position = run?.queue?.position;
  const state = loading ? (!accepted ? "提交结果没有确认" : position && position > 0 ? `排队中，前面还有 ${position - 1} 个` : run?.pct ? `正在生成 ${run.pct}%` : "正在生成")
    : meta?.status === "error" ? (meta.errorDetails || "生成失败") : `${images.length} 张`;
  return <li className={`scene-row is-${meta?.status || "idle"}`}>
    <div className="scene-row-meta"><strong>{row.title}</strong><span>{[request?.aspectRatio, request?.count ? `${request.count} 张` : undefined].filter(Boolean).join(" · ")}</span>
      <span className="scene-row-state" role={loading ? "status" : undefined}>{loading && <Loader2 size={14} className="studio-gallery-spinner"/>}{state}</span></div>
    {request?.prompt && <p className="scene-row-prompt" title={request.prompt}>{request.prompt}</p>}
    <div className="scene-row-images">
      {images.map((image, i) => <button type="button" key={image.id} onClick={() => onView({ url: image.content!, key: image.storageKey, name: `${row.title}-${i + 1}` })} aria-label={`查看第 ${i + 1} 张`}>
        <img src={image.content} alt={`${row.title}第 ${i + 1} 张`} loading="lazy"/></button>)}
      {loading && Array.from({ length: Math.max(0, (request?.count || 1) - images.length) }, (_, i) => <span key={`wait-${i}`} className="scene-row-placeholder"/>)}
    </div>
    <div className="scene-row-actions">
      {loading && accepted && <button type="button" onClick={onStop}><Square size={13}/>停止</button>}
      {loading && !accepted && <button type="button" disabled={busy} onClick={onConfirm}><RotateCcw size={13}/>确认原任务</button>}
      {images[0] && <button type="button" onClick={() => void downloadMedia(images[0].content!, row.title, undefined, images[0].storageKey)}><Download size={13}/>下载</button>}
      {request && <button type="button" onClick={onReuse}><ExternalLink size={13}/>用这段描述再做</button>}
    </div>
  </li>;
}
