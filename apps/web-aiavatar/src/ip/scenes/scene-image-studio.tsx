"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SignedImage } from "@/canvas-bridge/signed-image";
import { ChevronDown, Clapperboard, Cpu, Download, FolderOpen, ImageUp, ImagePlus, Loader2, Mountain, Package, PencilLine, Plus, RotateCcw, Shirt, SlidersHorizontal, Square, Undo2, UserRound, X } from "lucide-react";
import type { IpImageAsset, IpProject, IpRun, StudioSceneImageState, StudioSceneOptionGroup } from "@ai-star-eco/types";
import type { StudioCapabilities } from "@ai-star-eco/types/ip-studio-workflow";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { cancelRun, fetchModels, readRun, signKeys, type IpModelOption } from "@/canvas-bridge/api";
import { studioCapabilities, submitStudioRun } from "@/canvas-bridge/studio-api";
import { isStudioBillingCancelled } from "@/canvas-bridge/studio-billing-cancel";
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
import { useSceneDraftStore, useSceneStateSave } from "./scene-draft-store";
import { useSceneQuery, writeSceneQuery } from "./scene-query";
import { UiVersionSwitch } from "@/shell/ui-version-switch";
import { addImageRow, applyRun, createSceneDraft, imageRows, listSceneDrafts, openedImageState, patchNode, resubmitRow, rowUploads, slotUploads, submissionRejected, type SceneUpload } from "./scene-drafts";
import { SceneDrawer, SceneEmpty, SceneExample, SceneNoModel, SceneRecent, SceneResultTabs, SceneSwitch, SceneViewer, sceneFailureText, sceneHintText, sceneOptionValues, useSceneDrawerPin, useScenePopover, RatioGlyph, useSceneMobile } from "./scene-layout";
import { AiMark } from "../studio-ai-icon";

const FALLBACK_RATIOS = ["1:1", "3:4", "4:3", "9:16", "16:9"];
const POLL_MS = 1500;

const writeQuery = (scene: string, draft?: string) => writeSceneQuery("/image", scene, draft);

/** 「AI 图片」：选场景 → 放参考图 → 描述已写好 → 生成。草稿是一张普通画布，可以随时去画布里继续。 */
export function SceneImageStudio() {
  const router = useRouter();
  const auth = useRequireAuth();
  const mobile = useSceneMobile();
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
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pinned, pin] = useSceneDrawerPin("image");
  const [tab, setTab] = useState<"results" | "example">("example");
  const [picking, setPicking] = useState<number>();
  const [models, setModels] = useState<IpModelOption[]>();
  const [caps, setCaps] = useState<StudioCapabilities>();
  const [modelId, setModelId] = useState<string>();
  const [ratio, setRatio] = useState("3:4");
  const [size, setSize] = useState<string>();
  const [count, setCount] = useState(1);
  const [hint, setHint] = useState("");
  // 说明（不是报错）：换场景时没带过来的参考图、「重新编辑」放回了什么。undo 是点「撤销」要回到的样子。
  const [note, setNote] = useState<{ text: string; undo?: () => void }>();
  const [busy, setBusy] = useState(false);
  // 正在提交（含等用户确认费用）的那一行：这时候还谈不上「结果没确认」。
  const [submitting, setSubmitting] = useState<string>();
  const [opening, setOpening] = useState<string>();
  const [live, setLive] = useState<Record<string, IpRun>>({});
  const [viewing, setViewing] = useState<{ url: string; key?: string; name: string }>();
  const closeViewer = useCallback(() => setViewing(undefined), []);
  // 草稿与保存队列（换草稿时旧回包不改这一页，见 scene-draft-store.ts）。
  const { draft, current: draftRef, session, begin, remember, show, onPage, persist, settled } = useSceneDraftStore();
  const imageIds = useMemo(() => new Set(catalog?.image.map(s => s.id) ?? []), [catalog]);
  const loadDrafts = useCallback(() => listSceneDrafts(imageIds), [imageIds]);
  const drafts = useStudioList(loadDrafts, ready && !!catalog);

  // 每个场景没提交的输入（补充要求、完整描述、选项、参考图）：换个场景再回来时放回去，不悄悄清空（2026-10-30 复测）。
  type Unsent = { supplement: string; custom?: string; picked: Record<string, string>; slots: (SceneUpload | undefined)[] };
  // 离开时开着草稿的，只记草稿号：回来时重新打开那份草稿（条件存在草稿里），和 AI 视频一样（2026-10-30 界面评审）。
  const unsent = useRef(new Map<string, Unsent | { draftId: string }>());
  const inputsNow = useRef<Unsent>({ supplement: "", picked: {}, slots: [] });
  inputsNow.current = { supplement, custom, picked, slots };
  const sceneNow = useRef<string>(undefined);
  const pickScene = useCallback((next: ImageScene, keepInputs = false) => {
    const leaving = sceneNow.current, now = inputsNow.current;
    if (leaving && leaving !== next.id && !keepInputs) {
      if (draftRef.current) unsent.current.set(leaving, { draftId: draftRef.current.id });
      else if (now.supplement.trim() || now.custom !== undefined || Object.keys(now.picked).length || now.slots.some(Boolean)) unsent.current.set(leaving, now);
      else unsent.current.delete(leaving);
    }
    sceneNow.current = next.id;
    setSceneId(next.id);
    setRatio(next.ratio);
    setHint(""); setNote(undefined);
    if (!keepInputs) {
      const back = unsent.current.get(next.id);
      const sent = back && !("draftId" in back) ? back : undefined;
      setSupplement(sent?.supplement ?? ""); setCustom(sent?.custom); setPicked(sent?.picked ?? {});
      // 回到填过的场景放回当时的参考图；没填过的，**同名**的参考图位跟着走（模特图还是模特图、人物照片还是人物照片），
      // 别的位不带：按位置带会把「新面孔」放进「服装图」（模特换脸 → 服装上身），用途悄悄换了。带不过来的说一句。
      const from = leaving ? findImageScene(catalogRef.current, leaving) : undefined;
      const carried = sent ? next.refs.map((_, i) => sent.slots[i])
        : next.refs.map(r => { const j = from?.refs.findIndex(x => x.label === r.label) ?? -1; return j >= 0 ? now.slots[j] : undefined; });
      setSlots(carried);
      const left = !sent && from ? from.refs.filter((r, i) => now.slots[i] && !next.refs.some(x => x.label === r.label)).map(r => `「${r.label}」`) : [];
      if (left.length) setNote({ text: `${left.join("")}在这里用不上，先收起来了，回「${from!.title}」还在` });
    }
    writeQuery(next.id, draftRef.current?.id);
  }, []);

  const showDraft = useCallback((project: IpProject | undefined, ticket?: number) => {
    const shown = show(project, ticket);
    if (shown) setLive({});
    return shown;
  }, [show]);

  /**
   * 从左边列表换场景：开着草稿就离开它（草稿属于一个场景，条件也存在里面），回到那个场景时重新打开；
   * 以前图片页换场景草稿还开着，新场景的条件写进了原来那份草稿，从「最近」打开就对不上了（2026-10-30 界面评审）。
   */
  const goToScene = (next: ImageScene) => {
    const back = unsent.current.get(next.id);
    if (back && "draftId" in back && back.draftId !== draftRef.current?.id) {
      if (sceneNow.current && draftRef.current) unsent.current.set(sceneNow.current, { draftId: draftRef.current.id });
      unsent.current.delete(next.id); void openDraft(back.draftId); return;
    }
    const leaving = draftRef.current;
    pickScene(next);
    if (leaving) { showDraft(undefined, begin()); writeQuery(next.id); }
  };

  const openingId = useRef<string>(undefined);
  const openDraft = useCallback(async (id: string) => {
    const ticket = begin();
    openingId.current = id;
    setOpening(id);
    try {
      await settled(id);
      const project = await IpStudioApi.getProject(id);
      // 接着上次做：离开时的场景、补充要求、改过的描述、选项、参考图、模型和规格都放回来（存在草稿里，见 sceneImageState）。
      // 老草稿没存过，按最近一次出图推断。参考图地址先换好再摆，免得摆出来一排裂图。
      const state = openedImageState(project.doc, catalogRef.current, project.sceneId);
      const from = findImageScene(catalogRef.current, state.sceneId);
      const restored = from ? await slotUploads(project.doc, state.slots, signKeys) : [];
      if (!showDraft(project, ticket)) return;
      const latest = imageRows(project.doc)[0];
      if (from) { sceneNow.current = from.id; setSceneId(from.id); setRatio(state.ratio || from.ratio); setSlots(restored); }
      setSupplement(state.supplement); setCustom(state.custom); setPicked(state.options);
      setModelId(state.model); setSize(state.size); setCount(state.count); setNote(undefined);
      setTab(latest ? "results" : "example");
      writeQuery(from?.id ?? FREE_SCENE_ID, project.id);
    } catch (e) { if (onPage(ticket)) showFailure({ action: "打开草稿", error: e }); }
    finally { setOpening(o => o === id ? undefined : o); if (openingId.current === id) openingId.current = undefined; }
  }, [begin, settled, showDraft, onPage, showFailure]);

  // 地址栏里的场景 / 草稿（首页卡片、「最近」、前进后退都靠它，见 scene-query.ts）。
  // 带草稿号就打开那份（登录就绪后）；没有草稿号就到那个场景，页面上开着别的草稿时先离开它。
  const query = useSceneQuery();
  useEffect(() => {
    if (!catalog) return;
    if (query.draft) {
      if (ready && query.draft !== draftRef.current?.id && query.draft !== openingId.current) void openDraft(query.draft);
      return;
    }
    if (draftRef.current) showDraft(undefined, begin());
    const next = findImageScene(catalog, query.scene) ?? findImageScene(catalog, FREE_SCENE_ID)!;
    if (next.id !== sceneNow.current) pickScene(next);
  }, [catalog, ready, query.scene, query.draft, openDraft, pickScene, showDraft, begin, draftRef]);

  useEffect(() => {
    if (!ready) return;
    let active = true;
    void Promise.all([fetchModels(), studioCapabilities()]).then(([m, c]) => { if (active) { setModels(m.image); setCaps(c); } })
      .catch(e => { if (active) { setModels([]); showFailure({ action: "读取图片模型", error: e }); } });
    return () => { active = false; };
  }, [ready, showFailure]);

  // 接着看已经受理的任务：只读运行记录，绝不重新提交。
  const draftId = draft?.id;
  useEffect(() => {
    if (!draftId) return;
    let alive = true, ticking = false;
    const tick = async () => {
      if (ticking) return; ticking = true;
      try {
        // 这一轮读的是哪份草稿就写回哪份：读任务时页面换走了也不会写到别的草稿上。
        const projectId = draftRef.current?.id;
        const pending = imageRows(draftRef.current?.doc ?? { nodes: [], connections: [], viewport: { x: 0, y: 0, k: 1 } })
          .filter(n => n.metadata?.status === "loading" && n.metadata.studio?.runId);
        for (const row of pending) {
          const run = await readRun(row.metadata!.studio!.runId!);
          if (!alive) return;
          if (run.status === "running") { setLive(l => ({ ...l, [row.id]: run })); continue; }
          await persist(doc => patchNode(applyRun(doc, row.id, run), row.id, n => ({ ...n, metadata: { ...n.metadata,
            status: run.status === "done" ? "success" : "error", ...(run.status === "failed" ? { errorDetails: run.errorMessage || "生成失败", errorCode: run.errorCode, errorLogId: run.logId } : { errorDetails: undefined }) } })), projectId);
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

  // 页面上的条件写进草稿（有草稿时），刷新、再打开都还是这些。想要的比例 / 张数原样记，不记被换掉之后的。
  const imageState = useMemo<StudioSceneImageState>(() => ({ sceneId: scene?.id ?? FREE_SCENE_ID, supplement, ...(custom !== undefined ? { custom } : {}), options: picked,
    slots: (scene?.refs ?? []).map((_, i) => slots[i] ? { key: slots[i]!.key, name: slots[i]!.name } : null),
    ...(modelId ? { model: modelId } : {}), ratio, ...(size ? { size } : {}), count }), [scene, supplement, custom, picked, slots, modelId, ratio, size, count]);
  useSceneStateSave("sceneImageState", draft, imageState, persist, doc => openedImageState(doc, catalogRef.current, draft?.sceneId));
  // 模型不支持想要的比例 / 张数时照实说按什么出，不悄悄换（AGENTS「生成面板不许静默钳制」）。
  const specNote = [ratio !== usedRatio ? `这个模型出不了 ${ratio}，会按 ${usedRatio} 出` : "",
    count !== usedCount ? `一次出不了 ${count} 张，会出 ${usedCount} 张` : ""].filter(Boolean).join("，");

  /** 素材位只从资产库选（新文件在选择框里先传进资产库）：打开时记下是哪份草稿，选完时页面换了草稿就不放进来。 */
  const pickTicket = useRef(0);
  const openPicker = (index: number) => { pickTicket.current = session.current; setHint(""); setPicking(index); };

  type RowInput = Parameters<typeof addImageRow>[1];
  const generate = async () => {
    if (busy || !scene) return;
    if (blocker) { setHint(blocker); return; }
    setNote(undefined);
    // 描述由服务端按场景拼（同一份目录、同一套校验）；缺什么它会直接说，就地显示。
    let prompt: string;
    try {
      const options = sceneOptionValues(scene.options, picked);
      prompt = (await IpStudioApi.composeScene({ kind: "image", sceneId: scene.id, text: supplement, ...(custom !== undefined ? { custom } : {}),
        filled: slots.flatMap((s, i) => s ? [i] : []), ...(options ? { options } : {}) })).text;
    } catch (e) { setHint(sceneHintText(e, "描述没准备好，请再点一次")); return; }
    const refs = scene.refs.flatMap((r, i) => slots[i] ? [{ upload: slots[i]!, label: r.label }] : []);
    const model = caps?.mock ? undefined : chosen?.endpointId;
    // 这一次的条件另存一份（不是拼好的话）：「重新编辑」照它放回，选项和补充要求不会叠两遍。
    const snapshot = { sceneId: scene.id, supplement, ...(custom !== undefined ? { custom } : {}), options: sceneOptionValues(scene.options, picked) ?? {},
      ...(model ? { model } : {}), ratio: usedRatio, ...(usedSize ? { size: usedSize } : {}), count: usedCount };
    void submitRow({ title: scene.title, prompt, refs, ratio: usedRatio, count: usedCount, size: usedSize, model, maxCost: quote, scene: snapshot });
  };
  /** 失败了（没扣积分）就在原来那一行按原样再来一次：同样的图、描述和设置，新的请求编号。 */
  const retry = (row: CanvasNodeData) => { if (row.metadata?.studio?.request) void submitRow(row.id); };
  const submitRow = async (input: RowInput | string) => {
    if (busy) return;
    setBusy(true); setHint("");
    const ticket = session.current;
    let nodeId: string | undefined; let posted = false;
    // 这一次提交从头到尾只作用于这一份草稿；中途从「最近」换了草稿，它照样做完，只是不再改页面。
    let projectId = draftRef.current?.id;
    try {
      if (!projectId) {
        const created = await createSceneDraft(scene!.title, scene!.id);
        remember(created);
        if (showDraft(created, ticket)) writeQuery(scene!.id, created.id);
        projectId = created.id;
        drafts.reload();
      }
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
      }, projectId);
      if (onPage(ticket, projectId)) { setSubmitting(nodeId); setTab("results"); }
      posted = true;
      const run = await submitStudioRun(projectId, request!);
      await persist(doc => applyRun(doc, nodeId!, run), projectId);
    } catch (e) {
      if (nodeId && isStudioBillingCancelled(e)) { await persist(doc => patchNode(doc, nodeId!, () => undefined), projectId).catch(() => undefined); return; }
      const rejected = submissionRejected(e, posted);
      if (nodeId) await persist(doc => patchNode(doc, nodeId!, n => ({ ...n, metadata: { ...n.metadata, ...studioErrorMetadata(e),
        status: rejected ? "error" : "loading", ...(rejected ? {} : { errorDetails: "提交结果没有确认，点「确认原任务」查一下，不会重复扣费" }) } })), projectId).catch(() => undefined);
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
      await persist(doc => patchNode(applyRun(doc, row.id, run), row.id, n => ({ ...n, metadata: { ...n.metadata, status: "loading", errorDetails: undefined } })), project.id);
    } catch (e) { showFailure({ action: "确认原任务", error: e }); }
    finally { setBusy(false); }
  };

  /**
   * 重新编辑：把那一次的场景、补充要求、改过的描述、选项、参考图、模型和规格放回输入区，改一处再生成。
   * 放回的是**条件**，描述照样由服务端拼一次。以前把拼好的整段话塞进「完整描述」，再生成时选项和补充要求又拼一遍，
   * 旧的角度和新选的角度同时出现在描述里（2026-10-30 审查 G02）。2026-10-30 之前的出图没有条件快照，只能放回那段话。
   */
  const reuse = (row: CanvasNodeData) => {
    const request = row.metadata?.studio?.request, snap = row.metadata?.studio?.sceneImage;
    if (!request || !scene || !catalog) return;
    const target = (snap && findImageScene(catalog, snap.sceneId)) || scene;
    const used = draftRef.current ? rowUploads(draftRef.current.doc, row) : [];
    // 点之前正在编辑的样子：「撤销」回到这里（放回会覆盖输入框，600ms 后还会存进草稿）。
    const before = { scene, supplement, custom, picked, slots, modelId, ratio, size, count };
    const put = (v: typeof before) => {
      if (v.scene.id !== sceneNow.current) pickScene(v.scene, true);
      setSlots(v.slots); setSupplement(v.supplement); setCustom(v.custom); setPicked(v.picked);
      setModelId(v.modelId); setRatio(v.ratio); setSize(v.size); setCount(v.count);
    };
    if (snap) put({ scene: target, supplement: snap.supplement, custom: snap.custom, picked: snap.options, slots: target.refs.map((_, i) => used[i]),
      modelId: snap.model, ratio: snap.ratio, size: snap.size, count: snap.count });
    else put({ ...before, scene: target, slots: target.refs.map((_, i) => used[i]), ratio: request.aspectRatio || before.ratio,
      ...(target.id === FREE_SCENE_ID ? { supplement: request.prompt } : { custom: request.prompt, supplement: "" }) });
    // 当时的模型现在没有了就照实说换成了哪个，不悄悄换（审查「不悄悄钳制」同一条）。
    const gone = snap?.model && !caps?.mock && candidates.length && !candidates.some(m => m.endpointId === snap.model)
      ? `当时用的模型现在用不了，这次用「${(candidates.find(m => m.isDefault) ?? candidates[0]).name}」。` : "";
    setHint("");
    setNote({ text: `${gone}这次的设置放回来了，改好再生成。`, undo: () => { put(before); setNote(undefined); } });
    // 输入区在页面上方（手机上在结果下面很远）：滚过去并把光标放进去，不然点了像没反应（2026-10-30 界面评审）。
    setTimeout(() => {
      document.querySelector(".scene-image-studio .scene-composer")?.scrollIntoView?.({ block: "start", behavior: "smooth" });
      (document.querySelector<HTMLTextAreaElement>(".scene-image-studio .scene-box textarea"))?.focus({ preventScroll: true });
    }, 0);
  };

  /**
   * 出的这张图接着用（2026-10-30 审查 G04：只能下载，想拿它当参考得下载再上传）。
   * 当参考图：放进当前场景第一个空着的参考图位，都放满了就换掉第一张。做成视频：带着这张图去 AI 视频。
   */
  const putAsReference = (image: { url: string; key?: string; name: string }) => {
    if (!scene || !image.key) return;
    const empty = scene.refs.findIndex((_, i) => !slots[i]);
    const at = empty >= 0 ? empty : 0;
    setSlots(old => { const next = scene.refs.map((_, i) => old[i]); next[at] = { key: image.key!, url: image.url, name: image.name }; return next; });
    setViewing(undefined); setHint("");
    setNote({ text: `放进「${scene.refs[at].label}」了${empty < 0 ? "，换掉了原来那张" : ""}。` });
    setTimeout(() => document.querySelector(".scene-image-studio .scene-composer")?.scrollIntoView?.({ block: "start", behavior: "smooth" }), 0);
  };
  const toVideo = (image: { key?: string }) => {
    if (!image.key) return;
    router.push(`/video?scene=${videoSceneFor(scene?.id, scene?.group)}&ref=${encodeURIComponent(image.key)}`);
  };
  /**
   * 改图类场景（换脸、精修、真人感、白底、入景、换装）把原图放在结果前面，一眼对比改了什么（方案 §4.3）。
   * 原图就是那一次的图1；自由出图、设定图这类生成新图的不放。
   */
  const originalOf = (row: CanvasNodeData) => {
    const sceneId = row.metadata?.studio?.sceneImage?.sceneId ?? scene?.id;
    if (!sceneId || !COMPARE_SCENES.has(sceneId) || !draftRef.current) return undefined;
    const first = rowUploads(draftRef.current.doc, row)[0];
    return first ? { url: first.url, key: first.key, name: `${row.title}-原图` } : undefined;
  };
  const followUps = (image: { url: string; key?: string; name: string }) => image.key ? <>
    <button type="button" onClick={() => putAsReference(image)}><ImageUp size={16}/>当参考图</button>
    <button type="button" onClick={() => toVideo(image)}><Clapperboard size={16}/>做成视频</button></> : null;

  if (auth === "no-platform" || drafts.notEnrolled) return <PlatformGateScreen/>;
  const rows = draft ? imageRows(draft.doc) : [];
  if (catalogError && !catalog) return <main className="ip-brand-surface scene-studio scene-image-studio"><div className="scene-loading">场景目录没读出来<button type="button" className="ip-brand-secondary" onClick={retryCatalog}>重新加载</button></div></main>;
  if (!catalog || !scene) return <main className="ip-brand-surface scene-studio scene-image-studio"><div className="scene-loading"><Loader2 size={20} className="studio-gallery-spinner"/>正在读取场景</div></main>;
  const free = findImageScene(catalog, FREE_SCENE_ID);
  const listGroups = catalog.imageGroups.map(g => ({ id: g.id, title: g.title, items: catalog.image.filter(s => s.group === g.id && s.id !== FREE_SCENE_ID) }));
  const groupTitle = catalog.imageGroups.find(g => g.id === scene.group)?.title;
  const onPick = (id: string) => { const next = findImageScene(catalog, id); if (next && (next.id !== scene.id || draft)) goToScene(next); };

  return <main className={`ip-brand-surface scene-studio scene-image-studio${pinned ? " has-drawer" : ""}`} data-studio-overlay-root>
    {(pinned || drawerOpen) && <SceneDrawer heading="AI 图片" groups={listGroups} top={free} current={scene.id} onPick={onPick} pinned={pinned} onPin={pin} onClose={() => setDrawerOpen(false)}/>}

    <section className="scene-card scene-composer" aria-label="出图设置">
      <header className="scene-composer-head">
        <SceneSwitch scene={scene} groups={listGroups} top={free && free.id !== scene.id ? free : undefined} onPick={onPick} onAll={() => { if (!pinned) setDrawerOpen(true); }}/>
        {mobile && <SceneRecent icon drafts={drafts.data} loading={drafts.loading} error={drafts.error} onRetry={drafts.reload} current={draft?.id} onOpen={id => void openDraft(id)}/>}
        <button type="button" className="scene-new" onClick={() => { showDraft(undefined, begin()); pickScene(scene); writeQuery(scene.id); }}><Plus size={13} strokeWidth={1.6}/>新建</button>
      </header>

      <div className="scene-compose">
        <div className={`scene-media-row${scene.refs.length <= 3 ? " is-large" : ""}`} role="group" aria-label="参考图">
          {scene.refs.map((ref, i) => {
            const slot = slots[i];
            const Icon = refIcon(ref.label);
            return <div key={`${scene.id}-${i}`} className={`scene-media${slot ? " is-filled" : ""}`}>
              {slot ? <span className="scene-media-preview"><SignedImage src={slot.url} storageKey={slot.key} alt={ref.label}/><i className="scene-ref-index">图{i + 1}</i></span>
                : <button type="button" className="scene-slot-add" aria-label={`从资产库选${ref.label}`} title={ref.hint ?? undefined} onClick={() => openPicker(i)}>
                    <Icon size={20} strokeWidth={1.3}/><small>从资产库选</small></button>}
              <span title={ref.hint}>{ref.label}{!slot && !ref.required && <small>可选</small>}</span>
              {slot && <button type="button" className="scene-ref-remove" aria-label={`移除${ref.label}`} onClick={() => setSlots(old => { const next = [...old]; next[i] = undefined; return next; })}><X size={11} strokeWidth={1.8}/></button>}
            </div>;
          })}
        </div>

        <div className="scene-box">
          {custom !== undefined
            ? <textarea aria-label="完整描述" value={custom} onChange={e => setCustom(e.target.value)} className="is-full"/>
            : <textarea aria-label={isFree ? "想要的画面" : "补充要求"} value={supplement} placeholder={scene.hint} onChange={e => setSupplement(e.target.value)}/>}
          {custom !== undefined && <textarea aria-label="补充要求" className="is-extra" value={supplement} placeholder="还有要补充的，写在这里" onChange={e => setSupplement(e.target.value)}/>}
          <footer>
            <small className={ownText.length > ownLimit ? "is-over" : undefined}>{ownText.length} / {ownLimit}</small>
            {!isFree && (custom === undefined
              ? <button type="button" className="scene-text-button" title={scene.prompt} onClick={() => setCustom(scene.prompt)}><PencilLine size={13} strokeWidth={1.5}/>改完整描述</button>
              : <button type="button" className="scene-text-button" onClick={() => setCustom(undefined)}><Undo2 size={13} strokeWidth={1.5}/>用回场景描述</button>)}
          </footer>
        </div>

        <div className="scene-go-group">
          <div className="scene-pills">
            {caps?.imageModelMode !== "fixed" && candidates.length > 1 ? <div className="scene-pill is-select"><Cpu size={14} strokeWidth={1.5}/>
                <StudioSelect label="图片模型" compact value={chosen?.endpointId || ""} onChange={setModelId} options={candidates.map(m => ({ value: m.endpointId, label: m.name }))}/></div>
              : <span className="scene-pill"><Cpu size={14} strokeWidth={1.5}/><span>{chosen?.name ?? (caps?.mock ? "测试模型" : "图片模型")}</span></span>}
            <div className="scene-setting-panel-host">
              <button type="button" className="scene-pill" aria-expanded={settingsOpen} aria-controls="scene-image-settings" aria-label={`图片设置：${[usedRatio, studioImageSizeLabel(usedSize), `${usedCount} 张`].filter(Boolean).join("，")}`} onClick={() => setSettingsOpen(v => !v)}>
                <SlidersHorizontal size={14} strokeWidth={1.5}/><span><RatioGlyph ratio={usedRatio}/>{[usedRatio, studioImageSizeLabel(usedSize), `${usedCount} 张`].filter(Boolean).join(" · ")}</span><ChevronDown size={13} strokeWidth={1.6}/></button>
              {settingsOpen && <ImageSettingsPanel ratios={ratios} ratio={usedRatio} onRatio={setRatio} sizes={sizes} size={usedSize} onSize={setSize}
                counts={counts} count={usedCount} onCount={setCount} options={scene.options} picked={picked} onPick={(key, choice) => setPicked(old => ({ ...old, [key]: choice }))} onClose={() => setSettingsOpen(false)}/>}
            </div>
          </div>
          <button type="button" className="scene-go" aria-label="生成图片" title={blocker || undefined} disabled={busy || !!blocker} onClick={() => void generate()}>
            {busy ? <Loader2 size={16} className="studio-gallery-spinner"/> : null}<span>生成图片</span>
            {(caps?.mock || (chosen && quote > 0)) && <small>{caps?.mock ? "免费" : `${quote} 积分`}</small>}
          </button>
          {(hint || blocker) && <p className={`scene-hint${hint ? "" : " is-note"}`} role="status">{hint || blocker}</p>}
          {(note || specNote) && <p className="scene-hint is-note" role="status">{[note?.text, specNote].filter(Boolean).join(" ")}
            {note?.undo && <button type="button" onClick={note.undo}>撤销</button>}</p>}
          {models && !candidates.length && !caps?.mock && <SceneNoModel kind="图片"/>}
        </div>
      </div>
    </section>

    <section className="scene-card scene-results" aria-label="作品与示例">
      <header><SceneResultTabs tab={tab} onTab={setTab} count={rows.length} idBase="scene-image"/>
        <span className="scene-results-actions">{draft && <Link className="scene-text-button" href={`/projects/${encodeURIComponent(draft.id)}`}><FolderOpen size={14} strokeWidth={1.4}/>在画布中继续</Link>}
          {!mobile && <SceneRecent drafts={drafts.data} loading={drafts.loading} error={drafts.error} onRetry={drafts.reload} current={draft?.id} onOpen={id => void openDraft(id)}/>}
          <UiVersionSwitch inline/></span></header>
      <div id="scene-image-panel" className="scene-results-panel" role="tabpanel" aria-labelledby={`scene-image-tab-${tab}`}>
      {tab === "example" ? (isFree
          ? <SceneEmpty title="图片创作" note="放参考图，说说想要的画面；不知道怎么写，点上面的场景名换一个场景。"/>
          : <SceneExample id={scene.id} title={scene.title} group={groupTitle} note={scene.description} cover={scene.coverUrl} examples={scene.examples} ratio={scene.ratio}/>)
        : opening ? <div className="scene-loading"><Loader2 size={20} className="studio-gallery-spinner"/>正在打开草稿</div>
        : rows.length ? <ol className="scene-row-list">{rows.map(row => <ImageRow key={row.id} row={row} original={originalOf(row)} run={live[row.id]} busy={busy} submitting={submitting === row.id}
          onView={setViewing} onUse={putAsReference} onVideo={toVideo} onReuse={() => reuse(row)} onRetry={() => retry(row)} onConfirm={() => void confirmOriginal(row)}
          onStop={() => { const id = row.metadata?.studio?.runId; if (id) void cancelRun(id).catch(e => showFailure({ action: "停止生成", error: e })); }}/>)}</ol>
        : <SceneEmpty title="还没有作品" note="放好参考图，点「生成图片」，做好的图会出现在这里。"/>}
      </div>
    </section>

    {picking !== undefined && <div className="scene-picker-host"><LibraryReferencePicker open max={1} mediaType="image" upload title={`选${scene.refs[picking]?.label ?? "参考图"}`} intro="从资产库里选一张；新图点「上传到资产库」，传完会自动选中。原文件不会被改动。" confirmLabel="用这张"
      onClose={() => setPicking(undefined)} onAssets={async assets => {
        const image = assets.find((a): a is IpImageAsset => a.kind === "image" && !!a.data.storageKey);
        if (!image) throw new Error("请选择一张带图片的资产");
        const index = picking;
        if (!onPage(pickTicket.current)) return; // 选的时候换了草稿：这张图不是给新打开那份的
        setSlots(old => { const next = [...old]; next[index] = { key: image.data.storageKey!, url: image.data.dataUrl, name: image.title }; return next; });
      }}/></div>}
    {viewing && <SceneViewer url={viewing.url} storageKey={viewing.key} name={viewing.name} onClose={closeViewer} actions={followUps(viewing)}
      onDownload={() => void downloadMedia(viewing.url, viewing.name, undefined, viewing.key)}/>}
    <HubTabBar/>
  </main>;
}

function ImageRow({ row, original, run, busy, submitting, onView, onUse, onVideo, onReuse, onRetry, onConfirm, onStop }: {
  original?: { url: string; key?: string; name: string };
  row: CanvasNodeData; run?: IpRun; busy: boolean; submitting: boolean; onView: (image: { url: string; key?: string; name: string }) => void;
  onUse: (image: { url: string; key?: string; name: string }) => void; onVideo: (image: { key?: string }) => void;
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
  const state = loading ? (submitting && !accepted ? "正在提交" : !accepted ? "提交结果没有确认" : position && position > 0 ? `排队中，前面还有 ${position - 1} 个` : "生成中") : failure;
  const spec = [request?.aspectRatio, request?.count ? `${request.count} 张` : undefined].filter(Boolean).join(" · ");
  const ratio = (request?.aspectRatio ?? "1:1").replace(":", " / ");
  return <li className={`scene-row is-${meta?.status || "idle"}`}>
    <header className="scene-row-meta">
      {loading && <AiMark size={13}/>}
      <span className="scene-row-title"><strong title={request?.prompt || row.title}>{state && loading ? state : request?.prompt || row.title}</strong>
        <small>{[loading ? request?.prompt : undefined, spec].filter(Boolean).join(" · ")}</small></span>
      <span className="scene-row-actions">
        {loading && accepted && <button type="button" onClick={onStop}><Square size={12}/>停止</button>}
        {loading && !accepted && !submitting && <button type="button" disabled={busy} onClick={onConfirm}><RotateCcw size={12}/>确认原任务</button>}
        {meta?.status === "error" && request && <button type="button" className="is-primary" disabled={busy} onClick={onRetry}><RotateCcw size={12}/>重新生成</button>}
        {request && <button type="button" onClick={onReuse}><PencilLine size={12} strokeWidth={1.5}/>重新编辑</button>}
      </span>
    </header>
    {failure && <p className="scene-row-error" title={meta?.errorDetails !== failure ? `${meta?.errorDetails || ""}${meta?.errorLogId ? `（记录号 ${meta.errorLogId}）` : ""}` : undefined}>{failure}</p>}
    <div className="scene-row-images" style={{ "--tile-ratio": ratio } as CSSProperties}>
      {original && images.length > 0 && <button type="button" className="scene-row-original" onClick={() => onView(original)} aria-label="查看原图">
        <SignedImage src={original.url} storageKey={original.key} alt="原图" loading="lazy"/><span>原图</span></button>}
      {images.map((image, i) => { const item = { url: image.content!, key: image.storageKey, name: `${row.title}-${i + 1}` };
        return <div key={image.id} className="scene-row-tile">
          <button type="button" className="scene-row-image" onClick={() => onView(item)} aria-label={`查看第 ${i + 1} 张`}>
            <SignedImage src={image.content} storageKey={image.storageKey} alt={`${row.title}第 ${i + 1} 张`} loading="lazy"/></button>
          {/* 每张图上就能接着做：做成视频、当参考图、下载（悬停或聚焦时出现，手机上一直在）。 */}
          <span className="scene-row-tools">
            {image.storageKey && <button type="button" aria-label="做成视频" title="做成视频" onClick={() => onVideo({ key: image.storageKey })}><Clapperboard size={14} strokeWidth={1.5}/></button>}
            {image.storageKey && <button type="button" aria-label="当参考图" title="当参考图" onClick={() => onUse(item)}><ImageUp size={14} strokeWidth={1.5}/></button>}
            <button type="button" aria-label="下载" title="下载" onClick={() => void downloadMedia(item.url, row.title, undefined, item.key)}><Download size={14} strokeWidth={1.5}/></button>
          </span></div>; })}
      {loading && Array.from({ length: Math.max(0, (request?.count || 1) - images.length) }, (_, i) => <span key={`wait-${i}`} className="scene-row-placeholder"><AiMark size={18}/></span>)}
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

/** 图片设置：画面比例、清晰度、张数，以及场景的几组选项。就地展开在按钮上方。 */
function ImageSettingsPanel({ ratios, ratio, onRatio, sizes, size, onSize, counts, count, onCount, options, picked, onPick, onClose }: {
  ratios: string[]; ratio: string; onRatio: (r: string) => void; sizes: { size: string; aspectRatio: string }[]; size?: string; onSize: (s: string) => void;
  counts: number[]; count: number; onCount: (n: number) => void;
  options?: StudioSceneOptionGroup[] | null; picked: Record<string, string>; onPick: (key: string, choice: string) => void; onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useScenePopover(panel, onClose);
  return <div ref={panel} id="scene-image-settings" className="scene-settings-panel" role="group" aria-label="图片设置">
    <div className="scene-setting-row"><span>画面比例</span>
      <div className="scene-choice-row">{ratios.map(r => <button key={r} type="button" aria-pressed={r === ratio} onClick={() => onRatio(r)}><RatioGlyph ratio={r}/>{r}</button>)}</div></div>
    {sizes.length > 1 && <div className="scene-setting-row"><span>清晰度</span>
      <div className="scene-choice-row">{sizes.map(s => <button key={s.size} type="button" aria-pressed={s.size === size} onClick={() => onSize(s.size)} title={s.size.replace("x", " × ")}>{studioImageSizeLabel(s.size)}</button>)}</div></div>}
    <div className="scene-setting-row"><span>张数</span>
      <div className="scene-choice-row">{counts.map(c => <button key={c} type="button" aria-pressed={c === count} onClick={() => onCount(c)}>{c} 张</button>)}</div></div>
    {options?.map(g => <div key={g.key} className="scene-setting-row" role="group" aria-label={g.label}><span>{g.label}</span>
      <div className="scene-choice-row">{g.choices.map(c => <button key={c.value} type="button" aria-pressed={(picked[g.key] ?? g.defaultValue) === c.value} title={c.prompt}
        onClick={() => onPick(g.key, c.value)}>{c.label}</button>)}</div></div>)}
  </div>;
}

/**
 * 「做成视频」去哪个视频场景：人物类的图去数字人口播（人物照片），其余当商品图去口播带货。
 * 到了视频页可以再换场景，同名的素材位会跟着走。
 */
const COMPARE_SCENES = new Set(["face-swap", "retouch", "realism", "white-background", "scene-swap", "product-scene", "outfit-on-model", "outfit-restyle"]);

function videoSceneFor(sceneId?: string, group?: string): string {
  if (group === "ip" || group === "person" || sceneId === "realism" || sceneId === "scene-swap") return "ip-talking";
  return "ecom-talking";
}
