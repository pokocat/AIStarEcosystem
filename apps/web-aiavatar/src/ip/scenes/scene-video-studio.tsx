"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, ChevronDown, ImagePlus, Loader2, Mic, Plus, UserRound, Video, X } from "lucide-react";
import type { IpProject } from "@ai-star-eco/types";
import type { StudioMediaImportResult } from "@ai-star-eco/types";
import { PlatformGateScreen, useRequireAuth } from "@/components/hub/auth";
import { HubTabBar } from "@/components/hub/ui";
import { importStudioMedia } from "@/canvas-bridge/studio-api";
import { attachmentNode } from "@/canvas-bridge/studio-attachments";
import { CanvasNodeType, type CanvasNodeData } from "@/canvas/types/canvas";
import { IpStudioApi } from "../api";
import { useStudioFailure } from "../studio-errors";
import { useStudioList } from "../studio-gallery";
import { StudioSelect } from "../studio-select";
import { studioEntryHref } from "../studio-entry";
import { VIDEO_DRAFT_SUFFIX, composeVideoBrief, videoScene, videoSceneGroups, videoScenes, type VideoScene } from "./scene-catalog";
import { createSceneDraft, listSceneDrafts, saveDraftDoc } from "./scene-drafts";
import { SceneEmpty, SceneList, SceneRecent, SceneThumb } from "./scene-layout";

const loadDrafts = () => listSceneDrafts(VIDEO_DRAFT_SUFFIX);
type Media = StudioMediaImportResult & { title: string };
const DEFAULT_SCENE = videoScenes[0];

function writeQuery(scene: string) { window.history.replaceState(window.history.state, "", `/video?scene=${encodeURIComponent(scene)}`); }

/**
 * 「AI 视频」：选场景，填商品 / 门店 / 故事这些业务信息，放素材。
 * 我们把它拼成一段话交给画布里的创作助手，助手先写分镜、报价，用户确认后才开始生成。
 */
export function SceneVideoStudio() {
  const router = useRouter();
  const auth = useRequireAuth();
  const ready = auth === "ok";
  const showFailure = useStudioFailure();
  const drafts = useStudioList(loadDrafts, ready);
  const [scene, setScene] = useState<VideoScene>(DEFAULT_SCENE);
  const [values, setValues] = useState<Record<string, string>>({});
  const [extra, setExtra] = useState("");
  const [duration, setDuration] = useState(DEFAULT_SCENE.duration);
  const [ratio, setRatio] = useState<string>(DEFAULT_SCENE.ratio);
  const [images, setImages] = useState<Media[]>([]);
  const [character, setCharacter] = useState<Media>();
  const [voice, setVoice] = useState<Media>();
  const [video, setVideo] = useState<Media>();
  const [uploading, setUploading] = useState<string>();
  const [showBrief, setShowBrief] = useState(false);
  const [hint, setHint] = useState("");
  const [sending, setSending] = useState(false);
  const draft = useRef<IpProject>(undefined);
  const fileInput = useRef<HTMLInputElement>(null);
  const target = useRef<"image" | "character" | "voice" | "video">("image");

  const pickScene = useCallback((next: VideoScene) => {
    setScene(next); setDuration(next.duration); setRatio(next.ratio); setHint("");
    // 同名的项（商品、卖点…）换场景时保留，用户不用重填。
    setValues(old => Object.fromEntries(next.fields.filter(f => old[f.id]).map(f => [f.id, old[f.id]])));
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
      const subject = (values[scene.fields[0]?.id] || "").trim().slice(0, 14);
      draft.current = await createSceneDraft(subject ? `${scene.title} · ${subject}` : scene.title, VIDEO_DRAFT_SUFFIX);
    }
    return draft.current;
  };

  const upload = async (kind: "image" | "character" | "voice" | "video", file: File) => {
    const type = kind === "voice" ? "audio" : kind === "video" ? "video" : "image";
    if (type === "image" && !/\.(jpe?g|png)$/i.test(file.name)) { showFailure({ action: "上传素材", error: new Error("请选择 JPG 或 PNG 图片") }); return; }
    if (type === "video" && !/\.mp4$/i.test(file.name)) { showFailure({ action: "上传素材", error: new Error("参考视频请用 MP4 格式") }); return; }
    if (type === "audio" && !/\.(mp3|wav|m4a)$/i.test(file.name)) { showFailure({ action: "上传素材", error: new Error("声音请用 MP3、WAV 或 M4A") }); return; }
    setUploading(kind); setHint("");
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

  const brief = useMemo(() => composeVideoBrief(scene, { values, extra, duration, ratio,
    imageTitles: images.map(i => i.title), characterTitle: character?.title, voiceTitle: voice?.title, videoTitle: video?.title }),
  [scene, values, extra, duration, ratio, images, character, voice, video]);

  const missingField = scene.fields.find(f => f.required && !values[f.id]?.trim());
  const blocker = missingField ? `先填「${missingField.label}」`
    : scene.video?.required && !video ? `先放「${scene.video.label}」`
    : scene.images.required && !images.length ? `至少放一张「${scene.images.label}」` : "";

  const send = async () => {
    if (sending) return;
    if (blocker) { setHint(blocker); return; }
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
      // 和首页「说一句话开始」同一种起点：这段话存成助手的第一条消息，画布打开后自动发出。
      const start = { id: `${project.id}-brief`, type: CanvasNodeType.Text, title: "创作想法", position: { x: 100, y: 120 }, width: 480, height: 260,
        metadata: { content: brief, prompt: brief, studioStart: "assistant" as const, studio: { kind: "assistant" as const, conversation: { mode: "general" as const, turns: [] } } } };
      const conversations = [...(project.doc.assistantConversations || []).filter(n => n.id !== start.id), start];
      draft.current = await saveDraftDoc(project, { ...project.doc, nodes, assistantConversations: conversations });
      router.push(studioEntryHref(project.id, "assistant", { send: true }));
    } catch (e) {
      showFailure({ action: "交给创作助手", error: e, next: "填的内容还在，可以再点一次。" });
      setSending(false);
    }
  };

  const choose = (kind: typeof target.current) => { target.current = kind; if (fileInput.current) { fileInput.current.accept = kind === "voice" ? ".mp3,.wav,.m4a" : kind === "video" ? ".mp4" : ".jpg,.jpeg,.png"; fileInput.current.click(); } };

  if (auth === "no-platform" || drafts.notEnrolled) return <PlatformGateScreen/>;
  const groups = videoSceneGroups.map(g => ({ id: g.id, title: g.title, items: videoScenes.filter(s => s.group === g.id) }));
  const mediaChip = (media: Media | undefined, kind: "character" | "voice" | "video", label: string, icon: React.ReactNode, optional: boolean) =>
    <div className={`scene-media${media ? " is-filled" : ""}`}>
      <button type="button" disabled={uploading !== undefined} onClick={() => choose(kind)} aria-label={media ? `更换${label}` : `添加${label}`}>
        {uploading === kind ? <Loader2 size={20} className="studio-gallery-spinner"/> : media && kind === "character" ? <img src={media.url} alt=""/> : icon}
      </button>
      <span>{media ? media.fileName : label}{!media && optional && <small>（可选）</small>}</span>
      {media && <button type="button" className="scene-ref-remove" aria-label={`移除${label}`} onClick={() => kind === "character" ? setCharacter(undefined) : kind === "voice" ? setVoice(undefined) : setVideo(undefined)}><X size={13}/></button>}
    </div>;

  return <main className="ip-brand-surface scene-studio scene-video-studio" data-studio-overlay-root>
    <SceneList heading="AI 视频" current={scene.id} onPick={id => pickScene(videoScene(id) || DEFAULT_SCENE)} groups={groups}/>

    <section className="scene-composer" aria-label="视频设置">
      <header className="scene-composer-head">
        <SceneThumb id={scene.id} title={scene.title} size={52}/>
        <div><strong>{scene.title}</strong><small>{scene.description}</small></div>
        <button type="button" className="scene-new" onClick={() => { draft.current = undefined; setValues({}); setExtra(""); setImages([]); setCharacter(undefined); setVoice(undefined); setVideo(undefined); setHint(""); }}><Plus size={16}/>新建</button>
      </header>

      <div className="scene-composer-body">
        <div className="scene-fields">{scene.fields.map(f => <label key={f.id} className="scene-field">
          <span className="scene-field-label">{f.label}{!f.required && <small>（可选）</small>}</span>
          {f.multiline ? <textarea rows={2} value={values[f.id] || ""} placeholder={f.placeholder} onChange={e => setValues(v => ({ ...v, [f.id]: e.target.value }))}/>
            : <input value={values[f.id] || ""} placeholder={f.placeholder} onChange={e => setValues(v => ({ ...v, [f.id]: e.target.value }))}/>}
        </label>)}</div>

        <div className="scene-media-row" role="group" aria-label="素材">
          {scene.video && mediaChip(video, "video", scene.video.label, <Video size={20}/>, !scene.video.required)}
          {images.map((m, i) => <div key={m.key} className="scene-media is-filled"><span className="scene-media-preview"><img src={m.url} alt={m.title}/></span><span>{m.title}</span>
            <button type="button" className="scene-ref-remove" aria-label={`移除${m.title}`} onClick={() => setImages(old => old.filter((_, j) => j !== i))}><X size={13}/></button></div>)}
          {images.length < scene.images.max && <div className="scene-media"><button type="button" disabled={uploading !== undefined} onClick={() => choose("image")} aria-label={`添加${scene.images.label}`}>
            {uploading === "image" ? <Loader2 size={20} className="studio-gallery-spinner"/> : <ImagePlus size={20}/>}</button>
            <span>{scene.images.label}{!scene.images.required && <small>（可选）</small>}</span></div>}
          {scene.character && mediaChip(character, "character", "出镜人物", <UserRound size={20}/>, true)}
          {scene.voice && mediaChip(voice, "voice", "声音", <Mic size={20}/>, true)}
          <input ref={fileInput} type="file" hidden onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (file) void upload(target.current, file); }}/>
        </div>

        <label className="scene-field scene-extra"><span className="scene-field-label">补充说明<small>（可选）</small></span>
          <textarea rows={3} value={extra} placeholder="风格、节奏、不想要的东西，都可以写在这里" onChange={e => setExtra(e.target.value)}/></label>
        <div className="scene-ideas" role="group" aria-label="常用思路">{scene.ideas.map(idea => <button type="button" key={idea} onClick={() => setExtra(old => old.includes(idea) ? old : old.trim() ? `${old.trim()}；${idea}` : idea)}>{idea}</button>)}</div>

        <button type="button" className="scene-brief-toggle" aria-expanded={showBrief} onClick={() => setShowBrief(v => !v)}>看看会发给助手的话<ChevronDown size={14}/></button>
        {showBrief && <pre className="scene-brief">{brief}</pre>}
      </div>

      <div className="scene-settings">
        <label className="scene-setting"><span>时长</span><StudioSelect label="视频时长" compact value={String(duration)} onChange={v => setDuration(Number(v))} options={scene.durations.map(d => ({ value: String(d), label: `${d} 秒` }))}/></label>
        <label className="scene-setting"><span>画面</span><StudioSelect label="画面方向" compact value={ratio} onChange={setRatio} options={[{ value: "9:16", label: "竖屏 9:16" }, { value: "16:9", label: "横屏 16:9" }]}/></label>
      </div>
      {hint && <p className="scene-hint" role="status">{hint}</p>}
      <button type="button" className="scene-go" aria-label="交给创作助手" title="先出方案和报价，确认后才扣积分" disabled={sending || uploading !== undefined} onClick={() => void send()}>
        {sending ? <Loader2 size={18} className="studio-gallery-spinner"/> : <ArrowUp size={18}/>}<span>交给创作助手</span><small>先出方案和报价，确认后才扣积分</small>
      </button>
    </section>

    <section className="scene-results" aria-label="怎么做">
      <SceneEmpty title="视频创作" note={<>填好「{scene.fields[0]?.label}」，放上素材，交给创作助手。<br/>它会先写分镜、算好要花的积分，你点确认才开始生成。</>}
        covers={[videoScenes[5], scene, videoScenes[9]]}/>
      <ol className="scene-steps">
        <li><b>1</b><div><strong>填信息、放素材</strong><p>商品、卖点、门店，用你平时说话的方式写。</p></div></li>
        <li><b>2</b><div><strong>助手出方案</strong><p>在画布里看到分镜脚本和报价，不满意可以直接跟它说。</p></div></li>
        <li><b>3</b><div><strong>确认后生成</strong><p>画面、配音、字幕做好后，在画布里合成成片。</p></div></li>
      </ol>
    </section>

    <SceneRecent drafts={drafts.data} loading={drafts.loading} onOpen={id => router.push(`/projects/${encodeURIComponent(id)}`)}/>
    <HubTabBar/>
  </main>;
}
