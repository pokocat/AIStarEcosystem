"use client";
// 成片高级编辑（2026-10-19，2026-11-07 加变速、淡入淡出、调色、小窗和图片）：字幕和声音在合成阶段默认做好，这里给想精修的人用。
// Twick 只管编辑和预览；导出时把工程转成「片段 / 音频 / 文字 / 字幕 + 起止时间」的清单（toEditTimeline），
// 走普通的成片导出任务交给服务端 FFmpeg 合成，结果和一键成片一样出现在「已导出的成片」中。
// 素材一律先用带登录的同源接口取成 Blob 再交给 Twick：线上 OSS 没配 CORS，而 Twick 播放时设了 crossOrigin。
import "@/styles/twick-scoped.css";
import { useEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore, type ComponentType } from "react";
import { Button, Input, InputNumber, Radio, Select, Slider, Switch } from "antd";
import { ArrowLeft, ChevronRight, Download, Music, PictureInPicture2, Save, Trash2 } from "lucide-react";
import {
  AudioElement, CAPTION_PROPS, CaptionElement, ElementAnimation, ImageElement, LivePlayerProvider, TextElement, TimelineProvider, Track, TrackElement, TwickStudio, VideoElement,
  useTimelineContext, type PanelProps, type ProjectJSON, type StudioConfig,
} from "@twick/studio";
import { PLAYER_STATE, useLivePlayerContext } from "@twick/live-player";
import { CAPTION_STYLE, ElementAdder, TRACK_TYPES } from "@twick/timeline";
import type { StudioAdvancedEdit, StudioEditTimeline, StudioWorkDraft } from "@ai-star-eco/types/ip-studio-workflow";
import { cornerFrame, studioEditGapSeconds, toEditTimeline, toLiveProject, toStoredProject } from "@/canvas-bridge/studio-edit-timeline";
import { CanvasNodeType, type CanvasNodeData } from "@/canvas/types/canvas";
import { SignedAudio } from "@/canvas-bridge/signed-audio";
import { SignedImage } from "@/canvas-bridge/signed-image";
import { SignedVideo } from "@/canvas-bridge/signed-video";
import { parseStudioCaptions, studioCaptionMode } from "@/canvas-bridge/studio-packaging";
import { studioMediaSeconds } from "@/canvas-bridge/studio-work-clips";
import { fetchAssetBlob } from "@/ip/api/ip-studio";
import { USE_MOCK } from "@/ip/api/_client";
import { useStudioApp } from "./studio-errors";

type Props = {
  projectId: string;
  /** 一键成片里勾选的片段（按顺序），第一次打开时按它们搭时间线。 */
  clips: CanvasNodeData[];
  /** 画布上所有可用的视频 / 音频，左边素材栏里列出来。 */
  library: CanvasNodeData[];
  voice?: CanvasNodeData;
  /** 一键成片里选的背景音乐：不进时间线，导出时铺满全片。 */
  music?: CanvasNodeData;
  onMusicChange: (storageKey?: string) => void;
  /** 在音频面板直接上传背景音乐，传完返回存储 key 和文件名。 */
  onUploadMusic?: (file: File) => Promise<{ key: string; name: string }>;
  /** false = 语音识别不可用，「导出时自动生成字幕」开不了。 */
  captionRecognition?: boolean;
  draft: StudioWorkDraft;
  title: string;
  /** 上次导出自动生成的字幕（片段没变时）：第一次打开直接放到时间线上。 */
  seedCaptions?: { start: number; end: number; text: string }[];
  onSave: (edit: StudioAdvancedEdit) => Promise<void>;
  /** 存档并提交导出任务；返回 true 表示已提交（编辑器随即关闭，回到成片页看进度）。 */
  onExport: (timeline: StudioEditTimeline, edit: StudioAdvancedEdit) => Promise<boolean>;
  onClose: () => void;
};
type Media = { key: string; url: string; name: string; type: "video" | "audio" | "image"; seconds?: number };
type Size = { width: number; height: number };

const SIZES: Record<string, Size> = { "16:9": { width: 1280, height: 720 }, "9:16": { width: 720, height: 1280 } };
const SIZES_1080: Record<string, Size> = { "16:9": { width: 1920, height: 1080 }, "9:16": { width: 1080, height: 1920 } };
/** 工程的画面尺寸：打开已有工程按它存的尺寸（元素坐标都按它算），新工程按成片设置。 */
const projectSize = (draft: StudioWorkDraft): Size => draft.advanced ? draft.advanced.size || SIZES[draft.aspectRatio] || SIZES["9:16"]
  : (draft.quality === "1080p" ? SIZES_1080 : SIZES)[draft.aspectRatio] || SIZES["9:16"];
const SPEEDS: { value: number; label: string }[] = [{ value: 0.5, label: "0.5 倍" }, { value: 0.75, label: "0.75 倍" }, { value: 1, label: "正常" }, { value: 1.25, label: "1.25 倍" }, { value: 1.5, label: "1.5 倍" }, { value: 2, label: "2 倍" }];
const LOOKS = [{ value: "none", label: "原色" }, { value: "saturated", label: "鲜艳" }, { value: "bright", label: "明亮" }, { value: "warm", label: "暖色" }, { value: "cool", label: "冷色" }, { value: "black_white", label: "黑白" }];
const CORNERS: { value: string; label: string; corner: [number, number] }[] = [{ value: "tl", label: "左上", corner: [-1, -1] }, { value: "tr", label: "右上", corner: [1, -1] }, { value: "bl", label: "左下", corner: [-1, 1] }, { value: "br", label: "右下", corner: [1, 1] }];
const FADE_SECONDS = 0.5;
const TWICK_LABELS: Record<string, string> = {
  Delete: "删除", Split: "在竖线处分开", "Undo last action": "撤销", "Redo last undone action": "重做", "Jump to start": "回到开头", "Jump to end": "跳到结尾",
  Play: "播放", Pause: "暂停", "Zoom In": "放大时间线", "Zoom Out": "缩小时间线",
  "Follow playhead on (click to disable)": "播放时时间线跟随（点击关闭）", "Follow playhead off (click to enable)": "播放时时间线不跟随（点击开启）",
};
// Twick 自带的工具和面板都是英文、功能也多；全部藏起来，换成我们自己的四个中文面板（只留基础剪辑）。
const HIDDEN_TOOLS = ["video", "image", "audio", "text", "emoji", "text-style", "effect", "shape", "caption", "generate-media", "templates", "record", "chapters", "script"];
const TOOLS = [
  { id: "cn-video", name: "视频", icon: "Video", description: "画布中的视频" },
  { id: "cn-audio", name: "音频", icon: "Audio", description: "画布中的配音和音乐" },
  { id: "cn-image", name: "图片", icon: "Image", description: "画布中的图片" },
  { id: "cn-text", name: "文字", icon: "Type", description: "添加文字" },
  { id: "cn-caption", name: "字幕", icon: "MessageSquare", description: "添加字幕" },
];
const fmt = (s: number) => `${Math.round(s * 10) / 10} 秒`;
/** 字幕轨的样式：半透明底的整句字幕，放在画面中线往下约 30% 高度处（和一键合成烧的字幕位置差不多）。 */
const captionTrackProps = (size: Size) => {
  const base = CAPTION_PROPS[CAPTION_STYLE.SOFT_BOX] as { font?: { size?: number } };
  // 字号按短边放大，和服务端合成一致（StudioPackagingService.editCaption）。
  const scale = Math.min(size.width, size.height) / 720;
  return { capStyle: CAPTION_STYLE.SOFT_BOX, ...base, ...(base.font?.size ? { font: { ...base.font, size: Math.round(base.font.size * scale) } } : {}), x: 0, y: Math.round(size.height * 0.3) };
};

async function loadMedia(node: CanvasNodeData): Promise<Media | undefined> {
  const key = node.metadata?.storageKey;
  if (!key) return undefined;
  // 演示数据没有后端，素材本来就在本站；线上一律走同源接口（带登录、查归属）。
  const blob = USE_MOCK && node.metadata?.content
    ? await fetch(node.metadata.content).then(r => { if (!r.ok) throw new Error(`素材加载失败 ${r.status}`); return r.blob(); })
    : await fetchAssetBlob(key);
  return { key, url: URL.createObjectURL(blob), name: node.title || "素材", type: node.type === CanvasNodeType.Audio ? "audio" : node.type === CanvasNodeType.Image ? "image" : "video", seconds: studioMediaSeconds(node) };
}

/**
 * 第一次打开：按一键成片的设置搭好时间线（顺序片段、配音、品牌文字、字幕）。
 * 在时间线挂载之前就算好整份工程交给它，不在挂载后再往里加（开发模式下挂载两次会把后加的冲掉）。
 */
async function seedProject(clips: Media[], voice: Media | undefined, draft: StudioWorkDraft, size: Size, seedCaptions: Props["seedCaptions"], onSkip: (name: string) => void): Promise<ProjectJSON> {
  const tracks: Track[] = [];
  const video = new Track("视频", TRACK_TYPES.VIDEO);
  let at = 0;
  for (const clip of clips) {
    const el = new VideoElement(clip.url, size);
    try { await el.updateVideoMeta(); } catch { onSkip(clip.name); continue; }
    const length = el.getMediaDuration() || clip.seconds || 5;
    el.setStart(at); el.setEnd(at + length); el.setName(clip.name); el.setMetadata({ storageKey: clip.key, mediaDuration: el.getMediaDuration() || undefined });
    if (voice) el.setVolume(0);
    await el.accept(new ElementAdder(video));
    at += length;
  }
  tracks.push(video);
  if (voice) {
    const el = new AudioElement(voice.url);
    try {
      await el.updateAudioMeta();
      el.setStart(0); el.setEnd(Math.min(at || 5, el.getMediaDuration() || voice.seconds || at || 5)); el.setName(voice.name); el.setMetadata({ storageKey: voice.key });
      const track = new Track("配音", TRACK_TYPES.AUDIO);
      await el.accept(new ElementAdder(track));
      tracks.push(track);
    } catch { onSkip(voice.name); }
  }
  if (draft.packagingEnabled && at > 0) {
    const texts = [[draft.brand, -size.height / 2 + size.width / 12], [draft.title, -size.height / 2 + size.width / 6], [draft.cta, size.height / 2 - size.width / 8]] as const;
    const words = texts.filter(([text]) => text.trim());
    if (words.length) {
      const track = new Track("文字", TRACK_TYPES.ELEMENT);
      for (const [text, y] of words) {
        const el = new TextElement(text.trim(), { fontSize: Math.round(size.width / 18), fill: "#FFFFFF", fontWeight: 700 });
        el.setStart(0); el.setEnd(at); el.setPosition({ x: 0, y });
        await el.accept(new ElementAdder(track));
      }
      tracks.push(track);
    }
  }
  const mode = studioCaptionMode(draft);
  let captions: ReturnType<typeof parseStudioCaptions> = [];
  if (mode === "manual") { try { captions = parseStudioCaptions(draft.captionText); } catch { /* 一键成片里写错的字幕不带过来 */ } }
  else if (mode === "auto") captions = seedCaptions || [];
  if (captions.length && at > 0) {
    const track = new Track("字幕", TRACK_TYPES.CAPTION);
    track.setProps(captionTrackProps(size));
    for (const c of captions) if (c.start < at) await new CaptionElement(c.text, c.start, Math.min(c.end, at)).accept(new ElementAdder(track));
    tracks.push(track);
  }
  return { tracks: tracks.filter(t => t.serialize().elements.length).map(t => t.serialize()), version: 1 };
}

/**
 * 顶栏（我们自己的，中文）：返回、保存、导出成片。Twick 自带的英文顶栏藏起来。
 * touched：时间线有没有动过（撤销按钮靠的同一个状态）。没动过就返回，不算改过。
 */
function EditorBar({ title, busy, locked, barRef, asking, setAsking, unsaved, onClean, onSave, onNothingToSave, onExport, onChanged, onLeave, onSaveAndLeave }: {
  title: string; busy: boolean;
  /** 外层的后退拦截要读当前工程。 */
  barRef: { current: { project: () => ProjectJSON; canUndo: boolean } | null };
  asking: boolean; setAsking: (asking: boolean) => void;
  /** 素材没加载齐：时间线缺东西，这时保存或导出会丢剪辑。 */
  locked: boolean;
  unsaved: (project: ProjectJSON) => boolean; onClean: (project: ProjectJSON) => void;
  onSave: (project: ProjectJSON) => void; onNothingToSave: () => void; onExport: (project: ProjectJSON) => void;
  /** 这次打开有没有改过内容。 */
  onChanged: (project: ProjectJSON, touched: boolean) => boolean;
  onLeave: () => void; onSaveAndLeave: (project: ProjectJSON) => void;
}) {
  const { editor, canUndo } = useTimelineContext();
  const project = () => editor.getProject();
  const [gapAsk, setGapAsk] = useState<number>();
  const exportNow = () => { const gaps = gapSecondsOf(mainClipsOf(editor)); if (gaps) setGapAsk(gaps); else onExport(project()); };
  // 撤销不了就是原样：记下这时的工程，之后只有内容真的变了才算改过（点选片段也会让撤销亮起来，但不算改动）。
  useEffect(() => { if (!canUndo) onClean(editor.getProject()); });
  barRef.current = { project, canUndo };
  // 编辑不会自动保存：改过还没保存时，刷新或关标签先问一声。
  useEffect(() => {
    if (!canUndo) return;
    const warn = (e: BeforeUnloadEvent) => { if (unsaved(editor.getProject())) { e.preventDefault(); e.returnValue = ""; } };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUndo, editor]);
  return <header className="studio-advanced-bar">
    <button type="button" className="studio-advanced-back" disabled={busy} onClick={() => { if (onChanged(project(), canUndo)) setAsking(true); else onLeave(); }}><ArrowLeft size={16}/>返回</button>
    <strong title={title}>{title}</strong>
    {gapAsk ? <div className="studio-advanced-ask" role="group" aria-label="片段之间有空白">
      <span>片段之间有 {fmt(gapAsk)}空白，导出后是黑屏。</span>
      <Button disabled={busy} onClick={() => setGapAsk(undefined)}>取消</Button>
      <Button disabled={busy} onClick={() => { setGapAsk(undefined); onExport(project()); }}>直接导出</Button>
      <Button type="primary" disabled={busy} onClick={() => { setGapAsk(undefined); closeGaps(editor, mainClipsOf(editor)); onExport(project()); }}>去掉空白并导出</Button>
    </div> : asking ? <div className="studio-advanced-ask" role="group" aria-label="保存修改">
      <span>有修改还没保存。保存后，这条成片以高级编辑的内容为准。</span>
      <Button disabled={busy} onClick={() => setAsking(false)}>继续编辑</Button>
      <Button disabled={busy} onClick={onLeave}>不保存</Button>
      <Button type="primary" loading={busy} onClick={() => onSaveAndLeave(project())}>保存并返回</Button>
    </div> : <div>
      {busy && <span className="studio-advanced-progress" role="status">正在提交…</span>}
      <Button icon={<Save size={15}/>} disabled={busy || locked} onClick={() => { if (onChanged(project(), canUndo)) onSave(project()); else onNothingToSave(); }}>保存</Button>
      <Button type="primary" icon={<Download size={15}/>} loading={busy} disabled={locked} onClick={exportNow}>导出成片</Button>
    </div>}
  </header>;
}

/** 从竖线位置放进一条新轨道（字幕放进字幕轨），选中它。toEnd：接到主轨片尾，不盖住已有片段。 */
/** 左边的素材面板和右边的成片设置是分开渲染的，同一个设置靠它保持一致。 */
type Box<T> = { current: T; subscribe: (listener: () => void) => () => void };
function box<T>(initial: T): Box<T> {
  let value = initial;
  const listeners = new Set<() => void>();
  return {
    get current() { return value; },
    set current(next: T) { value = next; listeners.forEach(listener => listener()); },
    subscribe: listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
  };
}
function useBox<T>(source: Box<T>) { return useSyncExternalStore(source.subscribe, () => source.current, () => source.current); }

type MusicPick = { key: string; name: string; content?: string };
type MusicControl = { value: Box<MusicPick | undefined>; set: (next?: MusicPick) => void; upload?: (file: File) => Promise<MusicPick> };

function MusicField({ music, onError, empty, preview }: { music: MusicControl; onError: (e: unknown) => void; empty: string; preview?: boolean }) {
  const bgm = useBox(music.value);
  const picker = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const upload = async (file?: File) => {
    if (!file || !music.upload) return;
    if (file.size > 25 * 1024 * 1024) { onError(new Error("这个文件超过 25 MB，请换一个小一点的音乐文件。")); return; }
    setUploading(true);
    try { music.set(await music.upload(file)); } catch (e) { onError(e); } finally { setUploading(false); if (picker.current) picker.current.value = ""; }
  };
  return <>
    {bgm ? <p><Music size={14}/><span title={bgm.name}>{bgm.name}</span><button type="button" aria-label="移除背景音乐" onClick={() => music.set(undefined)}>移除</button></p> : <p>{empty}</p>}
    {preview && bgm && <SignedAudio key={bgm.key} src={bgm.content} storageKey={bgm.key} controls aria-label={`试听 ${bgm.name}`}/>}
    {music.upload && <><input ref={picker} type="file" hidden accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a" aria-label="选择背景音乐文件" onChange={e => void upload(e.target.files?.[0])}/>
      <Button size="small" loading={uploading} onClick={() => picker.current?.click()}>{bgm ? "更换音乐" : "上传背景音乐"}</Button></>}
  </>;
}

function MusicPickButton({ music, node }: { music: MusicControl; node: CanvasNodeData }) {
  const bgm = useBox(music.value);
  const key = node.metadata?.storageKey;
  if (!key) return null;
  const on = bgm?.key === key;
  return <button type="button" className="studio-advanced-pip" aria-pressed={on} aria-label={`将「${node.title || "素材"}」设为背景音乐`} title="循环铺满全片，人物说话时自动压低" onClick={() => music.set({ key, name: node.title || "背景音乐", content: node.metadata?.content })}><Music size={14}/>{on ? "已设为背景音乐" : "设为背景音乐"}</button>;
}

function useAddToTimeline(size: Size) {
  const { editor, setSelectedItem } = useTimelineContext();
  const { getCurrentTime } = useLivePlayerContext();
  return async (el: TrackElement, length: number, trackName: string, trackType: string, afterAdd?: () => void, toEnd = false) => {
    let at = Math.max(0, getCurrentTime?.() ?? 0);
    let track = trackType === TRACK_TYPES.CAPTION ? editor.getCaptionsTrack() : null;
    if (toEnd) {
      const main = (editor.getTimelineData()?.tracks ?? []).find(t => t.getType() === TRACK_TYPES.VIDEO && !t.getElements().some(x => x.getMetadata()?.pip));
      if (main) { track = main; at = Math.max(0, ...main.getElements().map(x => x.getEnd())); }
    }
    el.setStart(at); el.setEnd(at + length);
    if (!track) {
      track = editor.addTrack(trackName, trackType);
      if (trackType === TRACK_TYPES.CAPTION) track.setProps(captionTrackProps(size));
    }
    await editor.addElementToTrack(track, el);
    // 加进轨道时 Twick 会重新读素材、把显示尺寸改回铺满，所以小窗和图片的位置要在这之后设。
    if (afterAdd) { afterAdd(); editor.updateElement(el); }
    setSelectedItem(el);
  };
}

/** 素材栏：只列画布上已经有的素材，点一下才去取。不提供网址添加和本地上传（那些不会被保存）。视频多一个「添加为小窗」。 */
function mediaPanel(kind: "video" | "audio" | "image", nodes: CanvasNodeData[], resolve: (node: CanvasNodeData) => Promise<Media>, size: Size, onError: (e: unknown) => void, music?: MusicControl): ComponentType<PanelProps> {
  return function MediaPanel() {
    const add = useAddToTimeline(size);
    const [adding, setAdding] = useState<string>();
    const items = nodes.filter(n => kind === "audio" ? n.type === CanvasNodeType.Audio : kind === "image" ? n.type === CanvasNodeType.Image : n.type === CanvasNodeType.Video);
    const put = async (node: CanvasNodeData, pip: boolean) => {
      if (adding) return;
      setAdding(node.id);
      try {
        const m = await resolve(node);
        if (kind === "image") {
          const el = new ImageElement(m.url, size);
          await el.updateImageMeta();
          el.setName(m.name); el.setMetadata({ storageKey: m.key });
          await add(el, 3, "图片", TRACK_TYPES.ELEMENT, () => {
            const fit = el.getFrame().size || [size.width, size.height];
            el.setFrame(cornerFrame(size, fit[0] / fit[1], [1, -1], 0.3));
          });
          return;
        }
        const el = kind === "video" ? new VideoElement(m.url, size) : new AudioElement(m.url);
        if (el instanceof VideoElement) await el.updateVideoMeta(); else await el.updateAudioMeta();
        el.setName(m.name); el.setMetadata({ storageKey: m.key, mediaDuration: el.getMediaDuration() || undefined, ...(pip ? { pip: true } : {}) });
        if (pip && el instanceof VideoElement) el.setVolume(0);
        await add(el, el.getMediaDuration() || m.seconds || 5, pip ? "小窗" : kind === "video" ? "视频" : "音频", kind === "video" ? TRACK_TYPES.VIDEO : TRACK_TYPES.AUDIO, pip && el instanceof VideoElement ? () => {
          const fit = el.getFrame().size || [size.width, size.height];
          el.setFrame(cornerFrame(size, fit[0] / fit[1], [1, -1], 0.34));
        } : undefined, kind === "video" && !pip);
      } catch (e) { onError(e); } finally { setAdding(undefined); }
    };
    const titles = { video: "画布中的视频", audio: "画布中的音频", image: "画布中的图片" };
    const empties = { video: "画布中暂无视频", audio: "画布中暂无配音或音乐。", image: "画布中暂无图片" };
    return <div className="panel-container studio-advanced-panel">
      {music && <div className="studio-advanced-music"><div className="panel-title">背景音乐</div>
        <MusicField music={music} onError={onError} empty="未设置。可在下方把一条音频设为背景音乐。"/>
        <small>支持 MP3、WAV、M4A，最大 25 MB。导出时循环铺满全片，人物说话时自动压低；这里预览听不到，导出后才有。</small></div>}
      <div className="panel-title">{titles[kind]}</div>
      {!items.length ? <p className="studio-advanced-hint">{empties[kind]}</p>
        : <ul className="studio-advanced-media">{items.map(n => <li key={n.id}><button type="button" disabled={!!adding} onClick={() => void put(n, false)} title={kind === "video" ? "加到片尾" : "从竖线位置添加到时间线"}>
          {kind === "video" ? <SignedVideo src={n.metadata?.content} storageKey={n.metadata?.storageKey} muted playsInline preload="metadata"/>
            : kind === "image" ? <SignedImage src={n.metadata?.content} storageKey={n.metadata?.storageKey} alt=""/> : <span className="studio-advanced-audio-icon">♪</span>}
          <span>{adding === n.id ? "正在添加…" : n.title || "素材"}</span></button>
          {kind === "video" && <button type="button" className="studio-advanced-pip" disabled={!!adding} aria-label={`将「${n.title || "素材"}」添加为小窗`} title="叠在主画面的角落播放" onClick={() => void put(n, true)}><PictureInPicture2 size={14}/>小窗</button>}
          {music && <MusicPickButton music={music} node={n}/>}
        </li>)}</ul>}
      <p className="studio-advanced-hint">{kind === "image" ? "点击后从竖线位置显示 3 秒，可在画面中拖动位置、拖动边角调整大小。" : kind === "video" ? "点击加到片尾，可拖动调整顺序。需要叠在主画面角落时，点击「小窗」。" : "点击添加到竖线位置，可拖动调整位置，拖动两端调整时长。"}</p>
    </div>;
  };
}

function textPanel(size: Size): ComponentType<PanelProps> { return function TextPanel() {
  const add = useAddToTimeline(size);
  const [text, setText] = useState("");
  return <div className="panel-container studio-advanced-panel">
    <div className="panel-title">添加文字</div>
    <Input.TextArea aria-label="文字内容" value={text} onChange={e => setText(e.target.value)} rows={3} maxLength={120} placeholder="例如：限时优惠"/>
    <Button type="primary" disabled={!text.trim()} onClick={() => { void add(new TextElement(text.trim(), { fontSize: 48, fill: "#FFFFFF", fontWeight: 700 }), 3, "文字", TRACK_TYPES.ELEMENT); setText(""); }}>添加到画面</Button>
    <p className="studio-advanced-hint">从竖线位置开始显示 3 秒。可在画面中拖动文字调整位置，在右侧修改字号和颜色。</p>
  </div>;
}; }

function captionPanel(size: Size, auto: Box<boolean>, recognition?: boolean): ComponentType<PanelProps> { return function CaptionPanel() {
  const autoOn = useBox(auto);
  const add = useAddToTimeline(size);
  const [text, setText] = useState("");
  return <div className="panel-container studio-advanced-panel">
    <div className="panel-title">添加字幕</div>
    <Input.TextArea aria-label="字幕内容" value={text} onChange={e => setText(e.target.value)} rows={2} maxLength={80} placeholder="例如：今天介绍一款新品"/>
    <Button type="primary" disabled={!text.trim()} onClick={() => { void add(new CaptionElement(text.trim(), 0, 3), 3, "字幕", TRACK_TYPES.CAPTION); setText(""); }}>添加字幕</Button>
    <p className="studio-advanced-hint">从竖线位置开始显示 3 秒，拖动两端调整时长。选中字幕可修改内容。</p>
    {recognition === false ? <p className="studio-advanced-hint">自动生成字幕暂不可用，需要字幕请在这里手动添加。</p>
      : <label className="studio-advanced-auto"><Switch size="small" aria-label="导出时自动生成字幕" checked={autoOn} onChange={v => { auto.current = v; }}/>时间线上没有字幕时，导出时自动生成</label>}
  </div>;
}; }

/** 删掉一段视频时，同一条轨道上后面的片段往前补，不留黑屏（像剪映主轨那样）。文字、字幕、音频按原时间不动。 */
function removeClosingGap(editor: ReturnType<typeof useTimelineContext>["editor"], el: TrackElement) {
  const gap = el.getEnd() - el.getStart();
  const later = el instanceof VideoElement
    ? (editor.getTrackById(el.getTrackId())?.getElements() || []).filter(x => x.getId() !== el.getId() && x.getStart() >= el.getEnd() - 0.001).sort((a, b) => a.getStart() - b.getStart())
    : [];
  editor.removeElement(el);
  for (const x of later) { x.setStart(x.getStart() - gap); x.setEnd(x.getEnd() - gap); editor.updateElement(x); }
}

/**
 * 改播放速度：片段在时间线上的长度跟着变，同一轨后面的片段前后挪，不留空也不盖住。
 * Twick 播放的素材时间是 (props.time + 已播放秒数) × 速度，所以 props.time 要反算，素材起点才不变。
 */
function retimeClip(editor: ReturnType<typeof useTimelineContext>["editor"], el: VideoElement, next: number, isOverlay: boolean) {
  const old = el.getPlaybackRate() || 1;
  if (old === next) return;
  const length = el.getEnd() - el.getStart(), delta = length * old / next - length, oldEnd = el.getEnd();
  const from = (el.getStartAt() || 0) * old;
  const later = isOverlay ? [] : (editor.getTrackById(el.getTrackId())?.getElements() || []).filter(x => x.getId() !== el.getId() && x.getStart() >= oldEnd - 0.001).sort((a, b) => a.getStart() - b.getStart());
  // 变长时先把后面的挪开，变短时先把自己收回来，全程不重叠。
  const shift = (x: TrackElement) => { x.setStart(x.getStart() + delta); x.setEnd(x.getEnd() + delta); editor.updateElement(x); };
  if (delta > 0) [...later].reverse().forEach(shift);
  el.setPlaybackRate(next); el.setStartAt(from / next); el.setEnd(el.getStart() + length + delta);
  editor.updateElement(el);
  if (delta <= 0) later.forEach(shift);
}

/** 片段的淡入淡出：Twick 的 fade 动画，预览和导出一致。 */
function fadeState(el: TrackElement) {
  const animation = el.getAnimation();
  const animate = animation?.getName() === "fade" ? animation.getAnimate() : undefined;
  return { in: animate === "enter" || animate === "both", out: animate === "exit" || animate === "both" };
}
function setFades(el: TrackElement, fadeIn: boolean, fadeOut: boolean) {
  const animation = fadeIn || fadeOut ? new ElementAnimation("fade").setAnimate(fadeIn && fadeOut ? "both" : fadeIn ? "enter" : "exit").setInterval(FADE_SECONDS) : undefined;
  // Twick 的 both 先淡入，再等「总时长 - 淡入」，淡出排到了片段结束之后，看不见。把这里的 duration 减掉一段，淡出才落在片段最后。
  if (animation && fadeIn && fadeOut) animation.setDuration(Math.max(FADE_SECONDS, el.getEnd() - el.getStart() - FADE_SECONDS));
  el.setAnimation(animation);
}

/** 主画面的片段（不含小窗），按时间排好。 */
function mainClipsOf(editor: ReturnType<typeof useTimelineContext>["editor"]) {
  return (editor.getTimelineData()?.tracks ?? []).flatMap(t => t.getElements())
    .filter(el => el instanceof VideoElement && !el.getMetadata()?.pip).sort((a, b) => a.getStart() - b.getStart());
}
function gapSecondsOf(clips: TrackElement[]) { return studioEditGapSeconds(clips.map(c => ({ start: c.getStart(), end: c.getEnd() }))); }
function closeGaps(editor: ReturnType<typeof useTimelineContext>["editor"], clips: TrackElement[]) {
  let at = 0;
  for (const clip of clips) {
    const length = clip.getEnd() - clip.getStart();
    if (clip.getStart() > at + 0.001) { clip.setStart(at); clip.setEnd(at + length); editor.updateElement(clip); }
    at = Math.max(at, clip.getEnd());
  }
}
function GapNotice() {
  const { editor } = useTimelineContext();
  const clips = mainClipsOf(editor), gaps = gapSecondsOf(clips);
  if (!gaps) return null;
  return <div className="studio-advanced-gap" role="status">
    <p>片段之间有 {fmt(gaps)}空白，导出后是黑屏。</p>
    <Button size="small" type="primary" onClick={() => closeGaps(editor, clips)}>去掉空白</Button>
  </div>;
}

/** Twick 播到片尾不会自己停，时钟接着走、画面变黑，看着像片子后面多了一段。播完就停在片尾。 */
function StopAtEnd() {
  const { playerState, currentTime, setPlayerState, setSeekTime } = useLivePlayerContext();
  const { editor } = useTimelineContext();
  useEffect(() => {
    if (playerState !== PLAYER_STATE.PLAYING) return;
    const end = Math.max(0, ...(editor.getTimelineData()?.tracks ?? []).flatMap(t => t.getElements()).map(el => el.getEnd()));
    if (end > 0 && currentTime >= end) { setPlayerState(PLAYER_STATE.PAUSED); setSeekTime(end); }
  }, [playerState, currentTime, editor, setPlayerState, setSeekTime]);
  return null;
}

function elementKind(el: TrackElement) {
  if (el instanceof VideoElement) return el.getMetadata()?.pip ? "小窗" : "视频";
  return el instanceof AudioElement ? "音频" : el instanceof CaptionElement ? "字幕" : el instanceof TextElement ? "文字" : el instanceof ImageElement ? "图片" : "素材";
}

/** 右边没选中东西时：这条成片里有什么（点一下选中并跳到那里）、背景音乐和字幕。操作说明收起来，不占地方。 */
function CutOverview({ size, music, auto, recognition, onError }: { size: Size; music: MusicControl; auto: Box<boolean>; recognition?: boolean; onError: (e: unknown) => void }) {
  const { editor, setSelectedItem } = useTimelineContext();
  const { setSeekTime } = useLivePlayerContext();
  const autoOn = useBox(auto);
  const all = (editor.getTimelineData()?.tracks ?? []).flatMap(t => t.getElements()).sort((a, b) => a.getStart() - b.getStart());
  const clips = all.filter(el => elementKind(el) === "视频");
  const captions = all.filter(el => el instanceof CaptionElement);
  const others = all.filter(el => elementKind(el) !== "视频" && !(el instanceof CaptionElement));
  const length = Math.max(0, ...all.map(el => el.getEnd()));
  const open = (el: TrackElement) => { setSeekTime(el.getStart()); setSelectedItem(el); };
  const nameOf = (el: TrackElement) => (el instanceof TextElement ? el.getText() : el.getName?.()) || elementKind(el);
  const shape = size.width === size.height ? "方形" : size.width > size.height ? "横屏" : "竖屏";
  return <>
    <div>
      <h3>这条成片</h3>
      <p className="studio-advanced-hint">{clips.length} 段视频 · 共 {fmt(length)} · {shape}</p>
    </div>
    <GapNotice/>
    <section className="studio-advanced-section" aria-label="片段">
      <h4>片段</h4>
      {clips.length ? <ol className="studio-advanced-rows">{clips.map((el, i) => <li key={el.getId()}><button type="button" aria-label={`修改第 ${i + 1} 段：${nameOf(el)}`} onClick={() => open(el)}>
        <b>{i + 1}</b><span title={nameOf(el)}>{nameOf(el)}</span><em>{fmt(el.getEnd() - el.getStart())}</em><ChevronRight size={14}/></button></li>)}</ol>
        : <p>时间线上还没有视频。点击左侧「视频」添加。</p>}
      {clips.length > 0 && <small>点击一段，可以改速度、颜色、淡入淡出，或删除。</small>}
    </section>
    {others.length > 0 && <section className="studio-advanced-section" aria-label="其他内容">
      <h4>其他内容</h4>
      <ul className="studio-advanced-rows">{others.map(el => <li key={el.getId()}><button type="button" aria-label={`修改${elementKind(el)}：${nameOf(el)}`} onClick={() => open(el)}>
        <b>{elementKind(el)}</b><span title={nameOf(el)}>{nameOf(el)}</span><em>{fmt(el.getEnd() - el.getStart())}</em><ChevronRight size={14}/></button></li>)}</ul>
    </section>}
    <section className="studio-advanced-section" aria-label="字幕">
      <h4>字幕</h4>
      {captions.length > 0 ? <>
        <p>时间线上有 {captions.length} 条字幕，导出时使用这些字幕。</p>
        <Button size="small" onClick={() => open(captions[0])}>修改字幕</Button>
      </> : recognition === false ? <p>自动生成字幕暂不可用。需要字幕时，点击左侧「字幕」手动添加。</p>
        : <>
          <label className="studio-advanced-auto"><Switch size="small" aria-label="导出时自动生成字幕" checked={autoOn} onChange={v => { auto.current = v; }}/>导出时自动生成字幕</label>
          {!autoOn && <small>这次导出不带字幕。也可以点击左侧「字幕」手动添加。</small>}
        </>}
    </section>
    <section className="studio-advanced-section studio-advanced-music" aria-label="背景音乐">
      <h4>背景音乐</h4>
      <MusicField music={music} onError={onError} preview empty="未设置。可以上传一首，或点击左侧「音频」从画布中选择。"/>
      <small>导出时循环铺满全片，人物说话时自动压低。时间线预览中听不到。</small>
    </section>
    <details className="studio-advanced-section studio-advanced-guide">
      <summary>操作说明</summary>
      <ol>
        <li><strong>调整顺序：</strong>拖动时间线上的片段。</li>
        <li><strong>剪掉不要的部分：</strong>点中片段，拖动两端。需要从中间分开时，把竖线移到分开的位置，点击时间线上方的剪刀。</li>
        <li><strong>加小窗、图片、文字：</strong>使用左侧工具栏。</li>
        <li><strong>保存：</strong>编辑内容不会自动保存。点击「保存」后可以稍后继续，也可以回到成片页直接导出。</li>
        <li><strong>完成后：</strong>点击右上角「导出成片」。这条成片以高级编辑的内容为准。</li>
      </ol>
    </details>
  </>;
}

/** 右边：没选中时是这条成片，选中后是这一段能改什么（中文、不写术语）。Twick 自带的英文属性栏藏起来。 */
function Inspector({ size, music, auto, recognition, onError }: { size: Size; music: MusicControl; auto: Box<boolean>; recognition?: boolean; onError: (e: unknown) => void }) {
  const { editor, selectedItem, setSelectedItem } = useTimelineContext();
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const el = selectedItem instanceof TrackElement ? selectedItem : null;
  const change = (apply: (target: TrackElement) => void) => { if (!el) return; apply(el); editor.updateElement(el); refresh(); };
  const setProp = (key: string, value: unknown) => change(target => target.setProps({ ...target.getProps(), [key]: value }));
  const props = el?.getProps() || {};
  const isPip = el instanceof VideoElement && !!el.getMetadata()?.pip;
  const isOverlay = isPip || el instanceof ImageElement;
  const kind = el ? elementKind(el) : "";
  const placed = el instanceof VideoElement || el instanceof ImageElement ? el.getFrame() : undefined;
  const placedSize = placed?.size;
  const placedAspect = placedSize ? placedSize[0] / placedSize[1] : 16 / 9;
  const corner = placed ? `${(placed.y ?? 0) < 0 ? "t" : "b"}${(placed.x ?? 0) < 0 ? "l" : "r"}` : "tr";
  const scale = placedSize ? placedSize[0] / size.width : 0.34;
  const place = (nextCorner: [number, number], nextScale: number) => change(target => (target as VideoElement).setFrame(cornerFrame(size, placedAspect, nextCorner, nextScale)));
  const cornerOf = () => CORNERS.find(c => c.value === corner)?.corner || [1, -1] as [number, number];
  const fade = el instanceof VideoElement ? fadeState(el) : undefined;
  // 片段长度变了（拖两端、改速度），两头都淡时要按新长度算淡出的位置。
  const clipLength = el ? el.getEnd() - el.getStart() : 0;
  useEffect(() => {
    if (el instanceof VideoElement && fade?.in && fade.out) { setFades(el, true, true); editor.updateElement(el); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el?.getId(), clipLength]);
  const popup = (node: HTMLElement) => node.closest<HTMLElement>(".studio-advanced-shell") || document.body;
  return <aside className="studio-advanced-inspector" aria-label={el ? "选中内容" : "这条成片"}>
    {!el ? <CutOverview size={size} music={music} auto={auto} recognition={recognition} onError={onError}/> : <>
      <GapNotice/>
      <button type="button" className="studio-advanced-all" onClick={() => setSelectedItem(null)}><ArrowLeft size={14}/>全部片段</button>
      <h3>{kind}{el.getName?.() && el.getName() !== kind ? ` · ${el.getName()}` : ""}</h3>
      <p className="studio-advanced-hint">成片中 {fmt(el.getStart())}–{fmt(el.getEnd())}，共 {fmt(el.getEnd() - el.getStart())}</p>
      {el instanceof VideoElement && !isPip && <p className="studio-advanced-hint">剪掉不要的部分：拖动时间线上这段的两端。要从中间分开：把竖线移到分开的位置，点击时间线上方的剪刀。</p>}
      {(el instanceof VideoElement || el instanceof AudioElement) && <label className="studio-advanced-field">音量 {Math.round((Number(props.volume ?? 1)) * 100)}%
        <Slider aria-label="音量" min={0} max={100} value={Math.round(Number(props.volume ?? 1) * 100)} onChange={(v: number) => setProp("volume", v / 100)}/></label>}
      {el instanceof VideoElement && Number(props.volume ?? 1) === 0 && <p className="studio-advanced-hint">{isPip ? "小窗默认不出声，需要时可调高音量。" : "此片段原声已关闭（使用配音时默认关闭）。"}</p>}
      {el instanceof VideoElement && <label className="studio-advanced-field">播放速度
        <Select aria-label="播放速度" getPopupContainer={popup} value={el.getPlaybackRate() || 1} options={SPEEDS} onChange={(v: number) => { retimeClip(editor, el, v, isPip); refresh(); }}/></label>}
      {el instanceof VideoElement && (el.getPlaybackRate() || 1) !== 1 && <p className="studio-advanced-hint">这段的长度已随速度变化，后面的片段会跟着移动。字幕不会自动调整，需要时请拖动字幕对齐。</p>}
      {el instanceof VideoElement && !isPip && fade && <div className="studio-advanced-switches">
        <label><Switch size="small" aria-label="开头淡入" checked={fade.in} onChange={v => change(target => setFades(target, v, fade.out))}/>开头淡入</label>
        <label><Switch size="small" aria-label="结尾淡出" checked={fade.out} onChange={v => change(target => setFades(target, fade.in, v))}/>结尾淡出</label>
      </div>}
      {el instanceof VideoElement && !isPip && <label className="studio-advanced-field">画面颜色
        <Select aria-label="画面颜色" getPopupContainer={popup} value={String(props.mediaFilter || "none")} options={LOOKS} onChange={(v: string) => setProp("mediaFilter", v)}/></label>}
      {isOverlay && <>
        <div className="studio-advanced-field">显示位置
          <Radio.Group aria-label="显示位置" size="small" optionType="button" value={corner} options={CORNERS.map(c => ({ value: c.value, label: c.label }))}
            onChange={e => place(CORNERS.find(c => c.value === e.target.value)!.corner, scale)}/></div>
        <label className="studio-advanced-field">显示大小 {Math.round(scale * 100)}%
          <Slider aria-label="显示大小" min={15} max={70} value={Math.round(scale * 100)} onChange={(v: number) => place(cornerOf(), v / 100)}/></label>
      </>}
      {(el instanceof TextElement || el instanceof CaptionElement) && <label className="studio-advanced-field">{el instanceof CaptionElement ? "字幕内容" : "文字内容"}
        <Input.TextArea aria-label="文字内容" value={el.getText()} rows={3} onChange={e => change(target => (target as TextElement).setText(e.target.value))}/></label>}
      {el instanceof TextElement && <div className="studio-advanced-row">
        <label className="studio-advanced-field">字号<InputNumber aria-label="字号" min={12} max={200} value={Number(props.fontSize ?? 48)} onChange={v => v && setProp("fontSize", v)}/></label>
        <label className="studio-advanced-field">颜色<input aria-label="文字颜色" type="color" value={String(props.fill || "#ffffff")} onChange={e => setProp("fill", e.target.value)}/></label>
      </div>}
      <Button danger icon={<Trash2 size={15}/>} onClick={() => { if (isOverlay) editor.removeElement(el); else removeClosingGap(editor, el); setSelectedItem(null); }}>删除</Button>
    </>}
  </aside>;
}

export function StudioAdvancedEditor(p: Props) {
  const { message } = useStudioApp();
  const [size] = useState(() => projectSize(p.draft));
  // Twick 把时间线存在全局表里、按 contextId 取：同一页里再次打开如果用同一个 id，读到的是上次的时间线和已释放的 blob 地址，预览一直转圈。每次打开用新的。
  const [contextId] = useState(() => `studio-advanced-${p.projectId}-${Math.random().toString(36).slice(2)}`);
  const cache = useRef(new Map<string, Promise<Media>>());
  const [initial, setInitial] = useState<ProjectJSON>();
  const [loadError, setLoadError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const reload = () => { setLoadError(""); setLoadFailed(false); setInitial(undefined); setAttempt(n => n + 1); };
  // 加载屏：素材要整段取回来，大文件要等一会儿。写清进度，随时能退出，出错也不会卡在这一屏。
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [loadFailed, setLoadFailed] = useState(false);
  const [asking, setAsking] = useState(false);
  const barRef = useRef<{ project: () => ProjectJSON; canUndo: boolean } | null>(null);
  const [busy, setBusy] = useState(false);
  const [musicNow] = useState(() => box<MusicPick | undefined>(p.music?.metadata?.storageKey ? { key: p.music.metadata.storageKey, name: p.music.title || "背景音乐", content: p.music.metadata.content } : undefined));
  const latest = useRef(p);
  latest.current = p;
  const music = useMemo<MusicControl>(() => ({
    value: musicNow,
    set: next => { musicNow.current = next; latest.current.onMusicChange(next?.key); },
    upload: latest.current.onUploadMusic && (file => latest.current.onUploadMusic!(file)),
  }), [musicNow]);
  const resolve = (node: CanvasNodeData) => {
    const key = node.metadata?.storageKey || "";
    let pending = cache.current.get(key);
    if (!pending) {
      pending = loadMedia(node).then(m => { if (!m) throw new Error("素材无法添加"); return m; });
      pending.catch(() => cache.current.delete(key));
      cache.current.set(key, pending);
    }
    return pending;
  };

  useEffect(() => {
    const own = cache.current;
    // 关掉时释放 blob；连还在取的也挂上释放。清空缓存，下次打开重新取（开发模式会挂载两次，旧地址不能留着）。
    // Twick 取缩略图时往 <body> 上挂屏幕外的 <video>，卸载时不收；用的是我们的 blob，一并移走，
    // 否则每开关一次就多留几个，blob 释放后还会反复报加载失败。
    const release = (m: Media) => {
      for (const el of document.querySelectorAll<HTMLMediaElement>("body > video, body > audio")) {
        if (el.src === m.url) { el.removeAttribute("src"); el.load(); el.remove(); }
      }
      URL.revokeObjectURL(m.url);
    };
    return () => { for (const pending of own.values()) void pending.then(release, () => undefined); own.clear(); };
  }, []);
  useEffect(() => {
    let alive = true;
    // 打开时只取时间线要用的：第一次是勾选的片段和配音，之后是存档里引用的 key（可能已经不在画布上了，按 key 照样取）。
    const byKey = new Map<string, CanvasNodeData>();
    if (p.draft.advanced) {
      const nodes = new Map([...p.library, ...p.clips].flatMap(n => n.metadata?.storageKey ? [[n.metadata.storageKey, n] as const] : []));
      for (const track of p.draft.advanced.project.tracks as ProjectJSON["tracks"]) for (const el of track.elements) {
        const key = el.metadata?.storageKey ? String(el.metadata.storageKey) : "";
        if (key && !byKey.has(key)) byKey.set(key, nodes.get(key) || { id: key, type: el.type === "audio" ? CanvasNodeType.Audio : el.type === "image" ? CanvasNodeType.Image : CanvasNodeType.Video, title: el.name || "素材", position: { x: 0, y: 0 }, width: 0, height: 0, metadata: { storageKey: key } } as CanvasNodeData);
      }
    } else for (const n of [...p.clips, ...(p.voice ? [p.voice] : [])]) if (n.metadata?.storageKey) byKey.set(n.metadata.storageKey, n);
    setProgress({ done: 0, total: byKey.size });
    void Promise.all([...byKey.values()].map(n => resolve(n).catch(() => undefined).finally(() => { if (alive) setProgress(now => ({ ...now, done: now.done + 1 })); }))).then(async list => {
      const loaded = list.filter((m): m is Media => !!m);
      const skipped: string[] = [];
      const project = p.draft.advanced ? toLiveProject(p.draft.advanced.project, new Map(loaded.map(m => [m.key, m.url])))
        : await seedProject(p.clips.flatMap(c => loaded.filter(m => m.key === c.metadata?.storageKey)),
          p.voice ? loaded.find(m => m.key === p.voice?.metadata?.storageKey) : undefined, p.draft, size, p.seedCaptions, name => skipped.push(name));
      if (!alive) return;
      const missing = byKey.size - loaded.length + skipped.length;
      setLoadError(missing ? `有 ${missing} 个素材没有加载出来，时间线上暂时缺少它们。为了不丢失剪辑，现在不能保存和导出，请重新加载。` : "");
      setInitial(project);
    }).catch(() => { if (alive) setLoadFailed(true); });
    return () => { alive = false; };
    // 只在打开时取一次（和点「重新加载」时）：编辑过程中存档变化不该让编辑器重载。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // 「导出时自动生成字幕」的开关跟着工程存：用户在这里关掉后，删光字幕也不会被自动加回来。
  const [autoCaptions] = useState(() => box(p.draft.advanced?.autoCaptions ?? studioCaptionMode(p.draft, p.captionRecognition) === "auto"));
  const autoAtOpen = useRef(autoCaptions.current);
  const savedProject = useRef<string | undefined>(undefined);
  // 背景音乐以成片设置为准，换了（比如在成片页上传）这里跟着变。
  const musicKey = p.music?.metadata?.storageKey, musicTitle = p.music?.title, musicContent = p.music?.metadata?.content;
  useEffect(() => {
    if (musicKey && musicNow.current?.key !== musicKey) musicNow.current = { key: musicKey, name: musicTitle || "背景音乐", content: musicContent };
  }, [musicKey, musicTitle, musicContent, musicNow]);
  // 比导出清单，不比工程本身：点选片段时 Twick 会往工程里补位置信息，内容其实没变。
  const contentOf = (project: ProjectJSON) => JSON.stringify(toEditTimeline(project, size));
  const unsaved = (project: ProjectJSON) => contentOf(project) !== savedProject.current;
  const markClean = (project: ProjectJSON) => { savedProject.current = contentOf(project); };
  // 保存过之后，「原样」指保存的那一版：全部撤销回打开时的样子，也算和存档不一样。
  const hasSaved = useRef(false);
  // Twick 工具条的提示是英文写死的，这里换成中文（不改它的代码，升级时不用重打补丁）。
  useEffect(() => {
    const shell = document.querySelector(".studio-advanced-shell");
    if (!shell) return;
    const translate = () => {
      for (const el of shell.querySelectorAll<HTMLElement>("[title], [aria-label]")) {
        for (const attribute of ["title", "aria-label"]) {
          const zh = TWICK_LABELS[el.getAttribute(attribute) || ""];
          if (zh) el.setAttribute(attribute, zh);
        }
      }
    };
    translate();
    const observer = new MutationObserver(translate);
    observer.observe(shell, { subtree: true, childList: true, attributes: true, attributeFilter: ["title", "aria-label"] });
    return () => observer.disconnect();
  }, [initial]);

  const edit = (project: ProjectJSON): StudioAdvancedEdit => ({ engine: "twick", savedAt: new Date().toISOString(), project: toStoredProject(project), size, autoCaptions: autoCaptions.current });

  // 打开时整条片子都看得见：Twick 默认 1.5 倍，14 秒的片子有 2100 像素宽，一屏只看得到第一段。
  const fitZoom = useMemo(() => {
    const length = Math.max(1, ...(initial?.tracks ?? []).flatMap(t => t.elements.map(el => Number(el.e) || 0)));
    // 减掉左侧工具和素材栏、右侧成片设置、轨道标题的宽度。
    const room = typeof window === "undefined" ? 700 : Math.max(280, window.innerWidth - 700);
    return Math.max(0.1, Math.min(1.5, Math.floor(room / (length * 100) * 10) / 10));
  }, [initial]);
  const studioConfig: StudioConfig = useMemo(() => ({
    videoProps: size, hiddenTools: HIDDEN_TOOLS, timelineZoomConfig: { min: 0.1, max: 3, step: 0.1, default: fitZoom },
    media: { seed: "none", namespace: `studio-advanced:${p.projectId}` },
    customTools: TOOLS,
    // 选中时间线上的元素时 Twick 会切到同名工具（video / audio / text / caption），这些也指向我们的面板。
    customPanels: (() => {
      const video = mediaPanel("video", p.library, resolve, size, e => message.error(e)), audio = mediaPanel("audio", p.library, resolve, size, e => message.error(e), music), image = mediaPanel("image", p.library, resolve, size, e => message.error(e));
      const text = textPanel(size), caption = captionPanel(size, autoCaptions, p.captionRecognition);
      return { "cn-video": video, video, "cn-audio": audio, audio, "cn-image": image, image, "cn-text": text, text, "cn-caption": caption, caption };
    })(),
    // resolve 只读 ref；library 变化（画布上新增素材）时重建面板。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [p.library, size, p.projectId, fitZoom]);

  const save = async (project: ProjectJSON) => { await p.onSave(edit(project)); markClean(project); hasSaved.current = true; autoAtOpen.current = autoCaptions.current; };
  // 只是打开看一眼（或点选片段）不算改过：不存档，第 1 至第 5 步的设置和「导出成片」按钮都还在。
  // 素材没加载齐时时间线缺东西，不能当成改动存下去。
  const changed = (project: ProjectJSON, touched: boolean) => !loadError && (((touched || hasSaved.current) && unsaved(project)) || autoCaptions.current !== autoAtOpen.current);
  // 编辑室盖满全屏，点浏览器后退时人会以为是退出编辑室：先拦下来，改过就问一声。加载时也算，直接退出。
  const leaving = useRef({ changed, close: p.onClose });
  leaving.current = { changed, close: p.onClose };
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    const mark = () => window.history.pushState({ ...window.history.state, studioAdvanced: true }, "");
    if (!window.history.state?.studioAdvanced) mark();
    const onPop = () => {
      const bar = barRef.current;
      if (bar && leaving.current.changed(bar.project(), bar.canUndo)) { mark(); setAsking(true); } else leaving.current.close();
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      mounted.current = false;
      // 开发模式会卸载再挂载一次，等一拍确认真的关了，再把多出来的历史记录退掉。
      window.setTimeout(() => { if (!mounted.current && window.history.state?.studioAdvanced) window.history.back(); }, 0);
    };
  }, []);

  const saveAndLeave = async (project: ProjectJSON) => {
    setBusy(true);
    try { await save(project); p.onClose(); } catch (e) { message.error(e); } finally { setBusy(false); }
  };

  const exportCut = async (project: ProjectJSON) => {
    if (busy) return;
    const timeline = toEditTimeline(project, size, { autoCaptions: autoCaptions.current, musicStorageKey: musicNow.current?.key });
    if (!timeline.clips.length) { message.error("时间线中至少需要一段视频"); return; }
    setBusy(true);
    try {
      if (await p.onExport(timeline, edit(project))) { message.success("已开始导出，完成后显示在「已导出的成片」中"); p.onClose(); }
    } finally { setBusy(false); }
  };

  if (!initial) return <div className="studio-advanced-shell studio-advanced-loading" role={loadFailed ? "alert" : "status"}>
    {loadFailed ? <p>素材没有加载出来，请返回后重试。</p>
      : <p>正在加载素材{progress.total ? `（已加载 ${progress.done}/${progress.total}）` : "…"}</p>}
    <div className="studio-advanced-loading-actions">
      {loadFailed && <Button onClick={reload}>重新加载</Button>}
      <Button onClick={p.onClose}>返回</Button>
    </div>
  </div>;
  return <div className="studio-advanced-shell twick-scope" role="dialog" aria-modal="true" aria-label="高级编辑" tabIndex={-1} ref={el => { if (el && !el.contains(document.activeElement)) el.focus({ preventScroll: true }); }}>
    <LivePlayerProvider>
      <TimelineProvider key={attempt} contextId={`${contextId}-${attempt}`} resolution={size} initialData={initial} analytics={{ enabled: false }}>
        <StopAtEnd/>
        <EditorBar title={p.title} busy={busy} locked={!!loadError} barRef={barRef} asking={asking} setAsking={setAsking} unsaved={unsaved} onClean={project => { if (!hasSaved.current) markClean(project); }} onNothingToSave={() => message.info("没有需要保存的修改")}
          onSave={project => void save(project).then(() => message.success("已保存"), e => message.error(e))}
          onExport={project => void exportCut(project)}
          onChanged={changed} onLeave={p.onClose} onSaveAndLeave={project => void saveAndLeave(project)}/>
        {loadError && <p className="studio-advanced-warning" role="alert">{loadError}<Button size="small" onClick={reload}>重新加载</Button></p>}
        <div className="studio-advanced-body"><div className="studio-advanced-studio"><TwickStudio studioConfig={studioConfig}/></div><Inspector size={size} music={music} auto={autoCaptions} recognition={p.captionRecognition} onError={e => message.error(e)}/></div>
      </TimelineProvider>
    </LivePlayerProvider>
  </div>;
}

