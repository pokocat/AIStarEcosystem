"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ChevronDown, Clapperboard, ImagePlus, Languages, Loader2, Mic, Plus, Upload, UserRound, Video, X } from "lucide-react";
import type { IpProject, StudioMediaImportResult } from "@ai-star-eco/types";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { HubTabBar } from "@/components/hub/ui";
import { importStudioMedia } from "@/canvas-bridge/studio-api";
import { attachmentNode } from "@/canvas-bridge/studio-attachments";
import { CanvasNodeType, type CanvasNodeData } from "@/canvas/types/canvas";
import { useStudioFailure } from "../studio-errors";
import { useStudioList } from "../studio-gallery";
import { studioEntryHref } from "../studio-entry";
import { VIDEO_DRAFT_SUFFIX, composeVideoBrief, videoScene, videoSceneGroups, videoScenes, type VideoScene } from "./scene-catalog";
import { createSceneDraft, listSceneDrafts, saveDraftDoc } from "./scene-drafts";
import { SceneExample, SceneList, SceneRecent, SceneThumb } from "./scene-layout";

const loadDrafts = () => listSceneDrafts(VIDEO_DRAFT_SUFFIX);
type Media = StudioMediaImportResult & { title: string };
type Slot = "image" | "character" | "voice" | "video";
const DEFAULT_SCENE = videoScenes[0];

function writeQuery(scene: string) { window.history.replaceState(window.history.state, "", `/video?scene=${encodeURIComponent(scene)}`); }

/**
 * 「AI 视频」（照参考站登录后的样子）：放素材、写一句要求（可以不写），交给创作助手。
 * 我们把它按场景拼成一段话，在画布里由助手先写分镜、报价，用户确认后才生成。本页不扣积分。
 */
export function SceneVideoStudio() {
  const router = useRouter();
  const auth = useRequireAuth();
  const ready = auth === "ok";
  const showFailure = useStudioFailure();
  const drafts = useStudioList(loadDrafts, ready);
  const [scene, setScene] = useState<VideoScene>(DEFAULT_SCENE);
  const [text, setText] = useState("");
  const [duration, setDuration] = useState(DEFAULT_SCENE.duration);
  const [ratio, setRatio] = useState<string>(DEFAULT_SCENE.ratio);
  const [images, setImages] = useState<Media[]>([]);
  const [character, setCharacter] = useState<Media>();
  const [voice, setVoice] = useState<Media>();
  const [video, setVideo] = useState<Media>();
  const [uploading, setUploading] = useState<Slot>();
  const [showBrief, setShowBrief] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const draft = useRef<IpProject>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  const target = useRef<Slot>("image");

  const pickScene = useCallback((next: VideoScene) => {
    setScene(next); setDuration(next.duration); setRatio(next.ratio);
    setImages(old => old.slice(0, next.images.max));
    if (!next.video) setVideo(undefined);
    writeQuery(next.id);
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("scene");
    pickScene(videoScene(id) || DEFAULT_SCENE);
  }, [pickScene]);

  const ensureDraft = async () => {
    if (!draft.current) {
      const subject = text.trim().split(/[，。,.\n]/)[0].slice(0, 14);
      draft.current = await createSceneDraft(subject ? `${scene.title} · ${subject}` : scene.title, VIDEO_DRAFT_SUFFIX);
    }
    return draft.current;
  };

  const upload = async (kind: Slot, file: File) => {
    const type = kind === "voice" ? "audio" : kind === "video" ? "video" : "image";
    const wrong = type === "image" && !/\.(jpe?g|png)$/i.test(file.name) ? "请选择 JPG 或 PNG 图片"
      : type === "video" && !/\.mp4$/i.test(file.name) ? "参考视频请用 MP4 格式"
      : type === "audio" && !/\.(mp3|wav|m4a)$/i.test(file.name) ? "声音请用 MP3、WAV 或 M4A" : "";
    if (wrong) { showFailure({ action: "上传素材", error: new Error(wrong) }); return; }
    setUploading(kind);
    try {
      const project = await ensureDraft();
      const result = await importStudioMedia(project.id, file, type);
      if (kind === "image") setImages(old => [...old, { ...result, title: `${scene.images.label} ${old.length + 1}` }].slice(0, scene.images.max));
      if (kind === "character") setCharacter({ ...result, title: "出镜人物" });
      if (kind === "voice") setVoice({ ...result, title: "声音样本" });
      if (kind === "video") setVideo({ ...result, title: "参考视频" });
    } catch (e) { showFailure({ action: "上传素材", error: e, next: "检查一下文件格式和大小，再试一次。" }); }
    finally { setUploading(undefined); }
  };

  const brief = useMemo(() => composeVideoBrief(scene, { text, duration, ratio,
    imageTitles: images.map(i => i.title), characterTitle: character?.title, voiceTitle: voice?.title, videoTitle: video?.title }),
  [scene, text, duration, ratio, images, character, voice, video]);

  // 不能发的原因就写在发送键旁边。
  const blocker = scene.video?.required && !video ? `先放${scene.video.label}`
    : scene.images.required && !images.length ? `先放${scene.images.label}`
    : scene.textRequired && !text.trim() ? "先写一句要求" : "";

  const send = async () => {
    if (sending || blocker || uploading) return;
    setSending(true);
    try {
      const project = await ensureDraft();
      let nodes = project.doc.nodes as CanvasNodeData[];
      const place = (media: Media, kind: "image" | "video" | "audio", index: number) => {
        const node = attachmentNode(kind === "image" ? { kind, dataUrl: media.url, storageKey: media.key, title: media.title }
          : { kind, url: media.url, storageKey: media.key, title: media.title, width: media.width, height: media.height, mimeType: media.mimeType }, nodes);
        const placed: CanvasNodeData = { ...node, position: { x: 100 + (index % 3) * 400, y: 120 + Math.floor(index / 3) * 380 },
          metadata: { ...node.metadata, origin: "upload", mimeType: media.mimeType, bytes: media.bytes, naturalWidth: media.width, naturalHeight: media.height,
            durationMs: media.durationSec ? Math.round(media.durationSec * 1000) : undefined } };
        if (!nodes.some(n => n.id === placed.id)) nodes = [...nodes, placed];
      };
      [video && [video, "video"] as const, ...images.map(i => [i, "image"] as const), character && [character, "image"] as const, voice && [voice, "audio"] as const]
        .filter((m): m is readonly [Media, "image" | "video" | "audio"] => !!m).forEach(([m, kind], i) => place(m, kind, i));
      // 和首页「说一句话开始」同一种起点：这段话存成助手的第一句，画布打开后自动发出。
      const start = { id: `${project.id}-brief`, type: CanvasNodeType.Text, title: "创作想法", position: { x: 100, y: 120 }, width: 480, height: 260,
        metadata: { content: brief, prompt: brief, studioStart: "assistant" as const, studioSkill: scene.video ? "reference-video-recreation" : "video-generation", studio: { kind: "assistant" as const, conversation: { mode: "general" as const, turns: [] } } } };
      const conversations = [...(project.doc.assistantConversations || []).filter(n => n.id !== start.id), start];
      draft.current = await saveDraftDoc(project, { ...project.doc, nodes, assistantConversations: conversations });
      router.push(studioEntryHref(project.id, "assistant", { send: true }));
    } catch (e) {
      showFailure({ action: "交给创作助手", error: e, next: "写的内容和素材都还在，可以再点一次。" });
      setSending(false);
    }
  };

  const choose = (kind: Slot) => {
    target.current = kind;
    if (!fileInput.current) return;
    fileInput.current.accept = kind === "voice" ? ".mp3,.wav,.m4a" : kind === "video" ? ".mp4" : ".jpg,.jpeg,.png";
    fileInput.current.click();
  };
  const reset = () => { draft.current = undefined; setText(""); setImages([]); setCharacter(undefined); setVoice(undefined); setVideo(undefined); setShowBrief(false); };

  if (auth === "no-platform" || drafts.notEnrolled) return <PlatformGateScreen/>;
  const groups = videoSceneGroups.map(g => ({ id: g.id, title: g.title, items: videoScenes.filter(s => s.group === g.id) }));
  const tile = (kind: Exclude<Slot, "image">, media: Media | undefined, label: string, Icon: typeof Video, optional: boolean, clear: () => void) =>
    <div className={`scene-media${media ? " is-filled" : ""}`}>
      <button type="button" disabled={uploading !== undefined} onClick={() => choose(kind)} aria-label={media ? `更换${label}` : `添加${label}`} title={media?.fileName}>
        {uploading === kind ? <Loader2 size={20} className="studio-gallery-spinner"/> : media && kind === "character" ? <img src={media.url} alt=""/>
          : <><Icon size={26} strokeWidth={1.3}/>{!media && <span className="scene-ref-upload"><Upload size={11}/></span>}</>}
      </button>
      <span>{media ? label : `添加${label}`}{!media && optional && <small>（可选）</small>}</span>
      {media && <button type="button" className="scene-ref-remove" aria-label={`移除${label}`} onClick={clear}><X size={13}/></button>}
    </div>;

  return <main className="ip-brand-surface scene-studio scene-video-studio" data-studio-overlay-root>
    <SceneList heading="AI 视频" current={scene.id} onPick={id => pickScene(videoScene(id) || DEFAULT_SCENE)} groups={groups}/>

    <section className="scene-composer scene-video-composer" aria-label="视频设置">
      <header className="scene-composer-head">
        <SceneThumb id={scene.id} title={scene.title} size={52}/>
        <div><strong>{scene.title}</strong><small>{scene.description}</small></div>
        <button type="button" className="scene-new" onClick={reset}><Plus size={16}/>新建</button>
      </header>

      <div className="scene-video-stage">
        <span className="scene-video-mark" aria-hidden="true"><Clapperboard size={30} strokeWidth={1.4}/></span>
        <h2>你想做一条什么视频？</h2>
        <div className="scene-idea-grid" role="group" aria-label="常用开头">{scene.ideas.map(idea => <button type="button" key={idea} title={idea}
          onClick={() => setText(old => old.includes(idea) ? old : old.trim() ? `${old.trim()}；${idea}` : idea)}>{idea}</button>)}</div>
        <button type="button" className="scene-brief-toggle" aria-expanded={showBrief} onClick={() => setShowBrief(v => !v)}>看看会发给助手的话<ChevronDown size={14}/></button>
        {showBrief && <pre className="scene-brief">{brief}</pre>}
      </div>

      <div className="scene-video-input">
        <div className="scene-media-row" role="group" aria-label="素材">
          {scene.video && tile("video", video, scene.video.label, Video, !scene.video.required, () => setVideo(undefined))}
          {images.map((m, i) => <div key={m.key} className="scene-media is-filled"><span className="scene-media-preview"><img src={m.url} alt={m.title}/></span><span>{m.title}</span>
            <button type="button" className="scene-ref-remove" aria-label={`移除${m.title}`} onClick={() => setImages(old => old.filter((_, j) => j !== i))}><X size={13}/></button></div>)}
          {images.length < scene.images.max && <div className="scene-media"><button type="button" disabled={uploading !== undefined} onClick={() => choose("image")} aria-label={`添加${scene.images.label}`}>
            {uploading === "image" ? <Loader2 size={20} className="studio-gallery-spinner"/> : <><ImagePlus size={26} strokeWidth={1.3}/><span className="scene-ref-upload"><Upload size={11}/></span></>}</button>
            <span>添加{scene.images.label}{!scene.images.required && <small>（可选）</small>}</span></div>}
          {scene.character && <i className="scene-media-divider" aria-hidden="true"/>}
          {scene.character && tile("character", character, "角色", UserRound, true, () => setCharacter(undefined))}
          {scene.voice && <i className="scene-media-divider" aria-hidden="true"/>}
          {scene.voice && tile("voice", voice, "声音", Mic, true, () => setVoice(undefined))}
          <input ref={fileInput} type="file" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(target.current, file); }}/>
        </div>
        <textarea aria-label="想做的视频" rows={3} value={text} placeholder={scene.placeholder} onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }}/>
        <footer>
          <div className="scene-setting-panel-host">
            <button type="button" className="scene-video-settings" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(v => !v)}>
              <Languages size={14}/>中文 · {duration} 秒 · {ratio === "16:9" ? "横屏" : "竖屏"}<ChevronDown size={13}/></button>
            {settingsOpen && <VideoSettingsPanel durations={scene.durations} duration={duration} onDuration={setDuration} ratio={ratio} onRatio={setRatio} onClose={() => setSettingsOpen(false)}/>}
          </div>
          <small className={blocker ? "is-blocked" : undefined}>{blocker || "先出方案和报价，确认后才扣积分"}</small>
          <button type="button" className="scene-send" aria-label="交给创作助手" title={blocker || "交给创作助手（Enter）"} disabled={sending || !!blocker || uploading !== undefined} onClick={() => void send()}>
            {sending ? <Loader2 size={18} className="studio-gallery-spinner"/> : <ArrowUp size={19}/>}</button>
        </footer>
      </div>
    </section>

    <section className="scene-results" aria-label="参考示例">
      <header><div className="scene-tabs" role="tablist" aria-label="参考示例"><button type="button" role="tab" aria-selected>参考示例</button></div></header>
      <SceneExample id={scene.id} title={`${scene.title}怎么做`} note={scene.structure}>
        <ol className="scene-steps">
          <li><b>1</b><div><strong>放素材、写一句</strong><p>商品图、门店照片或故事，用平时说话的方式写，不写也行。</p></div></li>
          <li><b>2</b><div><strong>助手出方案</strong><p>在画布里看到分镜和报价，不满意直接跟它说。</p></div></li>
          <li><b>3</b><div><strong>确认后生成</strong><p>画面、配音、字幕做好后，在画布里合成成片。</p></div></li>
        </ol>
      </SceneExample>
    </section>

    <SceneRecent drafts={drafts.data} loading={drafts.loading} onOpen={id => router.push(`/projects/${encodeURIComponent(id)}`)}/>
    <HubTabBar/>
  </main>;
}

/** 时长和横竖屏：就地展开在输入框上方。 */
function VideoSettingsPanel({ durations, duration, onDuration, ratio, onRatio, onClose }: {
  durations: number[]; duration: number; onDuration: (n: number) => void; ratio: string; onRatio: (r: string) => void; onClose: () => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const away = (e: PointerEvent) => { if (e.target instanceof Node && !panel.current?.parentElement?.contains(e.target)) onClose(); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("pointerdown", away); document.addEventListener("keydown", escape);
    panel.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.focus();
    return () => { document.removeEventListener("pointerdown", away); document.removeEventListener("keydown", escape); };
  }, [onClose]);
  return <div ref={panel} className="scene-settings-panel is-left" role="group" aria-label="视频设置">
    <h3>时长</h3>
    <div className="scene-choice-row">{durations.map(d => <button key={d} type="button" aria-pressed={d === duration} onClick={() => onDuration(d)}>{d} 秒</button>)}</div>
    <h3>画面</h3>
    <div className="scene-choice-row">{[["9:16", "竖屏 9:16"], ["16:9", "横屏 16:9"]].map(([value, label]) => <button key={value} type="button" aria-pressed={value === ratio} onClick={() => onRatio(value)}>{label}</button>)}</div>
    <h3>语言</h3>
    <div className="scene-choice-row"><button type="button" aria-pressed>中文</button></div>
  </div>;
}
