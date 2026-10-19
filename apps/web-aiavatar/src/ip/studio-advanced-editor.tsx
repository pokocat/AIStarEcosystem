"use client";
// 成片高级编辑（2026-10-19）：在 Twick 的编辑器里做基础剪辑（排顺序、掐头去尾、切开、文字、字幕、两条音轨）。
// Twick 只管编辑和预览；导出时把工程转成「片段 / 音频 / 文字 / 字幕 + 起止时间」的清单（toEditTimeline），
// 走普通的成片合成任务交给服务端 FFmpeg 合成，结果和一键成片一样出现在「合成好的作品」里。
// 素材一律先用带登录的同源接口取成 Blob 再交给 Twick：线上 OSS 没配 CORS，而 Twick 播放时设了 crossOrigin。
import "@/styles/twick-scoped.css";
import { useEffect, useMemo, useReducer, useRef, useState, type ComponentType } from "react";
import { Button, Input, InputNumber, Slider } from "antd";
import { ArrowLeft, Download, Save, Trash2 } from "lucide-react";
import {
  AudioElement, CAPTION_PROPS, CaptionElement, LivePlayerProvider, TextElement, TimelineProvider, Track, TrackElement, TwickStudio, VideoElement,
  useTimelineContext, type PanelProps, type ProjectJSON, type StudioConfig,
} from "@twick/studio";
import { useLivePlayerContext } from "@twick/live-player";
import { CAPTION_STYLE, ElementAdder, TRACK_TYPES } from "@twick/timeline";
import type { StudioAdvancedEdit, StudioEditTimeline, StudioWorkDraft } from "@ai-star-eco/types/ip-studio-workflow";
import { toEditTimeline, toLiveProject, toStoredProject } from "@/canvas-bridge/studio-edit-timeline";
import { CanvasNodeType, type CanvasNodeData } from "@/canvas/types/canvas";
import { SignedVideo } from "@/canvas-bridge/signed-video";
import { parseStudioCaptions } from "@/canvas-bridge/studio-packaging";
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
  draft: StudioWorkDraft;
  title: string;
  onSave: (edit: StudioAdvancedEdit) => void;
  /** 存档并提交合成任务；返回 true 表示已提交（编辑器随即关闭，回到成片页看进度）。 */
  onExport: (timeline: StudioEditTimeline, edit: StudioAdvancedEdit) => Promise<boolean>;
  onClose: () => void;
};
type Media = { key: string; url: string; name: string; type: "video" | "audio"; seconds?: number };

const SIZES: Record<string, { width: number; height: number }> = { "16:9": { width: 1280, height: 720 }, "9:16": { width: 720, height: 1280 } };
// Twick 自带的工具和面板都是英文、功能也多；全部藏起来，换成我们自己的四个中文面板（只留基础剪辑）。
const HIDDEN_TOOLS = ["video", "image", "audio", "text", "emoji", "text-style", "effect", "shape", "caption", "generate-media", "templates", "record", "chapters", "script"];
const TOOLS = [
  { id: "cn-video", name: "视频", icon: "Video", description: "画布里的视频" },
  { id: "cn-audio", name: "音频", icon: "Audio", description: "画布里的配音和音乐" },
  { id: "cn-text", name: "文字", icon: "Type", description: "加一段文字" },
  { id: "cn-caption", name: "字幕", icon: "MessageSquare", description: "加一条字幕" },
];
const fmt = (s: number) => `${Math.round(s * 10) / 10} 秒`;
/** 字幕轨的样式：半透明底的整句字幕，放在画面中线往下约 30% 高度处（和一键合成烧的字幕位置差不多）。 */
const captionTrackProps = (size: { width: number; height: number }) =>
  ({ capStyle: CAPTION_STYLE.SOFT_BOX, ...CAPTION_PROPS[CAPTION_STYLE.SOFT_BOX], x: 0, y: Math.round(size.height * 0.3) });

async function loadMedia(node: CanvasNodeData): Promise<Media | undefined> {
  const key = node.metadata?.storageKey;
  if (!key) return undefined;
  // 演示数据没有后端，素材本来就在本站；线上一律走同源接口（带登录、查归属）。
  const blob = USE_MOCK && node.metadata?.content
    ? await fetch(node.metadata.content).then(r => { if (!r.ok) throw new Error(`素材读取失败 ${r.status}`); return r.blob(); })
    : await fetchAssetBlob(key);
  return { key, url: URL.createObjectURL(blob), name: node.title || "素材", type: node.type === CanvasNodeType.Audio ? "audio" : "video", seconds: studioMediaSeconds(node) };
}

/**
 * 第一次打开：按一键成片的设置搭好时间线（顺序片段、配音、品牌文字、字幕）。
 * 在时间线挂载之前就算好整份工程交给它，不在挂载后再往里加（开发模式下挂载两次会把后加的冲掉）。
 */
async function seedProject(clips: Media[], voice: Media | undefined, draft: StudioWorkDraft, size: { width: number; height: number }, onSkip: (name: string) => void): Promise<ProjectJSON> {
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
    let captions: ReturnType<typeof parseStudioCaptions> = [];
    try { captions = parseStudioCaptions(draft.captionText); } catch { /* 一键成片里写错的字幕不带过来 */ }
    if (captions.length) {
      const track = new Track("字幕", TRACK_TYPES.CAPTION);
      track.setProps(captionTrackProps(size));
      for (const c of captions) if (c.start < at) await new CaptionElement(c.text, c.start, Math.min(c.end, at)).accept(new ElementAdder(track));
      tracks.push(track);
    }
  }
  return { tracks: tracks.filter(t => t.serialize().elements.length).map(t => t.serialize()), version: 1 };
}

/** 顶栏（我们自己的，中文）：返回、保存、导出成片。Twick 自带的英文顶栏藏起来。 */
function EditorBar({ title, size, busy, onSave, onExport, onClose }: {
  title: string; size: { width: number; height: number }; busy: boolean;
  onSave: (project: ProjectJSON) => void; onExport: (project: ProjectJSON) => void; onClose: (project: ProjectJSON) => void;
}) {
  const { editor } = useTimelineContext();
  const project = () => editor.getProject();
  return <header className="studio-advanced-bar">
    <button type="button" className="studio-advanced-back" disabled={busy} onClick={() => onClose(project())}><ArrowLeft size={16}/>返回成片编辑</button>
    <strong title={title}>{title}</strong>
    <span className="studio-advanced-size">{size.width}×{size.height}</span>
    <div>
      {busy && <span className="studio-advanced-progress" role="status">正在提交合成…</span>}
      <Button icon={<Save size={15}/>} disabled={busy} onClick={() => onSave(project())}>保存</Button>
      <Button type="primary" icon={<Download size={15}/>} loading={busy} onClick={() => onExport(project())}>导出成片</Button>
    </div>
  </header>;
}

/** 从播放头位置放进一条新轨道（字幕放进字幕轨），选中它。 */
function useAddToTimeline(size: { width: number; height: number }) {
  const { editor, setSelectedItem } = useTimelineContext();
  const { getCurrentTime } = useLivePlayerContext();
  return async (el: TrackElement, length: number, trackName: string, trackType: string) => {
    const at = Math.max(0, getCurrentTime?.() ?? 0);
    el.setStart(at); el.setEnd(at + length);
    let track = trackType === TRACK_TYPES.CAPTION ? editor.getCaptionsTrack() : null;
    if (!track) {
      track = editor.addTrack(trackName, trackType);
      if (trackType === TRACK_TYPES.CAPTION) track.setProps(captionTrackProps(size));
    }
    await editor.addElementToTrack(track, el);
    setSelectedItem(el);
  };
}

/** 素材栏：只列画布上已经有的视频 / 音频，点一下才去取。不提供网址添加和本地上传（那些不会被保存）。 */
function mediaPanel(kind: "video" | "audio", nodes: CanvasNodeData[], resolve: (node: CanvasNodeData) => Promise<Media>, size: { width: number; height: number }, onError: (e: unknown) => void): ComponentType<PanelProps> {
  return function MediaPanel() {
    const add = useAddToTimeline(size);
    const [adding, setAdding] = useState<string>();
    const items = nodes.filter(n => (n.type === CanvasNodeType.Audio) === (kind === "audio"));
    const put = async (node: CanvasNodeData) => {
      if (adding) return;
      setAdding(node.id);
      try {
        const m = await resolve(node);
        const el = kind === "video" ? new VideoElement(m.url, size) : new AudioElement(m.url);
        if (el instanceof VideoElement) await el.updateVideoMeta(); else await el.updateAudioMeta();
        el.setName(m.name); el.setMetadata({ storageKey: m.key, mediaDuration: el.getMediaDuration() || undefined });
        await add(el, el.getMediaDuration() || m.seconds || 5, kind === "video" ? "视频" : "音频", kind === "video" ? TRACK_TYPES.VIDEO : TRACK_TYPES.AUDIO);
      } catch (e) { onError(e); } finally { setAdding(undefined); }
    };
    return <div className="panel-container studio-advanced-panel">
      <div className="panel-title">{kind === "video" ? "画布里的视频" : "画布里的音频"}</div>
      {!items.length ? <p className="studio-advanced-hint">{kind === "video" ? "画布上还没有视频" : "画布上还没有配音或音乐，先在画布上做一条配音"}</p>
        : <ul className="studio-advanced-media">{items.map(n => <li key={n.id}><button type="button" disabled={!!adding} onClick={() => void put(n)} title="从播放头位置加到时间线">
          {kind === "video" ? <SignedVideo src={n.metadata?.content} storageKey={n.metadata?.storageKey} muted playsInline preload="metadata"/> : <span className="studio-advanced-audio-icon">♪</span>}
          <span>{adding === n.id ? "正在添加…" : n.title || "素材"}</span></button></li>)}</ul>}
      <p className="studio-advanced-hint">点一下从播放头位置加到时间线，再拖动位置、拖两边调长短。</p>
    </div>;
  };
}

function textPanel(size: { width: number; height: number }): ComponentType<PanelProps> { return function TextPanel() {
  const add = useAddToTimeline(size);
  const [text, setText] = useState("");
  return <div className="panel-container studio-advanced-panel">
    <div className="panel-title">加文字</div>
    <Input.TextArea aria-label="要加的文字" value={text} onChange={e => setText(e.target.value)} rows={3} maxLength={120} placeholder="比如：限时优惠"/>
    <Button type="primary" disabled={!text.trim()} onClick={() => { void add(new TextElement(text.trim(), { fontSize: 48, fill: "#FFFFFF", fontWeight: 700 }), 3, "文字", TRACK_TYPES.ELEMENT); setText(""); }}>加到画面</Button>
    <p className="studio-advanced-hint">从播放头位置开始显示 3 秒。在画面上拖动文字换位置，在右边改字号和颜色。</p>
  </div>;
}; }

function captionPanel(size: { width: number; height: number }): ComponentType<PanelProps> { return function CaptionPanel() {
  const add = useAddToTimeline(size);
  const [text, setText] = useState("");
  return <div className="panel-container studio-advanced-panel">
    <div className="panel-title">加字幕</div>
    <Input.TextArea aria-label="要加的字幕" value={text} onChange={e => setText(e.target.value)} rows={2} maxLength={80} placeholder="这一句要说的话"/>
    <Button type="primary" disabled={!text.trim()} onClick={() => { void add(new CaptionElement(text.trim(), 0, 3), 3, "字幕", TRACK_TYPES.CAPTION); setText(""); }}>加一条字幕</Button>
    <p className="studio-advanced-hint">从播放头位置开始显示 3 秒，拖两边调时长。字幕都放在同一条字幕轨上。</p>
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

/** 右边：选中的东西能改什么（中文、只留基础）。Twick 自带的英文属性栏藏起来。 */
function Inspector() {
  const { editor, selectedItem, setSelectedItem } = useTimelineContext();
  const [, refresh] = useReducer((n: number) => n + 1, 0);
  const el = selectedItem instanceof TrackElement ? selectedItem : null;
  const change = (apply: (target: TrackElement) => void) => { if (!el) return; apply(el); editor.updateElement(el); refresh(); };
  const setProp = (key: string, value: unknown) => change(target => target.setProps({ ...target.getProps(), [key]: value }));
  const props = el?.getProps() || {};
  const kind = el instanceof VideoElement ? "视频" : el instanceof AudioElement ? "音频" : el instanceof CaptionElement ? "字幕" : el instanceof TextElement ? "文字" : el ? "素材" : "";
  return <aside className="studio-advanced-inspector" aria-label="选中内容">
    {!el ? <div className="studio-advanced-guide">
      <h3>怎么剪</h3>
      <ul>
        <li>拖动时间线上的片段换位置。</li>
        <li>拖片段的两边掐头去尾。</li>
        <li>把播放头放到要切的地方，点时间线上方的剪刀切开。</li>
        <li>选中后点这里的「删除」，后面的片段会自动补上来。</li>
        <li>左边加配音、文字和字幕，选中后在这里改。</li>
      </ul>
    </div> : <>
      <h3>{kind}{el.getName?.() && el.getName() !== kind ? ` · ${el.getName()}` : ""}</h3>
      <p className="studio-advanced-hint">在成片里 {fmt(el.getStart())} – {fmt(el.getEnd())}，共 {fmt(el.getEnd() - el.getStart())}</p>
      {(el instanceof VideoElement || el instanceof AudioElement) && <label className="studio-advanced-field">音量 {Math.round((Number(props.volume ?? 1)) * 100)}%
        <Slider aria-label="音量" min={0} max={100} value={Math.round(Number(props.volume ?? 1) * 100)} onChange={(v: number) => setProp("volume", v / 100)}/></label>}
      {el instanceof VideoElement && Number(props.volume ?? 1) === 0 && <p className="studio-advanced-hint">这段的原声关掉了（选了配音时默认关掉）。</p>}
      {(el instanceof TextElement || el instanceof CaptionElement) && <label className="studio-advanced-field">{el instanceof CaptionElement ? "字幕内容" : "文字内容"}
        <Input.TextArea aria-label="文字内容" value={el.getText()} rows={3} onChange={e => change(target => (target as TextElement).setText(e.target.value))}/></label>}
      {el instanceof TextElement && <div className="studio-advanced-row">
        <label className="studio-advanced-field">字号<InputNumber aria-label="字号" min={12} max={200} value={Number(props.fontSize ?? 48)} onChange={v => v && setProp("fontSize", v)}/></label>
        <label className="studio-advanced-field">颜色<input aria-label="文字颜色" type="color" value={String(props.fill || "#ffffff")} onChange={e => setProp("fill", e.target.value)}/></label>
      </div>}
      <Button danger icon={<Trash2 size={15}/>} onClick={() => { removeClosingGap(editor, el); setSelectedItem(null); }}>删除</Button>
    </>}
  </aside>;
}

export function StudioAdvancedEditor(p: Props) {
  const { message } = useStudioApp();
  const size = SIZES[p.draft.aspectRatio] || SIZES["9:16"];
  const cache = useRef(new Map<string, Promise<Media>>());
  const [initial, setInitial] = useState<ProjectJSON>();
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const resolve = (node: CanvasNodeData) => {
    const key = node.metadata?.storageKey || "";
    let pending = cache.current.get(key);
    if (!pending) {
      pending = loadMedia(node).then(m => { if (!m) throw new Error("素材没有存储位置，加不进来"); return m; });
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
        if (key && !byKey.has(key)) byKey.set(key, nodes.get(key) || { id: key, type: el.type === "audio" ? CanvasNodeType.Audio : CanvasNodeType.Video, title: el.name || "素材", position: { x: 0, y: 0 }, width: 0, height: 0, metadata: { storageKey: key } } as CanvasNodeData);
      }
    } else for (const n of [...p.clips, ...(p.voice ? [p.voice] : [])]) if (n.metadata?.storageKey) byKey.set(n.metadata.storageKey, n);
    void Promise.all([...byKey.values()].map(n => resolve(n).catch(() => undefined))).then(async list => {
      const loaded = list.filter((m): m is Media => !!m);
      const skipped: string[] = [];
      const project = p.draft.advanced ? toLiveProject(p.draft.advanced.project, new Map(loaded.map(m => [m.key, m.url])))
        : await seedProject(p.clips.flatMap(c => loaded.filter(m => m.key === c.metadata?.storageKey)),
          p.voice ? loaded.find(m => m.key === p.voice?.metadata?.storageKey) : undefined, p.draft, size, name => skipped.push(name));
      if (!alive) return;
      if (loaded.length < byKey.size) setLoadError(`有 ${byKey.size - loaded.length} 个素材没取到，已从时间线去掉`);
      else if (skipped.length) setLoadError(`「${skipped.join("」「")}」读不出来，没有放进时间线`);
      setInitial(project);
    });
    return () => { alive = false; };
    // 只在打开时取一次：编辑过程中存档变化不该让编辑器重载。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const edit = (project: ProjectJSON): StudioAdvancedEdit => ({ engine: "twick", savedAt: new Date().toISOString(), project: toStoredProject(project) });

  const studioConfig: StudioConfig = useMemo(() => ({
    videoProps: size, hiddenTools: HIDDEN_TOOLS,
    media: { seed: "none", namespace: `studio-advanced:${p.projectId}` },
    customTools: TOOLS,
    // 选中时间线上的元素时 Twick 会切到同名工具（video / audio / text / caption），这些也指向我们的面板。
    customPanels: (() => {
      const video = mediaPanel("video", p.library, resolve, size, e => message.error(e)), audio = mediaPanel("audio", p.library, resolve, size, e => message.error(e));
      const text = textPanel(size), caption = captionPanel(size);
      return { "cn-video": video, video, "cn-audio": audio, audio, "cn-text": text, text, "cn-caption": caption, caption };
    })(),
    // resolve 只读 ref；library 变化（画布上新增素材）时重建面板。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [p.library, size, p.projectId]);

  const exportCut = async (project: ProjectJSON) => {
    if (busy) return;
    const timeline = toEditTimeline(project, size);
    if (!timeline.clips.length) { message.error("时间线上至少要有一段视频"); return; }
    setBusy(true);
    try {
      if (await p.onExport(timeline, edit(project))) { message.success("已开始合成，完成后出现在「合成好的作品」里"); p.onClose(); }
    } finally { setBusy(false); }
  };

  if (!initial) return <div className="studio-advanced-shell studio-advanced-loading" role="status">正在载入素材…</div>;
  return <div className="studio-advanced-shell twick-scope">
    <LivePlayerProvider>
      <TimelineProvider contextId={`studio-advanced-${p.projectId}`} resolution={size} initialData={initial} analytics={{ enabled: false }}>
        <EditorBar title={p.title} size={size} busy={busy}
          onSave={project => { p.onSave(edit(project)); message.success("已保存"); }}
          onExport={project => void exportCut(project)}
          onClose={project => { p.onSave(edit(project)); p.onClose(); }}/>
        {loadError && <p className="studio-advanced-warning" role="alert">{loadError}</p>}
        <div className="studio-advanced-body"><div className="studio-advanced-studio"><TwickStudio studioConfig={studioConfig}/></div><Inspector/></div>
      </TimelineProvider>
    </LivePlayerProvider>
  </div>;
}

