"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowUp, Check, ChevronDown, Clapperboard, Copy, Download, FolderOpen, ImagePlus, Languages, Loader2, Mic, PencilLine, Plus,
  RotateCcw, Sparkles, Square, Upload, UserRound, Video, Wand2, X } from "lucide-react";
import type { IpProject, IpRun, StudioMediaImportResult, StudioSceneInputs, StudioSceneVideoState } from "@ai-star-eco/types";
import type { StudioCapabilities } from "@ai-star-eco/types/ip-studio-workflow";
import type { VideoStudioModel } from "@ai-star-eco/types/video-studio";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { HubTabBar } from "@/components/hub/ui";
import { cancelRun, fetchStudioVideoModels, readRun, signKeys } from "@/canvas-bridge/api";
import { SignedImage } from "@/canvas-bridge/signed-image";
import { SignedVideo } from "@/canvas-bridge/signed-video";
import { importStudioMedia, studioCapabilities, submitStudioRun } from "@/canvas-bridge/studio-api";
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
import { IpStudioApi } from "../api";
import { findVideoScene, useSceneCatalog, type VideoScene } from "./scene-catalog";
import { addScriptNode, addVideoRow, applyRun, createSceneDraft, draftSubject, listSceneDrafts, openedVideoState, patchNode, resubmitRow, sceneInputsOf, scriptNodes, scriptOfRow, submissionRejected, videoRows, withSceneInput, type SceneInputKind } from "./scene-drafts";
import { useSceneDraftStore, useSceneStateSave } from "./scene-draft-store";
import { useSceneQuery, writeSceneQuery } from "./scene-query";
import { UiVersionSwitch } from "@/shell/ui-version-switch";
import { SceneExample, SceneList, SceneNoModel, SceneOptions, SceneRecent, SceneResultTabs, SceneThumb, sceneFailureText, sceneHintText, sceneOptionValues, useScenePopover } from "./scene-layout";
import { clampSceneDuration, sceneVideoDurations, sceneVideoInputs, sceneVideoSettings, type SceneVideoMaterial } from "./scene-video-plan";
import { classifyBlanks, missingFigures, scriptMissing, scriptPlaceholders, splitBlanks } from "./scene-script-check";

type Media = StudioMediaImportResult & { title: string };
type Slot = "image" | "character" | "voice" | "video";
const DEFAULT_SCENE = "ecom-talking";
const POLL_MS = 1500;
const LANGUAGES = ["中文", "英文"];
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
  const [mode, setMode] = useState<"talk" | "generate">("talk");
  const [scriptId, setScriptId] = useState<string>();
  const [prompt, setPrompt] = useState("");
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
  const fileInput = useRef<HTMLInputElement>(null);
  const target = useRef<Slot>("image");
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

  // ── 场景与草稿 ────────────────────────────────────────────────────────
  const sceneNow = useRef<string>(undefined);
  /** 只管场景本身的默认值（时长、画面）；输入和素材怎么跟着走见 goToScene。 */
  const pickScene = useCallback((next: VideoScene) => {
    sceneNow.current = next.id;
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
    setMode("talk"); setScriptId(undefined); setPrompt(""); setHint(""); setTab("example");
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
      setText(state.text); setPicked(state.options); setLanguage(state.language!); setTier(state.tier); setOptimize(state.optimize!);
      setDuration(state.duration!); setRatio(state.ratio!);
      setMode(state.edit ? "generate" : "talk"); setScriptId(state.edit?.scriptId); setPrompt(state.edit?.prompt ?? ""); setNote(undefined);
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
  const scripts = scriptNodes(doc);
  const rows = videoRows(doc);
  const latestScript = [...scripts].reverse().find(s => s.metadata?.status === "success" && s.metadata.content);
  const lastScriptSpent = latestScript?.metadata?.studio?.textEditor?.turns?.at(-1)?.billing?.credits;
  const writing = scripts.some(s => s.metadata?.status === "loading");
  // 新的一轮出来时滚到底（只滚对话区自己）。
  // 等这一帧排好版再滚：打开草稿时脚本和图片是后到的，立刻滚会停在半路，最新一版的按钮被输入框挡住一半。
  useEffect(() => {
    const frame = requestAnimationFrame(() => { const el = thread.current; if (el) el.scrollTop = el.scrollHeight; });
    return () => cancelAnimationFrame(frame);
  }, [scripts.length, writing]);

  // ── 素材 ──────────────────────────────────────────────────────────────
  const upload = async (kind: Slot, file: File) => {
    const type = kind === "voice" ? "audio" : kind === "video" ? "video" : "image";
    const wrong = type === "image" && !/\.(jpe?g|png)$/i.test(file.name) ? "请选择 JPG 或 PNG 图片"
      : type === "video" && !/\.mp4$/i.test(file.name) ? "参考视频请用 MP4 格式"
      : type === "audio" && !/\.(mp3|wav|m4a)$/i.test(file.name) ? "声音请用 MP3、WAV 或 M4A" : "";
    if (wrong) { showFailure({ action: "上传素材", error: new Error(wrong) }); return; }
    const ticket = session.current;
    setUploading(kind);
    try {
      const projectId = await ensureDraft(ticket);
      const result = await importStudioMedia(projectId, file, type);
      const title = kind === "image" ? `${scene!.images.label} ${images.length + 1}` : kind === "character" ? "出镜人物" : kind === "voice" ? "声音样本" : "参考视频";
      const media: Media = { ...result, title };
      const max = scene!.images.max ?? 6;
      // 传的时候换了草稿：素材照样记进它自己那份草稿，只是不放到新打开的这页上。
      if (onPage(ticket, projectId)) {
        if (kind === "image") setImages(old => [...old, media].slice(0, max));
        if (kind === "character") setCharacter(media);
        if (kind === "voice") setVoice(media);
        if (kind === "video") setVideo(media);
      }
      // 上传完就写进草稿：素材节点 + 这一格现在选的是它。刷新或从「最近」再打开时还是这份（换过就是换后的）。
      await persist(doc => {
        const nodes = doc.nodes as CanvasNodeData[];
        const made = placeMedia(nodes, media, type, nodes.filter(n => n.metadata?.origin === "upload").length);
        const placed = nodes.some(n => n.id === made.id) ? doc : { ...doc, nodes: [...nodes, made] };
        return withSceneInput(placed, kind, media.key, "add", max);
      }, projectId).catch(() => undefined);
    } catch (e) { showFailure({ action: "上传素材", error: e, next: "检查一下文件格式和大小，再试一次。" }); }
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
  const choose = (kind: Slot) => {
    target.current = kind;
    if (!fileInput.current) return;
    fileInput.current.accept = kind === "voice" ? ".mp3,.wav,.m4a" : kind === "video" ? ".mp4" : ".jpg,.jpeg,.png";
    fileInput.current.click();
  };

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
  const blocker = !scene ? "正在读取场景…" : recreation && scene.video?.required && !video ? `先放${scene.video.label}`
    : scene.images.required && !images.length ? `先放${scene.images.label}`
    : recreation && scene.textRequired && !text.trim() ? "先写一句要求"
    : !recreation && !revising && scene.textRequired && !text.trim() ? "先写一句要求"
    : !recreation && revising && !text.trim() ? "说说想改哪里"
    : !recreation && !caps ? "正在读取模型…"
    : !recreation && !caps?.mock && !textModel?.tokenPricing ? "编导暂时不可用（文字模型没配置价格）" : "";

  /** 让编导写或改一版。revisionAsk 是代码替用户说的修改意见（出片时换了规格，「让编导按现在的设置改一版」）。 */
  const send = async (revisionAsk?: string) => {
    if (busy || uploading || writing) return;
    // 代码替用户说的修改意见（换了规格重写）只跳过「说说想改哪里」，模型没读到、没配价这类照样拦。
    if (blocker && !(revisionAsk && blocker === "说说想改哪里")) { setHint(blocker); return; }
    if (recreation) { await handoff(); return; }
    setBusy(true); setHint(""); setNote(undefined);
    const ticket = session.current;
    let nodeId: string | undefined, posted = false, projectId: string | undefined;
    try {
      const ask = (revisionAsk ?? text).trim();
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
      if (onPage(ticket, projectId)) { if (!revisionAsk) setText(""); setSubmitting(nodeId); }
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
      const longest = scene.durations.includes(duration) ? duration : scene.duration;
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
  const useScript = (row: CanvasNodeData) => { setScriptId(row.id); setPrompt(scriptMissing(row.metadata?.content || "").body); setMode("generate"); setHint(""); };
  /**
   * 重新编辑（成功的视频）：成功了但不满意时用。把这条用的脚本（含出片前改过的字）、时长、画面、清晰度、模型和要不要先优化放回「生成视频」，
   * 改一处再出；旧的这条留着。素材用现在放着的（编辑器里列着会用上哪几份）。
   */
  const reuseVideo = (row: CanvasNodeData) => {
    const request = row.metadata?.studio?.request, doc = draftRef.current?.doc;
    if (!request) return;
    // 点之前的样子：「撤销」回到这里（放回会覆盖正在改的脚本）。
    const before = { mode, scriptId, prompt, duration, ratio, tier, optimize, model: chosenVideo?.endpointId };
    const put = (v: typeof before) => {
      setMode(v.mode); setScriptId(v.scriptId); setPrompt(v.prompt); setDuration(v.duration); setRatio(v.ratio); setTier(v.tier); setOptimize(v.optimize);
      if (v.model && v.model !== chosenVideo?.endpointId && videoModels?.some(m => m.endpointId === v.model)) chooseVideoModel(v.model);
    };
    put({ mode: "generate", scriptId: doc ? scriptOfRow(doc, row.id) : undefined, prompt: request.prompt || "", duration: request.durationSec ?? duration,
      ratio: request.aspectRatio ?? ratio, tier: request.video?.resolutionTier ?? tier, optimize: request.video?.optimizePrompt !== false, model: request.model ?? undefined });
    const gone = request.model && videoModels && !videoModels.some(m => m.endpointId === request.model) && chosenVideo
      ? `当时用的模型现在用不了，这次用「${chosenVideo.name}」。` : "";
    setHint("");
    setNote({ text: `${gone}这条的脚本和设置放回来了，素材用的是现在放着的。`, undo: () => { put(before); setNote(undefined); } });
    // 编辑器在页面上方（手机上离结果很远）：滚过去、光标放进脚本，不然点了像没反应（2026-10-30 界面评审）。
    setTimeout(() => {
      document.querySelector(".scene-video-studio .scene-video-composer")?.scrollIntoView?.({ block: "start", behavior: "smooth" });
      document.querySelector<HTMLTextAreaElement>('.scene-video-studio textarea[aria-label="视频脚本"]')?.focus({ preventScroll: true });
    }, 0);
  };
  // 页面上的条件写进草稿（有草稿时）：刷新、从「最近」再打开都从离开的地方接着来。素材另记在 sceneInputs、视频模型在 sceneVideoModel。
  const videoState = useMemo<StudioSceneVideoState>(() => ({ text, options: picked, language, ...(tier ? { tier } : {}), duration, ratio, optimize,
    ...(mode === "generate" ? { edit: { ...(scriptId ? { scriptId } : {}), prompt } } : {}) }), [text, picked, language, tier, duration, ratio, optimize, mode, scriptId, prompt]);
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
  // 输入栏上的规格和费用：跟着选的视频模型走（画面比例、清晰度都按这个模型实际支持的给）。
  const talkRatios = contract?.tiers.find(t => t.tier === usedTier)?.canvases.map(c => c.aspectRatio).filter(r => r === "9:16" || r === "16:9") ?? ["9:16", "16:9"];
  const shownDuration = recreation ? (scene?.durations.includes(duration) ? duration : scene?.duration ?? duration) : usedDuration;
  const specLabel = [language, !recreation && usedTier ? usedTier.toUpperCase() : "", `${shownDuration} 秒`, ratio === "16:9" ? "横屏" : "竖屏"].filter(Boolean).join(" · ");
  const talkCost = recreation ? "交给创作助手：先出方案和报价，确认后才扣积分"
    : caps?.mock ? "测试响应 · 免费"
    // maxCost 是这一次最多能冻结的数，不是价格（2026-10-30 验收：只写「最多 N 积分」，读起来像一版短脚本就要这么多）。
    // 写过的给出上一版实际扣了多少，没写过的直说短脚本用不满。授权和结算不变：仍按 maxCost 冻结、按实际用量结算。
    : [scriptCost !== undefined ? (lastScriptSpent !== undefined
        ? `写脚本按实际用量扣积分，上一版扣了 ${lastScriptSpent}，这一版最多扣 ${scriptCost}（只是上限）`
        : `写脚本按实际用量扣积分，这一版最多扣 ${scriptCost}（只是上限，短脚本用不了这么多）`) : "",
       chosenVideo ? (videoQuote != null ? `用 ${chosenVideo.name} 出片预计 ${videoQuote} 积分` : planError || "") : "",
       !textModel?.supportsVision && (images.length || character) ? "编导这次不看图，只按文字写" : ""].filter(Boolean).join("；");
  // 正在出片的这版脚本是按什么写的：时长、横竖屏、交给视频模型的图。现在的设置跟它对不上（换了模型、改了时长或素材），
  // 就照实说哪里变了，并给一键「让编导按现在的设置改一版」；不拦出片，用户也可能就是想这么出（2026-10-30 审查 F07）。
  const writtenFor = scripts.find(s => s.id === scriptId)?.metadata?.studio?.sceneDirector;
  const handedNow = (plan?.used ?? []).filter(m => m.mediaType === "image").map(m => m.key);
  const staleScript = mode === "generate" && writtenFor ? [
    writtenFor.duration !== usedDuration ? `这版脚本是照 ${writtenFor.duration} 秒写的，现在要出 ${usedDuration} 秒` : "",
    writtenFor.ratio !== ratio ? `脚本是照${writtenFor.ratio === "16:9" ? "横屏" : "竖屏"}写的，现在是${ratio === "16:9" ? "横屏" : "竖屏"}` : "",
    writtenFor.refs && writtenFor.refs.join() !== handedNow.join()
      ? writtenFor.refs.length && !handedNow.length ? `脚本里用了参考图，这个模型不看图`
        : `脚本里用了 ${writtenFor.refs.length || "0"} 张参考图，这次只用得上 ${handedNow.length} 张` : "",
  ].filter(Boolean).join("，") : "";
  const reviseForNow = () => {
    if (!staleScript) return;
    setMode("talk");
    void send(`${staleScript}。按现在的时长、画面和参考图重新排镜头和台词，内容和卖点不变。`);
  };

  // 编导留了【待补】的地方没填，出出来就是一句「待补」或者模型自己编一个价：先拦下。
  const blanks = scriptPlaceholders(prompt);
  const videoBlocker = !videoModels ? "正在读取视频模型…" : !chosenVideo ? "还没有可用的视频模型" : planError
    || (blanks.length ? `还有没填的：${[...new Set(blanks)].join("、")}。在上面换成实际内容，用不上的直接删掉。` : "")
    || (settings ? studioVideoError(chosenVideo, settings, prompt, ratio, usedDuration) : "请重新选择清晰度") || "";

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
          title: `${scene.title} · ${usedDuration} 秒`, prompt: prompt.trim(), scriptId, refIds, video: settings!, durationSec: usedDuration, aspectRatio: ratio,
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
  const tooLong = !!contract && scene.duration > contract.maxSeconds;
  // 选的时长这个模型出不了（换了模型之后常见）：照实说按几秒出，不悄悄换。场景默认时长超上限另有下面那句「交给创作助手分段做」。
  const durationNote = !recreation && contract && usedDuration !== duration && !(tooLong && duration === scene.duration)
    ? contract.minSeconds === contract.maxSeconds ? `这个模型只做 ${usedDuration} 秒的片子`
      : `这个模型只能做 ${contract.minSeconds}–${contract.maxSeconds} 秒，会按 ${usedDuration} 秒出` : "";
  const tile = (kind: Exclude<Slot, "image">, media: Media | undefined, label: string, Icon: typeof Video, optional: boolean, clear: () => void) =>
    <div className={`scene-media${media ? " is-filled" : ""}`}>
      <button type="button" disabled={uploading !== undefined} onClick={() => choose(kind)} aria-label={media ? `更换${label}` : `添加${label}`} title={media?.fileName}>
        {uploading === kind ? <Loader2 size={20} className="studio-gallery-spinner"/> : media && kind === "character" ? <SignedImage src={media.url} storageKey={media.key} alt=""/>
          : <><Icon size={26} strokeWidth={1.3}/>{!media && <span className="scene-ref-upload"><Upload size={11}/></span>}</>}
      </button>
      <span>{media ? label : `添加${label}`}{!media && optional && <small>（可选）</small>}</span>
      {media && <button type="button" className="scene-ref-remove" aria-label={`移除${label}`} onClick={clear}><X size={13}/></button>}
    </div>;

  return <main className="ip-brand-surface scene-studio scene-video-studio" data-studio-overlay-root>
    <SceneList heading="AI 视频" current={scene.id} onPick={id => { const next = findVideoScene(catalog, id); if (next && (next.id !== scene.id || draftRef.current)) goToScene(next); }} groups={groups}/>

    <section className="scene-composer scene-video-composer" aria-label="编导">
      <header className="scene-composer-head">
        <SceneThumb id={scene.id} title={scene.title} cover={scene.coverUrl} size={52}/>
        <div><strong>{scene.title}</strong><small>{scene.description}</small></div>
        <button type="button" className="scene-new" onClick={() => reset()}><Plus size={16}/>新建</button>
      </header>

      {/* 生成模式（照参考站「应用脚本」之后）整列换成编辑器，脚本就在编辑框里；回到编导再看对话。 */}
      <div className="scene-director-thread" ref={thread} aria-live="polite" hidden={mode === "generate"}>
        {!scripts.length ? <div className="scene-video-stage">
            <span className="scene-video-mark" aria-hidden="true"><Clapperboard size={30} strokeWidth={1.4}/></span>
            <h2>你想做一条什么视频？</h2>
            <p className="scene-director-intro">{recreation ? "放上要复刻的视频，说说换成什么；会交给画布里的创作助手先拉片再做。" : "放素材、说一句，编导先写一版分镜脚本给你看，满意了再出片。"}</p>
            <div className="scene-idea-grid" role="group" aria-label="常用开头">{scene.ideas.map(idea => <button type="button" key={idea}
              onClick={() => setText(old => old.includes(idea) ? old : old.trim() ? `${old.trim()}；${idea}` : idea)}>{idea}</button>)}</div>
          </div>
          : scripts.map((row, i) => <ScriptTurn key={row.id} row={row} run={live[row.id]} busy={busy} submitting={submitting === row.id} latest={row.id === latestScript?.id}
              given={scripts.slice(0, i + 1).map(s => s.metadata?.studio?.sceneDirector?.ask ?? "")} facts={scene.brief?.facts}
              copied={copied === row.id} onUse={() => useScript(row)} onRevise={() => { setMode("talk"); input.current?.focus(); }} onCopy={() => void copy(row)}
              onRetry={() => void retry(row)} onConfirm={() => void confirmOriginal(row)}
              onStop={() => { const id = row.metadata?.studio?.runId; if (id) void cancelRun(id).catch(e => showFailure({ action: "停止", error: e })); }}/>)}
      </div>

      {mode === "talk" ? <div className="scene-video-input">
        <div className="scene-media-row" role="group" aria-label="素材">
          {scene.video && tile("video", video, scene.video.label, Video, !scene.video.required, () => { if (video) drop("video", video.key); setVideo(undefined); })}
          {images.map((m, i) => <div key={m.key} className="scene-media is-filled"><span className="scene-media-preview"><SignedImage src={m.url} storageKey={m.key} alt={m.title}/></span><span>图{i + 1} {m.title}</span>
            <button type="button" className="scene-ref-remove" aria-label={`移除${m.title}`} onClick={() => { drop("image", m.key); setImages(old => old.filter((_, j) => j !== i).map((o, j) => ({ ...o, title: `${scene.images.label} ${j + 1}` }))); }}><X size={13}/></button></div>)}
          {images.length < (scene.images.max ?? 6) && <div className="scene-media"><button type="button" disabled={uploading !== undefined} onClick={() => choose("image")} aria-label={`添加${scene.images.label}`}>
            {uploading === "image" ? <Loader2 size={20} className="studio-gallery-spinner"/> : <><ImagePlus size={26} strokeWidth={1.3}/><span className="scene-ref-upload"><Upload size={11}/></span></>}</button>
            <span>添加{scene.images.label}{!scene.images.required && <small>（可选）</small>}</span></div>}
          {scene.character && <i className="scene-media-divider" aria-hidden="true"/>}
          {scene.character && tile("character", character, "角色", UserRound, true, () => { if (character) drop("character", character.key); setCharacter(undefined); })}
          {scene.voice && <i className="scene-media-divider" aria-hidden="true"/>}
          {scene.voice && tile("voice", voice, "声音", Mic, true, () => { if (voice) drop("voice", voice.key); setVoice(undefined); })}
          <input ref={fileInput} type="file" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(target.current, file); }}/>
        </div>
        <SceneOptions groups={scene.options} value={picked} onPick={(key, choice) => setPicked(old => ({ ...old, [key]: choice }))}/>
        {/* 这类视频要写清的信息（场景的 brief）：点一下在输入框里起一行「店名和位置：」，接着写就行，不用填表。 */}
        {/* 写过一版之后只给脚本里还空着的那几条，没有空着的就不显示（2026-10-30 界面评审：改稿时三行标签挤在中间）。 */}
        {!recreation && chipFacts.length > 0 && <div className="scene-fact-chips" role="group" aria-label="要写清楚的信息"><span>{revising ? "还空着" : "写清楚"}</span>
          <div>{chipFacts.map(f => <button key={f.label} type="button" onClick={() => addFact(f.label)}>
            {f.label}{!f.required && <small>有就写</small>}</button>)}</div></div>}
        <textarea ref={input} aria-label={revising ? "想改哪里" : "想做的视频"} rows={3} value={text}
          placeholder={revising ? "想改哪里，直接说。例如：开头再抓人一点，台词口语一点" : scene.placeholder} onChange={e => { setText(e.target.value); setHint(""); }}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}/>
        {/* 分两层（2026-10-30 复测：挤在一行时提示缩成「先…」、手机上模型名只剩几个字）：
            上层是视频模型、规格和发送，下层整行写提示：卡在哪、写脚本和按这个模型出片各要多少积分、这个模型能用哪些素材。 */}
        <footer>
          <div className="scene-video-controls">
            {!recreation && !!videoModels?.length && <StudioSelect compact label="视频模型" value={chosenVideo?.endpointId ?? ""} onChange={chooseVideoModel}
              options={videoModels.map(m => ({ value: m.endpointId, label: m.name }))}/>}
            <div className="scene-setting-panel-host">
              <button type="button" className="scene-video-settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(v => !v)}>
                <Languages size={14}/>{specLabel}<ChevronDown size={13}/></button>
              {settingsOpen && <VideoSettingsPanel durations={recreation ? scene.durations : durations} duration={recreation ? (scene.durations.includes(duration) ? duration : scene.duration) : usedDuration}
                onDuration={setDuration} ratios={recreation ? ["9:16", "16:9"] : talkRatios} ratio={ratio} onRatio={setRatio}
                tiers={recreation ? [] : tiers.map(t => t.tier)} tier={usedTier} onTier={setTier}
                language={language} onLanguage={setLanguage} onClose={() => setSettingsOpen(false)}/>}
            </div>
          </div>
          <button type="button" className="scene-send" aria-label={recreation ? "交给创作助手" : revising ? "让编导改" : "让编导写脚本"} title={blocker || "发送（Enter）"}
            disabled={busy || !!blocker || uploading !== undefined || writing} onClick={() => void send()}>
            {busy || writing ? <Loader2 size={18} className="studio-gallery-spinner"/> : <ArrowUp size={19}/>}</button>
          <p className={`scene-video-hint${hint || blocker ? " is-blocked" : ""}`} role="status">{hint || blocker || talkCost}</p>
          {!hint && !blocker && !recreation && plan?.note && <p className="scene-video-hint is-note">{plan.note}</p>}
          {!hint && !blocker && durationNote && <p className="scene-video-hint is-note">{durationNote}</p>}
          {note && <p className="scene-video-hint is-note" role="status">{note.text}{note.undo && <button type="button" onClick={note.undo}>撤销</button>}</p>}
        </footer>
        {!recreation && tooLong && <p className="scene-director-long">当前模型一条最长 {contract!.maxSeconds} 秒。想做 {scene.duration} 秒这样更长的片子？
          <button type="button" disabled={busy} onClick={() => void handoff()}>交给创作助手分段做</button></p>}
      </div>
      : <GenerateEditor prompt={prompt} onPrompt={p => { setPrompt(p); setHint(""); }} onBack={() => setMode("talk")}
          models={videoModels ?? []} model={chosenVideo} onModel={chooseVideoModel} tiers={tiers.map(t => t.tier)} tier={usedTier} onTier={setTier}
          durations={durations} duration={usedDuration} onDuration={setDuration} ratio={ratio} onRatio={setRatio}
          used={plan?.used ?? []} restored={note} stale={staleScript} onReviseForNow={reviseForNow} reviseCost={caps?.mock ? undefined : scriptCost} note={[plan?.note, durationNote].filter(Boolean).join("；") || undefined} quote={videoQuote} mock={!!caps?.mock} blocker={hint || videoBlocker} busy={busy}
          optimize={optimize} onOptimize={setOptimize} maxChars={contract?.promptMaxChars} onGenerate={() => void generate()}/>}
      {videoModels && !videoModels.length && !caps?.mock && mode === "generate" && <SceneNoModel kind="视频"/>}
    </section>

    <section className="scene-results" aria-label="生成结果">
      <header><SceneResultTabs tab={tab} onTab={setTab} count={rows.length} idBase="scene-video"/>
        <span className="scene-results-actions">{draft && <Link className="scene-link" href={`/projects/${encodeURIComponent(draft.id)}`}><FolderOpen size={15}/>在画布中继续</Link>}<UiVersionSwitch inline/></span></header>
      <div id="scene-video-panel" className="scene-results-panel" role="tabpanel" aria-labelledby={`scene-video-tab-${tab}`}>
      {tab === "example" ? <SceneExample id={scene.id} title={`${scene.title}怎么做`} note={scene.structure} cover={scene.coverUrl} examples={scene.examples}>
          <ol className="scene-steps">
            <li><b>1</b><div><strong>放素材、说一句</strong><p>商品图、门店照片或故事，用平时说话的方式写，不写也行。</p></div></li>
            <li><b>2</b><div><strong>编导写脚本</strong><p>{recreation ? "画布里的创作助手先拉片，再按原片结构出方案。" : "看完素材写一版分镜和台词，哪里不满意直接说。"}</p></div></li>
            <li><b>3</b><div><strong>确认后出片</strong><p>选好模型和时长，看清要花多少积分再生成。</p></div></li>
          </ol>
        </SceneExample>
        : rows.length ? <ol className="scene-row-list">{rows.map(row => <VideoRow key={row.id} row={row} run={live[row.id]} busy={busy} submitting={submitting === row.id}
            onRetry={() => void retry(row)} onConfirm={() => void confirmOriginal(row)} onReuse={() => reuseVideo(row)}
            onStop={() => { const id = row.metadata?.studio?.runId; if (id) void cancelRun(id).catch(e => showFailure({ action: "停止生成", error: e })); }}/>)}</ol>
        : <div className="scene-empty"><h2>还没有生成</h2><p>编导写好脚本后，点「用这个脚本生成」，视频会出现在这里。</p></div>}
      </div>
    </section>

    <SceneRecent drafts={drafts.data} loading={drafts.loading} error={drafts.error} onRetry={drafts.reload} current={draft?.id} onOpen={id => void openDraft(id)}/>
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
function ScriptTurn({ row, run, busy, submitting, latest, copied, onUse, onRevise, onCopy, onRetry, onConfirm, onStop, given, facts }: {
  row: CanvasNodeData; run?: IpRun; busy: boolean; submitting: boolean; latest: boolean; copied: boolean;
  onUse: () => void; onRevise: () => void; onCopy: () => void; onRetry: () => void; onConfirm: () => void; onStop: () => void;
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
  const spent = meta?.studio?.textEditor?.turns?.at(-1)?.billing?.credits;
  const summary = meta?.studio?.textEditor?.turns?.at(-1)?.content;
  const failed = meta?.status === "error";
  return <article className="scene-director-turn">
    <p className={`scene-director-ask${turn?.ask ? "" : " is-empty"}`}>{turn?.ask || (turn?.revision ? "再改一版" : "看素材写一版脚本")}</p>
    <div className={`scene-script-card is-${meta?.status || "idle"}`}>
      <header><Sparkles size={14} aria-hidden="true"/><strong>编导</strong>
        <span>{turn ? `${turn.duration} 秒 · ${turn.ratio === "16:9" ? "横屏" : "竖屏"} · ${turn.language}` : ""}</span></header>
      {loading ? <p className="scene-script-state" role="status"><Loader2 size={14} className="studio-gallery-spinner"/>
          {submitting && !accepted ? "正在交给编导" : !accepted ? "提交结果没有确认" : position && position > 0 ? `排队中，前面还有 ${position - 1} 个` : turn?.revision ? "正在改脚本" : "正在看素材、写脚本"}</p>
        : failed ? <p className="scene-script-state is-failed" title={meta?.errorLogId ? `记录号 ${meta.errorLogId}` : undefined}>{sceneFailureText(meta?.errorCode, meta?.errorDetails, "脚本")}</p>
        : <>{summary && <p className="scene-script-summary">{summary}</p>}
          <pre className="scene-script-text">{splitBlanks(body).map((p, i) => p.blank ? <mark key={i} className="scene-script-blank">{p.text}</mark> : p.text)}</pre>
          {/* 放在脚本下面、按钮上面：脚本区会滚到底，放上面一打开就看不见（2026-10-30 界面评审）。用场景里的信息名说，不照抄模型那句。 */}
          {mustFill.length > 0 ? <p className="scene-script-missing" role="status">还缺{mustFill.join("、")}。在下面写上发给编导，会补进脚本。{mayFill.length ? `${mayFill.join("、")}没有就不用写。` : ""}</p>
            : mayFill.length > 0 ? <p className="scene-script-check">{mayFill.join("、")}没有就不用写，出片前把脚本里标着的那几处删掉就行。</p>
            : missing ? <p className="scene-script-check">编导觉得可能还缺{missing}，写过了就不用管。</p> : null}
          {absent.length > 0 && <p className="scene-script-check">你写的 {absent.join("、")} 脚本里没用上，要加的话跟编导说一声。</p>}</>}
      <footer>
        {loading && accepted && <button type="button" onClick={onStop}><Square size={13}/>停止</button>}
        {loading && !accepted && !submitting && <button type="button" disabled={busy} onClick={onConfirm}><RotateCcw size={13}/>确认原任务</button>}
        {failed && meta?.studio?.request && <button type="button" className="is-primary" disabled={busy} onClick={onRetry}><RotateCcw size={13}/>重新写</button>}
        {meta?.status === "success" && meta.content && <>
          <button type="button" className="is-primary" onClick={onUse}><Wand2 size={13}/>用这个脚本生成</button>
          {latest && <button type="button" onClick={onRevise}><PencilLine size={13}/>改一改</button>}
          <button type="button" onClick={onCopy}>{copied ? <Check size={13}/> : <Copy size={13}/>}{copied ? "已复制" : "复制"}</button>
        </>}
        {spent !== undefined && <small>花了 {spent} 积分</small>}
      </footer>
    </div>
  </article>;
}

/** 生成模式（照参考站「应用脚本」之后）：脚本可以再改，选模型、清晰度、时长、画面，看清价格再生成。 */
function GenerateEditor({ prompt, onPrompt, onBack, models, model, onModel, tiers, tier, onTier, durations, duration, onDuration, ratio, onRatio,
  used, restored, stale, onReviseForNow, reviseCost, note, quote, mock, blocker, busy, optimize, onOptimize, maxChars, onGenerate }: {
  prompt: string; onPrompt: (v: string) => void; onBack: () => void;
  models: VideoStudioModel[]; model?: VideoStudioModel; onModel: (id: string) => void;
  tiers: string[]; tier?: string; onTier: (t: string) => void; durations: number[]; duration: number; onDuration: (n: number) => void;
  ratio: string; onRatio: (r: string) => void; used: SceneVideoMaterial[]; restored?: { text: string; undo?: () => void }; stale?: string; onReviseForNow: () => void; reviseCost?: number; note?: string; quote: number | null; mock: boolean;
  blocker: string; busy: boolean; optimize: boolean; onOptimize: (on: boolean) => void; maxChars?: number; onGenerate: () => void;
}) {
  const optimizable = !!model?.supportsPromptOptimization;
  const ratios = model?.contract.tiers.find(t => t.tier === tier)?.canvases.map(c => c.aspectRatio).filter(r => r === "9:16" || r === "16:9") ?? ["9:16", "16:9"];
  let image = 0;
  return <div className="scene-generate">
    <header><button type="button" className="scene-generate-back" onClick={onBack}><ArrowLeft size={15}/>回到编导</button><strong>生成视频</strong></header>
    <textarea aria-label="视频脚本" value={prompt} onChange={e => onPrompt(e.target.value)} rows={8}/>
    <div className="scene-generate-meta">
      {used.length ? <span className="scene-generate-refs">{used.map(m => <i key={m.key}>{m.mediaType === "image" ? `图${++image}` : "声音"} {m.title}</i>)}</span> : <span>只按脚本生成</span>}
      {maxChars ? <small className={Array.from(prompt).length > maxChars ? "is-over" : undefined}>{Array.from(prompt).length} / {maxChars}</small> : null}
    </div>
    {restored && <p className="scene-generate-note is-note" role="status">{restored.text}{restored.undo && <button type="button" onClick={restored.undo}>撤销</button>}</p>}
    {note && <p className="scene-generate-note" role="status">{note}</p>}
    {stale && <p className="scene-generate-note is-note" role="status">{stale}。
      <button type="button" disabled={busy} onClick={onReviseForNow}>让编导照现在的改一版{reviseCost !== undefined ? `（最多 ${reviseCost} 积分）` : ""}</button></p>}
    <div className="scene-generate-settings">
      {models.length > 1 && <div className="scene-gen-row"><span>模型</span>
        <StudioSelect label="视频模型" compact value={model?.endpointId || ""} onChange={onModel} options={models.map(m => ({ value: m.endpointId, label: m.name }))}/></div>}
      {tiers.length > 1 && <ChoiceRow label="清晰度" options={tiers.map(t => [t, t.toUpperCase()])} value={tier} onChange={onTier}/>}
      <ChoiceRow label="时长" options={durations.map(d => [String(d), `${d} 秒`])} value={String(duration)} onChange={v => onDuration(Number(v))}/>
      <ChoiceRow label="画面" options={ratios.map(r => [r, r === "16:9" ? "横屏" : "竖屏"])} value={ratio} onChange={onRatio}/>
      {optimizable && <ChoiceRow label="描述" options={[["on", "先优化再出片"], ["off", "按原文出片"]]} value={optimize ? "on" : "off"} onChange={v => onOptimize(v === "on")}/>}
    </div>
    {/* 2026-10-30 线上复核：「优化描述另需少量积分」说不清扣多少、能不能不要。服务端是另起一笔文字任务，按改写模型的上限冻结、按实际用量结算。 */}
    {optimizable && !mock && <p className="scene-generate-help">{optimize
      ? "出片前先把脚本改写成这个模型更认的写法。这一步单独按实际用量扣积分，不含在下面的视频价里；不想要可以选「按原文出片」。"
      : "按你写的原文直接出片，只扣视频价。"}</p>}
    <button type="button" className="scene-go" aria-label="立即生成视频" title={blocker || undefined} disabled={busy || !!blocker} onClick={onGenerate}>
      {busy ? <Loader2 size={18} className="studio-gallery-spinner"/> : null}<span>立即生成视频</span>
      <small>{blocker || (mock ? "测试响应 · 免费" : quote != null ? `视频预计 ${quote} 积分${optimizable && optimize ? "，优化描述按用量另扣" : ""}` : "")}</small>
    </button>
  </div>;
}

function ChoiceRow({ label, options, value, onChange }: { label: string; options: string[][]; value?: string; onChange: (v: string) => void }) {
  return <div className="scene-gen-row"><span>{label}</span>
    <div className="scene-choice-row" role="group" aria-label={label}>{options.map(([v, text]) => <button key={v} type="button" aria-pressed={v === value} onClick={() => onChange(v)}>{text}</button>)}</div>
  </div>;
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

/** 时长、横竖屏和台词语言：就地展开在输入框上方。 */
function VideoSettingsPanel({ durations, duration, onDuration, ratios, ratio, onRatio, tiers, tier, onTier, language, onLanguage, onClose }: {
  durations: number[]; duration: number; onDuration: (n: number) => void; ratios: string[]; ratio: string; onRatio: (r: string) => void;
  tiers: string[]; tier?: string; onTier: (t: string) => void; language: string; onLanguage: (l: string) => void; onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useScenePopover(panel, onClose);
  return <div ref={panel} className="scene-settings-panel is-left" role="group" aria-label="视频设置">
    {tiers.length > 1 && <><h3>清晰度</h3>
      <div className="scene-choice-row">{tiers.map(t => <button key={t} type="button" aria-pressed={t === tier} onClick={() => onTier(t)}>{t.toUpperCase()}</button>)}</div></>}
    <h3>时长</h3>
    <div className="scene-choice-row">{durations.map(d => <button key={d} type="button" aria-pressed={d === duration} onClick={() => onDuration(d)}>{d} 秒</button>)}</div>
    <h3>画面</h3>
    <div className="scene-choice-row">{ratios.map(value => <button key={value} type="button" aria-pressed={value === ratio} onClick={() => onRatio(value)}>{value === "16:9" ? "横屏 16:9" : "竖屏 9:16"}</button>)}</div>
    <h3>台词语言</h3>
    <div className="scene-choice-row">{LANGUAGES.map(l => <button key={l} type="button" aria-pressed={l === language} onClick={() => onLanguage(l)}>{l}</button>)}</div>
  </div>;
}
