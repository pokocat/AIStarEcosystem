"use client";

import { type CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, Check, ChevronDown, Copy, Cpu, Download, FolderOpen, Loader2, Mic, PencilLine, Plus,
  RotateCcw, SlidersHorizontal, Square, UserRound, Video, X } from "lucide-react";
import type { IpProject, IpRun, IpSavedAsset, StudioMediaImportResult, StudioSceneInputs, StudioSceneOptionGroup, StudioSceneVideoState } from "@ai-star-eco/types";
import type { StudioCapabilities } from "@ai-star-eco/types/ip-studio-workflow";
import type { VideoStudioModel } from "@ai-star-eco/types/video-studio";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { HubTabBar } from "@/components/hub/ui";
import { cancelRun, fetchStudioVideoModels, readRun, signKeys } from "@/canvas-bridge/api";
import { SignedImage } from "@/canvas-bridge/signed-image";
import { SignedVideo } from "@/canvas-bridge/signed-video";
import { getStudioPlanExecution } from "@/canvas-bridge/studio-plan-execution";
import type { StudioPlanExecution } from "@ai-star-eco/types/ip-studio-workflow";
import { studioCapabilities, submitStudioRun } from "@/canvas-bridge/studio-api";
import { attachmentNode } from "@/canvas-bridge/studio-attachments";
import { isStudioBillingCancelled } from "@/canvas-bridge/studio-billing-cancel";
import { studioChosenTextModel } from "@/canvas-bridge/studio-text-model";
import { studioVideoError, studioVideoQuote } from "@/canvas-bridge/studio-video";
import { downloadMedia } from "@/canvas-bridge/download-media";
import { CanvasNodeType, type CanvasNodeData } from "@/canvas/types/canvas";
import { studioErrorMetadata, useStudioFailure } from "../studio-errors";
import { useStudioList } from "../studio-gallery";
import { studioEntryHref } from "../studio-entry";
import { StudioSelect } from "../studio-select";
import { LibraryReferencePicker } from "../library-reference-picker";
import { IpStudioApi } from "../api";
import { findVideoScene, useSceneCatalog, type VideoScene } from "./scene-catalog";
import { addScriptNode, addVideoRow, applyRun, createSceneDraft, draftSubject, listSceneDrafts, openedVideoState, patchNode, resubmitRow, sceneInputsOf, scriptNodes, scriptOfRow, submissionRejected, videoRows, withSceneInput, type SceneInputKind } from "./scene-drafts";
import { useSceneDraftStore, useSceneStateSave } from "./scene-draft-store";
import { useSceneQuery, writeSceneQuery } from "./scene-query";
import { UiVersionSwitch } from "@/shell/ui-version-switch";
import { SceneDrawer, SceneEmpty, SceneExample, SceneNoModel, SceneRecent, SceneResultTabs, SceneSwitch, sceneFailureText, sceneHintText, sceneOptionValues, sceneSteps, useSceneDrawerPin, useScenePopover, RatioGlyph, useSceneMobile } from "./scene-layout";
import { AiMark } from "../studio-ai-icon";
import { clampSceneDuration, sceneVideoDurations, sceneVideoInputs, sceneVideoSettings, type SceneVideoMaterial } from "./scene-video-plan";
import { classifyBlanks, missingFigures, scriptMissing, scriptPlaceholders, splitBlanks } from "./scene-script-check";

type Media = StudioMediaImportResult & { title: string };
type Slot = "image" | "character" | "voice" | "video";
const DEFAULT_SCENE = "ecom-talking";
const POLL_MS = 1500;
const LANGUAGES = ["中文", "英文"];
/** 一条视频最长多少秒（超过单段上限的分段做、再拼成一条）。 */
const MAX_SECONDS = 60;
/** 按单段上限切段：40 秒、单段 15 秒 → 15 + 15 + 10。 */
const splitSegments = (total: number, max: number) => {
  const out: number[] = [];
  for (let left = total; left > 0; left -= max) out.push(Math.min(max, left));
  return out;
};
const RECREATION = "reference-video-recreation";
const EMPTY_DOC = { nodes: [], connections: [], viewport: { x: 0, y: 0, k: 1 } };

const writeQuery = (scene: string, draft?: string) => writeSceneQuery("/video", scene, draft);
/** 草稿里没记过的条件按场景默认值。 */
const videoDefaults = (scene?: VideoScene) => ({ language: LANGUAGES[0], duration: scene?.duration ?? 15, ratio: scene?.ratio ?? "9:16" });

/**
 * 「AI 视频」（照参考站「超级编导」的出片方式，docs/studio-scene-creation.md §8）：
 * 放素材、说一句（可以不说）→ 编导看图写一版分镜脚本，接着说哪里要改 →「用这个脚本生成」→ 选模型和时长、确认积分 → 出片。
 * 一切都写在一张普通草稿画布里，随时可以「在画布中继续」。爆款复刻要先拉片、超过模型时长的长片要分段，这两种交给画布里的创作助手。
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
  // 一个编辑框：放想法，或放「采用」进来的脚本，按框里的内容生成。AI 编导写脚本时整张卡换成编导那一页。
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
  const [hint, setHint] = useState("");
  // 说明（不是报错，灰字一行）：换场景时没带过来的素材、「重新编辑」放回了什么。undo 是点「撤销」要回到的样子。
  const [note, setNote] = useState<{ text: string; undo?: () => void }>();
  const [live, setLive] = useState<Record<string, IpRun>>({});
  const [copied, setCopied] = useState<string>();
  // 草稿与保存队列（换草稿时旧回包不改这一页，见 scene-draft-store.ts）。
  const { draft, current: draftRef, session, begin, remember, show, onPage, persist, settled } = useSceneDraftStore();
  const [picking, setPicking] = useState<Slot>();
  const input = useRef<HTMLTextAreaElement>(null);
  const thread = useRef<HTMLDivElement>(null);

  // ── 模型 ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!ready) return;
    let active = true;
    void Promise.all([studioCapabilities(), fetchStudioVideoModels()]).then(([c, v]) => { if (active) { setCaps(c); setVideoModels(v); } })
      .catch(e => { if (active) { setVideoModels([]); showFailure({ action: "读取视频模型", error: e }); } });
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
  // 场景默认时长比模型单段上限长时，先按单段出（拖到上限以外才分段交给创作助手）；用户自己拖过、或草稿里记着的不动。
  const durationTouched = useRef(false);
  const pickScene = useCallback((next: VideoScene) => {
    sceneNow.current = next.id; durationTouched.current = false;
    setSceneId(next.id); setDuration(next.duration); setRatio(next.ratio); setPicked({});
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
    setNote(dropped.length && from ? { text: `${dropped.join("、")}在「${next.title}」用不上，先收起来了，回「${from.title}」还在` } : undefined);
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
      setHint(""); setTab(videoRows(project.doc).length ? "results" : "example");
      writeQuery(from?.id ?? DEFAULT_SCENE, project.id);
    } catch (e) { if (onPage(ticket)) showFailure({ action: "打开草稿", error: e }); }
    finally { if (openingId.current === id) openingId.current = undefined; }
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
  const ensureDraft = async (ticket: number) => {
    if (!scene) throw new Error("场景还没读出来，请稍等");
    if (draftRef.current) return draftRef.current.id;
    const subject = draftSubject(text);
    const created = await createSceneDraft(subject ? `${scene.title} · ${subject}` : scene.title, scene.id);
    remember(created);
    if (showDraft(created, ticket)) writeQuery(scene.id, created.id);
    drafts.reload();
    return created.id;
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
          await persist(d => patchNode(applyRun(d, row.id, run), row.id, n => ({ ...n, metadata: { ...n.metadata,
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

  const doc = draft?.doc ?? EMPTY_DOC;
  // 交给画布里创作助手的那份（爆款复刻、比模型长的片子）：回到这页也看得到做到哪了（2026-10-30 审查 G05 / C2）。
  // 执行就是画布那一套（ip_plan_execution），这里只读它，不另记一份进度。
  const handedOff = !!draft?.doc.assistantConversations?.some(n => n.metadata?.studioStart === "assistant");
  const executionId = [...(doc.nodes as CanvasNodeData[])].reverse().find(n => n.metadata?.studio?.execution?.executionId)?.metadata?.studio?.execution?.executionId;
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
  const writing = scripts.some(s => s.metadata?.status === "loading");
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
    if (!chosen.length) throw new Error(type === "image" ? "请选一张图片" : type === "video" ? "请选一段视频" : "请选一段声音");
    const ticket = session.current;
    setUploading(kind);
    try {
      const projectId = await ensureDraft(ticket);
      const max = scene.images.max ?? 6;
      const fresh = kind === "image" ? chosen.filter(m => !images.some(o => o.key === m.key)).slice(0, Math.max(0, max - images.length)) : chosen.slice(0, 1);
      const titled = fresh.map((m, i) => ({ ...m, title: kind === "image" ? `${scene.images.label} ${images.length + i + 1}` : kind === "character" ? "出镜人物" : kind === "voice" ? "声音样本" : "参考视频" }));
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
        const placed = nodes.some(n => n.id === made.id) ? next : { ...next, nodes: [...nodes, made] };
        return withSceneInput(placed, kind, media.key, "add", max);
      }, doc), projectId).catch(() => undefined);
    } catch (e) { showFailure({ action: "放素材", error: e }); }
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
      if (!url) throw new Error("这张图读不出来了，回 AI 图片重新点一次「做成视频」");
      const projectId = await ensureDraft(ticket);
      const max = scene.images.max ?? 6;
      const media: Media = { key, url, title: `${scene.images.label} ${images.length + 1}`, mediaType: "image", mimeType: "", bytes: 0, fileName: "" };
      if (onPage(ticket, projectId)) {
        setImages(old => old.some(m => m.key === key) ? old : [...old, media].slice(0, max));
        setNote({ text: `图带过来了，放在「${scene.images.label}」。说说想拍成什么样，编导会照着写。` });
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
  const choose = (kind: Slot) => setPicking(kind);

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
  const scriptBlocker = (ask: string) => !scene ? "正在读取场景…"
    : scene.images.required && !images.length ? `先放${scene.images.label}`
    : !revising && scene.textRequired && !ask.trim() ? "先写一句要求"
    : revising && !ask.trim() ? "说说想改哪里"
    : !caps ? "正在读取模型…"
    : !caps.mock && !textModel?.tokenPricing ? "AI 编导暂时用不了（文字模型没配置价格）" : "";
  /** 爆款复刻交给创作助手之前卡在哪。 */
  const handoffBlocker = !scene ? "正在读取场景…" : scene.video?.required && !video ? `先放${scene.video.label}`
    : scene.images.required && !images.length ? `先放${scene.images.label}`
    : scene.textRequired && !text.trim() ? "先写一句要求" : "";

  /**
   * 让编导写第一版（ask 是编辑框里的想法）或改一版（ask 是「想改哪里」）。
   * auto 是代码替用户说的修改意见（换了规格，「让编导照现在的改一版」），不清空用户正在写的那句。
   */
  const send = async (raw: string, opts?: { auto?: boolean }) => {
    if (busy || uploading || writing) return;
    const blocked = scriptBlocker(raw);
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
      const composed = await IpStudioApi.composeScene({ kind: "video-script", sceneId: scene!.id, text: revising ? first?.ask ?? "" : ask,
        ...(revising ? { revision: ask } : {}),
        imageTitles: images.filter(i => handed.has(i.key)).map(i => i.title), seenTitles: images.filter(i => !handed.has(i.key)).map(i => i.title),
        characterTitle: character?.title, ...(character && !handed.has(character.key) ? { characterSeen: true } : {}),
        voiceTitle: voice && handed.has(voice.key) ? voice.title : undefined, visual,
        duration: usedDuration, ratio, language, ...(sceneOptionValues(scene!.options, picked) ? { options: sceneOptionValues(scene!.options, picked) } : {}) });
      projectId = await ensureDraft(ticket);
      const chosen = selection();
      const vision = caps?.mock || textModel?.supportsVision;
      let request: Parameters<typeof submitStudioRun>[1] | undefined;
      await persist(doc => {
        const { nodes, placed } = placeMaterials(doc.nodes as CanvasNodeData[]);
        const imageIds = placed.filter(p => p.media.mediaType === "image").map(p => p.node.id);
        const made = addScriptNode({ ...doc, nodes }, {
          ask, revision: revising, prompt: composed.text, materialIds: placed.map(p => p.node.id), imageIds: vision ? imageIds : [],
          duration: usedDuration, ratio, language, model: caps?.mock ? undefined : textModel?.endpointId, maxCost: scriptCost, options: sceneOptionValues(scene!.options, picked),
          ...(chosenVideo ? { videoModel: chosenVideo.endpointId } : {}), refs: (plan?.used ?? []).filter(m => m.mediaType === "image").map(m => m.key) });
        request = made.request; nodeId = made.nodeId;
        // 用了哪些素材记进草稿：重开时原样放回（不看图的模型不记读图列表，不能靠它推断）。
        return { ...made.doc, sceneInputs: chosen };
      }, projectId);
      if (onPage(ticket, projectId)) { if (revising && !opts?.auto) setRevise(""); setSubmitting(nodeId); setView("director"); }
      posted = true;
      const run = await submitStudioRun(projectId, request!);
      await persist(doc => applyRun(doc, nodeId!, run), projectId);
    } catch (e) {
      if (!nodeId) { if (onPage(ticket)) setHint(sceneHintText(e, "这一版没发出去，请再点一次")); return; }
      const rejected = submissionRejected(e, posted);
      await persist(doc => patchNode(doc, nodeId!, n => ({ ...n, metadata: { ...n.metadata, ...studioErrorMetadata(e),
        status: rejected ? "error" : "loading", ...(rejected ? {} : { errorDetails: "提交结果没有确认，点「确认原任务」查一下，不会重复扣费" }) } })), projectId).catch(() => undefined);
      showFailure({ action: "让编导写脚本", error: e, next: rejected ? "改一下再试；积分没有扣。" : "这次可能已经被受理，点「确认原任务」查一下，不要直接重写。" });
    } finally { setBusy(false); setSubmitting(undefined); }
  };

  /** 失败了（没扣积分）原地按原样再来一次：同样的要求、新的请求编号。 */
  const retry = async (row: CanvasNodeData) => {
    const project = draftRef.current;
    if (busy || !project || !row.metadata?.studio?.request) return;
    setBusy(true);
    let request: Parameters<typeof submitStudioRun>[1] | undefined;
    try {
      await persist(doc => { const again = resubmitRow(doc, row.id); if (!again) throw new Error("这一条已经不在了"); request = again.request; return again.doc; }, project.id);
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
    } catch (e) { showFailure({ action: "确认原任务", error: e }); }
    finally { setBusy(false); }
  };

  // ── 交给创作助手（爆款复刻、比模型更长的片子）─────────────────────────
  const handoff = async () => {
    if (!scene) return;
    setBusy(true);
    const ticket = session.current;
    try {
      const longest = Math.min(MAX_SECONDS, Math.max(1, duration));
      const composed = await IpStudioApi.composeScene({ kind: "video", sceneId: scene.id, text: text.trim() || scripts[0]?.metadata?.studio?.sceneDirector?.ask || "", duration: longest, ratio,
        imageTitles: images.map(i => i.title), characterTitle: character?.title, voiceTitle: voice?.title, videoTitle: video?.title,
        ...(sceneOptionValues(scene.options, picked) ? { options: sceneOptionValues(scene.options, picked) } : {}) });
      const projectId = await ensureDraft(ticket);
      // 和首页「说一句话开始」同一种起点：这段话存成助手的第一句，画布打开后带着场景的方法自动发出。
      const start = { id: `${projectId}-brief`, type: CanvasNodeType.Text, title: "创作想法", position: { x: 100, y: 120 }, width: 480, height: 260,
        metadata: { content: composed.text, prompt: composed.text, studioStart: "assistant" as const, ...(composed.skillKey ? { studioSkill: composed.skillKey } : {}), studio: { kind: "assistant" as const, conversation: { mode: "general" as const, turns: [] } } } };
      const chosen = selection();
      await persist(doc => ({ ...doc, nodes: placeMaterials(doc.nodes as CanvasNodeData[]).nodes, sceneInputs: chosen,
        assistantConversations: [...(doc.assistantConversations || []).filter(n => n.id !== start.id), start] }), projectId);
      // 交出去之前换了草稿就不跳：用户已经在看别的了
      if (onPage(ticket, projectId)) router.push(studioEntryHref(projectId, "assistant", { send: true }));
      else setBusy(false);
    } catch (e) {
      setHint(sceneHintText(e, "没交出去，请再点一次"));
      setBusy(false);
    }
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
    setTimeout(() => { const el = input.current; if (el) { el.focus(); el.setSelectionRange(end, end); } }, 0);
  };
  /** 采用脚本：放进编辑框（替换框里原来的内容，换掉了用户自己写的就给一个撤销），回到编辑。 */
  const useScript = (row: CanvasNodeData) => {
    const body = scriptMissing(row.metadata?.content || "").body, before = { text, scriptId };
    setText(body); setScriptId(row.id); setView("compose"); setHint("");
    setNote(before.text.trim() && before.text.trim() !== body.trim() && before.scriptId !== row.id
      ? { text: "脚本放进编辑框了，原来写的那段换掉了", undo: () => { setText(before.text); setScriptId(before.scriptId); setNote(undefined); } } : undefined);
    setTimeout(() => input.current?.focus({ preventScroll: true }), 0);
  };
  /** AI 编导：还没写过就把编辑框里的想法交给编导写第一版；写过了回到编导那一页接着改（不另花一次）。 */
  const openDirector = () => {
    if (scripts.length) { setView("director"); setHint(""); setTimeout(() => document.querySelector<HTMLInputElement>('.scene-video-studio input[aria-label="想改哪里"]')?.focus(), 0); return; }
    void send(text);
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
      ? `当时用的模型现在用不了，这次用「${chosenVideo.name}」。` : "";
    setHint("");
    setNote({ text: `${gone}这条的脚本和设置放回来了，素材用的是现在放着的。`, undo: () => { put(before); setNote(undefined); } });
    // 编辑器在页面上方（手机上离结果很远）：滚过去、光标放进脚本，不然点了像没反应（2026-10-30 界面评审）。
    setTimeout(() => {
      document.querySelector(".scene-video-studio .scene-video-composer")?.scrollIntoView?.({ block: "start", behavior: "smooth" });
      input.current?.focus({ preventScroll: true });
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
  catch (e) { planError = e instanceof Error ? e.message : "素材和模型对不上"; }
  const videoQuote = chosenVideo && settings ? studioVideoQuote(chosenVideo, settings, usedDuration) : null;
  // 规格跟着选的视频模型走（画面比例、清晰度都按这个模型实际支持的给）。
  const ratios = contract?.tiers.find(t => t.tier === usedTier)?.canvases.map(c => c.aspectRatio).filter(r => r === "9:16" || r === "16:9") ?? ["9:16", "16:9"];
  // 比单段上限长的片子（拖到上限以外）交给画布里的创作助手分段做再拼起来；爆款复刻也交给它。
  const long = !recreation && !!contract && duration > contract.maxSeconds;
  const toAssistant = recreation || long;
  const shownDuration = toAssistant ? duration : usedDuration;
  const segments = long ? splitSegments(duration, contract!.maxSeconds) : [];
  // 正在出片的这版脚本是按什么写的：时长、横竖屏、交给视频模型的图。现在的设置跟它对不上（换了模型、改了时长或素材），
  // 就照实说哪里变了，并给一键「让编导按现在的设置改一版」；不拦出片，用户也可能就是想这么出（2026-10-30 审查 F07）。
  const writtenFor = scripts.find(s => s.id === scriptId)?.metadata?.studio?.sceneDirector;
  const handedNow = (plan?.used ?? []).filter(m => m.mediaType === "image").map(m => m.key);
  const staleScript = scriptId && writtenFor ? [
    writtenFor.duration !== usedDuration ? `这版脚本是照 ${writtenFor.duration} 秒写的，现在要出 ${usedDuration} 秒` : "",
    writtenFor.ratio !== ratio ? `脚本是照${writtenFor.ratio === "16:9" ? "横屏" : "竖屏"}写的，现在是${ratio === "16:9" ? "横屏" : "竖屏"}` : "",
    writtenFor.refs && writtenFor.refs.join() !== handedNow.join()
      ? writtenFor.refs.length && !handedNow.length ? `脚本里用了参考图，这个模型不看图`
        : `脚本里用了 ${writtenFor.refs.length || "0"} 张参考图，这次只用得上 ${handedNow.length} 张` : "",
  ].filter(Boolean).join("，") : "";
  const reviseForNow = () => {
    if (!staleScript) return;
    void send(`${staleScript}。按现在的时长、画面和参考图重新排镜头和台词，内容和卖点不变。`, { auto: true });
  };

  // 编导留了【待补】的地方没填，出出来就是一句「待补」或者模型自己编一个价：先拦下。
  const blanks = scriptPlaceholders(text);
  const videoBlocker = !videoModels ? "正在读取视频模型…" : !chosenVideo ? "还没有可用的视频模型"
    : scene?.images.required && !images.length ? `先放${scene.images.label}`
    : !text.trim() ? "先写提示词，或点「AI 编导」写一版脚本" : planError
    || (blanks.length ? `还有没填的：${[...new Set(blanks)].join("、")}。在上面换成实际内容，用不上的直接删掉。` : "")
    || (settings ? studioVideoError(chosenVideo, settings, text, ratio, usedDuration) : "请重新选择清晰度") || "";

  const generate = async () => {
    if (busy || !scene || !chosenVideo || !settings) return;
    if (videoBlocker) { setHint(videoBlocker); return; }
    setBusy(true); setHint(""); setNote(undefined);
    const ticket = session.current;
    let nodeId: string | undefined, posted = false, projectId: string | undefined;
    try {
      projectId = await ensureDraft(ticket);
      const chosen = selection();
      let request: Parameters<typeof submitStudioRun>[1] | undefined;
      await persist(doc => {
        const { nodes, placed } = placeMaterials(doc.nodes as CanvasNodeData[]);
        const refIds = plan!.used.map(m => placed.find(p => p.media.key === m.key)?.node.id).filter((id): id is string => !!id);
        const made = addVideoRow({ ...doc, nodes }, {
          title: `${scene.title} · ${usedDuration} 秒`, prompt: text.trim(), scriptId, refIds, video: settings!, durationSec: usedDuration, aspectRatio: ratio,
          model: chosenVideo.selectableById && !caps?.mock ? chosenVideo.endpointId : undefined, maxCost: videoQuote ?? undefined });
        request = made.request; nodeId = made.nodeId;
        return { ...made.doc, sceneInputs: chosen, sceneVideoModel: chosenVideo.endpointId };
      }, projectId);
      if (onPage(ticket, projectId)) { setSubmitting(nodeId); setTab("results"); }
      posted = true;
      const run = await submitStudioRun(projectId, request!);
      await persist(doc => applyRun(doc, nodeId!, run), projectId);
    } catch (e) {
      if (nodeId && isStudioBillingCancelled(e)) { await persist(doc => patchNode(doc, nodeId!, () => undefined), projectId).catch(() => undefined); return; }
      if (!nodeId) { showFailure({ action: "生成视频", error: e }); return; }
      const rejected = submissionRejected(e, posted);
      await persist(doc => patchNode(doc, nodeId!, n => ({ ...n, metadata: { ...n.metadata, ...studioErrorMetadata(e),
        status: rejected ? "error" : "loading", ...(rejected ? {} : { errorDetails: "提交结果没有确认，点「确认原任务」查一下，不会重复扣费" }) } })), projectId).catch(() => undefined);
      showFailure({ action: "生成视频", error: e, next: rejected ? "改一下再试；积分没有扣。" : "这次可能已经被受理，点「确认原任务」查一下，不要直接重新生成。" });
    } finally { setBusy(false); setSubmitting(undefined); }
  };

  const copy = async (row: CanvasNodeData) => {
    try { await navigator.clipboard.writeText(row.metadata?.content || ""); setCopied(row.id); setTimeout(() => setCopied(c => c === row.id ? undefined : c), 1500); }
    catch { showFailure({ action: "复制脚本", error: new Error("浏览器不让复制，请手动选中文字复制") }); }
  };

  if (auth === "no-platform" || drafts.notEnrolled) return <PlatformGateScreen/>;
  if (catalogError && !catalog) return <main className="ip-brand-surface scene-studio scene-video-studio"><div className="scene-loading">场景目录没读出来<button type="button" className="ip-brand-secondary" onClick={retryCatalog}>重新加载</button></div></main>;
  if (!catalog || !scene) return <main className="ip-brand-surface scene-studio scene-video-studio"><div className="scene-loading"><Loader2 size={20} className="studio-gallery-spinner"/>正在读取场景</div></main>;
  const groups = catalog.videoGroups.map(g => ({ id: g.id, title: g.title, items: catalog.video.filter(s => s.group === g.id) }));
  const groupTitle = catalog.videoGroups.find(g => g.id === scene.group)?.title;
  // 选的时长这个模型出不了（比下限短）：照实说按几秒出，不悄悄换。比上限长的是分段交给创作助手，不在这里说。
  // 比单段上限长的照实说会分几段、交给谁做（换了个更短的模型时最常见），不悄悄改时长。
  const durationNote = long ? `这个模型单段最长 ${contract!.maxSeconds} 秒，${duration} 秒会分 ${segments.length} 段，交给创作助手做`
    : !toAssistant && contract && usedDuration !== duration
    ? contract.minSeconds === contract.maxSeconds ? `这个模型只做 ${usedDuration} 秒的片子` : `这个模型最短 ${contract.minSeconds} 秒，会按 ${usedDuration} 秒出` : "";
  const pickDuration = (n: number) => { durationTouched.current = true; setDuration(n); setHint(""); };
  const goBlocker = toAssistant ? handoffBlocker : videoBlocker;
  const onPick = (id: string) => { const next = findVideoScene(catalog, id); if (next && (next.id !== scene.id || draftRef.current)) goToScene(next); };
  const tile = (kind: Exclude<Slot, "image">, media: Media | undefined, label: string, Icon: typeof Video, optional: boolean, clear: () => void) =>
    <div className={`scene-media${media ? " is-filled" : ""}`}>
      <button type="button" disabled={uploading !== undefined} onClick={() => choose(kind)} aria-label={media ? `更换${label}` : `从资产库选${label}`} title={media?.fileName}>
        {uploading === kind ? <Loader2 size={18} className="studio-gallery-spinner"/> : media && kind === "character" ? <SignedImage src={media.url} storageKey={media.key} alt=""/>
          : <Icon size={18} strokeWidth={1.3}/>}
      </button>
      <span>{label}{!media && optional && <small>可选</small>}</span>
      {media && <button type="button" className="scene-ref-remove" aria-label={`移除${label}`} onClick={clear}><X size={11} strokeWidth={1.8}/></button>}
    </div>;
  const imageIndex = (key: string) => (plan?.used ?? []).filter(m => m.mediaType === "image").findIndex(m => m.key === key);

  return <main className={`ip-brand-surface scene-studio scene-video-studio${pinned ? " has-drawer" : ""}`} data-studio-overlay-root>
    {(pinned || drawerOpen) && <SceneDrawer heading="AI 视频" groups={groups} current={scene.id} onPick={onPick} pinned={pinned} onPin={pin} onClose={() => setDrawerOpen(false)}/>}

    <section className="scene-card scene-video-composer" aria-label={view === "director" ? "AI 编导" : "写一条视频"}>
      <header className="scene-composer-head">
        <SceneSwitch scene={scene} groups={groups} onPick={onPick} onAll={() => { if (!pinned) setDrawerOpen(true); }}/>
        {mobile && <SceneRecent icon drafts={drafts.data} loading={drafts.loading} error={drafts.error} onRetry={drafts.reload} current={draft?.id} onOpen={id => void openDraft(id)}/>}
        <button type="button" className="scene-new" onClick={() => reset()}><Plus size={13} strokeWidth={1.6}/>新建</button>
      </header>

      {view === "director" ? <div className="scene-director">
        <div className="scene-director-title"><AiMark size={13}/><strong>AI 编导</strong>
          <button type="button" className="scene-text-button" onClick={() => setView("compose")}>回到编辑</button></div>
        <div className="scene-director-thread" ref={thread} aria-live="polite">
          {scripts.map((row, i) => <ScriptTurn key={row.id} row={row} run={live[row.id]} busy={busy} submitting={submitting === row.id} latest={row.id === latestScript?.id}
            given={scripts.slice(0, i + 1).map(s => s.metadata?.studio?.sceneDirector?.ask ?? "")} facts={scene.brief?.facts}
            copied={copied === row.id} onUse={() => useScript(row)} onBack={() => setView("compose")} onCopy={() => void copy(row)}
            onAgain={() => void send("换个写法重新写一版，要求和素材都不变。", { auto: true })}
            onRetry={() => void retry(row)} onConfirm={() => void confirmOriginal(row)}
            onStop={() => { const id = row.metadata?.studio?.runId; if (id) void cancelRun(id).catch(e => showFailure({ action: "停止", error: e })); }}/>)}
        </div>
        <form className="scene-director-input" onSubmit={e => { e.preventDefault(); void send(revise); }}>
          <input aria-label="想改哪里" placeholder="想改哪里，直接说" value={revise} onChange={e => { setRevise(e.target.value); setHint(""); }}/>
          <button type="submit" className="scene-send" aria-label="让编导改" title={scriptBlocker(revise) || "发送（Enter）"} disabled={busy || writing || !revise.trim()}>
            {busy || writing ? <Loader2 size={15} className="studio-gallery-spinner"/> : <ArrowUp size={15} strokeWidth={1.8}/>}</button>
        </form>
        {hint && <p className="scene-hint" role="status">{hint}</p>}
      </div>

      : <div className="scene-compose">
        <div className="scene-media-row" role="group" aria-label="素材">
          {scene.video && tile("video", video, scene.video.label, Video, !scene.video.required, () => { if (video) drop("video", video.key); setVideo(undefined); })}
          {images.map((m, i) => { const at = imageIndex(m.key); return <div key={m.key} className="scene-media is-filled">
            <span className="scene-media-preview"><SignedImage src={m.url} storageKey={m.key} alt={m.title}/>{at >= 0 && <i className="scene-ref-index">图{at + 1}</i>}</span>
            <span>{scene.images.label}</span>
            <button type="button" className="scene-ref-remove" aria-label={`移除${m.title}`} onClick={() => { drop("image", m.key); setImages(old => old.filter((_, j) => j !== i).map((o, j) => ({ ...o, title: `${scene.images.label} ${j + 1}` }))); }}><X size={11} strokeWidth={1.8}/></button></div>; })}
          {images.length < (scene.images.max ?? 6) && <div className="scene-media"><button type="button" disabled={uploading !== undefined} onClick={() => choose("image")} aria-label={`从资产库选${scene.images.label}`}>
            {uploading === "image" ? <Loader2 size={18} className="studio-gallery-spinner"/> : <Plus size={18} strokeWidth={1.3}/>}</button>
            <span>{images.length ? "再加一张" : scene.images.label}{!images.length && !scene.images.required && <small>可选</small>}</span></div>}
          {(scene.character || scene.voice) && <i className="scene-media-divider" aria-hidden="true"/>}
          {scene.character && tile("character", character, "角色", UserRound, true, () => { if (character) drop("character", character.key); setCharacter(undefined); })}
          {scene.voice && tile("voice", voice, "声音", Mic, true, () => { if (voice) drop("voice", voice.key); setVoice(undefined); })}
        </div>

        <div className="scene-box">
          <textarea ref={input} aria-label={scriptId ? "视频脚本" : "想做的视频"} value={text}
            placeholder={recreation ? scene.placeholder : "贴上写好的提示词直接生成；只有想法的话，写几句让 AI 编导帮你写成脚本"}
            onChange={e => { setText(e.target.value); setHint(""); }}/>
          {/* 这类视频要写清的信息：点一下在框里起一行「店名和位置：」，接着写就行。写过脚本之后只给脚本里还空着的。 */}
          {!recreation && chipFacts.length > 0 && <div className="scene-fact-chips" role="group" aria-label="要写清楚的信息">{chipFacts.map(f =>
            <button key={f.label} type="button" onClick={() => addFact(f.label)}><Plus size={11} strokeWidth={1.6}/>{f.label}{!f.required && <small>有就写</small>}</button>)}</div>}
          <footer>
            <small className={contract && Array.from(text).length > contract.promptMaxChars ? "is-over" : undefined}>{Array.from(text).length}{contract && !recreation ? ` / ${contract.promptMaxChars}` : ""}</small>
            {!recreation && <button type="button" className="scene-ai-button" disabled={busy || writing || uploading !== undefined || (!scripts.length && !!scriptBlocker(text))}
              title={scriptBlocker(text) || (scripts.length ? "回到 AI 编导接着改" : "按框里的想法写一版分镜脚本，按实际用量扣积分")} onClick={openDirector}>
              {busy || writing ? <Loader2 size={13} className="studio-gallery-spinner"/> : <AiMark size={12}/>}{scriptId ? "AI 改写" : "AI 编导"}</button>}
          </footer>
        </div>

        <div className="scene-go-group">
          <div className="scene-pills">
            {recreation ? <span className="scene-pill"><Cpu size={14} strokeWidth={1.5}/><span>创作助手</span></span>
              : (videoModels?.length ?? 0) > 1 ? <div className="scene-pill is-select"><Cpu size={14} strokeWidth={1.5}/>
                <StudioSelect compact label="视频模型" value={chosenVideo?.endpointId ?? ""} onChange={chooseVideoModel} options={(videoModels ?? []).map(m => ({ value: m.endpointId, label: m.name }))}/></div>
              : <span className="scene-pill"><Cpu size={14} strokeWidth={1.5}/><span>{chosenVideo?.name ?? "视频模型"}</span></span>}
            <div className="scene-setting-panel-host">
              <button type="button" className="scene-pill" aria-expanded={settingsOpen} aria-label={`视频规格：${language}，${shownDuration} 秒，${ratio}${!toAssistant && usedTier ? `，${usedTier.toUpperCase()}` : ""}`} onClick={() => setSettingsOpen(v => !v)}>
                <SlidersHorizontal size={14} strokeWidth={1.5}/><span>{language} · {shownDuration} 秒 · <RatioGlyph ratio={ratio}/>{ratio}{!toAssistant && usedTier ? ` · ${usedTier.toUpperCase()}` : ""}</span><ChevronDown size={13} strokeWidth={1.6}/></button>
              {settingsOpen && <VideoSettingsPanel min={recreation ? Math.min(...scene.durations) : contract?.minSeconds ?? Math.min(...scene.durations)}
                max={MAX_SECONDS} single={recreation ? undefined : contract?.maxSeconds} duration={duration} onDuration={pickDuration} segments={segments}
                ratios={recreation ? ["9:16", "16:9"] : ratios} ratio={ratio} onRatio={setRatio}
                tiers={toAssistant ? [] : tiers.map(t => t.tier)} tier={usedTier} onTier={setTier}
                language={language} onLanguage={setLanguage} optimizable={!toAssistant && !!chosenVideo?.supportsPromptOptimization} optimize={optimize} onOptimize={setOptimize}
                options={scene.options} picked={picked} onPick={(key, choice) => setPicked(old => ({ ...old, [key]: choice }))} onClose={() => setSettingsOpen(false)}/>}
            </div>
          </div>
          <button type="button" className="scene-go" aria-label={toAssistant ? "交给创作助手" : "生成视频"} title={goBlocker || (toAssistant ? "交给画布里的创作助手：先出方案和报价，确认后才扣积分" : undefined)}
            disabled={busy || !!goBlocker || uploading !== undefined} onClick={() => void (toAssistant ? handoff() : generate())}>
            {busy && !writing ? <Loader2 size={16} className="studio-gallery-spinner"/> : null}
            <span>{toAssistant ? "交给创作助手" : "生成视频"}</span>
            {/* 价格一直摆着（还没写字时也看得到要花多少）；算不出就不显示，不编。 */}
            {(long || recreation || caps?.mock || videoQuote != null) && <small>{long ? `分 ${segments.length} 段 · 先报价` : recreation ? "先出方案" : caps?.mock ? "免费" : `${videoQuote} 积分`}</small>}
          </button>
          {/* 点了没做成的原因用提醒色；还没动手时只是灰字说一句还差什么。 */}
          {(hint || goBlocker) && <p className={`scene-hint${hint ? "" : " is-note"}`} role="status">{hint || goBlocker}</p>}
          {!toAssistant && plan?.note && <p className="scene-hint is-note">{plan.note}</p>}
          {durationNote && <p className="scene-hint is-note">{durationNote}</p>}
          {staleScript && <p className="scene-hint is-note" role="status">{staleScript}。<button type="button" disabled={busy} onClick={reviseForNow}>让编导照现在的改一版</button></p>}
          {note && <p className="scene-hint is-note" role="status">{note.text}{note.undo && <button type="button" onClick={note.undo}>撤销</button>}</p>}
          {videoModels && !videoModels.length && !caps?.mock && !recreation && <SceneNoModel kind="视频"/>}
        </div>
      </div>}
    </section>

    <section className="scene-card scene-results" aria-label="作品与示例">
      <header><SceneResultTabs tab={tab} onTab={setTab} count={rows.length} idBase="scene-video"/>
        <span className="scene-results-actions">{draft && <Link className="scene-text-button" href={`/projects/${encodeURIComponent(draft.id)}`}><FolderOpen size={14} strokeWidth={1.4}/>在画布中继续</Link>}
          {!mobile && <SceneRecent drafts={drafts.data} loading={drafts.loading} error={drafts.error} onRetry={drafts.reload} current={draft?.id} onOpen={id => void openDraft(id)}/>}
          <UiVersionSwitch inline/></span></header>
      {draft && handedOff && <HandoffStatus projectId={draft.id} execution={execution} waiting={!!executionId && !execution}/>}
      <div id="scene-video-panel" className="scene-results-panel" role="tabpanel" aria-labelledby={`scene-video-tab-${tab}`}>
      {tab === "example" ? <SceneExample id={scene.id} title={scene.title} group={groupTitle} note={scene.description} steps={sceneSteps(scene.structure)}
          cover={scene.coverUrl} examples={scene.examples} ratio={scene.ratio}/>
        : rows.length ? <ol className="scene-row-list">{rows.map(row => <VideoRow key={row.id} row={row} run={live[row.id]} busy={busy} submitting={submitting === row.id}
            onRetry={() => void retry(row)} onConfirm={() => void confirmOriginal(row)} onReuse={() => reuseVideo(row)}
            onStop={() => { const id = row.metadata?.studio?.runId; if (id) void cancelRun(id).catch(e => showFailure({ action: "停止生成", error: e })); }}/>)}</ol>
        : <SceneEmpty title="还没有作品" note="写好提示词点「生成视频」，做好的视频会出现在这里。"/>}
      </div>
    </section>
    {picking && <div className="scene-picker-host"><LibraryReferencePicker open upload
      mediaType={picking === "voice" ? "audio" : picking === "video" ? "video" : "image"}
      max={picking === "image" ? Math.max(1, (scene.images.max ?? 6) - images.length) : 1}
      title={`选${picking === "image" ? scene.images.label : picking === "character" ? "出镜人物" : picking === "voice" ? "声音" : scene.video?.label ?? "参考视频"}`}
      intro="从资产库里选；新文件点「上传到资产库」，传完会自动选中。原文件不会被改动。" confirmLabel="用这个"
      onClose={() => setPicking(undefined)} onAssets={assets => addFromLibrary(picking, assets)}/></div>}
    <HubTabBar/>
  </main>;
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
function ScriptTurn({ row, run, busy, submitting, latest, copied, onUse, onBack, onCopy, onAgain, onRetry, onConfirm, onStop, given, facts }: {
  row: CanvasNodeData; run?: IpRun; busy: boolean; submitting: boolean; latest: boolean; copied: boolean;
  onUse: () => void; onBack: () => void; onCopy: () => void; onAgain: () => void; onRetry: () => void; onConfirm: () => void; onStop: () => void;
  /** 到这一版为止用户说过的话（第一句和每次修改意见）：核对里面的数字有没有进脚本。 */
  given: string[];
  /** 场景要的信息：分清哪些空着的必须补、哪些「有就写」。 */
  facts?: { label: string; required: boolean }[];
}) {
  const meta = row.metadata, turn = meta?.studio?.sceneDirector;
  const { missing, body } = scriptMissing(meta?.content || "");
  const absent = meta?.status === "success" ? missingFigures(given, body) : [];
  const { required: mustFill, optional: mayFill } = classifyBlanks(scriptPlaceholders(body), facts);
  const loading = meta?.status === "loading", accepted = !!meta?.studio?.runId;
  const position = run?.queue?.position;
  const summary = meta?.studio?.textEditor?.turns?.at(-1)?.content;
  const failed = meta?.status === "error";
  return <article className="scene-director-turn">
    <p className={`scene-director-ask${turn?.ask ? "" : " is-empty"}`}>{turn?.ask || (turn?.revision ? "再改一版" : "看素材写一版脚本")}</p>
    <div className={`scene-script-card is-${meta?.status || "idle"}`}>
      {loading ? <div className="scene-script-writing" role="status">
          <span className="scene-script-lines" aria-hidden="true"><i/><i/><i/></span>
          <span><AiMark size={12}/>{submitting && !accepted ? "正在交给编导" : !accepted ? "提交结果没有确认" : position && position > 0 ? `排队中，前面还有 ${position - 1} 个` : turn?.revision ? "正在改脚本" : "正在看素材、写脚本"}</span></div>
        : failed ? <p className="scene-script-state is-failed" title={meta?.errorLogId ? `记录号 ${meta.errorLogId}` : undefined}>{sceneFailureText(meta?.errorCode, meta?.errorDetails, "脚本")}</p>
        : <>{summary && <p className="scene-script-summary">{summary}</p>}
          <pre className="scene-script-text">{splitBlanks(body).map((p, i) => p.blank ? <mark key={i} className="scene-script-blank">{p.text}</mark> : p.text)}</pre>
          {mustFill.length > 0 ? <p className="scene-script-missing" role="status">还缺{mustFill.join("、")}。在下面写上发给编导，会补进脚本。{mayFill.length ? `${mayFill.join("、")}没有就不用写。` : ""}</p>
            : mayFill.length > 0 ? <p className="scene-script-check">{mayFill.join("、")}没有就不用写，出片前把脚本里标着的那几处删掉就行。</p>
            : missing ? <p className="scene-script-check">编导觉得可能还缺{missing}，写过了就不用管。</p> : null}
          {absent.length > 0 && <p className="scene-script-check">你写的 {absent.join("、")} 脚本里没用上，要加的话跟编导说一声。</p>}</>}
      <footer>
        {loading && accepted && <button type="button" onClick={onStop}><Square size={12}/>停止</button>}
        {loading && !accepted && !submitting && <button type="button" disabled={busy} onClick={onConfirm}><RotateCcw size={12}/>确认原任务</button>}
        {failed && meta?.studio?.request && <button type="button" className="is-primary" disabled={busy} onClick={onRetry}><RotateCcw size={12}/>重新写</button>}
        {meta?.status === "success" && meta.content && <>
          {latest && <button type="button" className="is-icon" aria-label="重新回答" title="重新回答" disabled={busy} onClick={onAgain}><RotateCcw size={14} strokeWidth={1.5}/></button>}
          <button type="button" className="is-icon" aria-label={copied ? "已复制" : "复制"} title={copied ? "已复制" : "复制"} onClick={onCopy}>{copied ? <Check size={14} strokeWidth={1.6}/> : <Copy size={14} strokeWidth={1.5}/>}</button>
          <span className="scene-spacer"/>
          {latest && <button type="button" onClick={onBack}>回到编辑</button>}
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
  const state = loading ? (submitting && !accepted ? "正在提交" : !accepted ? "提交结果没有确认" : position && position > 0 ? `排队中，前面还有 ${position - 1} 个` : "正在生成，一般要几分钟")
    : failure ?? "已完成";
  const url = meta?.status === "success" ? meta.content : undefined;
  return <li className={`scene-row scene-video-row is-${meta?.status || "idle"}`}>
    <div className="scene-row-meta"><strong>{row.title}</strong><span>{[request?.aspectRatio === "16:9" ? "横屏" : "竖屏", request?.video?.resolutionTier?.toUpperCase()].filter(Boolean).join(" · ")}</span>
      <span className="scene-row-state" role={loading ? "status" : undefined} title={failure && meta?.errorDetails !== failure ? `${meta?.errorDetails || ""}${meta?.errorLogId ? `（记录号 ${meta.errorLogId}）` : ""}` : undefined}>
        {loading && <Loader2 size={14} className="studio-gallery-spinner"/>}{state}</span></div>
    {url ? <SignedVideo className="scene-video-player" src={url} storageKey={meta?.storageKey} controls playsInline preload="metadata" aria-label={row.title}/>
      : loading ? <span className={`scene-video-placeholder is-${request?.aspectRatio === "16:9" ? "wide" : "tall"}`}/> : null}
    {request?.prompt && <p className="scene-row-prompt" title={request.prompt}>{request.prompt}</p>}
    <div className="scene-row-actions">
      {loading && accepted && <button type="button" onClick={onStop}><Square size={13}/>停止</button>}
      {loading && !accepted && !submitting && <button type="button" disabled={busy} onClick={onConfirm}><RotateCcw size={13}/>确认原任务</button>}
      {meta?.status === "error" && request && <button type="button" className="is-primary" disabled={busy} onClick={onRetry}><RotateCcw size={13}/>重新生成</button>}
      {url && <button type="button" onClick={() => void downloadMedia(url, row.title, undefined, meta?.storageKey)}><Download size={13}/>下载</button>}
      {url && request && <button type="button" disabled={busy} onClick={onReuse} title="把这条的脚本和设置放回编辑器，改好再出；这条留着"><PencilLine size={13}/>重新编辑</button>}
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
      {segments.length > 1 && <p>超过单段上限，分 {segments.length} 段生成后拼成一条：{segments.join(" + ")} 秒。交给创作助手做，先出方案和报价。</p>}
    </div>
    <div className="scene-setting-row"><span>画面比例</span>
      <div className="scene-choice-row">{ratios.map(value => <button key={value} type="button" aria-pressed={value === ratio} onClick={() => onRatio(value)}><RatioGlyph ratio={value}/>{value}</button>)}</div></div>
    {tiers.length > 1 && <div className="scene-setting-row"><span>清晰度</span>
      <div className="scene-choice-row">{tiers.map(t => <button key={t} type="button" aria-pressed={t === tier} onClick={() => onTier(t)}>{t.toUpperCase()}</button>)}</div></div>}
    {optimizable && <div className="scene-setting-row" role="group" aria-label="提示词"><span>提示词</span>
      <div className="scene-choice-row">
        <button type="button" aria-pressed={optimize} onClick={() => onOptimize(true)}>先优化再生成</button>
        <button type="button" aria-pressed={!optimize} onClick={() => onOptimize(false)}>按原文生成</button></div>
      {/* 2026-10-30 线上复核：先优化是另一笔文字任务，要说清不含在视频价里、可以不要。 */}
      <p>{optimize ? "先按这个模型更认的写法改写一遍，按实际用量另扣少量积分，不含在视频价里。" : "按你写的原文直接生成，只扣视频价。"}</p></div>}
    {options?.map(g => <div key={g.key} className="scene-setting-row" role="group" aria-label={g.label}><span>{g.label}</span>
      <div className="scene-choice-row">{g.choices.map(c => <button key={c.value} type="button" aria-pressed={(picked[g.key] ?? g.defaultValue) === c.value} title={c.prompt}
        onClick={() => onPick(g.key, c.value)}>{c.label}</button>)}</div></div>)}
  </div>;
}

/** 交给创作助手之后做到哪了：一句话加「去画布看」。没有确认方案之前还没开始做，也照实说。 */
function HandoffStatus({ projectId, execution, waiting }: { projectId: string; execution?: StudioPlanExecution; waiting: boolean }) {
  const steps = execution?.steps ?? [];
  const done = steps.filter(s => s.status === "done" || s.status === "skipped").length;
  const text = waiting ? "在画布里交给创作助手做了，正在读进度…"
    : !execution ? "交给画布里的创作助手了，去那边确认方案和费用后才开始做。"
    : execution.status === "running" ? `创作助手在做，第 ${Math.min(done + 1, steps.length)} 步，共 ${steps.length} 步。`
    : execution.status === "done" ? "创作助手做完了，成片在画布里。"
    : execution.status === "paused" || execution.status === "needs_user" ? `创作助手停下来等你${execution.needsUserReason ? `：${execution.needsUserReason}` : "，去画布里看一眼"}。`
    : execution.status === "canceled" ? "这次制作停掉了，做好的部分还在画布里。"
    : `没全部做完，做好了 ${done} 步，剩下的去画布里看看。`;
  return <p className={`scene-handoff${execution?.status === "paused" || execution?.status === "needs_user" ? " is-waiting" : ""}`} role="status">{text}
    <Link href={`/projects/${encodeURIComponent(projectId)}?start=assistant`}>去画布看</Link></p>;
}
