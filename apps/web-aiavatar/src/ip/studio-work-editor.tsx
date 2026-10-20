"use client";
import { useEffect, useMemo, useRef, useState, type RefObject } from "react";
import { Button, Checkbox, Input, Select } from "antd";
import { ArrowDown, ArrowUp, Download, GripVertical, Mic, Pause, Play, SlidersHorizontal } from "lucide-react";
import { formatDateTime } from "@/lib/datetime";
import type { StudioWorkDraft } from "@ai-star-eco/types/ip-studio-workflow";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from "@/canvas/types/canvas";
import { SignedVideo } from "@/canvas-bridge/signed-video";
import { SignedAudio } from "@/canvas-bridge/signed-audio";
import { parseStudioCaptions } from "@/canvas-bridge/studio-packaging";
import {
  formatStudioClock, formatStudioSeconds, studioCaptionProblem, studioCaptionTemplate, studioClipEpisode, studioClipIncluded,
  studioClipName, studioClipOffsets, studioClipOrigin, studioMediaSeconds, studioRatioHint, studioSourceClipIds, type StudioClipOrigin,
} from "@/canvas-bridge/studio-work-clips";
import { StudioErrorNotice, studioNodeError } from "./studio-errors";

type Media = { seconds?: number; width?: number; height?: number };
type Props = {
  nodes: CanvasNodeData[]; connections: CanvasConnection[];
  /** Clips of the current episode filter, in cut order. */
  clips: CanvasNodeData[]; multiEpisode: boolean;
  draft: StudioWorkDraft; onDraftChange: (changes: Partial<StudioWorkDraft>) => void;
  onIncludeClip: (id: string, included: boolean) => void;
  onMoveClip: (from: number, to: number) => void;
  /** Assembled works of this view, oldest first (document order). */
  works: CanvasNodeData[];
  busy: boolean; locked: boolean; mock?: boolean;
  onAssemble: () => void; onDownload: (node: CanvasNodeData) => void;
  onAddClips: () => void; onCreateVideo: () => void; onOpenStoryboard: () => void; onMakeVoice: () => void;
  /** 高级编辑（Twick）。只有电脑版界面能用，手机上提示去电脑。 */
  onOpenAdvanced: () => void; onDropAdvanced: () => void; advancedAvailable: boolean;
};

const ORIGIN_TAGS: Record<StudioClipOrigin, string> = { source: "原片素材", generated: "AI 生成", uploaded: "上传" };
const RATIOS = [["9:16", "竖屏 9:16"], ["16:9", "横屏 16:9"]] as const;
const readMedia = (el: HTMLVideoElement | HTMLAudioElement): Media => ({
  seconds: Number.isFinite(el.duration) && el.duration > 0 ? el.duration : undefined,
  ...(el instanceof HTMLVideoElement && el.videoWidth ? { width: el.videoWidth, height: el.videoHeight } : {}),
});

/**
 * 成片编辑器：选片段、排顺序、配声音和文字，合成前先在左边连续看一遍。
 * 时长和画面比例以浏览器读到的文件为准；服务端仍是最终裁判，这里只是把它会拒绝的情况提前说出来。
 */
export function StudioWorkEditor(p: Props) {
  const { clips, draft } = p;
  const sourceIds = useMemo(() => studioSourceClipIds(p.nodes, p.connections), [p.nodes, p.connections]);
  const [media, setMedia] = useState<Record<string, Media>>({});
  const record = (id: string, el: HTMLVideoElement | HTMLAudioElement) => {
    const next = readMedia(el);
    setMedia(current => current[id]?.seconds === next.seconds && current[id]?.width === next.width ? current : { ...current, [id]: next });
  };
  const secondsOf = (node: CanvasNodeData) => media[node.id]?.seconds ?? studioMediaSeconds(node);
  const included = clips.filter(n => studioClipIncluded(n, sourceIds));
  const lengths = included.map(secondsOf);
  const known = included.length > 0 && lengths.every(s => s !== undefined);
  const total = lengths.reduce<number>((sum, s) => sum + (s || 0), 0);

  const voices = p.nodes.filter(n => n.type === CanvasNodeType.Audio && n.metadata?.storageKey && n.metadata.status === "success");
  const voice = draft.voiceoverStorageKey ? voices.find(n => n.metadata!.storageKey === draft.voiceoverStorageKey) : undefined;
  const voiceMissing = !!draft.voiceoverStorageKey && !voice;
  const voiceSeconds = voice ? secondsOf(voice) : undefined;
  const voiceGap = voice && voiceSeconds !== undefined && known ? voiceSeconds - total : undefined;
  const voiceTooLong = voiceGap !== undefined && voiceGap > 0.05;

  const packagingEmpty = draft.packagingEnabled && ![draft.brand, draft.title, draft.cta, draft.captionText].some(v => v.trim());
  const captionProblem = draft.packagingEnabled && draft.captionText.trim() ? studioCaptionProblem(draft.captionText, known ? total : undefined) : undefined;
  const blocked = !included.length ? "先勾选要放进成片的片段"
    : voiceMissing ? "选的配音已经不在画布上了，重新选一条或改回片段原声"
    : voiceTooLong ? "配音比成片长，合成不了"
    : packagingEmpty ? "品牌、标题、结尾提示和字幕都没填，填一项或关掉文字"
    : captionProblem;

  const [cursor, setCursor] = useState(0);
  const [solo, setSolo] = useState<CanvasNodeData>();
  const preview = (node: CanvasNodeData) => {
    const at = included.indexOf(node);
    if (at < 0) { setSolo(node); return; }
    setSolo(undefined); setCursor(at);
  };
  useEffect(() => { if (solo && !clips.some(n => n.id === solo.id)) setSolo(undefined); }, [clips, solo]);

  const drag = useRef<number | undefined>(undefined);
  const [dropAt, setDropAt] = useState<number>();
  const sameEpisode = (a: number, b: number) => !!clips[a] && !!clips[b] && studioClipEpisode(clips[a]) === studioClipEpisode(clips[b]);
  const endDrag = () => { drag.current = undefined; setDropAt(undefined); };

  const results = useRef<HTMLElement>(null);
  const workCount = useRef(p.works.length);
  useEffect(() => {
    // A new assembly lands below the fold; bring it into view so the user sees it started.
    if (p.works.length > workCount.current) results.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    workCount.current = p.works.length;
  }, [p.works.length]);

  if (!clips.length) return <>
    <div className="studio-empty"><Play size={28}/><h3>还没有视频片段</h3><p>在画布上传视频，或者先生成几段视频，再回来排顺序、配声音、合成。</p>
      <Button onClick={p.onAddClips}>去画布添加片段</Button><Button onClick={p.onCreateVideo}>生成一段视频</Button><Button onClick={p.onOpenStoryboard}>去故事板</Button></div>
    <StudioWorkResults works={p.works} onDownload={p.onDownload} anchor={results}/>
  </>;

  const captionTemplateReady = known && !draft.captionText.trim();
  return <>
    <div className={`studio-work-editor${draft.aspectRatio === "16:9" ? " is-landscape" : ""}`}>
      <StudioWorkPreview clips={included} seconds={secondsOf} ratio={draft.aspectRatio} voice={voice} draft={draft}
        index={cursor} onIndex={setCursor} solo={solo} soloName={solo && studioClipName(solo, studioClipOrigin(solo, sourceIds))} onExitSolo={() => setSolo(undefined)}/>
      <div className="studio-work-main">
        <section className="studio-work-section" aria-label="片段">
          <header className="studio-work-section-head">
            <div><h3>片段</h3><p>勾选的片段按这个顺序拼成成片，<span className="studio-work-drag-hint">拖动或</span>用箭头调整顺序。</p></div>
            <div className="studio-work-ratio" role="group" aria-label="成片画幅">
              {RATIOS.map(([value, label]) => <button type="button" key={value} aria-pressed={draft.aspectRatio === value} onClick={() => p.onDraftChange({ aspectRatio: value })}>{label}</button>)}
            </div>
          </header>
          <ol className="studio-work-clips">{clips.map((node, index) => {
            const on = studioClipIncluded(node, sourceIds), origin = studioClipOrigin(node, sourceIds), name = studioClipName(node, origin);
            const seconds = secondsOf(node), size = media[node.id]?.width ? media[node.id] : { width: node.metadata?.naturalWidth, height: node.metadata?.naturalHeight };
            const ratioHint = on ? studioRatioHint(size.width, size.height, draft.aspectRatio) : undefined;
            const label = `${p.multiEpisode ? `第 ${studioClipEpisode(node)} 集 · ` : ""}${name}`;
            return <li key={node.id} className={`studio-work-clip${on ? "" : " is-out"}${dropAt === index ? " is-drop" : ""}`} draggable={!p.busy}
              onDragStart={e => { drag.current = index; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", node.id); }}
              onDragOver={e => { if (drag.current !== undefined && drag.current !== index && sameEpisode(drag.current, index)) { e.preventDefault(); setDropAt(index); } }}
              onDragLeave={() => setDropAt(at => at === index ? undefined : at)}
              onDrop={e => { e.preventDefault(); const from = drag.current; endDrag(); if (from !== undefined && from !== index && sameEpisode(from, index)) p.onMoveClip(from, index); }}
              onDragEnd={endDrag}>
              <span className="studio-work-grip" aria-hidden="true"><GripVertical size={16}/></span>
              <button type="button" className="studio-work-thumb" aria-label={`预览：${label}`} title={on ? "在左边预览里从这一段开始看" : "在左边单独看这一段"} onClick={() => preview(node)}>
                <SignedVideo src={node.metadata?.content} storageKey={node.metadata?.storageKey} muted playsInline preload="metadata" onLoadedMetadata={e => record(node.id, e.currentTarget)}/>
                {on && <span className="studio-work-seq">{included.indexOf(node) + 1}</span>}
                {seconds !== undefined && <span className="studio-work-duration">{formatStudioSeconds(seconds)}</span>}
              </button>
              <div className="studio-work-clip-body">
                <div className="studio-work-clip-title"><strong title={label}>{label}</strong><span className={`studio-work-tag is-${origin}`}>{ORIGIN_TAGS[origin]}</span></div>
                {node.metadata?.prompt && <p title={node.metadata.prompt}>{node.metadata.prompt}</p>}
                {origin === "source" && !on && <small>其他片段是照着它做的，默认不放进成片。</small>}
                {ratioHint && <small className="is-warn">{ratioHint}</small>}
              </div>
              <div className="studio-work-clip-tools">
                <Checkbox checked={on} aria-label={`把「${label}」放进成片`} onChange={e => p.onIncludeClip(node.id, e.target.checked)}>放进成片</Checkbox>
                <span>
                  <Button aria-label={`片段 ${index + 1} 上移`} disabled={!sameEpisode(index, index - 1)} onClick={() => p.onMoveClip(index, index - 1)}><ArrowUp size={15}/></Button>
                  <Button aria-label={`片段 ${index + 1} 下移`} disabled={!sameEpisode(index, index + 1)} onClick={() => p.onMoveClip(index, index + 1)}><ArrowDown size={15}/></Button>
                </span>
              </div>
            </li>;
          })}</ol>
        </section>

        <section className="studio-work-section" aria-label="声音">
          <h3>声音</h3>
          {voices.length || voiceMissing ? <label className="studio-work-field">成片用哪条声音
            <Select aria-label="成片音轨" value={draft.voiceoverStorageKey || ""} onChange={(key: string) => p.onDraftChange({ voiceoverStorageKey: key || undefined })}
              options={[{ value: "", label: "保留片段原声" },
                ...voices.map(n => { const s = secondsOf(n); return { value: n.metadata!.storageKey!, label: `${n.title}${s ? ` · ${formatStudioSeconds(s)}` : ""}` }; }),
                ...(voiceMissing ? [{ value: draft.voiceoverStorageKey!, label: "已移出画布的配音" }] : [])]}/>
          </label> : <p className="studio-work-note">画布上还没有配音，成片会保留片段原声。<button type="button" className="studio-work-link" onClick={p.onMakeVoice}><Mic size={14}/>去做一条配音</button></p>}
          {voiceMissing && <StudioErrorNotice error="选的配音已经不在画布上了，重新选一条或改回片段原声。"/>}
          {voice && <>
            <SignedAudio key={voice.id} src={voice.metadata?.content} storageKey={voice.metadata?.storageKey} controls onLoadedMetadata={e => record(voice.id, e.currentTarget)}/>
            {voiceGap !== undefined && (voiceTooLong
              ? <p className="studio-work-note is-error" role="status">配音 {formatStudioSeconds(voiceSeconds!)}，比成片长 {formatStudioSeconds(voiceGap)}，合成不了。换一条短一点的配音，或者多放几段片段。</p>
              : voiceGap < -0.5 ? <p className="studio-work-note" role="status">配音比成片短 {formatStudioSeconds(-voiceGap)}，最后这一段没有声音。</p> : null)}
            <p className="studio-work-note">换成配音后，片段原来的声音不再保留；人物口型不会跟着配音改。</p>
          </>}
        </section>

        <section className="studio-work-section" aria-label="文字">
          <h3>文字</h3>
          <Checkbox checked={draft.packagingEnabled} onChange={e => p.onDraftChange({ packagingEnabled: e.target.checked })}>添加品牌文字与字幕</Checkbox>
          {draft.packagingEnabled && <>
            <div className="studio-work-grid">
              <label className="studio-work-field">品牌<Input aria-label="成片品牌" value={draft.brand} onChange={e => p.onDraftChange({ brand: e.target.value })} maxLength={60}/></label>
              <label className="studio-work-field">作品标题<Input aria-label="成片标题文字" value={draft.title} onChange={e => p.onDraftChange({ title: e.target.value })} maxLength={120}/></label>
            </div>
            <label className="studio-work-field">结尾提示<Input aria-label="成片结尾提示" value={draft.cta} onChange={e => p.onDraftChange({ cta: e.target.value })} maxLength={100} placeholder="比如：点击下方链接了解更多"/></label>
            <div className="studio-work-field">
              <span className="studio-work-field-head">字幕
                <button type="button" className="studio-work-link" disabled={!captionTemplateReady} title={draft.captionText.trim() ? "清空字幕后可以按片段重新填时间" : known ? undefined : "片段时长还没读到"}
                  onClick={() => p.onDraftChange({ captionText: studioCaptionTemplate(lengths as number[]) })}>按片段填好时间</button></span>
              <Input.TextArea aria-label="成片字幕时间与文字" value={draft.captionText} onChange={e => p.onDraftChange({ captionText: e.target.value })} rows={4}
                placeholder={"每行一条，写成「开始秒-结束秒: 字幕」\n0-3: 第一句字幕\n3-5: 第二句字幕"}/>
              {captionProblem ? <p className="studio-work-note is-error" role="status">{captionProblem}</p>
                : <p className="studio-work-note">{known ? `成片共 ${formatStudioSeconds(total)}，字幕不要超过这个时间。` : ""}字幕按你写的时间出现，不会自动识别台词。</p>}
            </div>
            <p className="studio-work-note">品牌和标题在画面左上角，结尾提示在底部，整条成片都显示。左边预览能看到大概位置，合成后以成片为准。</p>
          </>}
        </section>

        {draft.advanced ? <div className="studio-work-actions">
          <Button type="primary" icon={<SlidersHorizontal size={15}/>} disabled={!p.advancedAvailable} onClick={p.onOpenAdvanced}>继续高级编辑</Button>
          <Button disabled={p.locked} onClick={p.onDropAdvanced}>改回一键成片</Button>
          <div>
            <strong>这份成片在高级编辑里改过</strong>
            <span>{p.advancedAvailable ? `上次保存 ${formatDateTime(draft.advanced.savedAt)}，在高级编辑里导出成片。上面的设置不再生效。` : "高级编辑要在电脑上打开"}</span>
          </div>
        </div> : <div className="studio-work-actions">
          <Button type="primary" loading={p.busy} disabled={p.locked || !!blocked} onClick={p.onAssemble}>合成作品</Button>
          <Button icon={<SlidersHorizontal size={15}/>} disabled={p.locked || !p.advancedAvailable} title={p.advancedAvailable ? "掐头去尾、切开、加文字和字幕，再导出" : "高级编辑要在电脑上打开"} onClick={p.onOpenAdvanced}>高级编辑</Button>
          <div>
            <strong>已选 {included.length}/{clips.length} 段 · {known ? `共 ${formatStudioSeconds(total)}` : included.length ? "时长读取中" : "还没选片段"}</strong>
            {blocked ? <span className="is-error">{blocked}</span> : <span>{p.mock ? "测试响应，不产生模型费用" : "合成不收模型积分"}</span>}
          </div>
        </div>}
      </div>
    </div>
    <StudioWorkResults works={p.works} onDownload={p.onDownload} anchor={results}/>
  </>;
}

function StudioWorkResults({ works, onDownload, anchor }: { works: CanvasNodeData[]; onDownload: (node: CanvasNodeData) => void; anchor: RefObject<HTMLElement | null> }) {
  if (!works.length) return null;
  return <section className="studio-work-results" ref={anchor} aria-label="合成好的作品"><h3>合成好的作品</h3>
    {[...works].reverse().map(node => <article key={node.id} className="studio-work-result"><h4>{node.title}</h4>
      {node.metadata?.status === "loading" ? <p>正在合成，可以先回画布继续做。</p>
        : node.metadata?.content || node.metadata?.storageKey ? <><SignedVideo src={node.metadata.content} storageKey={node.metadata.storageKey} controls preload="metadata"/>
          <Button onClick={() => onDownload(node)}><Download size={15}/>下载作品</Button></>
        : node.metadata?.status === "error" ? <StudioErrorNotice error={studioNodeError(node)} once={`run:${node.metadata.studio?.runId || node.id}`} autoReport={false}/>
        : <p>作品待合成</p>}
    </article>)}
  </section>;
}

type PreviewProps = {
  clips: CanvasNodeData[]; seconds: (node: CanvasNodeData) => number | undefined; ratio: string; voice?: CanvasNodeData; draft: StudioWorkDraft;
  index: number; onIndex: (index: number) => void; solo?: CanvasNodeData; soloName?: string; onExitSolo: () => void;
};

/** Plays the chosen clips back to back, with the voiceover on the cut's clock and the text where the server puts it. */
function StudioWorkPreview({ clips, seconds, ratio, voice, draft, index, onIndex, solo, soloName, onExitSolo }: PreviewProps) {
  const video = useRef<HTMLVideoElement>(null), audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false), [local, setLocal] = useState(0);
  const lengths = clips.map(seconds), offsets = studioClipOffsets(lengths);
  const total = lengths.reduce<number>((sum, s) => sum + (s || 0), 0);
  const at = Math.min(index, Math.max(0, clips.length - 1));
  const clip = solo || clips[at];
  const time = solo ? local : (offsets[at] ?? 0) + local;
  const captions = useMemo(() => { try { return draft.packagingEnabled ? parseStudioCaptions(draft.captionText) : []; } catch { return []; } }, [draft.packagingEnabled, draft.captionText]);
  const caption = captions.find(c => time >= c.start && time < c.end);
  const showText = draft.packagingEnabled && !solo;
  useEffect(() => { if (index !== at) onIndex(at); }, [index, at, onIndex]);

  const syncVoice = (play: boolean) => {
    const el = audio.current;
    if (!el) return;
    if (Math.abs(el.currentTime - time) > 0.3) el.currentTime = time;
    if (play && !(el.duration && time >= el.duration)) void el.play().catch(() => undefined); else el.pause();
  };
  const jump = (next: number) => {
    onExitSolo(); setLocal(0);
    if (next === at && video.current) video.current.currentTime = 0;
    onIndex(next);
  };
  const toggle = () => { const el = video.current; if (!el) return; if (el.paused) void el.play().catch(() => undefined); else el.pause(); };
  const ended = () => {
    if (solo) { setPlaying(false); return; }
    setLocal(0);
    if (at < clips.length - 1) { onIndex(at + 1); return; }
    setPlaying(false); audio.current?.pause(); if (audio.current) audio.current.currentTime = 0;
    if (video.current) video.current.currentTime = 0;
    onIndex(0);
  };

  return <aside className="studio-work-preview" aria-label="成片预览">
    <div className="studio-work-stage" style={{ aspectRatio: ratio === "16:9" ? "16 / 9" : "9 / 16" }}>
      {clip ? <SignedVideo key={clip.id} ref={video} src={clip.metadata?.content} storageKey={clip.metadata?.storageKey} playsInline preload="auto"
          muted={!!voice && !solo} autoPlay={playing && !solo} controls={!!solo}
          onTimeUpdate={e => setLocal(e.currentTarget.currentTime)}
          onPlay={() => { setPlaying(true); if (!solo) syncVoice(true); }}
          onPause={e => { if (e.currentTarget.ended) return; setPlaying(false); audio.current?.pause(); }}
          onEnded={ended}/>
        : <p className="studio-work-stage-empty">勾选片段后，在这里连续看一遍</p>}
      {showText && <div className="studio-work-overlay" aria-hidden="true">
        {(draft.brand.trim() || draft.title.trim()) && <div className="studio-work-overlay-top">
          {draft.brand.trim() && <span>{draft.brand}</span>}{draft.title.trim() && <span className="is-title">{draft.title}</span>}</div>}
        {caption && <span className="studio-work-overlay-caption">{caption.text}</span>}
        {draft.cta.trim() && <span className="studio-work-overlay-cta">{draft.cta}</span>}
      </div>}
    </div>
    {voice && <SignedAudio key={voice.id} ref={audio} src={voice.metadata?.content} storageKey={voice.metadata?.storageKey} className="studio-work-voice"/>}
    {solo ? <p className="studio-work-solo">正在单独看「{soloName}」，它不在成片里。<button type="button" className="studio-work-link" onClick={onExitSolo}>回到成片预览</button></p>
      : <div className="studio-work-player">
        <button type="button" className="studio-work-play" disabled={!clip} aria-label={playing ? "暂停预览" : "播放整片预览"} onClick={toggle}>{playing ? <Pause size={16}/> : <Play size={16}/>}</button>
        <span className="studio-work-clock">{formatStudioClock(time)} / {formatStudioClock(total)}</span>
        <div className="studio-work-timeline" role="group" aria-label="成片时间线">{clips.map((c, i) => {
          const len = lengths[i], fill = i < at ? 1 : i === at && len ? Math.min(1, local / len) : 0;
          return <button type="button" key={c.id} style={{ flexGrow: len || 1 }} aria-label={`从第 ${i + 1} 段开始看`} aria-current={i === at ? "step" : undefined} onClick={() => jump(i)}>
            <span style={{ width: `${fill * 100}%` }}/></button>;
        })}</div>
      </div>}
    <p className="studio-work-preview-note">{draft.advanced ? "这里播的是一键成片的顺序。高级编辑里剪过的版本，请在高级编辑里播放。"
      : `预览把勾选的片段按顺序连着放${voice ? "，配音跟着一起放" : ""}。合成后的画面和文字以成片为准。`}</p>
  </aside>;
}
