"use client";

import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { nanoid } from "nanoid";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, AudioLines, Check, ChevronDown, Copy, Cpu, Download, FolderOpen, History, Image as ImageIcon, Loader2, Mic, PencilLine, Plus,
  RotateCcw, SlidersHorizontal, Square, UserRound, Video, X } from "lucide-react";
import type { IpProject, IpProjectDoc, IpRun, IpSavedAsset, StudioMediaImportResult, StudioSceneComposeRequest, StudioSceneInputs, StudioNodeMetadata, StudioSceneOptionGroup, StudioSceneVideoState } from "@ai-star-eco/types";
import type { StudioCapabilities } from "@ai-star-eco/types/ip-studio-workflow";
import type { VideoStudioModel } from "@ai-star-eco/types/video-studio";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { HubTabBar } from "@/components/hub/ui";
import { cancelRun, fetchStudioVideoModels, readRun, signKeys } from "@/canvas-bridge/api";
import { SignedImage } from "@/canvas-bridge/signed-image";
import { SignedVideo } from "@/canvas-bridge/signed-video";
import { getStudioPlanExecution } from "@/canvas-bridge/studio-plan-execution";
import type { StudioPlanExecution, StudioSegmentedVideoPrice, StudioSegmentedVideoRequest } from "@ai-star-eco/types/ip-studio-workflow";
import { describeSegmentedPrice, segmentedRecords, segmentedVideoPrice, startSegmentedVideo, type SegmentedRecord } from "@/canvas-bridge/studio-segmented";
import type { StudioVideoTask, StudioVideoTaskCreate, StudioVideoTaskKind, StudioVideoTaskQuote } from '@ai-star-eco/types/ip-studio-video-task';
import type { EnterpriseBillingSelection } from '@ai-star-eco/types/enterprise';
import type { StudioVideoSettings } from '@ai-star-eco/types/ip-studio-workflow';
import { startVideoTask, prepareVideoTask, videoTaskPrice } from '@/canvas-bridge/studio-video-tasks';
import { SceneVideoWorkspace, VideoHistoryToggle, VideoTaskSettings, VIDEO_TASK_SELECTION } from './scene-video-workspace';
import { SegmentedRow } from "./scene-segmented-row";
import { studioCapabilities, submitStudioRun } from "@/canvas-bridge/studio-api";
import { attachmentNode } from "@/canvas-bridge/studio-attachments";
import { isStudioBillingCancelled, studioCreditShortageChoice } from "@/canvas-bridge/studio-billing-cancel";
import { studioChosenTextModel } from "@/canvas-bridge/studio-text-model";
import { studioVideoError, studioVideoQuote } from "@/canvas-bridge/studio-video";
import { describeStudioVideoPrice, studioPreviewPayer, studioVideoPriceQuery, useStudioVideoPrice } from "@/canvas-bridge/studio-video-price";
import { quoteVideoPrice } from "@/canvas-bridge/studio-model-quote";
import { STUDIO_GRANT_HINT, studioCreditCheck } from "@/canvas-bridge/studio-billing";
import { downloadMedia } from "@/canvas-bridge/download-media";
import { CanvasNodeType, type CanvasNodeData } from "@/canvas/types/canvas";
import { studioErrorMetadata, useStudioFailure } from "../studio-errors";
import { useStudioList } from "../studio-gallery";
import { studioEntryHref } from "../studio-entry";
import { StudioSelect } from "../studio-select";
import { LibraryReferencePicker } from "../library-reference-picker";
import { AUDIO_REFERENCE_NOTICE } from '@/canvas-bridge/recording-audio';
import { IpStudioApi } from "../api";
import { findVideoScene, useSceneCatalog, type VideoScene } from "./scene-catalog";
import { addScriptNode, addVideoRow, applyRun, createSceneDraft, draftSubject, listSceneDrafts, openedVideoState, patchNode, resubmitRow, restoreVideoTaskScript, sceneInputsOf, scriptNodes, scriptOfRow, rejectedNextStep, submissionRejected, videoRows, withSceneInput, type SceneInputKind } from "./scene-drafts";
import { useSceneDraftStore, useSceneStateSave } from "./scene-draft-store";
import { useSceneQuery, writeSceneQuery } from "./scene-query";
import { SceneDrawer, SceneEmpty, SceneExample, SceneNoModel, SceneResultTabs, SceneSwitch, sceneFailureText, sceneHintText, sceneOptionValues, useSceneDrawerPin, useScenePopover, RatioGlyph, useSceneMobile, SlotEmpty } from "./scene-layout";
import { PromptText, ScenePromptEditor, type ScenePromptEditorHandle, type ScenePromptRef } from "./scene-prompt-editor";
import { AiMark } from "../studio-ai-icon";
import { clampSceneDuration, sceneVideoDurations, sceneVideoInputs, sceneVideoSettings, type SceneVideoMaterial } from "./scene-video-plan";
import { classifyBlanks, missingFigures, overlongShots, scriptMissing, scriptPlaceholders, splitBlanks } from "./scene-script-check";

type Media = StudioMediaImportResult & { title: string };
type Slot = "image" | "character" | "voice" | "video";
const DEFAULT_SCENE = "ecom-talking";
const POLL_MS = 1500;
const LANGUAGES = ["中文", "英文"];
/** 一条视频最长多少秒（超过单段上限的分段做、再拼成一条，段数由服务端算，docs/studio-segmented-video.md）。 */
const MAX_SECONDS = 60;
const RECREATION = "reference-video-recreation";
const EMPTY_DOC = { nodes: [], connections: [], viewport: { x: 0, y: 0, k: 1 } };

const writeQuery = (scene: string, draft?: string) => writeSceneQuery("/video", scene, draft);
/** 草稿里没记过的条件按场景默认值。 */
const videoDefaults = (scene?: VideoScene) => ({ language: LANGUAGES[0], duration: scene?.duration ?? 15, ratio: scene?.ratio ?? "9:16" });

/**
 * 「AI 视频」（照参考站「超级编导」的出片方式，docs/studio-scene-creation.md §8）：
 * 放素材、说一句（可以不说）→ 编导看图写一版分镜脚本，接着说哪里要改 →「用这个脚本生成」→ 选模型和时长、确认积分 → 出片。
 * 一切都写在一张普通草稿画布里，随时可以「在画布中查看」。比模型单段长的片子一键做到成片（脚本、审核、分镜图、各段视频、合成，docs/studio-segmented-video.md）；
 * 爆款复刻和长视频同样在本页受理后台任务，正常制作不用进画布（docs/studio-video-workflow-redesign.md）。
 */
export function SceneVideoStudio() {
  const router = useRouter();
  const auth = useRequireAuth();
  const ready = auth === "ok";
  const mobile = useSceneMobile();
  const showFailure = useStudioFailure();
  const { catalog, error: catalogError, retry: retryCatalog } = useSceneCatalog(ready);
  const catalogRef = useRef(catalog); catalogRef.current = catalog;
  const videoIds = useMemo(() => new Set(catalog?.video.map(s => s.id) ?? []), [catalog]);
  const loadDrafts = useCallback(() => listSceneDrafts(videoIds), [videoIds]);
  const drafts = useStudioList(loadDrafts, ready && !!catalog);
  const [sceneId, setSceneId] = useState(DEFAULT_SCENE);
  const scene = findVideoScene(catalog, sceneId) ?? catalog?.video[0];
  const [text, setText] = useState("");
  const [language, setLanguage] = useState(LANGUAGES[0]);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [duration, setDuration] = useState(15);
  const [ratio, setRatio] = useState<string>("9:16");
  const [images, setImages] = useState<Media[]>([]);
  const [character, setCharacter] = useState<Media>();
  const [voice, setVoice] = useState<Media>();
  const [video, setVideo] = useState<Media>();
  const [uploading, setUploading] = useState<Slot>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitting, setSubmitting] = useState<string>();
  const [tab, setTab] = useState<"example" | "results">("example");
  // 一个编辑框：放想法，或放「采用」进来的脚本，按框里的内容生成。点「AI 编导」整张卡换成编导那一页（点了还没开始，发送才写）。
  const [selectedTask, setSelectedTask] = useState<StudioVideoTask>();
  const [mobileView, setMobileView] = useState<'compose' | 'result'>('compose');
  const [railOpen, setRailOpen] = useState(false);
  const [view, setView] = useState<"compose" | "director">("compose");
  const [scriptId, setScriptId] = useState<string>();
  const [revise, setRevise] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pinned, pin] = useSceneDrawerPin("video");
  const [caps, setCaps] = useState<StudioCapabilities>();
  const [videoModels, setVideoModels] = useState<VideoStudioModel[]>();
  const [modelId, setModelId] = useState<string>();
  const [tier, setTier] = useState<string>();
  const [optimize, setOptimize] = useState(true);
  // 生成过一次就重新报价：可能刚设了默认付款账户，模型赠款也用掉了一些。
  const [priceRevision, setPriceRevision] = useState(0);
  const [hint, setHint] = useState("");
  // 说明（不是报错，灰字一行）：换场景时没带过来的素材、「重新编辑」放回了什么。undo 是点「撤销」要回到的样子。
  const [note, setNote] = useState<{ text: string; undo?: () => void }>();
  const [live, setLive] = useState<Record<string, IpRun>>({});
  const [copied, setCopied] = useState<string>();
  // 草稿与保存队列（换草稿时旧回包不改这一页，见 scene-draft-store.ts）。
  const { draft, current: draftRef, session, begin, remember, show, onPage, persist, settled } = useSceneDraftStore();
  const [picking, setPicking] = useState<Slot>();
  const [imagePurpose, setImagePurpose] = useState<string>();
  const input = useRef<ScenePromptEditorHandle>(null);
  const thread = useRef<HTMLDivElement>(null);

  // ── 模型 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    let active = true;
    void Promise.all([studioCapabilities(), fetchStudioVideoModels()]).then(([c, v]) => { if (active) { setCaps(c); setVideoModels(v); } })
      .catch(e => { if (active) { setVideoModels([]); showFailure({ action: "加载视频模型", error: e }); } });
    return () => { active = false; };
  }, [ready, showFailure]);
  const textModel = studioChosenTextModel(caps, undefined);
  const scriptCost = caps?.mock ? 0 : textModel?.tokenPricing ? Math.ceil(textModel.tokenPricing.maxCost) : undefined;
  const chosenVideo = (videoModels ?? []).find(m => m.endpointId === modelId) ?? videoModels?.find(m => m.isDefault) ?? videoModels?.[0];
  const contract = chosenVideo?.contract;
  const durations = contract ? sceneVideoDurations(contract) : [duration];
  const usedDuration = contract ? clampSceneDuration(duration, contract) : duration;
  const tiers = contract?.tiers.filter(t => t.canvases.some(c => c.aspectRatio === ratio)) ?? [];
  const usedTier = tiers.find(t => t.tier === tier)?.tier ?? tiers[0]?.tier;
  useEffect(() => { if (contract && !durationTouched.current && duration > contract.maxSeconds) setDuration(contract.maxSeconds); }, [contract, duration]);

  // ── 场景与草稿 ────────────────────────────────────────────────────────
  const sceneNow = useRef<string>(undefined);
  /** 只管场景本身的默认值（时长、画面）；输入和素材怎么跟着走见 goToScene。 */
  // 场景默认时长比模型单段上限长时，先按单段出（拖到上限以外才分段做）；用户自己拖过、或草稿里记着的不动。
  const durationTouched = useRef(false);
  const pickScene = useCallback((next: VideoScene) => {
    sceneNow.current = next.id; durationTouched.current = false;
    setSceneId(next.id); setDuration(next.duration); setRatio(next.ratio); setPicked({});
    // 爆款复刻没有编导这一页；停在还没开始的编导页时换过去要回到编辑。
    if (next.skill === RECREATION) setView("compose");
    writeQuery(next.id, draftRef.current?.id);
  }, []);

  // 每个场景没发出去的东西：一句话、选项、素材。离开时开着草稿就只记草稿号，回来时打开那份草稿（2026-10-30 审查 G03：
  // 以前开着草稿换场景全清空、没草稿换场景文字和图一起带走，两种做法不一样，而且门店照片会被当成商品图用）。
  type Unsent = { text: string; picked: Record<string, string>; images: Media[]; character?: Media; voice?: Media; video?: Media };
  const unsent = useRef(new Map<string, Unsent | { draftId: string }>());
  const inputsNow = useRef<Unsent>({ text: "", picked: {}, images: [] });
  inputsNow.current = { text, picked, images, character, voice, video };

  const showDraft = useCallback((project: IpProject | undefined, ticket?: number) => {
    const shown = show(project, ticket);
    if (shown) setLive({});
    return shown;
  }, [show]);

  const reset = (next = scene) => {
    setSelectedTask(undefined); setMobileView('compose');
    try { sessionStorage.removeItem(VIDEO_TASK_SELECTION); } catch { /* UI preference */ }
    showDraft(undefined, begin()); setText(""); setImages([]); setCharacter(undefined); setVoice(undefined); setVideo(undefined);
    setView("compose"); setScriptId(undefined); setRevise(""); setHint(""); setTab("example");
    if (next) writeQuery(next.id);
  };

  /**
   * 换到另一个场景（左边列表、地址栏、前进后退都走这里）：
   * 回到来过的场景放回当时没发的输入，离开时开着草稿的就重新打开那份草稿；没来过的场景从空的开始，
   * 只有同名的素材位跟着走（商品图 → 商品图），出镜人物、声音、参考视频看新场景有没有这一格。没带过来的就地说一句。
   */
  const goToScene = (next: VideoScene) => {
    const leaving = sceneNow.current, now = inputsNow.current, open = draftRef.current;
    if (leaving && leaving !== next.id) {
      if (open) unsent.current.set(leaving, { draftId: open.id });
      else if (now.text.trim() || Object.keys(now.picked).length || now.images.length || now.character || now.voice || now.video) unsent.current.set(leaving, now);
      else unsent.current.delete(leaving);
    }
    const back = unsent.current.get(next.id);
    if (back && "draftId" in back) { unsent.current.delete(next.id); if (back.draftId !== open?.id) { void openDraft(back.draftId); return; } }
    const from = findVideoScene(catalogRef.current, leaving);
    if (open) reset(next);
    pickScene(next);
    if (back && !("draftId" in back)) {
      setText(back.text); setPicked(back.picked); setImages(back.images); setCharacter(back.character); setVoice(back.voice); setVideo(back.video);
      setNote(undefined);
      return;
    }
    const keepImages = !!from && from.images.label === next.images.label;
    const carried = { images: keepImages ? now.images.slice(0, next.images.max ?? 6) : [],
      character: next.character ? now.character : undefined, voice: next.voice ? now.voice : undefined, video: next.video ? now.video : undefined };
    setText(""); setImages(carried.images); setCharacter(carried.character); setVoice(carried.voice); setVideo(carried.video);
    const dropped = [now.images.length > carried.images.length && from ? from.images.label : "", now.character && !carried.character ? "出镜人物" : "",
      now.voice && !carried.voice ? "声音" : "", now.video && !carried.video ? "参考视频" : ""].filter(Boolean);
    // 单独一行灰字，不借用 hint：hint 是卡点（金色），借用会顶掉花费那行（2026-10-30 界面评审）。
    setNote(dropped.length && from ? { text: `此场景不使用${dropped.join("、")}，返回「${from.title}」时会恢复。` } : undefined);
  };

  /** 打开一份草稿：场景、素材、最新脚本都放回来，接着聊或接着出片。 */
  const openingId = useRef<string>(undefined);
  const openDraft = useCallback(async (id: string) => {
    const ticket = begin();
    openingId.current = id;
    try {
      await settled(id);
      const project = await IpStudioApi.getProject(id);
      if (!showDraft(project, ticket)) return;
      const from = findVideoScene(catalogRef.current, project.sceneId);
      if (from) { sceneNow.current = from.id; setSceneId(from.id); setRatio(from.ratio); }
      const nodes = project.doc.nodes as CanvasNodeData[];
      const media = (key: string | null): Media | undefined => {
        // 同一个文件可能放过几次，取最新那个节点
        const n = key ? [...nodes].reverse().find(x => x.metadata?.storageKey === key) : undefined;
        return n?.metadata?.storageKey && n.metadata.content
          ? { key: n.metadata.storageKey, url: n.metadata.content, title: n.title || "素材", fileName: n.title || "", bytes: 0, mimeType: n.metadata.mimeType || "",
            mediaType: n.type === CanvasNodeType.Audio ? "audio" : n.type === CanvasNodeType.Video ? "video" : "image" } : undefined;
      };
      // 选中哪些素材以草稿里记的为准（移除、更换都记了）；老草稿没记过，按画布上的素材推断。
      const inputs = sceneInputsOf(project.doc);
      setImages(inputs.images.flatMap(k => media(k) ?? []));
      setCharacter(media(inputs.character));
      setVoice(media(inputs.voice));
      setVideo(media(inputs.video));
      // 选过的视频模型跟着草稿走；老草稿没记过就看最近一条出片用的模型。
      setModelId(project.doc.sceneVideoModel ?? videoRows(project.doc)[0]?.metadata?.studio?.request?.model ?? undefined);
      // 离开时的条件放回来：没发的那句话、选项、台词语言、清晰度、时长、画面、要不要先优化，停在「生成视频」时连改了一半的脚本一起
      // （存在草稿里，见 sceneVideoState；老草稿按最近一版脚本记的推断）。改稿因此沿用写那一版时的选项，不会悄悄回到默认值。
      const state = openedVideoState(project.doc, videoDefaults(from));
      setText(state.edit ? state.edit.prompt ?? "" : state.text); setPicked(state.options); setLanguage(state.language!); setTier(state.tier); setOptimize(state.optimize!);
      // 草稿里记过时长才算用户定的；没记过的按场景默认值，同样先按模型单段上限出。
      setDuration(state.duration!); setRatio(state.ratio!); durationTouched.current = !!project.doc.sceneVideoState?.duration;
      // 写过脚本还没采用：直接看编导写的那几版；采用过就回到编辑框接着改。
      setView(!state.edit && scriptNodes(project.doc).length ? "director" : "compose"); setScriptId(state.edit?.scriptId); setRevise(""); setNote(undefined);
      setHint(""); setTab(videoRows(project.doc).length || segmentedRecords(project).length ? "results" : "example");
      writeQuery(from?.id ?? DEFAULT_SCENE, project.id);
    } catch (e) { if (onPage(ticket)) showFailure({ action: "打开草稿", error: e }); }
    finally { if (openingId.current === id) openingId.current = undefined; }
  }, [begin, settled, showDraft, onPage, showFailure]);

  // 地址栏里的场景 / 草稿（首页卡片、「最近」、前进后退都靠它，见 scene-query.ts）。
  // 带草稿号就打开那份（登录就绪后）；没有草稿号就到那个场景，页面上开着别的草稿时先离开它。
  const query = useSceneQuery();
  const initialVideoEntry = useRef(query);
  const taskOpen = !!selectedTask && query.task === selectedTask.id;
  useEffect(() => {
    if (!catalog) return;
    if (query.draft) {
      if (ready && query.draft !== draftRef.current?.id && query.draft !== openingId.current) void openDraft(query.draft);
      return;
    }
    const next = findVideoScene(catalog, query.scene) ?? findVideoScene(catalog, DEFAULT_SCENE) ?? catalog.video[0];
    if (next && (draftRef.current || next.id !== sceneNow.current)) goToScene(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalog, ready, query.scene, query.draft, openDraft, pickScene]);

  // 地址里带着 ref（AI 图片「做成视频」）：场景定下来以后放进素材，并从地址里去掉，刷新不会再放一次。
  const broughtRef = useRef<string>(undefined);
  useEffect(() => {
    if (!ready || !catalog || !scene || !query.ref || query.draft || broughtRef.current === query.ref) return;
    if (query.scene && query.scene !== scene.id) return;
    broughtRef.current = query.ref;
    writeQuery(scene.id, draftRef.current?.id);
    void bringImage(query.ref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, catalog, scene?.id, query.ref, query.draft, query.scene]);

  /** 这一次操作用哪份草稿：页面上开着的那份，没有就新建一份（ticket 之后换过草稿，新建的不摆到页面上）。 */
  const creatingDraft = useRef<{ ticket: number; promise: Promise<string> } | undefined>(undefined);
  const ensureDraft = async (ticket: number) => {
    if (!scene) throw new Error("场景尚未加载完成，请稍后重试。");
    if (draftRef.current) return draftRef.current.id;
    if (creatingDraft.current?.ticket === ticket) return creatingDraft.current.promise;
    const subject = draftSubject(text);
    const promise = (async () => {
      const created = await createSceneDraft(subject ? `${scene.title} · ${subject}` : scene.title, scene.id);
      remember(created);
      if (showDraft(created, ticket)) writeQuery(scene.id, created.id);
      drafts.reload();
      return created.id;
    })();
    creatingDraft.current = { ticket, promise };
    try { return await promise; }
    finally { if (creatingDraft.current?.promise === promise) creatingDraft.current = undefined; }
  };

  // 接着看已经受理的任务（脚本和视频）：只读运行记录，绝不重新提交。
  const draftId = draft?.id;
  useEffect(() => {
    if (!draftId) return;
    let alive = true, ticking = false;
    const tick = async () => {
      if (ticking) return; ticking = true;
      try {
        // 这一轮读的是哪份草稿就写回哪份：读任务时页面换走了也不会写到别的草稿上。
        const projectId = draftRef.current?.id;
        const doc = draftRef.current?.doc ?? EMPTY_DOC;
        const pending = [...scriptNodes(doc), ...videoRows(doc)].filter(n => n.metadata?.status === "loading" && n.metadata.studio?.runId);
        for (const row of pending) {
          const run = await readRun(row.metadata!.studio!.runId!);
          if (!alive) return;
          if (run.status === "running") { setLive(l => ({ ...l, [row.id]: run })); continue; }
          await persist(d => applyFinishedRun(d, row.id, run), projectId);
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

  const doc = draft?.doc ?? EMPTY_DOC;
  // 交给画布里创作助手的那份（爆款复刻）：回到这页也看得到做到哪了（2026-10-30 审查 G05 / C2）。
  // 执行就是画布那一套（ip_plan_execution），这里只读它，不另记一份进度。长视频有自己的一行（SegmentedRow），不算在这里。
  const handedOff = !!draft?.doc.assistantConversations?.some(n => n.metadata?.studioStart === "assistant");
  const segmentedRuns = segmentedRecords(draft);
  const executionId = [...(doc.nodes as CanvasNodeData[])].reverse().map(n => n.metadata?.studio?.execution?.executionId)
    .find(id => id && !segmentedRuns.some(r => r.executionId === id));
  const [execution, setExecution] = useState<StudioPlanExecution>();
  useEffect(() => {
    setExecution(undefined);
    if (!draftId || !executionId) return;
    let alive = true, timer: ReturnType<typeof setTimeout> | undefined;
    const read = async () => {
      try {
        const next = await getStudioPlanExecution(draftId, executionId);
        if (!alive) return;
        setExecution(next);
        if (next.status === "running") timer = setTimeout(() => void read(), 5000);
      } catch { if (alive) timer = setTimeout(() => void read(), 15000); }
    };
    void read();
    return () => { alive = false; if (timer) clearTimeout(timer); };
  }, [draftId, executionId]);
  const scripts = scriptNodes(doc);
  const rows = videoRows(doc);
  const latestScript = [...scripts].reverse().find(s => s.metadata?.status === "success" && s.metadata.content);
  const [stoppingScripts, setStoppingScripts] = useState<Record<string, "requesting" | "accepted">>({});
  const scriptStopping = (row: CanvasNodeData) => stoppingScripts[row.metadata?.studio?.runId ?? ""]
    ?? (live[row.id]?.stage === "studio.stopping" ? "accepted" : undefined);
  const writing = scripts.some(s => s.metadata?.status === "loading" && scriptStopping(s) !== "accepted");
  const stopScript = async (row: CanvasNodeData) => {
    const id = row.metadata?.studio?.runId;
    if (!id || scriptStopping(row)) return;
    const projectId = draftRef.current?.id;
    setStoppingScripts(old => ({ ...old, [id]: "requesting" }));
    try {
      const run = await cancelRun(id);
      if (run.status === "running") {
        setStoppingScripts(old => ({ ...old, [id]: "accepted" }));
        setLive(old => ({ ...old, [row.id]: run }));
      } else {
        await persist(doc => applyFinishedRun(doc, row.id, run), projectId);
        setLive(old => { const next = { ...old }; delete next[row.id]; return next; });
        setStoppingScripts(old => { const next = { ...old }; delete next[id]; return next; });
      }
    } catch (error) {
      setStoppingScripts(old => { const next = { ...old }; delete next[id]; return next; });
      showFailure({ action: "停止生成", error });
    }
  };
  // 新的一轮出来时滚到底（只滚对话区自己）。
  // 等这一帧排好版再滚：打开草稿时脚本和图片是后到的，立刻滚会停在半路，最新一版的按钮被输入框挡住一半。
  useEffect(() => {
    const frame = requestAnimationFrame(() => { const el = thread.current; if (el) el.scrollTop = el.scrollHeight; });
    return () => cancelAnimationFrame(frame);
  }, [scripts.length, writing]);

  // ── 素材 ──────────────────────────────────────────────────────────────
  /**
   * 素材只从资产库选（2026-10-31：不在这页直接传文件；新文件在选择框里先传进资产库，传完自动选中）。
   * 选好就放进这一格并写进草稿：素材节点 + 这一格现在选的是它，刷新或从「最近」再打开时还是这份。第一次放素材时建草稿。
   */
  const addFromLibrary = async (kind: Slot, assets: IpSavedAsset[]) => {
    if (!scene) return;
    const type = kind === "voice" ? "audio" : kind === "video" ? "video" : "image";
    const chosen = assets.flatMap((a): Media[] => {
      if (a.kind !== type) return [];
      const key = a.data.storageKey, url = a.kind === "image" ? a.data.dataUrl : a.data.url;
      return key && url ? [{ key, url, title: a.title, fileName: a.title, mediaType: type, mimeType: a.data.mimeType, bytes: a.data.bytes,
        ...(a.kind !== "audio" ? { width: a.data.width, height: a.data.height } : {}) }] : [];
    });
    if (!chosen.length) throw new Error(type === "image" ? "请选择一张图片" : type === "video" ? "请选择一段视频" : "请选择一段声音");
    const ticket = session.current;
    setUploading(kind);
    try {
      const projectId = await ensureDraft(ticket);
      const max = scene.images.max ?? 6;
      const fresh = kind === "image" ? chosen.filter(m => !images.some(o => o.key === m.key)).slice(0, Math.max(0, max - images.length)) : chosen.slice(0, 1);
      const titled = fresh.map((m, i) => ({ ...m, title: kind === "image" ? `${scene.images.label} ${images.length + i + 1}` : kind === "character" ? "出镜人物" : kind === "voice" ? m.title || "声音样本" : "参考视频" }));
      // 选的时候换了草稿：素材照样记进它自己那份草稿，只是不放到新打开的这页上。
      if (onPage(ticket, projectId)) {
        if (kind === "image") setImages(old => [...old, ...titled].slice(0, max));
        if (kind === "character") setCharacter(titled[0]);
        if (kind === "voice") setVoice(titled[0]);
        if (kind === "video") setVideo(titled[0]);
      }
      await persist(doc => titled.reduce((next, media) => {
        const nodes = next.nodes as CanvasNodeData[];
        const made = placeMedia(nodes, media, type, nodes.filter(n => n.metadata?.origin === "upload").length);
        // 老草稿的声音节点可能只叫「声音样本」；重选同一文件时也保留资产库里的名称。
        const placed = nodes.some(n => n.id === made.id)
          ? kind === "voice" ? { ...next, nodes: nodes.map(n => n.id === made.id ? { ...n, title: media.title } : n) } : next
          : { ...next, nodes: [...nodes, made] };
        return withSceneInput(placed, kind, media.key, "add", max);
      }, doc), projectId).catch(() => undefined);
    } catch (e) { showFailure({ action: "添加素材", error: e }); }
    finally { setUploading(undefined); }
  };
  /**
   * 从 AI 图片「做成视频」带过来的那张图（地址里的 ref，是本人的文件 key）：当一张场景图放进来，和上传的一样记进草稿。
   * key 是不是本人的由服务端在出片时照常把关（requireOwnedAssetKey）。
   */
  const bringImage = async (key: string) => {
    if (!scene) return;
    const ticket = session.current;
    setUploading("image");
    try {
      const url = (await signKeys([key]))[key];
      if (!url) throw new Error("图片加载失败，请返回 AI 图片重新点击「做成视频」。");
      const projectId = await ensureDraft(ticket);
      const max = scene.images.max ?? 6;
      const media: Media = { key, url, title: `${scene.images.label} ${images.length + 1}`, mediaType: "image", mimeType: "", bytes: 0, fileName: "" };
      if (onPage(ticket, projectId)) {
        setImages(old => old.some(m => m.key === key) ? old : [...old, media].slice(0, max));
        setNote({ text: `图片已添加到「${scene.images.label}」。描述想要的视频后，可交给 AI 编导撰写脚本。` });
      }
      await persist(doc => {
        const nodes = doc.nodes as CanvasNodeData[];
        const made = placeMedia(nodes, media, "image", nodes.filter(n => n.metadata?.origin === "upload").length);
        const placed = nodes.some(n => n.id === made.id) ? doc : { ...doc, nodes: [...nodes, made] };
        return withSceneInput(placed, "image", key, "add", max);
      }, projectId).catch(() => undefined);
    } catch (e) { showFailure({ action: "带入图片", error: e }); }
    finally { setUploading(undefined); }
  };

  /** 页面上现在选中的素材（记进草稿的那份，见 IpProjectDoc.sceneInputs）。 */
  const selection = (): StudioSceneInputs => ({ images: images.map(m => m.key), character: character?.key ?? null, voice: voice?.key ?? null, video: video?.key ?? null });
  /**
   * 换视频生成模型（输入栏和「生成视频」那一步是同一个选择）：时长、清晰度、能用的素材和出片报价都跟着它；
   * 有草稿就记进草稿，重开还是它。已受理的任务、确认原任务照原请求，不受影响。
   */
  const chooseVideoModel = (id: string) => {
    setModelId(id); setHint("");
    const projectId = draftRef.current?.id;
    if (projectId) void persist(doc => ({ ...doc, sceneVideoModel: id }), projectId).catch(e => showFailure({ action: "切换视频模型", error: e }));
  };
  /** 移除一格素材：页面上去掉，草稿里也记下这一格空了（素材节点留着，旧结果还引用它）。 */
  const drop = (kind: SceneInputKind, key: string) => {
    const projectId = draftRef.current?.id;
    if (projectId) void persist(doc => withSceneInput(doc, kind, key, "remove"), projectId).catch(e => showFailure({ action: "移除素材", error: e }));
  };
  const choose = (kind: Slot, purpose?: string) => { setImagePurpose(kind === "image" ? purpose : undefined); setPicking(kind); };

  /**
   * 素材放进草稿画布（同一个文件只放一次），返回每份素材对应的节点，顺序就是编导写的图1、图2…。
   * 必须在保存队列里基于当前文档调用：拿建草稿那一刻的旧节点会把轮询刚写进去的结果盖掉。
   */
  const placeMaterials = (base: CanvasNodeData[]) => {
    let nodes = base;
    const placed: { media: Media; node: CanvasNodeData }[] = [];
    const place = (media: Media, kind: "image" | "video" | "audio") => {
      const node = placeMedia(nodes, media, kind, placed.length);
      if (!nodes.some(n => n.id === node.id)) nodes = [...nodes, node];
      placed.push({ media, node });
    };
    if (video) place(video, "video");
    images.forEach(m => place(m, "image"));
    if (character) place(character, "image");
    if (voice) place(voice, "audio");
    return { nodes, placed };
  };

  // ── 编导写脚本 ────────────────────────────────────────────────────────
  const revising = !!latestScript;
  const recreation = scene?.skill === RECREATION;
  /** 让编导写（或改）这一版之前卡在哪：ask 是要交给编导的那句话。 */
  const scriptBlocker = (ask: string, settingsChanged = false) => !scene ? "正在加载场景…"
    : scene.images.required && !images.length ? `请添加${scene.images.label}`
    : !revising && scene.textRequired && !ask.trim() ? "请填写要求"
    : revising && !ask.trim() && !settingsChanged ? "请填写修改意见"
    : !caps ? "正在加载模型…"
    : !caps.mock && !textModel?.tokenPricing ? "AI 编导暂时不可用，请联系平台处理。" : "";
  /** 爆款复刻生成之前卡在哪。 */
  const handoffBlocker = !scene ? "正在加载场景…" : scene.video?.required && !video ? `请添加${scene.video.label}`
    : scene.images.required && !images.length ? `请添加${scene.images.label}`
    : scene.textRequired && !text.trim() ? "请填写要求" : "";

  /**
   * 让编导写第一版（ask 是编辑框里的想法）或改一版（ask 是「修改意见」）。
   * auto 是代码替用户发的（换了规格，「按当前设置修改脚本」），不清空用户正在写的那句；changes 是设置变了什么，
   * 交给服务端的编导模板说成一句话（docs/studio-prompt-architecture.md §5.1），页面不自己拼给模型的话。
   */
  const send = async (raw: string, opts?: { auto?: boolean; changes?: string }) => {
    if (busy || uploading || writing) return;
    // 编导页的输入框没写字、但设置改过（时长、画面、素材）：发出去就是照现在的设置改一版。
    if (revising && !raw.trim() && latestChanges && !opts?.auto) return send("", { auto: true, changes: latestChanges });
    const blocked = scriptBlocker(raw, !!opts?.changes);
    if (blocked) { setHint(blocked); return; }
    setBusy(true); setHint(""); setNote(undefined);
    const ticket = session.current;
    let nodeId: string | undefined, posted = false, projectId: string | undefined;
    try {
      const ask = raw.trim();
      const first = scripts[0]?.metadata?.studio?.sceneDirector;
      // 只给会交给视频模型的图编号（按所选模型算，和出片时同一个函数）：只认首帧的模型只拿第一张、纯文字模型一张都不拿。
      // 用不上的图编导照样可以看，脚本里用文字写；写脚本的模型看不到图就照实说（2026-10-30 审查 F07）。
      const handed = new Set((plan?.used ?? []).map(m => m.key));
      const visual = !!(caps?.mock || textModel?.supportsVision);
      // 用户写了改法、设置也变了：两件事一起交给编导（气泡里只显示用户写的那句）。
      const changed = opts?.changes ?? (revising && !opts?.auto ? latestChanges : "");
      // 场景输入随请求提交，服务端按提示词库的编导环节拼话并记下版本；页面不再先拼一段话再当普通文字提交。
      const sceneInput: StudioSceneComposeRequest = { kind: "video-script", sceneId: scene!.id, text: revising ? first?.ask ?? "" : ask,
        ...(revising && ask ? { revision: ask } : {}), ...(changed ? { settingsChanged: changed } : {}),
        imageTitles: images.filter(i => handed.has(i.key)).map(i => i.title), seenTitles: images.filter(i => !handed.has(i.key)).map(i => i.title),
        characterTitle: character?.title, ...(character && !handed.has(character.key) ? { characterSeen: true } : {}),
        voiceTitle: voice && handed.has(voice.key) ? voice.title : undefined, visual,
        duration: shownDuration, ratio, language, ...(sceneOptionValues(scene!.options, picked) ? { options: sceneOptionValues(scene!.options, picked) } : {}) };
      const said = ask || (changed ? `照现在的设置改一版（${changed}）` : "");
      projectId = await ensureDraft(ticket);
      const chosen = selection();
      const vision = caps?.mock || textModel?.supportsVision;
      let request: Parameters<typeof submitStudioRun>[1] | undefined;
      await persist(doc => {
        const { nodes, placed } = placeMaterials(doc.nodes as CanvasNodeData[]);
        const imageIds = placed.filter(p => p.media.mediaType === "image").map(p => p.node.id);
        const made = addScriptNode({ ...doc, nodes }, {
          ask: said, revision: revising, prompt: said || scene!.title, scene: sceneInput, materialIds: placed.map(p => p.node.id), imageIds: vision ? imageIds : [],
          duration: shownDuration, ratio, language, model: caps?.mock ? undefined : textModel?.endpointId, maxCost: scriptCost, options: sceneOptionValues(scene!.options, picked),
          ...(chosenVideo ? { videoModel: chosenVideo.endpointId } : {}), refs: (plan?.used ?? []).filter(m => m.mediaType === "image").map(m => m.key) });
        request = made.request; nodeId = made.nodeId;
        // 用了哪些素材记进草稿：重开时原样放回（不看图的模型不记读图列表，不能靠它推断）。
        return { ...made.doc, sceneInputs: chosen };
      }, projectId);
      if (onPage(ticket, projectId)) { if (revising && !opts?.auto) setRevise(""); setSubmitting(nodeId); setView("director"); }
      posted = true;
      const run = await submitStudioRun(projectId, request!, { canRetry: true });
      await persist(doc => applyRun(doc, nodeId!, run), projectId);
    } catch (e) {
      if (!nodeId) { if (onPage(ticket)) setHint(sceneHintText(e, "提交失败，请重试。")); return; }
      // 积分不够：这一版没发出去，撤掉它，用户写的字放回输入框。
      if (isStudioBillingCancelled(e)) {
        await persist(doc => patchNode(doc, nodeId!, () => undefined), projectId).catch(() => undefined);
        if (onPage(ticket, projectId)) { if (revising && !opts?.auto) setRevise(raw); if (studioCreditShortageChoice(e)?.kind === "retry") rewrite.current = { raw, opts, ticket, projectId }; }
        return;
      }
      const rejected = submissionRejected(e, posted);
      await persist(doc => patchNode(doc, nodeId!, n => ({ ...n, metadata: { ...n.metadata, ...studioErrorMetadata(e),
        status: rejected ? "error" : "loading", ...(rejected ? {} : { errorDetails: "提交结果待确认。点击「确认原任务」查询，不会重复扣费。" }) } })), projectId).catch(() => undefined);
      showFailure({ action: "生成脚本", error: e, next: rejected ? rejectedNextStep(e) : "本次提交可能已成功。请点击「确认原任务」查询，不要直接重新生成。" });
    } finally { setBusy(false); setSubmitting(undefined); }
  };

  /** 失败了（没扣积分）原地按原样再来一次：同样的要求、新的请求编号。 */
  const retry = async (row: CanvasNodeData) => {
    const project = draftRef.current;
    if (busy || !project || !row.metadata?.studio?.request) return;
    setBusy(true);
    let request: Parameters<typeof submitStudioRun>[1] | undefined;
    try {
      await persist(doc => { const again = resubmitRow(doc, row.id); if (!again) throw new Error("此记录已不存在。"); request = again.request; return again.doc; }, project.id);
      setSubmitting(row.id);
      const run = await submitStudioRun(project.id, request!);
      await persist(doc => applyRun(doc, row.id, run), project.id);
    } catch (e) {
      if (isStudioBillingCancelled(e)) { await persist(doc => patchNode(doc, row.id, n => ({ ...n, metadata: { ...n.metadata, status: "error", errorDetails: "已取消" } })), project.id).catch(() => undefined); return; }
      const rejected = submissionRejected(e, true);
      await persist(doc => patchNode(doc, row.id, n => ({ ...n, metadata: { ...n.metadata, ...studioErrorMetadata(e), status: rejected ? "error" : "loading" } })), project.id).catch(() => undefined);
      showFailure({ action: "重新生成", error: e });
    } finally { setBusy(false); setSubmitting(undefined); }
  };

  /** 同一个请求编号再交一次：服务端认得它，已受理就返回原任务，不会再扣一次。 */
  const confirmOriginal = async (row: CanvasNodeData) => {
    const request = row.metadata?.studio?.request, project = draftRef.current;
    if (!request || !project || busy) return;
    setBusy(true);
    try {
      const run = await submitStudioRun(project.id, request);
      await persist(doc => patchNode(applyRun(doc, row.id, run), row.id, n => ({ ...n, metadata: { ...n.metadata, status: "loading", errorDetails: undefined } })), project.id);
    } catch (e) {
      // 积分不足提示框已经说清了：这条没有受理，不用再确认，转成可以重新生成的失败记录。
      if (studioCreditShortageChoice(e)) await persist(doc => patchNode(doc, row.id, n => ({ ...n, metadata: { ...n.metadata, status: "error", errorDetails: "积分不足，未提交" } })), project.id).catch(() => undefined);
      else showFailure({ action: "确认原任务", error: e });
    }
    finally { setBusy(false); }
  };

  // ── 按脚本出片 ────────────────────────────────────────────────────────
  // 「还缺：……」那一行是编导写给你看的，不是脚本：拿去出片时去掉。
  // 「写清楚」小标签：还没写脚本时给全部；写过之后只给最新一版里还空着的那几条。
  const latestBlanks = latestScript ? scriptPlaceholders(scriptMissing(latestScript.metadata?.content || "").body) : [];
  const chipFacts = (scene?.brief?.facts ?? []).filter(f => !latestScript || latestBlanks.some(b => b.includes(f.label) || f.label.includes(b)));
  const addFact = (label: string) => {
    const line = `${label}：`;
    const next = text.includes(line) ? text : text.trim() ? `${text.replace(/\s+$/, "")}\n${line}` : line;
    setText(next); setHint("");
    // 已经有这一行就把光标放到这一行末尾，没有就放到最后。
    const at = next.indexOf(line), end = at >= 0 ? (next.indexOf("\n", at) < 0 ? next.length : next.indexOf("\n", at)) : next.length;
    setTimeout(() => input.current?.focus({ line: next.slice(0, end).split("\n").length - 1 }), 0);
  };
  /** 采用脚本：放进编辑框（替换框里原来的内容，换掉了用户自己写的就给一个撤销），回到编辑。 */
  const useScript = (row: CanvasNodeData) => {
    const body = scriptMissing(row.metadata?.content || "").body, before = { text, scriptId };
    setText(body); setScriptId(row.id); setView("compose"); setHint("");
    setNote(before.text.trim() && before.text.trim() !== body.trim() && before.scriptId !== row.id
      ? { text: "脚本已放入编辑框，替换了原有内容。", undo: () => { setText(before.text); setScriptId(before.scriptId); setNote(undefined); } } : undefined);
    setTimeout(() => input.current?.focus("end", { preventScroll: true }), 0);
  };
  /**
   * AI 编导：只是换到编导那一页，点了不花钱也不开始。还没写过就在那里写要求、放素材、调时长，点发送才写第一版
   * （2026-11-04 用户反馈：以前一点就开始写，没机会调时长）；写过了就接着改。
   */
  const openDirector = () => {
    setView("director"); setHint("");
    setTimeout(() => {
      if (scripts.length) document.querySelector<HTMLInputElement>('.scene-video-studio input[aria-label="修改意见"]')?.focus();
      else input.current?.focus("end", { preventScroll: true });
    }, 0);
  };
  /** 点一条常用开头：接在要求后面，不发送。 */
  // 点开头建议是换一种写法，不是叠加：输入框换成这一条（2026-11-07 用户要求，原来接在后面越点越长）。
  const useIdea = (idea: string) => {
    setText(idea);
    setHint("");
    setTimeout(() => input.current?.focus("end", { preventScroll: true }), 0);
  };
  /**
   * 重新编辑（成功的视频）：成功了但不满意时用。把这条用的脚本（含出片前改过的字）、时长、画面、清晰度、模型和要不要先优化放回「生成视频」，
   * 改一处再出；旧的这条留着。素材用现在放着的（编辑器里列着会用上哪几份）。
   */
  const reuseVideo = (row: CanvasNodeData) => {
    const request = row.metadata?.studio?.request, doc = draftRef.current?.doc;
    if (!request) return;
    // 点之前的样子：「撤销」回到这里（放回会覆盖正在改的脚本）。
    const before = { text, scriptId, duration, ratio, tier, optimize, model: chosenVideo?.endpointId };
    const put = (v: typeof before) => {
      setView("compose"); setScriptId(v.scriptId); setText(v.text); setDuration(v.duration); setRatio(v.ratio); setTier(v.tier); setOptimize(v.optimize);
      if (v.model && v.model !== chosenVideo?.endpointId && videoModels?.some(m => m.endpointId === v.model)) chooseVideoModel(v.model);
    };
    put({ scriptId: doc ? scriptOfRow(doc, row.id) : undefined, text: request.prompt || "", duration: request.durationSec ?? duration,
      ratio: request.aspectRatio ?? ratio, tier: request.video?.resolutionTier ?? tier, optimize: request.video?.optimizePrompt !== false, model: request.model ?? undefined });
    const gone = request.model && videoModels && !videoModels.some(m => m.endpointId === request.model) && chosenVideo
      ? `原模型已不可用，本次改用「${chosenVideo.name}」。` : "";
    setHint("");
    setNote({ text: `${gone}已恢复此视频的脚本和设置，素材使用当前已添加的内容。`, undo: () => { put(before); setNote(undefined); } });
    // 编辑器在页面上方（手机上离结果很远）：滚过去、光标放进脚本，不然点了像没反应（2026-10-30 界面评审）。
    setTimeout(() => {
      document.querySelector(".scene-video-studio .scene-video-composer")?.scrollIntoView?.({ block: "start", behavior: "smooth" });
      input.current?.focus("end", { preventScroll: true });
    }, 0);
  };
  // 页面上的条件写进草稿（有草稿时）：刷新、从「最近」再打开都从离开的地方接着来。素材另记在 sceneInputs、视频模型在 sceneVideoModel。
  // 采用过脚本时，编辑框里的就是（可能改过的）脚本，记成 edit；没采用时记成那句想法。
  const videoState = useMemo<StudioSceneVideoState>(() => ({ text: scriptId ? "" : text, options: picked, language, ...(tier ? { tier } : {}), duration, ratio, optimize,
    ...(scriptId ? { edit: { scriptId, prompt: text } } : {}) }), [text, picked, language, tier, duration, ratio, optimize, scriptId]);
  useSceneStateSave("sceneVideoState", draft, videoState, persist, doc => openedVideoState(doc, videoDefaults(findVideoScene(catalogRef.current, draft?.sceneId))));
  const materials: SceneVideoMaterial[] = useMemo(() => {
    const nodes = doc.nodes as CanvasNodeData[];
    const nodeOf = (key: string) => nodes.find(n => n.metadata?.storageKey === key)?.id ?? "";
    return [...images.map(m => ({ key: m.key, mediaType: "image" as const, title: m.title, nodeId: nodeOf(m.key) })),
      ...(character ? [{ key: character.key, mediaType: "image" as const, title: character.title, nodeId: nodeOf(character.key) }] : []),
      ...(voice ? [{ key: voice.key, mediaType: "audio" as const, title: voice.title, nodeId: nodeOf(voice.key) }] : [])];
  }, [doc.nodes, images, character, voice]);
  const plan = chosenVideo ? sceneVideoInputs(chosenVideo, materials) : undefined;
  let settings: ReturnType<typeof sceneVideoSettings> | undefined, planError = "";
  try { settings = chosenVideo && usedTier && plan ? sceneVideoSettings(chosenVideo, usedTier, plan, optimize) : undefined; }
  catch (e) { planError = e instanceof Error ? e.message : "素材与当前模型不匹配"; }
  const videoQuote = chosenVideo && settings ? studioVideoQuote(chosenVideo, settings, usedDuration) : null;
  /**
   * 积分不足时能换的模型。标准价按换过去实际的时长、清晰度和素材算；会变的写进 changes，用户看过再生成。
   * 做不了现在的组合就算不出价，有赠款照样列出来，写明要调整，换过去也不会自动提交。
   */
  const modelChoices = (videoModels ?? []).filter(m => m.selectableById).map(m => {
    const fits = m.contract.tiers.filter(t => t.canvases.some(c => c.aspectRatio === ratio));
    // 和上面 usedTier 同一条规则：换过去报的价、写的变化，才是真正会提交的规格。
    const nextTier = (fits.find(t => t.tier === tier) ?? fits[0])?.tier;
    if (!nextTier) return { endpointId: m.endpointId, name: m.name, cost: null, changes: `不支持 ${ratio} 画面，需要重新选择` };
    const nextDuration = clampSceneDuration(duration, m.contract);
    const changes = [nextTier !== usedTier && `清晰度将改为 ${nextTier}`, nextDuration !== usedDuration && `时长将改为 ${nextDuration} 秒`];
    try {
      const inputs = sceneVideoInputs(m, materials);
      const nextSettings = sceneVideoSettings(m, nextTier, inputs, optimize);
      return { endpointId: m.endpointId, name: m.name, cost: studioVideoQuote(m, nextSettings, nextDuration), quotePatch: { video: nextSettings, durationSec: nextDuration },
        // 优化描述是另一笔文字任务，不含在视频报价里。
        extraCharge: nextSettings.rewrite ? "优化提示词按实际用量另计" : undefined,
        changes: [...changes, inputs.note].filter(Boolean).join("，") };
    } catch { return { endpointId: m.endpointId, name: m.name, cost: null, changes: "当前素材不支持，需要调整" }; }
  });
  // 规格跟着选的视频模型走（画面比例、清晰度都按这个模型实际支持的给）。
  const ratios = contract?.tiers.find(t => t.tier === usedTier)?.canvases.map(c => c.aspectRatio).filter(r => r === "9:16" || r === "16:9") ?? ["9:16", "16:9"];
  // 三种入口共用任务工作区，后台按实际制作方式推进。
  const long = !recreation && !!contract && duration > contract.maxSeconds;
  const shownDuration = recreation || long ? duration : usedDuration;
  // 按钮旁的价按服务端报价显示（折扣、模型赠款、付款账户），本地价表只在报价回来之前垫着，也作为提交时的上限。
  const priceQuery = useMemo(() => chosenVideo && settings && videoQuote != null && !recreation && !long && caps && !caps.mock
    ? studioVideoPriceQuery(chosenVideo.selectableById ? chosenVideo.endpointId : undefined, settings, usedDuration, ratio) : undefined,
  // settings 每次渲染都是新对象：按它的内容判断变没变
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [chosenVideo?.endpointId, chosenVideo?.selectableById, settings && JSON.stringify(settings), videoQuote, recreation, long, caps, usedDuration, ratio]);
  const price = describeStudioVideoPrice(useStudioVideoPrice(priceQuery, priceRevision), videoQuote,
    { optimizing: !!chosenVideo?.supportsPromptOptimization && optimize });
  /**
   * 一版脚本是照什么写的，跟现在的设置差在哪（时长、横竖屏、语言、交给视频模型的图）；都一样时为空。
   * 每一项两种写法：sent 交给服务端拼进给编导的提示词（stage-scene-script.md），不能随界面文案改；shown 显示在页面上。
   */
  function specDiffs(spec?: StudioNodeMetadata["sceneDirector"]): { sent: string; shown: string }[] {
    if (!spec) return [];
    const handed = (plan?.used ?? []).filter(m => m.mediaType === "image").map(m => m.key);
    const orientation = (r?: string) => r === "16:9" ? "横屏" : "竖屏";
    return [
      spec.duration !== shownDuration ? { sent: `这版脚本是照 ${spec.duration} 秒写的，现在要出 ${shownDuration} 秒`, shown: `此脚本按 ${spec.duration} 秒撰写，当前为 ${shownDuration} 秒` } : undefined,
      spec.ratio !== ratio ? { sent: `脚本是照${orientation(spec.ratio)}写的，现在是${orientation(ratio)}`, shown: `此脚本按${orientation(spec.ratio)}撰写，当前为${orientation(ratio)}` } : undefined,
      spec.language && spec.language !== language ? { sent: `台词是照${spec.language}写的，现在选的是${language}`, shown: `台词按${spec.language}撰写，当前选择${language}` } : undefined,
      spec.refs && spec.refs.join() !== handed.join()
        ? spec.refs.length && !handed.length ? { sent: `脚本里用了参考图，这个模型不看图`, shown: `此脚本引用了参考图，当前模型不使用参考图` }
          : { sent: `脚本里用了 ${spec.refs.length || "0"} 张参考图，这次只用得上 ${handed.length} 张`, shown: `此脚本引用了 ${spec.refs.length || "0"} 张参考图，本次使用 ${handed.length} 张` } : undefined,
    ].filter((d): d is { sent: string; shown: string } => !!d);
  }
  const specChanges = (spec?: StudioNodeMetadata["sceneDirector"]) => specDiffs(spec).map(d => d.sent).join("，");
  const specChangesShown = (spec?: StudioNodeMetadata["sceneDirector"]) => specDiffs(spec).map(d => d.shown).join("；");
  // 编导页：最新一版跟现在的设置对不上时，输入框不写字也能发，发出去就是「照现在的设置改一版」。
  const latestChanges = specChanges(latestScript?.metadata?.studio?.sceneDirector);
  const latestChangesShown = specChangesShown(latestScript?.metadata?.studio?.sceneDirector);
  // 长视频的段数和价：服务端按所选模型算（拖滑杆时等一下再问，慢回来的旧结果不盖新选择）。
  const [longPrice, setLongPrice] = useState<{ key: string; spec: string; price?: StudioSegmentedVideoPrice; enterprise?: StudioSegmentedVideoPrice; error?: string }>();
  const longModel = chosenVideo?.selectableById ? chosenVideo.endpointId : undefined;
  const longSpec = long ? JSON.stringify([longModel, usedTier, duration, ratio, images.length, !!character, !!voice, optimize]) : "";
  const longKey = long ? JSON.stringify([longSpec, priceRevision]) : "";
  useEffect(() => {
    if (!longKey) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const query = { model: longModel, tier: usedTier, duration, ratio, images: images.length, character: !!character, voice: !!voice, optimize };
      const load = async () => {
        const payer = await studioPreviewPayer().catch(() => ({ kind: "undecided" as const }));
        if (controller.signal.aborted) return;
        if (payer.kind === "decided") {
          if (payer.billing.mode !== "enterprise") return { price: await segmentedVideoPrice({ ...query, payer: "personal" }, controller.signal) };
          // 企业账户报不出价（在途满了、模型没授权）不挡生成，先显示标准价，同短视频：提交时会说清楚原因。
          const enterpriseId = payer.billing.enterpriseId;
          return { price: await segmentedVideoPrice({ ...query, payer: "enterprise", enterpriseId }, controller.signal).catch(async () => {
            const standard = await segmentedVideoPrice({ ...query, payer: "personal" }, controller.signal);
            return { ...standard, discountedVideoCost: null, videoDiscountName: null };
          }) };
        }
        const [price, enterprise] = await Promise.all([
          segmentedVideoPrice({ ...query, payer: "personal" }, controller.signal),
          "enterpriseId" in payer && payer.enterpriseId ? segmentedVideoPrice({ ...query, payer: "enterprise", enterpriseId: payer.enterpriseId }, controller.signal).catch(() => undefined) : undefined,
        ]);
        return { price, enterprise };
      };
      load().then(result => { if (!controller.signal.aborted && result) setLongPrice({ key: longKey, spec: longSpec, ...result }); })
        .catch(e => { if (!controller.signal.aborted) setLongPrice({ key: longKey, spec: longSpec, error: sceneHintText(e, "价格加载失败，请稍后刷新重试。") }); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [longKey]);
  const taskKind: StudioVideoTaskKind = recreation ? 'recreation' : long ? 'segmented' : 'direct';
  const [taskQuote, setTaskQuote] = useState<{ key: string; price?: StudioVideoTaskQuote; error?: string }>();
  // 爆款复刻的分析要写明用哪个模型（服务端必填）；其余按原来的规则，不可按编号选的模型走默认。
  const taskModel = recreation ? chosenVideo?.endpointId : chosenVideo?.selectableById && !caps?.mock ? chosenVideo.endpointId : undefined;
  const taskPriceKey = JSON.stringify([taskKind, chosenVideo?.endpointId, taskModel, settings?.mode, usedTier, shownDuration, ratio, images.length, !!character, !!voice, optimize, priceRevision]);
  useEffect(() => {
    if (!chosenVideo) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      videoTaskPrice({ kind: taskKind, model: taskModel, mode: settings?.mode, tier: usedTier, duration: shownDuration, ratio,
        images: images.length, character: !!character, voice: !!voice, optimize }, controller.signal)
        .then(price => { if (!controller.signal.aborted) setTaskQuote({ key: taskPriceKey, price }); })
        .catch(error => { if (!controller.signal.aborted) setTaskQuote({ key: taskPriceKey, error: sceneHintText(error, '费用加载失败，请稍后刷新重试。') }); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taskPriceKey]);
  useEffect(() => {
    if (!long) return;
    const refresh = () => { if (document.visibilityState === "visible") setPriceRevision(n => n + 1); };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [long]);
  const longReady = longPrice?.key === longKey ? longPrice : undefined;
  const segments = long ? longReady?.price?.segments ?? longPrice?.price?.segments ?? [] : [];
  // 正在出片的这版脚本是按什么写的：时长、横竖屏、交给视频模型的图。现在的设置跟它对不上（换了模型、改了时长或素材），
  // 就照实说哪里变了，并给一键「按当前设置修改脚本」；不拦出片，用户也可能就是想这么出（2026-10-30 审查 F07）。
  const writtenFor = scripts.find(s => s.id === scriptId)?.metadata?.studio?.sceneDirector;
  const handedNow = (plan?.used ?? []).filter(m => m.mediaType === "image").map(m => m.key);
  const staleScript = scriptId ? specChanges(writtenFor) : "";
  const staleScriptShown = scriptId ? specChangesShown(writtenFor) : "";
  const reviseForNow = () => {
    if (!staleScript) return;
    void send("", { auto: true, changes: staleScript });
  };

  // 编导留了【待补】的地方没填，出出来就是一句「待补」或者模型自己编一个价：先拦下。
  const blanks = scriptPlaceholders(text);
  const videoBlocker = !videoModels ? "正在加载视频模型…" : !chosenVideo ? "暂无可用的视频模型"
    : scene?.images.required && !images.length ? `请添加${scene.images.label}`
    : !text.trim() ? "请填写提示词，或点击「AI 编导」生成脚本" : planError
    || (blanks.length ? `脚本中还有待补充的内容：${[...new Set(blanks)].join("、")}。请替换为实际内容，不需要的请删除。` : "")
    || (settings ? studioVideoError(chosenVideo, settings, text, ratio, usedDuration) : "请重新选择清晰度") || "";

  // 长视频：不用写好提示词也能开始（编导那一步由服务端做），有想法或有素材就行。
  const longBlocker = !long ? "" : scene?.images.required && !images.length ? `请添加${scene.images.label}`
    : scene?.textRequired && !text.trim() ? "请填写要求"
    : !text.trim() && !images.length && !character ? "请填写要求，或添加素材"
    : blanks.length ? `脚本中还有待补充的内容：${[...new Set(blanks)].join("、")}。请替换为实际内容，不需要的请删除。`
    : longReady?.error ? longReady.error : !longReady?.price ? "正在计算价格…" : "";

  /** 先把请求记进草稿，再提交：提交结果没确认时，同一个请求编号再交一次会拿回原来那次，不会重复开始。 */
  const submitLong = async (projectId: string, request: StudioSegmentedVideoRequest) => {
    const execution = await startSegmentedVideo(projectId, request);
    await persist(doc => ({ ...doc, sceneSegmented: (doc.sceneSegmented ?? []).map(r => r.clientRequestId === request.clientRequestId ? { ...r, executionId: execution.id } : r) }), projectId);
  };
  const startLong = async () => { await startSceneTask('segmented'); };
  const confirmLong = async (record: SegmentedRecord) => {
    const project = draftRef.current;
    if (busy || !project || !record.request) return;
    setBusy(true);
    try { await submitLong(project.id, record.request); }
    catch (e) { showFailure({ action: "确认原任务", error: e }); }
    finally { setBusy(false); }
  };

  const generate = async () => { await startSceneTask('direct'); };

  const acceptTask = (task: StudioVideoTask) => {
    if (selectedTask?.id !== task.id) setMobileView('result');
    setSelectedTask(task); setTab('results');
    try { sessionStorage.setItem(VIDEO_TASK_SELECTION, task.id); } catch { /* UI preference */ }
    const current = new URLSearchParams(location.search);
    // 只带 task 的链接也写回完整地址：要打开任务自己的草稿，场景也要对。
    if (current.get('task') !== task.id || current.get('draft') !== task.projectId) writeSceneQuery('/video', task.sceneId, task.projectId, task.id);
  };
  const openingTask = useRef(0);
  const openTask = async (task: StudioVideoTask) => {
    const selection = ++openingTask.current;
    try {
      // Keep an unsent configuration before switching the visible task.
      if (!draftRef.current && (text.trim() || images.length || video)) {
        const id = await ensureDraft(session.current);
        await persist(doc => ({ ...doc, sceneVideoState: videoState }), id);
      }
      if (selection === openingTask.current) acceptTask(task);
    } catch (error) { showFailure({ action: '保存当前草稿', error }); }
  };
  const reuseTask = async (task: StudioVideoTask) => {
    if (!task.input) return;
    setBusy(true);
    try {
      const project = await createSceneDraft(task.title, task.sceneId);
      const nodes = task.input.nodes ?? [];
      const keys = nodes.flatMap(n => n.metadata?.storageKey ?? []);
      const signed = keys.length ? await signKeys(keys) : {};
      await IpStudioApi.updateProject(project.id, { name: task.title, baseDocVersion: project.docVersion ?? undefined,
        doc: restoreVideoTaskScript({ ...project.doc, ...task.input, nodes: nodes.map(n => ({ ...n, metadata: { ...n.metadata, content: n.metadata?.storageKey ? signed[n.metadata.storageKey] : n.metadata?.content } })) }) });
      setSelectedTask(undefined);
      try { sessionStorage.removeItem(VIDEO_TASK_SELECTION); } catch { /* UI preference */ }
      await openDraft(project.id); setView('compose'); setMobileView('compose'); drafts.reload();
    } catch (error) { showFailure({ action: '重新编辑', error }); }
    finally { setBusy(false); }
  };
  async function startSceneTask(kind: StudioVideoTaskKind, pending?: StudioVideoTaskCreate) {
    if (busy || !scene || !chosenVideo) return;
    const blocker = pending ? '' : kind === 'direct' ? videoBlocker : kind === 'recreation' ? handoffBlocker : longBlocker;
    if (blocker) { setHint(blocker); return; }
    if (!pending && (taskQuote?.key !== taskPriceKey || !taskQuote?.price)) { setHint(taskQuote?.error || '正在计算费用，请稍等'); return; }
    setBusy(true); setHint(''); setNote(undefined);
    const ticket = session.current;
    let projectId: string | undefined, request: StudioVideoTaskCreate | undefined;
    try {
      projectId = await ensureDraft(ticket);
      if (pending) request = pending;
      else {
        const { nodes, placed } = placeMaterials(draftRef.current?.doc.nodes as CanvasNodeData[] ?? []);
        const materials = placed.filter(p => p.media.key !== video?.key).map(p => ({ nodeId: p.node.id, title: p.media.title,
          slot: p.media.key === character?.key ? 'character' : p.media.key === voice?.key ? 'voice' : 'image' })) as StudioSegmentedVideoRequest['materials'];
        const clientRequestId = nanoid(), cap = taskQuote!.price!.cap;
        const configuration: StudioSegmentedVideoRequest = { clientRequestId, sceneId: scene.id, text: text.trim(), hasScript: !!scriptId,
          options: sceneOptionValues(scene.options, picked), language, duration: kind === 'direct' ? usedDuration : duration, ratio,
          model: taskModel, tier: usedTier, optimize, materials, budgetCap: cap };
        const native = kind === 'direct' ? addVideoRow({ ...draftRef.current!.doc, nodes }, { title: scene.title, prompt: text.trim(), scriptId,
          refIds: plan!.used.map(m => placed.find(p => p.media.key === m.key)?.node.id).filter((id): id is string => !!id),
          video: settings!, durationSec: usedDuration, aspectRatio: ratio, model: taskModel, maxCost: videoQuote ?? undefined }).request : undefined;
        const snapshotNodes = placed.map(p => p.node).map(n => ({ ...n, metadata: { storageKey: n.metadata?.storageKey, mimeType: n.metadata?.mimeType,
          naturalWidth: n.metadata?.naturalWidth, naturalHeight: n.metadata?.naturalHeight, durationMs: n.metadata?.durationMs } }));
        // 列表里要能分清每一条：优先用用户写的主题，没写才用时长。
        const brief = (scriptId ? scripts.find(s => s.id === scriptId)?.metadata?.studio?.sceneDirector?.ask ?? '' : text).trim();
        const cut = draftSubject(brief);
        const subject = cut && brief.split(/[，。,.!?！？；;\n]/)[0].trim() !== cut ? `${cut}…` : cut;
        request = await prepareVideoTask(projectId, { clientRequestId, kind, sceneId: scene.id, title: `${scene.title} · ${subject || `${configuration.duration} 秒`}`,
          configuration, video: native, budgetCap: cap, sourceNodeId: placed.find(p => p.media.key === video?.key)?.node.id,
          input: { nodes: snapshotNodes, sceneInputs: selection(), sceneVideoState: { ...videoState, duration: configuration.duration, tier: usedTier, ratio, optimize }, sceneVideoModel: chosenVideo.endpointId } });
        // 任务受理后才异步执行，积分不够要到那时才知道，只能落成一条「需处理」的记录：直接出片的价钱是确定的，受理前先问。
        // 长视频和复刻是多步任务，总价只是估算，这里不拦。
        if (kind === 'direct' && !caps?.mock) {
          const billing: EnterpriseBillingSelection = request.billing ?? { mode: 'personal' };
          await studioCreditCheck(() => quoteVideoPrice(studioVideoPriceQuery(taskModel, settings!, usedDuration, ratio), billing), billing, {
            modelChoices, canRetry: true, grantHint: STUDIO_GRANT_HINT,
            verifyChoice: (model, patch) => quoteVideoPrice(studioVideoPriceQuery(model, patch?.video as StudioVideoSettings, patch?.durationSec as number, ratio), billing) });
        }
        await persist(doc => ({ ...doc, nodes, sceneInputs: selection(), sceneVideoModel: chosenVideo.endpointId,
          sceneVideoSubmissions: [...(doc.sceneVideoSubmissions ?? []), request!] }), projectId);
      }
      const accepted = await startVideoTask(projectId, request);
      await persist(doc => ({ ...doc, sceneVideoSubmissions: (doc.sceneVideoSubmissions ?? []).filter(r => r.clientRequestId !== request!.clientRequestId),
        sceneVideoTasks: [...new Set([accepted.id, ...(doc.sceneVideoTasks ?? [])])] }), projectId);
      if (onPage(ticket, projectId)) acceptTask(accepted);
      drafts.reload();
    } catch (error) {
      if (projectId && request && (isStudioBillingCancelled(error) || submissionRejected(error, true)))
        await persist(doc => ({ ...doc, sceneVideoSubmissions: (doc.sceneVideoSubmissions ?? []).filter(r => r.clientRequestId !== request!.clientRequestId) }), projectId).catch(() => undefined);
      if (!isStudioBillingCancelled(error)) showFailure({ action: '生成视频', error, next: submissionRejected(error, true) ? rejectedNextStep(error) : '本次提交可能已成功。请点击「确认原任务」查询，不要直接重新生成。' });
      const shortage = studioCreditShortageChoice(error);
      // 提示框开着或保存期间可能已经换了草稿（浏览器前进后退）：用户的选择不作用到别的草稿上。
      if (shortage && onPage(ticket, projectId)) {
        // 这条路径没有费用确认弹窗，点生成就开始花钱：换了模型只换模型，看过按钮上的价再点。充值后继续生成是同一个模型、同一个价，才自动开始。
        if (shortage.kind === 'switch-model') {
          chooseVideoModel(shortage.endpointId);
          setNote({ text: `已改用「${shortage.name}」${shortage.changes ? `，${shortage.changes}` : ''}。确认费用后点击「生成视频」。` });
        } else if (shortage.kind === 'retry') regenerate.current = { ticket, projectId, kind };
      }
    } finally { setBusy(false); setPriceRevision(n => n + 1); }
  }

  // 积分不足提示框里选了「继续生成」：等上一次提交收尾、费用重新算好后再来一次（生成要用这个价）。
  const regenerate = useRef<{ ticket: number; projectId?: string; kind: StudioVideoTaskKind }>(undefined);
  const rewrite = useRef<{ raw: string; opts?: { auto?: boolean; changes?: string }; ticket: number; projectId?: string }>(undefined);
  useEffect(() => {
    if (busy) return;
    const again = rewrite.current;
    if (again) { rewrite.current = undefined; if (onPage(again.ticket, again.projectId)) void send(again.raw, again.opts); return; }
    const next = regenerate.current;
    if (!next) return;
    if (!onPage(next.ticket, next.projectId)) { regenerate.current = undefined; return; }
    if (taskQuote?.key !== taskPriceKey || !(taskQuote.price || taskQuote.error)) return;
    regenerate.current = undefined;
    void startSceneTask(next.kind);
  });

  const copy = async (row: CanvasNodeData) => {
    try { await navigator.clipboard.writeText(row.metadata?.content || ""); setCopied(row.id); setTimeout(() => setCopied(c => c === row.id ? undefined : c), 1500); }
    catch { showFailure({ action: "复制脚本", error: new Error("浏览器不允许复制，请手动选中文字复制。") }); }
  };

  if (auth === "no-platform" || drafts.notEnrolled) return <PlatformGateScreen/>;
  if (catalogError && !catalog) return <main className="ip-brand-surface scene-studio scene-video-studio"><div className="scene-loading">场景加载失败。<button type="button" className="ip-brand-secondary" onClick={retryCatalog}>重新加载</button></div></main>;
  if (!catalog || !scene) return <main className="ip-brand-surface scene-studio scene-video-studio"><div className="scene-loading"><Loader2 size={20} className="studio-gallery-spinner"/>正在加载场景…</div></main>;
  const groups = catalog.videoGroups.map(g => ({ id: g.id, title: g.title, items: catalog.video.filter(s => s.group === g.id) }));
  const groupTitle = catalog.videoGroups.find(g => g.id === scene.group)?.title;
  // 选的时长这个模型出不了（比下限短）：照实说按几秒出，不悄悄换。
  // 比单段上限长的怎么分，写在时长设置里（「超过单段上限，将分 N 段…」），按钮下不再重复（2026-11-07 用户：说明多余）。
  const durationNote = !long && !recreation && contract && usedDuration !== duration
    ? contract.minSeconds === contract.maxSeconds ? `当前模型仅支持 ${usedDuration} 秒` : `当前模型最短 ${contract.minSeconds} 秒，将按 ${usedDuration} 秒生成` : "";
  const pickDuration = (n: number) => { durationTouched.current = true; setDuration(n); setHint(""); };
  const goBlocker = (!videoModels ? '正在加载视频模型…' : !chosenVideo ? '暂无可用的视频模型' : '') || (recreation ? handoffBlocker : long ? longBlocker : videoBlocker) || (taskQuote?.key !== taskPriceKey ? '正在计算费用…' : taskQuote.error || '');
  // 编导页发送键点不了的原因，写在键旁边。提交和写脚本期间键在转圈、输入框也空了，这时不提示。
  const directorNote = busy || writing ? "" : scripts.length
    ? scriptBlocker(revise, !!latestChanges) || (!revise.trim() && !latestChanges ? "请填写修改意见" : "") : scriptBlocker(text);
  // 规格变了旧价立刻作废；规格没变只是重新报价（切回页面）时，新价回来之前继续显示上一份。
  const longPriced = longReady?.price ? longReady : longPrice?.spec === longSpec && longPrice.price ? longPrice : undefined;
  const longShown = longPriced?.price;
  const longView = longShown ? describeSegmentedPrice(longShown, longPriced?.enterprise) : undefined;
  // 长视频和爆款复刻按实际用量结算：按钮上写约数，上限和明细只放悬停提示（2026-11-07 用户：按钮下的费用说明多余）。
  const capNote = !caps?.mock && taskQuote?.key === taskPriceKey && taskQuote.price ? `按实际用量结算，最多 ${taskQuote.price.cap.toLocaleString("zh-CN")} 积分` : undefined;
  const priceTitle = (...lines: (string | false | undefined)[]) => lines.filter(Boolean).join("\n") || undefined;
  const onPick = (id: string) => { const next = findVideoScene(catalog, id); if (next && (next.id !== scene.id || draftRef.current)) goToScene(next); };
  const tile = (kind: Exclude<Slot, "image">, media: Media | undefined, label: string, Icon: typeof Video, optional: boolean, clear: () => void) =>
    <div className={`scene-media${media ? " is-filled" : ""}`}>
      <button type="button" disabled={uploading !== undefined} onClick={() => choose(kind)} aria-label={media ? `更换${label}` : `从资产库选择${label}`} title={media?.fileName || `从资产库选择${label}`}>
        {uploading === kind ? <Loader2 size={18} className="studio-gallery-spinner"/> : media && kind === "character" ? <SignedImage src={media.url} storageKey={media.key} alt=""/>
          : media && kind === "voice" ? <>
            <AudioLines size={22} strokeWidth={1.5} aria-hidden="true"/>
            <i className="scene-slot-badge" aria-label="已选择声音"><Check size={11} strokeWidth={2.4}/></i>
          </> : <SlotEmpty Icon={Icon} size={22}/>}
      </button>
      <span title={kind === "voice" && media ? media.fileName || media.title : undefined}>{kind === "voice" && media ? media.fileName || media.title : label}{!media && optional && <small>选填</small>}</span>
      {media && <button type="button" className="scene-ref-remove" aria-label={`移除${label}`} onClick={clear}><X size={11} strokeWidth={1.8}/></button>}
    </div>;
  // 编辑框里的「图N」标签：这次交给视频模型的图，按图1、图2 的顺序（和素材格上的角标同一套）。
  const placedMedia = (key: string) => {
    const m = [...images, ...(character ? [character] : [])].find(x => x.key === key);
    if (m) return { title: m.title, url: m.url };
    const n = (doc.nodes as CanvasNodeData[]).find(x => x.metadata?.storageKey === key);
    return n ? { title: n.title, url: n.metadata?.content } : undefined;
  };
  const promptRefs: ScenePromptRef[] = (plan?.used ?? []).filter(m => m.mediaType === "image")
    .map((m, i) => ({ index: i + 1, title: placedMedia(m.key)?.title || m.title, url: placedMedia(m.key)?.url, storageKey: m.key }));
  // 编导的每一版按它当时交给视频模型的图编号（sceneDirector.refs）；更早的版本没记，就不显示标签。
  const scriptRefs = (row: CanvasNodeData): ScenePromptRef[] => (row.metadata?.studio?.sceneDirector?.refs ?? [])
    .map((key, i) => ({ index: i + 1, title: placedMedia(key)?.title || `图${i + 1}`, url: placedMedia(key)?.url, storageKey: key }));
  const imageIndex = (key: string) => (plan?.used ?? []).filter(m => m.mediaType === "image").findIndex(m => m.key === key);

  // 团购的产品图、环境图复用同一排素材占位和上传入口，不另设引导区。
  const imageSlot = (label: string, guided = false) => <div key={label} className="scene-media">
    <button type="button" disabled={uploading !== undefined} onClick={() => choose("image", guided ? label : undefined)} aria-label={guided ? `添加${label}` : `从资产库选择${label}`} title={`从资产库选择${label}`}>
      {uploading === "image" ? <Loader2 size={18} className="studio-gallery-spinner"/> : <SlotEmpty Icon={ImageIcon} size={22}/>}</button>
    <span>{guided ? label : images.length ? "添加图片" : label}{!guided && !images.length && !scene.images.required && <small>选填</small>}</span>
  </div>;
  // 素材和规格在编辑页和编导页是同一份：编导页的输入框里也看得到、改得了，编导按这里的时长和素材写（2026-10-31 用户反馈）。
  const mediaRow = (compact = false) => <>
    <div className={`scene-media-row${compact ? " is-compact" : ""}`} role="group" aria-label="素材">
      {scene.video && tile("video", video, scene.video.label, Video, !scene.video.required, () => { if (video) drop("video", video.key); setVideo(undefined); })}
      {images.map((m, i) => { const at = imageIndex(m.key); return <div key={m.key} className="scene-media is-filled">
        <span className="scene-media-preview"><SignedImage src={m.url} storageKey={m.key} alt={m.title}/>{at >= 0 && <i className="scene-ref-index">图{at + 1}</i>}</span>
        <span>{scene.images.label}</span>
        <button type="button" className="scene-ref-remove" aria-label={`移除${m.title}`} onClick={() => { drop("image", m.key); setImages(old => old.filter((_, j) => j !== i).map((o, j) => ({ ...o, title: `${scene.images.label} ${j + 1}` }))); }}><X size={11} strokeWidth={1.8}/></button></div>; })}
      {images.length < (scene.images.max ?? 6) && <>
        {imageSlot(scene.images.label)}
        {scene.id === "local-groupbuy" && ["产品图片", "环境图片"].map(label => imageSlot(label, true))}
      </>}
      {(scene.character || scene.voice) && <i className="scene-media-divider" aria-hidden="true"/>}
      {scene.character && tile("character", character, "角色", UserRound, true, () => { if (character) drop("character", character.key); setCharacter(undefined); })}
      {scene.voice && tile("voice", voice, "声音", Mic, true, () => { if (voice) drop("voice", voice.key); setVoice(undefined); })}
    </div>
  </>;
  const specPill =
    <div className="scene-setting-panel-host">
      <button type="button" className="scene-pill" aria-expanded={settingsOpen} aria-label={`视频规格：${language}，${shownDuration} 秒，${ratio}${usedTier ? `，${usedTier.toUpperCase()}` : ""}`} onClick={() => setSettingsOpen(v => !v)}>
        <SlidersHorizontal size={14} strokeWidth={1.5}/><span>{language} · {shownDuration} 秒 · <RatioGlyph ratio={ratio}/>{ratio}{usedTier ? ` · ${usedTier.toUpperCase()}` : ""}</span><ChevronDown size={13} strokeWidth={1.6}/></button>
      {settingsOpen && <VideoSettingsPanel min={recreation ? Math.min(...scene.durations) : contract?.minSeconds ?? Math.min(...scene.durations)}
        max={MAX_SECONDS} single={recreation ? undefined : contract?.maxSeconds} duration={duration} onDuration={pickDuration} segments={segments}
        ratios={recreation ? ["9:16", "16:9"] : ratios} ratio={ratio} onRatio={setRatio}
        tiers={tiers.map(t => t.tier)} tier={usedTier} onTier={setTier}
        language={language} onLanguage={setLanguage} optimizable={!!chosenVideo?.supportsPromptOptimization} optimize={optimize} onOptimize={setOptimize}
        options={scene.options} picked={picked} onPick={(key, choice) => setPicked(old => ({ ...old, [key]: choice }))} onClose={() => setSettingsOpen(false)}/>}
    </div>;

  return <main className={`ip-brand-surface scene-studio scene-video-studio${pinned ? " has-drawer" : ""}`} data-studio-overlay-root data-video-view={mobileView}>
    <div className="scene-tabs video-mobile-tabs" role="group" aria-label="切换页面内容">
      <button type="button" aria-pressed={mobileView === 'compose'} onClick={() => setMobileView('compose')}>{taskOpen ? '设置' : '编辑'}</button>
      <button type="button" aria-pressed={mobileView === 'result' && (taskOpen || tab === 'results')} onClick={() => { setMobileView('result'); setTab('results'); }}>作品</button>
      {!taskOpen && <button type="button" aria-pressed={mobileView === 'result' && tab === 'example'} onClick={() => { setMobileView('result'); setTab('example'); }}>示例</button>}
    </div>
    {(pinned || drawerOpen) && <SceneDrawer heading="AI 视频" groups={groups} current={scene.id} onPick={onPick} pinned={pinned} onPin={pin} onClose={() => setDrawerOpen(false)}/>}

    {taskOpen ? <VideoTaskSettings task={selectedTask!} onNew={() => reset()} onReuse={() => void reuseTask(selectedTask!)}/> : <section className="scene-card scene-video-composer" aria-label={view === "director" ? "AI 编导" : "写一条视频"}>
      <header className="scene-composer-head">
        <SceneSwitch scene={scene} groups={groups} onPick={onPick} onAll={() => { if (!pinned) setDrawerOpen(true); }}/>
        {mobile && <button type="button" className="scene-icon-button is-large" aria-label="最近任务" onClick={() => setRailOpen(true)}><History size={19} strokeWidth={1.4}/></button>}
        <button type="button" className="scene-new" onClick={() => reset()}><Plus size={13} strokeWidth={1.6}/>新建</button>
      </header>

      {view === "director" ? <div className="scene-director">
        <div className="scene-director-title"><AiMark size={13}/><strong>AI 编导</strong>
          <button type="button" className="scene-text-button" onClick={() => setView("compose")}>返回编辑</button></div>
        <div className="scene-director-thread" ref={thread} aria-live="polite">
          {!scripts.length && <div className="scene-director-start">
            <h2>想做一条什么视频？</h2>
            {scene.ideas.length > 0 && <div className="scene-director-ideas" role="group" aria-label="常用开头">{scene.ideas.map(idea =>
              <button key={idea} type="button" aria-pressed={text.trim() === idea} onClick={() => useIdea(idea)}>{idea}</button>)}</div>}
          </div>}
          {scripts.map((row, i) => <ScriptTurn key={row.id} row={row} refs={scriptRefs(row)} run={live[row.id]} stopping={scriptStopping(row)} busy={busy} submitting={submitting === row.id} latest={row.id === latestScript?.id}
            given={scripts.slice(0, i + 1).map(s => s.metadata?.studio?.sceneDirector?.ask ?? "")} facts={scene.brief?.facts}
            copied={copied === row.id} onUse={() => useScript(row)} onBack={() => setView("compose")} onCopy={() => void copy(row)}
            onAgain={() => void send("换个写法重新写一版，要求和素材都不变。", { auto: true })}
            onRetry={() => void retry(row)} onConfirm={() => void confirmOriginal(row)}
            onStop={() => void stopScript(row)}/>)}
        </div>
        {/* 还没写过：这里写的就是编辑框里那段想法（同一份，回到编辑还在）。写过了：这里写改法。 */}
        <form className="scene-director-input" onSubmit={e => { e.preventDefault(); void send(scripts.length ? revise : text); }}>
          {scripts.length ? <>
            {mediaRow(true)}
            <input aria-label="修改意见" placeholder={latestChanges ? "设置已修改，直接发送将按当前设置修改脚本" : "例如：开头更抓人，台词更口语"} title={latestChangesShown || undefined}
              value={revise} onChange={e => { setRevise(e.target.value); setHint(""); }}/>
          </> : <>
            {mediaRow()}
            <ScenePromptEditor ref={input} ariaLabel="想做的视频" value={text} refs={promptRefs} placeholder={scene.placeholder}
              onChange={v => { setText(v); setHint(""); }} onEnter={() => void send(text)}/>
          </>}
          <footer>
            {specPill}
            {scripts.length ? <button type="submit" className="scene-send" aria-label="发送修改意见" aria-describedby={hint || directorNote ? "scene-director-note" : undefined} title={revise.trim() || !latestChanges ? scriptBlocker(revise) || "发送（Enter）" : "按当前设置修改"}
              disabled={busy || writing || uploading !== undefined || (!revise.trim() && !latestChanges)}>
              {busy || writing ? <Loader2 size={15} className="studio-gallery-spinner"/> : <ArrowUp size={15} strokeWidth={1.8}/>}</button>
            : <button type="submit" className="scene-send" aria-label="生成脚本" aria-describedby={hint || directorNote ? "scene-director-note" : undefined} title={scriptBlocker(text) || "发送（Enter），按实际用量结算"}
              disabled={busy || writing || uploading !== undefined || !!scriptBlocker(text)}>
              {busy || writing ? <Loader2 size={15} className="studio-gallery-spinner"/> : <ArrowUp size={15} strokeWidth={1.8}/>}</button>}
          </footer>
        </form>
        {/* 发送键点不了的原因灰字写在旁边；点了没做成的原因用提醒色。 */}
        {(hint || directorNote) && <p id="scene-director-note" className={`scene-hint${hint ? "" : " is-note"}`} role="status">{hint || directorNote}</p>}
      </div>

      : <div className="scene-compose">
        {mediaRow()}

        <div className="scene-box">
          <ScenePromptEditor ref={input} ariaLabel={scriptId ? "视频脚本" : "想做的视频"} value={text} refs={promptRefs}
            placeholder={recreation ? scene.placeholder : "粘贴写好的提示词直接生成；只有想法时，可写几句交给 AI 编导撰写脚本"}
            onChange={v => { setText(v); setHint(""); }}/>
          {/* 这类视频要写清的信息：点一下在框里起一行「店名和位置：」，接着写就行。写过脚本之后只给脚本里还空着的。 */}
          {!recreation && chipFacts.length > 0 && <div className="scene-fact-chips" role="group" aria-label="要写清楚的信息">{chipFacts.map(f =>
            <button key={f.label} type="button" onClick={() => addFact(f.label)}><Plus size={11} strokeWidth={1.6}/>{f.label}{!f.required && <small>选填</small>}</button>)}</div>}
          <footer>
            <small className={contract && Array.from(text).length > contract.promptMaxChars ? "is-over" : undefined}>{Array.from(text).length}{contract && !recreation ? ` / ${contract.promptMaxChars}` : ""}</small>
            {!recreation && <button type="button" className="scene-ai-button" title={scripts.length ? "返回 AI 编导继续修改" : "由 AI 编导撰写分镜脚本"} onClick={openDirector}>
              {writing ? <Loader2 size={13} className="studio-gallery-spinner"/> : <AiMark size={12}/>}{scriptId ? "AI 改写" : "AI 编导"}</button>}
          </footer>
        </div>

        <div className="scene-go-group">
          <div className="scene-pills">
            {(videoModels?.length ?? 0) > 1 ? <div className="scene-pill is-select"><Cpu size={14} strokeWidth={1.5}/>
                <StudioSelect compact label="视频模型" value={chosenVideo?.endpointId ?? ""} onChange={chooseVideoModel} options={(videoModels ?? []).map(m => ({ value: m.endpointId, label: m.name }))}/></div>
              : <span className="scene-pill"><Cpu size={14} strokeWidth={1.5}/><span>{chosenVideo?.name ?? "视频模型"}</span></span>}
            {specPill}
          </div>
          <button type="button" className="scene-go" aria-label="生成视频" aria-describedby={hint || goBlocker ? "scene-video-go-note" : undefined} title={goBlocker || undefined}
            disabled={busy || !!goBlocker || uploading !== undefined} onClick={() => void (recreation ? startSceneTask('recreation') : long ? startLong() : generate())}>
            {busy && !writing ? <Loader2 size={16} className="studio-gallery-spinner"/> : null}
            <span>生成视频</span>
            {/* 普通视频的价格是确定的；长视频和爆款复刻要看实际用量，才写「约」。算不出就不显示，不编。 */}
            {caps?.mock ? <small>免费</small>
              : long ? longView && <small title={priceTitle(longView.discount, longView.accounts, capNote)}>约 {longView.shown !== longView.standard && <s><span className="scene-sr-only">原价 </span>{longView.standard.toLocaleString("zh-CN")}</s>}
                {longView.shown !== longView.standard && <span className="scene-sr-only">，折后 </span>}{longView.shown.toLocaleString("zh-CN")} 积分{longView.from ? "起" : ""}</small>
              : taskKind === 'direct' ? price && <small title={priceTitle(price.discount, price.detail)} className={price.pending ? "is-pending" : undefined} aria-busy={price.pending || undefined}>
                {price.shown !== price.standard && <s><span className="scene-sr-only">原价 </span>{price.standard.toLocaleString("zh-CN")}</s>}
                {price.shown !== price.standard && <span className="scene-sr-only">，折后 </span>}{price.shown.toLocaleString("zh-CN")} 积分{price.from ? "起" : ""}</small>
              : taskQuote?.key === taskPriceKey && taskQuote.price && <small title={capNote}>约 {taskQuote.price.estimated.toLocaleString("zh-CN")} 积分</small>}
          </button>
          {/* 点了没做成的原因用提醒色；还没动手时只是灰字说一句还差什么。 */}
          {(hint || goBlocker) && <p id="scene-video-go-note" className={`scene-hint${hint ? "" : " is-note"}`} role="status">{hint || goBlocker}</p>}
          {taskKind === 'direct' && price?.note && <p className="scene-hint is-note">{price.note}</p>}
          {!!draft?.doc.sceneVideoSubmissions?.length && <div className="video-pending-submissions">{draft!.doc.sceneVideoSubmissions!.map(request => <p key={request.clientRequestId}>提交结果待确认。<button type="button" disabled={busy} onClick={() => void startSceneTask(request.kind, request)}>确认原任务</button></p>)}</div>}
          {!recreation && !long && plan?.note && <p className="scene-hint is-note">{plan.note}</p>}
          {!recreation && plan?.used.some(m => m.mediaType === 'audio') && <p className="scene-hint is-note" role="status">{AUDIO_REFERENCE_NOTICE}</p>}
          {durationNote && <p className="scene-hint is-note">{durationNote}</p>}
          {staleScript && <p className="scene-hint is-note" role="status">{staleScriptShown}。<button type="button" disabled={busy} onClick={reviseForNow}>按当前设置修改脚本</button></p>}
          {note && <p className="scene-hint is-note" role="status">{note.text}{note.undo && <button type="button" onClick={note.undo}>撤销</button>}</p>}
          {videoModels && !videoModels.length && !caps?.mock && !recreation && <SceneNoModel kind="视频"/>}
        </div>
      </div>}
    </section>}

    <SceneVideoWorkspace enabled={ready} taskId={query.task} draftId={query.draft} sceneId={query.scene} restoreLastTask={!initialVideoEntry.current.draft && !initialVideoEntry.current.scene}
      selected={selectedTask} onSelect={task => { if (query.task && query.task === task.id) acceptTask(task); else void openTask(task); }}
      onReuse={task => void reuseTask(task)} onDraft={id => { setSelectedTask(undefined); window.history.replaceState(null, '', `/video?scene=${encodeURIComponent(scene.id)}&draft=${encodeURIComponent(id)}`); void openDraft(id); }}
      drafts={drafts.data} draftsError={drafts.error} onRetryDrafts={drafts.reload} railOpen={railOpen} onRail={setRailOpen} onNew={() => reset()} persist={persist}>
    <section className="scene-results scene-legacy-results" aria-label="作品与示例">
      <header><SceneResultTabs tab={tab} onTab={setTab} count={rows.length + segmentedRuns.length} idBase="scene-video"/>
        <span className="scene-results-actions">{draft && <Link className="scene-text-button" href={`/projects/${encodeURIComponent(draft.id)}`}><FolderOpen size={14} strokeWidth={1.4}/>在画布上查看</Link>}
          <VideoHistoryToggle onOpen={() => setRailOpen(true)}/></span></header>
      {draft && handedOff && <HandoffStatus projectId={draft.id} execution={execution} waiting={!!executionId && !execution}/>}
      <div id="scene-video-panel" className="scene-results-panel" role="tabpanel" aria-labelledby={`scene-video-tab-${tab}`}>
      {tab === "example" ? <SceneExample id={scene.id} title={scene.title} group={groupTitle} note={scene.description}
          cover={scene.coverUrl} examples={scene.examples} ratio={scene.ratio}/>
        : rows.length || segmentedRuns.length ? <ol className="scene-row-list">{draft && segmentedRuns.map(record => <SegmentedRow key={record.clientRequestId} record={record} projectId={draft.id} doc={draft.doc} persist={persist} busy={busy}
            onConfirm={() => void confirmLong(record)} onFailure={(action, error) => showFailure({ action, error })}/>)}{rows.map(row => <VideoRow key={row.id} row={row} run={live[row.id]} busy={busy} submitting={submitting === row.id}
            onRetry={() => void retry(row)} onConfirm={() => void confirmOriginal(row)} onReuse={() => reuseVideo(row)}
            onStop={() => { const id = row.metadata?.studio?.runId; if (id) void cancelRun(id).catch(e => showFailure({ action: "停止生成", error: e })); }}/>)}</ol>
        : <SceneEmpty title="还没有作品" note="生成的视频将显示在这里。"/>}
      </div>
    </section>
    </SceneVideoWorkspace>
    {picking && <div className="scene-picker-host"><LibraryReferencePicker open upload
      mediaType={picking === "voice" ? "audio" : picking === "video" ? "video" : "image"}
      max={picking === "image" ? Math.max(1, (scene.images.max ?? 6) - images.length) : 1}
      title={`选择${picking === "image" ? imagePurpose ?? scene.images.label : picking === "character" ? "出镜人物" : picking === "voice" ? "声音" : scene.video?.label ?? "参考视频"}`}
      intro="从资产库选择，也可上传新文件。"
      onClose={() => setPicking(undefined)} onAssets={assets => addFromLibrary(picking, assets)}/></div>}
    <HubTabBar/>
  </main>;
}

/** 轮询或停止接口直接返回终态时，都立即保存同一份状态和原因。 */
function applyFinishedRun(doc: IpProjectDoc, nodeId: string, run: IpRun): IpProjectDoc {
  return patchNode(applyRun(doc, nodeId, run), nodeId, node => ({ ...node, metadata: { ...node.metadata,
    status: run.status === "done" ? "success" : "error",
    ...(run.status === "failed" ? { errorDetails: run.errorMessage || "生成失败", errorCode: run.errorCode, errorLogId: run.logId } : { errorDetails: undefined }),
  } }));
}

/** 一份素材在草稿画布上的节点：同一个文件已经在画布上就用原来那个，新放的排在左边一列。 */
function placeMedia(nodes: CanvasNodeData[], media: Media, kind: "image" | "video" | "audio", index: number): CanvasNodeData {
  const made = attachmentNode(kind === "image" ? { kind, dataUrl: media.url, storageKey: media.key, title: media.title }
    : { kind, url: media.url, storageKey: media.key, title: media.title, width: media.width, height: media.height, mimeType: media.mimeType }, nodes);
  return nodes.some(n => n.id === made.id) ? made : { ...made, position: { x: 100, y: 120 + index * 300 },
    metadata: { ...made.metadata, origin: "upload", mimeType: media.mimeType, bytes: media.bytes, naturalWidth: media.width, naturalHeight: media.height,
      durationMs: media.durationSec ? Math.round(media.durationSec * 1000) : undefined } };
}

/** 编导的一轮：你说的话 + 编导写的脚本（写作中 / 失败 / 写好了）。 */
function ScriptTurn({ row, refs, run, stopping, busy, submitting, latest, copied, onUse, onBack, onCopy, onAgain, onRetry, onConfirm, onStop, given, facts }: {
  row: CanvasNodeData; refs: ScenePromptRef[]; run?: IpRun; stopping?: "requesting" | "accepted"; busy: boolean; submitting: boolean; latest: boolean; copied: boolean;
  onUse: () => void; onBack: () => void; onCopy: () => void; onAgain: () => void; onRetry: () => void; onConfirm: () => void; onStop: () => void;
  /** 到这一版为止用户说过的话（第一句和每次修改意见）：核对里面的数字有没有进脚本。 */
  given: string[];
  /** 场景要的信息：分清哪些空着的必须补、哪些选填。 */
  facts?: { label: string; required: boolean }[];
}) {
  const meta = row.metadata, turn = meta?.studio?.sceneDirector;
  const { missing, body } = scriptMissing(meta?.content || "");
  const absent = meta?.status === "success" ? missingFigures(given, body) : [];
  const overlong = meta?.status === "success" ? overlongShots(body) : [];
  const { required: mustFill, optional: mayFill } = classifyBlanks(scriptPlaceholders(body), facts);
  const loading = meta?.status === "loading", accepted = !!meta?.studio?.runId;
  const position = run?.queue?.position;
  const summary = meta?.studio?.textEditor?.turns?.at(-1)?.content;
  const failed = meta?.status === "error";
  const stopped = failed && meta?.errorCode === "IP_RUN_CANCELLED";
  return <article className="scene-director-turn">
    <p className={`scene-director-ask${turn?.ask ? "" : " is-empty"}`}>{turn?.ask || (turn?.revision ? "修改脚本" : "根据素材生成脚本")}</p>
    <div className={`scene-script-card is-${stopped || stopping ? "stopped" : meta?.status || "idle"}`}>
      {loading ? <div className="scene-script-writing" role="status">
          {!stopping && <span className="scene-script-lines" aria-hidden="true"><i/><i/><i/></span>}
          <span><AiMark size={12}/>{stopping ? stopping === "requesting" ? "正在停止…" : "已停止创作，正在结算已用费用" : submitting && !accepted ? "提交中" : !accepted ? "结果待确认" : position && position > 0 ? `排队中 · 第 ${position} 位` : turn?.revision ? "正在修改脚本" : "正在撰写脚本"}</span></div>
        : failed ? <p className={`scene-script-state${stopped ? "" : " is-failed"}`} role={stopped ? "status" : undefined} title={meta?.errorLogId ? `追查号 ${meta.errorLogId}` : undefined}>{sceneFailureText(meta?.errorCode, meta?.errorDetails, "脚本")}</p>
        : <>{summary && <p className="scene-script-summary">{summary}</p>}
          <pre className="scene-script-text">{splitBlanks(body).map((p, i) => p.blank ? <mark key={i} className="scene-script-blank">{p.text}</mark> : <PromptText key={i} text={p.text} refs={refs}/>)}</pre>
          {mustFill.length > 0 ? <p className="scene-script-missing" role="status">还缺{mustFill.join("、")}。请在下方输入框补充，AI 编导会写入脚本。{mayFill.length ? `${mayFill.join("、")}为选填。` : ""}</p>
            : mayFill.length > 0 ? <p className="scene-script-check">{mayFill.join("、")}为选填。如不需要，请在生成视频前删除脚本中标出的内容。</p>
            : missing ? <p className="scene-script-check">AI 编导提示可能还缺{missing}，如已填写可忽略。</p> : null}
          {absent.length > 0 && <p className="scene-script-check">你填写的 {absent.join("、")} 未出现在脚本中。如需加入，请告诉 AI 编导。</p>}
          {overlong.length > 0 && <p className="scene-script-check">{overlong.map(o => `第 ${o.no} 镜 ${o.seconds} 秒有 ${o.chars} 个字`).join("，")}，可能念不完。可让 AI 编导精简台词，或延长时长。</p>}</>}
      <footer>
        {loading && accepted && <button type="button" disabled={!!stopping} title="停止后，已产生的费用按实际用量结算" onClick={onStop}><Square size={12}/>{stopping ? "已请求停止" : "停止"}</button>}
        {loading && !accepted && !submitting && <button type="button" disabled={busy} onClick={onConfirm}><RotateCcw size={12}/>确认原任务</button>}
        {failed && meta?.studio?.request && <button type="button" className="is-primary" disabled={busy} onClick={onRetry}><RotateCcw size={12}/>重试</button>}
        {meta?.status === "success" && meta.content && <>
          {latest && <button type="button" className="is-icon" aria-label="重新生成" title="重新生成" disabled={busy} onClick={onAgain}><RotateCcw size={14} strokeWidth={1.5}/></button>}
          <button type="button" className="is-icon" aria-label={copied ? "已复制" : "复制"} title={copied ? "已复制" : "复制"} onClick={onCopy}>{copied ? <Check size={14} strokeWidth={1.6}/> : <Copy size={14} strokeWidth={1.5}/>}</button>
          <span className="scene-spacer"/>
          {latest && <button type="button" onClick={onBack}>返回编辑</button>}
          <button type="button" className="is-primary" onClick={onUse}><Check size={13} strokeWidth={1.8}/>采用脚本</button>
        </>}
      </footer>
    </div>
  </article>;
}

/** 一条视频：排队 / 生成中 / 失败（说人话）/ 播放器 + 下载。不显示假的百分比。 */
function VideoRow({ row, run, busy, submitting, onRetry, onConfirm, onReuse, onStop }: {
  row: CanvasNodeData; run?: IpRun; busy: boolean; submitting: boolean; onRetry: () => void; onConfirm: () => void; onReuse: () => void; onStop: () => void;
}) {
  const meta = row.metadata, request = meta?.studio?.request;
  const loading = meta?.status === "loading", accepted = !!meta?.studio?.runId;
  const position = run?.queue?.position;
  const failure = meta?.status === "error" ? sceneFailureText(meta.errorCode, meta.errorDetails, "视频") : undefined;
  const state = loading ? (submitting && !accepted ? "提交中" : !accepted ? "结果待确认" : position && position > 0 ? `排队中 · 第 ${position} 位` : "生成中，通常需要几分钟")
    : failure ?? "已完成";
  const url = meta?.status === "success" ? meta.content : undefined;
  return <li className={`scene-row scene-video-row is-${meta?.status || "idle"}`}>
    <div className="scene-row-meta"><strong>{row.title}</strong><span>{[request?.aspectRatio === "16:9" ? "横屏" : "竖屏", request?.video?.resolutionTier?.toUpperCase()].filter(Boolean).join(" · ")}</span>
      <span className="scene-row-state" role={loading ? "status" : undefined} title={failure && meta?.errorDetails !== failure ? `${meta?.errorDetails || ""}${meta?.errorLogId ? `（追查号 ${meta.errorLogId}）` : ""}` : undefined}>
        {loading && <Loader2 size={14} className="studio-gallery-spinner"/>}{state}</span></div>
    {url ? <SignedVideo className="scene-video-player" src={url} storageKey={meta?.storageKey} controls playsInline preload="metadata" aria-label={row.title}/>
      : loading ? <span className={`scene-video-placeholder is-${request?.aspectRatio === "16:9" ? "wide" : "tall"}`}/> : null}
    {request?.prompt && <p className="scene-row-prompt" title={request.prompt}>{request.prompt}</p>}
    <div className="scene-row-actions">
      {loading && accepted && <button type="button" onClick={onStop}><Square size={13}/>停止</button>}
      {loading && !accepted && !submitting && <button type="button" disabled={busy} onClick={onConfirm}><RotateCcw size={13}/>确认原任务</button>}
      {meta?.status === "error" && request && <button type="button" className="is-primary" disabled={busy} onClick={onRetry}><RotateCcw size={13}/>重新生成</button>}
      {url && <button type="button" onClick={() => void downloadMedia(url, row.title, undefined, meta?.storageKey)}><Download size={13}/>下载</button>}
      {url && request && <button type="button" disabled={busy} onClick={onReuse} title="将此视频的脚本和设置恢复到编辑器，修改后重新生成，原视频保留"><PencilLine size={13}/>重新编辑</button>}
    </div>
  </li>;
}

/** 视频规格：台词语言、时长（拖动，超过单段上限分段）、画面比例、清晰度，以及场景的几组选项。就地展开在按钮上方。 */
function VideoSettingsPanel({ min, max, single, duration, onDuration, segments, ratios, ratio, onRatio, tiers, tier, onTier, language, onLanguage,
  optimizable, optimize, onOptimize, options, picked, onPick, onClose }: {
  min: number; max: number; single?: number; duration: number; onDuration: (n: number) => void; segments: number[];
  ratios: string[]; ratio: string; onRatio: (r: string) => void; tiers: string[]; tier?: string; onTier: (t: string) => void;
  language: string; onLanguage: (l: string) => void; optimizable: boolean; optimize: boolean; onOptimize: (on: boolean) => void;
  options?: StudioSceneOptionGroup[] | null; picked: Record<string, string>; onPick: (key: string, choice: string) => void; onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useScenePopover(panel, onClose);
  // 面板贴着按钮往上弹，上面放不下就会被卡片裁掉、滚也滚不到（编导页的输入框高，矮屏上「台词语言」直接看不见）：只用上面有的这么高，多的在面板里滚。
  useLayoutEffect(() => {
    const el = panel.current, clip = el?.closest(".scene-compose, .scene-card");
    if (!el || !clip || getComputedStyle(el).position === "fixed") return;
    const room = el.getBoundingClientRect().bottom - clip.getBoundingClientRect().top - 8;
    if (room > 0) el.style.maxHeight = `min(${Math.floor(room)}px, 560px, 70vh)`;
  }, []);
  const fill = max > min ? ((duration - min) / (max - min)) * 100 : 100;
  // 单段上限的刻度只在「最小值和最大值之间」时才画，等于最小值（如只能做 4 秒的模型）时和左端的字叠在一起。
  const singleAt = single && single > min && single < max && max > min ? ((single - min) / (max - min)) * 100 : undefined;
  return <div ref={panel} className="scene-settings-panel" role="group" aria-label="视频规格">
    <div className="scene-setting-row"><span>台词语言</span>
      <div className="scene-choice-row">{LANGUAGES.map(l => <button key={l} type="button" aria-pressed={l === language} onClick={() => onLanguage(l)}>{l}</button>)}</div></div>
    <div className="scene-setting-row is-stack">
      <label htmlFor="scene-video-duration">时长<b>{duration} 秒</b></label>
      <input id="scene-video-duration" className="scene-range" type="range" min={min} max={max} step={1} value={duration} style={{ "--p": `${fill}%` } as CSSProperties}
        aria-valuetext={segments.length > 1 ? `${duration} 秒，分 ${segments.length} 段` : `${duration} 秒`} onChange={e => onDuration(Number(e.target.value))}/>
      <div className="scene-range-scale"><span>{min} 秒</span>{singleAt !== undefined && <span style={{ left: `clamp(32px, ${singleAt}%, calc(100% - 32px))` }}>单段 {single} 秒</span>}<span>{max} 秒</span></div>
      {segments.length > 1 && <p>超过单段上限，将分 {segments.length} 段生成后拼接：{segments.join(" + ")} 秒。</p>}
    </div>
    <div className="scene-setting-row"><span>画面比例</span>
      <div className="scene-choice-row">{ratios.map(value => <button key={value} type="button" aria-pressed={value === ratio} onClick={() => onRatio(value)}><RatioGlyph ratio={value}/>{value}</button>)}</div></div>
    {tiers.length > 1 && <div className="scene-setting-row"><span>清晰度</span>
      <div className="scene-choice-row">{tiers.map(t => <button key={t} type="button" aria-pressed={t === tier} onClick={() => onTier(t)}>{t.toUpperCase()}</button>)}</div></div>}
    {optimizable && <div className="scene-setting-row" role="group" aria-label="提示词"><span>提示词</span>
      <div className="scene-choice-row">
        <button type="button" aria-pressed={optimize} onClick={() => onOptimize(true)}>优化后生成</button>
        <button type="button" aria-pressed={!optimize} onClick={() => onOptimize(false)}>按原文生成</button></div>
      {/* 2026-10-30 线上复核：优化提示词是另一笔文字任务，要说清是视频费之外的另一笔、可以不要。 */}
      {optimize && <p>按此模型的写法优化提示词，按实际用量另计。</p>}</div>}
    {options?.map(g => <div key={g.key} className="scene-setting-row" role="group" aria-label={g.label}><span>{g.label}</span>
      <div className="scene-choice-row">{g.choices.map(c => <button key={c.value} type="button" aria-pressed={(picked[g.key] ?? g.defaultValue) === c.value} title={c.prompt}
        onClick={() => onPick(g.key, c.value)}>{c.label}</button>)}</div></div>)}
  </div>;
}

/** 旧草稿：此前交给画布里的创作助手的那份做到哪了。没有确认方案之前还没开始做，也照实说。 */
function HandoffStatus({ projectId, execution, waiting }: { projectId: string; execution?: StudioPlanExecution; waiting: boolean }) {
  const steps = execution?.steps ?? [];
  const done = steps.filter(s => s.status === "done" || s.status === "skipped").length;
  const text = waiting ? "正在加载进度…"
    : !execution ? "已交给画布中的创作助手，确认方案和费用后开始制作。"
    : execution.status === "running" ? `制作中，第 ${Math.min(done + 1, steps.length)} 步，共 ${steps.length} 步。`
    : execution.status === "done" ? "制作已完成，结果在画布上。"
    : execution.status === "paused" || execution.status === "needs_user" ? `创作助手已暂停${execution.needsUserReason ? `：${execution.needsUserReason}` : "，请在画布上查看"}。`
    : execution.status === "canceled" ? "制作已停止，已完成的部分保留在画布上。"
    : `制作未全部完成，已完成 ${done} 步，请在画布上查看。`;
  return <p className={`scene-handoff${execution?.status === "paused" || execution?.status === "needs_user" ? " is-waiting" : ""}`} role="status">{text}
    <Link href={`/projects/${encodeURIComponent(projectId)}?start=assistant`}>在画布上查看</Link></p>;
}
