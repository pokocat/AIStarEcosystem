"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Button, Checkbox, Input, Radio, Select } from "antd";
import { ArrowDown, ArrowUp, Download, GripVertical, Mic, Music, Pause, Play, Plus, SlidersHorizontal, Trash2, Upload } from "lucide-react";
import { formatDateTime } from "@/lib/datetime";
import type { StudioCaptionMode, StudioWorkDraft } from "@ai-star-eco/types/ip-studio-workflow";
import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from "@/canvas/types/canvas";
import { SignedVideo } from "@/canvas-bridge/signed-video";
import { SignedAudio } from "@/canvas-bridge/signed-audio";
import { studioEditGapSeconds, toEditTimeline } from "@/canvas-bridge/studio-edit-timeline";
import { parseStudioCaptions, studioCaptionMode, studioCaptionNote } from "@/canvas-bridge/studio-packaging";
import {
  formatStudioClock, formatStudioSeconds, studioCaptionProblem, studioCaptionRows, studioCaptionRowsFor, studioCaptionRowsText, studioClipEpisode, studioClipIncluded,
  studioClipName, studioClipOffsets, studioClipOrigin, studioMediaSeconds, studioNextCaptionRow, studioRatioHint, studioSourceClipIds, type StudioCaptionRow, type StudioClipOrigin,
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
  works: CanvasNodeData[]; renderNodeActions?: (node: CanvasNodeData) => ReactNode;
  busy: boolean; locked: boolean; mock?: boolean;
  onAssemble: () => void; onDownload: (node: CanvasNodeData) => Promise<void>;
  onAddClips: () => void; onCreateVideo: () => void; onOpenStoryboard: () => void; onMakeVoice: () => void;
  /** 高级编辑（Twick）。只有电脑版界面能用，手机上提示去电脑。 */
  onOpenAdvanced: () => void; onDropAdvanced: () => void; advancedAvailable: boolean;
  /** 已存过高级编辑时，不用再进编辑室，直接按存档导出。手机上也能用。 */
  onExportAdvanced?: () => void;
  /** false = 语音识别不可用，自动字幕加不上：不让选，默认不添加。不传表示还不知道。 */
  captionRecognition?: boolean;
  /** 上传一首背景音乐并选中它。 */
  onUploadMusic?: (file: File) => Promise<unknown>;
};

const ORIGIN_TAGS: Record<StudioClipOrigin, string> = { source: "原片素材", generated: "AI 生成", uploaded: "上传" };
const RATIOS = [["9:16", "竖屏 9:16"], ["16:9", "横屏 16:9"]] as const;
const MUSIC_MAX_MB = 25;
const readMedia = (el: HTMLVideoElement | HTMLAudioElement): Media => ({
  seconds: Number.isFinite(el.duration) && el.duration > 0 ? el.duration : undefined,
  ...(el instanceof HTMLVideoElement && el.videoWidth ? { width: el.videoWidth, height: el.videoHeight } : {}),
});

/**
 * 制作成片：选片段、排顺序、配声音和文字，导出前先在左边连续看一遍。
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

  const audios = p.nodes.filter(n => n.type === CanvasNodeType.Audio && n.metadata?.storageKey && n.metadata.status === "success");
  // 上传的音乐不进「人物声音」，生成的配音不进「背景音乐」：选错会用一首歌替换全部原声。
  const voices = audios.filter(n => n.metadata?.studio?.audioRole !== "music");
  const musics = audios.filter(n => n.metadata?.studio?.audioRole === "music" || !n.metadata?.studio?.speechRequest);
  const voice = draft.voiceoverStorageKey ? audios.find(n => n.metadata!.storageKey === draft.voiceoverStorageKey) : undefined;
  const voiceMissing = !!draft.voiceoverStorageKey && !voice;
  const voiceSeconds = voice ? secondsOf(voice) : undefined;
  const voiceGap = voice && voiceSeconds !== undefined && known ? voiceSeconds - total : undefined;
  const voiceTooLong = voiceGap !== undefined && voiceGap > 0.05;

  const music = draft.musicStorageKey ? audios.find(n => n.metadata!.storageKey === draft.musicStorageKey) : undefined;
  const musicMissing = !!draft.musicStorageKey && !music;
  const captionMode = studioCaptionMode(draft, p.captionRecognition);
  const packagingEmpty = draft.packagingEnabled && ![draft.brand, draft.title, draft.cta].some(v => v.trim());
  const captionEmpty = captionMode === "manual" && !draft.captionText.trim();
  const captionProblem = captionMode === "manual" && draft.captionText.trim() ? studioCaptionProblem(draft.captionText, known ? total : undefined) : undefined;
  const blocked = !included.length ? "请勾选要加入成片的片段"
    : voiceMissing ? "所选配音已移出画布，请重新选择配音或保留片段原声"
    : musicMissing ? "所选背景音乐已移出画布，请重新选择或选择不添加"
    : voiceTooLong ? "配音长于成片，无法导出"
    : captionEmpty ? "请填写字幕，或选择不添加"
    : packagingEmpty ? "品牌、标题和结尾提示均未填写，请至少填写一项或取消添加文字"
    : captionProblem;

  // 存过高级编辑：要导出的是存档，不是下面的原始片段。把会导出什么说清楚，手机上也能核对。
  const savedCut = useMemo(() => draft.advanced
    ? toEditTimeline(draft.advanced.project as unknown as Parameters<typeof toEditTimeline>[0], draft.advanced.size ?? { width: 720, height: 1280 }, { autoCaptions: draft.advanced.autoCaptions })
    : undefined, [draft.advanced]);
  const savedSeconds = savedCut ? Math.max(0, ...savedCut.clips.map(c => c.end)) : 0;
  const savedCaptions = !savedCut ? "" : savedCut.captions.length ? `${savedCut.captions.length} 条` : !savedCut.autoCaptions ? "不添加" : p.captionRecognition === false ? "自动字幕暂不可用，这次没有字幕" : "导出时自动生成";

  const savedRows = (savedCut?.clips ?? []).map((c, i) => {
    const node = clips.find(n => n.metadata?.storageKey === c.storageKey);
    return { key: `${c.storageKey}-${i}`, name: node ? studioClipName(node, studioClipOrigin(node, sourceIds)) : "片段", seconds: c.end - c.start };
  });
  const savedGaps = studioEditGapSeconds(savedCut?.clips ?? []);
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

  const musicPicker = useRef<HTMLInputElement>(null);
  const [musicUploading, setMusicUploading] = useState(false);
  const [musicError, setMusicError] = useState("");
  const uploadMusic = async (file?: File) => {
    if (!file || !p.onUploadMusic) return;
    if (file.size > MUSIC_MAX_MB * 1024 * 1024) { setMusicError(`这个文件超过 ${MUSIC_MAX_MB} MB，请换一个小一点的音乐文件。`); if (musicPicker.current) musicPicker.current.value = ""; return; }
    setMusicUploading(true); setMusicError("");
    try { await p.onUploadMusic(file); }
    catch (e) { setMusicError(e instanceof Error ? e.message : "音乐上传失败，请重试"); }
    finally { setMusicUploading(false); if (musicPicker.current) musicPicker.current.value = ""; }
  };
  const results = useRef<HTMLElement>(null);
  const workCount = useRef(p.works.length);
  useEffect(() => {
    // A new assembly lands below the fold; bring it into view so the user sees it started.
    if (p.works.length > workCount.current) results.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
    workCount.current = p.works.length;
  }, [p.works.length]);

  if (!clips.length) return <>
    <div className="studio-empty"><Play size={28}/><h3>还没有视频片段</h3><p>在画布中上传或生成视频后，可在此排列顺序、添加声音并导出。</p>
      <Button onClick={p.onAddClips}>添加片段</Button><Button onClick={p.onCreateVideo}>生成视频</Button><Button onClick={p.onOpenStoryboard}>打开故事板</Button></div>
    <StudioWorkResults works={p.works} onDownload={p.onDownload} renderNodeActions={p.renderNodeActions} anchor={results}/>
  </>;

  const firstSize = included[0] && (media[included[0].id]?.width ? media[included[0].id] : { width: included[0].metadata?.naturalWidth, height: included[0].metadata?.naturalHeight });
  const clipQuality = firstSize?.width && firstSize.height ? `（${Math.min(firstSize.width, firstSize.height)}P）` : "";
  const musicField = <>
          <div className="studio-work-field">
            <span className="studio-work-field-head">背景音乐（选填）</span>
            {music ? <div className="studio-work-music"><Music size={15}/><strong title={music.title}>{music.title || "背景音乐"}</strong>
                <SignedAudio key={music.id} src={music.metadata?.content} storageKey={music.metadata?.storageKey} controls/>
                <Button icon={<Trash2 size={14}/>} aria-label="移除背景音乐" onClick={() => p.onDraftChange({ musicStorageKey: undefined })}>移除</Button></div>
              : <>
                {(musics.length > 0 || musicMissing) && <Select aria-label="背景音乐" value={draft.musicStorageKey || ""} onChange={(key: string) => p.onDraftChange({ musicStorageKey: key || undefined })}
                  options={[{ value: "", label: "不添加" },
                    ...musics.filter(n => n.metadata!.storageKey !== draft.voiceoverStorageKey).map(n => ({ value: n.metadata!.storageKey!, label: n.title || "音频" })),
                    ...(musicMissing ? [{ value: draft.musicStorageKey!, label: "已移出画布的音乐" }] : [])]}/>}
                {p.onUploadMusic && <span><Button icon={<Upload size={14}/>} loading={musicUploading} onClick={() => musicPicker.current?.click()}>上传背景音乐</Button></span>}
              </>}
            {p.onUploadMusic && <input ref={musicPicker} type="file" hidden accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/x-m4a,.mp3,.wav,.m4a" aria-label="选择背景音乐文件" onChange={e => void uploadMusic(e.target.files?.[0])}/>}
            {musicError && <p className="studio-work-note is-error" role="alert">{musicError}</p>}
            {musicMissing && <StudioErrorNotice error="所选背景音乐已移出画布，请重新选择或选择不添加。" background/>}
            <p className="studio-work-note">{music ? "人物说话时，音乐会自动压低；音乐比成片短时会循环播放。" : `支持 MP3、WAV、M4A，最大 ${MUSIC_MAX_MB} MB。`}</p>
          </div>
  </>;
  const step = (no: number, title: string) => <h3 className="studio-work-step-title"><span className="studio-work-step" aria-hidden="true">{no}</span>{title}</h3>;
  return <>
    <div className={`studio-work-editor${draft.aspectRatio === "16:9" ? " is-landscape" : ""}`}>
      {draft.advanced ? <aside className="studio-work-saved" aria-label="将导出的内容">
        <h3>将导出的内容</h3>
        <p>{savedRows.length} 段视频，共 {formatStudioSeconds(savedSeconds)}</p>
        <ol>{savedRows.map((row, i) => <li key={row.key}><b>{i + 1}</b><span title={row.name}>{row.name}</span><em>{formatStudioSeconds(row.seconds)}</em></li>)}</ol>
        {savedGaps > 0 && <p className="studio-work-note is-warn" role="status">片段之间有 {formatStudioSeconds(savedGaps)}空白，导出后是黑屏。点击「继续高级编辑」可以去掉。</p>}
        <p className="studio-work-note">这是高级编辑中保存的版本。{p.advancedAvailable ? "要看剪辑后的效果，点击「继续高级编辑」，或导出后在下方观看。" : "导出后可以在下方观看。"}</p>
      </aside> : <StudioWorkPreview clips={included} seconds={secondsOf} ratio={draft.aspectRatio} voice={voice} music={music} recognition={p.captionRecognition} draft={draft}
        index={cursor} onIndex={setCursor} solo={solo} soloName={solo && studioClipName(solo, studioClipOrigin(solo, sourceIds))} onExitSolo={() => setSolo(undefined)}/>}
      <div className="studio-work-main">
        {!draft.advanced && <section className="studio-work-section" aria-label="片段">
          <header className="studio-work-section-head">
            <div>{step(1, "选择片段")}<p>勾选的片段按此顺序导出，可<span className="studio-work-drag-hint">拖动或</span>用箭头调整顺序。其余设置都有默认值，可以直接导出。</p></div>
            <div className="studio-work-ratio" role="group" aria-label="成片画幅">
              {RATIOS.map(([value, label]) => <button type="button" key={value} aria-pressed={draft.aspectRatio === value} onClick={() => p.onDraftChange({ aspectRatio: value })}>{label}</button>)}
            </div>
          </header>
          <ol className="studio-work-clips">{clips.map((node, index) => {
            const on = studioClipIncluded(node, sourceIds), origin = studioClipOrigin(node, sourceIds), name = studioClipName(node, origin);
            const seconds = secondsOf(node), size = media[node.id]?.width ? media[node.id] : { width: node.metadata?.naturalWidth, height: node.metadata?.naturalHeight };
            const ratioHint = on ? studioRatioHint(size.width, size.height, draft.aspectRatio) : undefined;
            const label = `${p.multiEpisode ? `第 ${studioClipEpisode(node)} 集 · ` : ""}${name}`;
            return <li key={node.id} className={`studio-work-clip${on ? "" : " is-out"}${dropAt === index ? " is-drop" : ""}`} draggable={!p.busy && !draft.advanced}
              onDragStart={e => { drag.current = index; e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", node.id); }}
              onDragOver={e => { if (drag.current !== undefined && drag.current !== index && sameEpisode(drag.current, index)) { e.preventDefault(); setDropAt(index); } }}
              onDragLeave={() => setDropAt(at => at === index ? undefined : at)}
              onDrop={e => { e.preventDefault(); const from = drag.current; endDrag(); if (from !== undefined && from !== index && sameEpisode(from, index)) p.onMoveClip(from, index); }}
              onDragEnd={endDrag}>
              <span className="studio-work-grip" aria-hidden="true"><GripVertical size={16}/></span>
              <button type="button" className="studio-work-thumb" aria-label={`预览：${label}`} title={on ? "从此片段开始预览" : "单独预览此片段"} onClick={() => preview(node)}>
                <SignedVideo src={node.metadata?.content} storageKey={node.metadata?.storageKey} muted playsInline preload="metadata" onLoadedMetadata={e => record(node.id, e.currentTarget)}/>
                {on && <span className="studio-work-seq">{included.indexOf(node) + 1}</span>}
                {seconds !== undefined && <span className="studio-work-duration">{formatStudioSeconds(seconds)}</span>}
              </button>
              <div className="studio-work-clip-body">
                <div className="studio-work-clip-title"><strong title={label}>{label}</strong><span className={`studio-work-tag is-${origin}`}>{ORIGIN_TAGS[origin]}</span></div>
                {node.metadata?.prompt && <p title={node.metadata.prompt}>{node.metadata.prompt}</p>}
                {origin === "source" && !on && <small>其他片段据此生成，默认不加入成片。</small>}
                {ratioHint && <small className="is-warn">{ratioHint}</small>}
              </div>
              <div className="studio-work-clip-tools">
                <Checkbox checked={on} aria-label={`将「${label}」加入成片`} onChange={e => p.onIncludeClip(node.id, e.target.checked)}>加入成片</Checkbox>
                <span>
                  <Button aria-label={`片段 ${index + 1} 上移`} disabled={!sameEpisode(index, index - 1)} onClick={() => p.onMoveClip(index, index - 1)}><ArrowUp size={15}/></Button>
                  <Button aria-label={`片段 ${index + 1} 下移`} disabled={!sameEpisode(index, index + 1)} onClick={() => p.onMoveClip(index, index + 1)}><ArrowDown size={15}/></Button>
                </span>
              </div>
            </li>;
          })}</ol>
        </section>}

        {draft.advanced && <section className="studio-work-section" aria-label="背景音乐">{musicField}</section>}

        {!draft.advanced && <>
        <section className="studio-work-section" aria-label="声音">
          {step(2, "设置声音（选填）")}
          {voices.length || voiceMissing ? <label className="studio-work-field">人物声音
            <Select aria-label="人物声音" value={draft.voiceoverStorageKey || ""} onChange={(key: string) => p.onDraftChange({ voiceoverStorageKey: key || undefined })}
              options={[{ value: "", label: "保留片段原声" },
                ...voices.filter(n => n.metadata!.storageKey !== draft.musicStorageKey).map(n => { const s = secondsOf(n); return { value: n.metadata!.storageKey!, label: `${n.title}${s ? ` · ${formatStudioSeconds(s)}` : ""}` }; }),
                ...(voiceMissing ? [{ value: draft.voiceoverStorageKey!, label: "已移出画布的配音" }] : [])]}/>
          </label> : <p className="studio-work-note">画布中暂无配音，成片将保留片段原声。<button type="button" className="studio-work-link" onClick={p.onMakeVoice}><Mic size={14}/>生成配音</button></p>}
          {voiceMissing && <StudioErrorNotice error="所选配音已移出画布，请重新选择配音或保留片段原声。" background/>}
          {voice && <>
            <SignedAudio key={voice.id} src={voice.metadata?.content} storageKey={voice.metadata?.storageKey} controls onLoadedMetadata={e => record(voice.id, e.currentTarget)}/>
            {voiceGap !== undefined && (voiceTooLong
              ? <p className="studio-work-note is-error" role="status">配音 {formatStudioSeconds(voiceSeconds!)}，长于成片 {formatStudioSeconds(voiceGap)}，无法导出。请更换较短的配音，或加入更多片段。</p>
              : voiceGap < -0.5 ? <p className="studio-work-note" role="status">配音短于成片 {formatStudioSeconds(-voiceGap)}，结尾部分将没有声音。</p> : null)}
            <p className="studio-work-note">使用配音后，片段原声将不再保留，人物口型不会随配音变化。</p>
          </>}
          {musicField}
        </section>

        <section className="studio-work-section" aria-label="字幕">
          {step(3, "添加字幕")}
          <Radio.Group className="studio-work-choices" aria-label="字幕" value={captionMode} onChange={e => p.onDraftChange({ captionMode: e.target.value as StudioCaptionMode })}>
            {p.captionRecognition === false
              ? <Radio value="auto" disabled>自动生成<small>暂不可用</small></Radio>
              : <Radio value="auto">自动生成<small>推荐。导出时根据说话声生成，显示在画面下方。</small></Radio>}
            <Radio value="off">不添加</Radio>
            <Radio value="manual">手动填写<small>自己输入每一段要显示的文字。</small></Radio>
          </Radio.Group>
          {captionMode === "auto" && <p className="studio-work-note">导出后无法单独去除；如需去掉，改为「不添加」后重新导出，原片段不受影响。</p>}
          {captionMode === "off" && p.captionRecognition === false && <p className="studio-work-note is-warn" role="status">自动字幕暂不可用，这次成片没有字幕。需要字幕请选择手动填写。</p>}
          {captionMode === "manual" && <StudioCaptionRows text={draft.captionText} seconds={known ? lengths as number[] : undefined} total={known ? total : undefined} problem={captionProblem} onChange={captionText => p.onDraftChange({ captionText })}/>}
        </section>

        <section className="studio-work-section" aria-label="文字">
          {step(4, "添加文字（选填）")}
          <Checkbox checked={draft.packagingEnabled} onChange={e => p.onDraftChange({ packagingEnabled: e.target.checked })}>添加品牌、标题和结尾提示</Checkbox>
          {draft.packagingEnabled && <>
            <div className="studio-work-grid">
              <label className="studio-work-field">品牌<Input aria-label="成片品牌" value={draft.brand} onChange={e => p.onDraftChange({ brand: e.target.value })} maxLength={60}/></label>
              <label className="studio-work-field">作品标题<Input aria-label="成片标题文字" value={draft.title} onChange={e => p.onDraftChange({ title: e.target.value })} maxLength={120}/></label>
            </div>
            <label className="studio-work-field">结尾提示<Input aria-label="成片结尾提示" value={draft.cta} onChange={e => p.onDraftChange({ cta: e.target.value })} maxLength={100} placeholder="例如：点击下方链接了解更多"/></label>
            <p className="studio-work-note">品牌和标题显示在左上角，结尾提示显示在底部，实际位置以成片为准。</p>
          </>}
        </section>

        <section className="studio-work-section" aria-label="清晰度">
          {step(5, "选择清晰度（选填）")}
          <Radio.Group className="studio-work-choices is-row" aria-label="清晰度" value={draft.quality || ""} onChange={e => p.onDraftChange({ quality: e.target.value || undefined })}>
            <Radio value="">与片段一致{clipQuality}<small>推荐</small></Radio>
            <Radio value="720p">720P 高清<small>文件较小</small></Radio>
            <Radio value="1080p">1080P 超清<small>文件较大</small></Radio>
          </Radio.Group>
          {draft.quality === "1080p" && <p className="studio-work-note">片段本身不够清晰时，选择 1080P 不会让画面变得更清楚。</p>}
        </section>
        </>}

        {draft.advanced ? <div className="studio-work-actions">
          <Button type="primary" loading={p.busy} disabled={p.locked || !p.onExportAdvanced} onClick={p.onExportAdvanced}>导出成片</Button>
          <Button icon={<SlidersHorizontal size={15}/>} disabled={p.locked || !p.advancedAvailable} title={p.advancedAvailable ? undefined : "高级编辑仅支持电脑版"} onClick={p.onOpenAdvanced}>继续高级编辑</Button>
          <Button disabled={p.locked} onClick={p.onDropAdvanced}>放弃高级编辑的修改</Button>
          <div>
            <span>背景音乐：{music?.title || (draft.musicStorageKey ? "已移出画布" : "不添加")}；字幕：{savedCaptions}</span>
            <span>已在高级编辑中修改，上次保存于 {formatDateTime(draft.advanced.savedAt)}。{p.advancedAvailable ? "" : "继续修改需要用电脑打开。"}</span>
          </div>
        </div> : <div className="studio-work-actions">
          <Button type="primary" loading={p.busy} disabled={p.locked || !!blocked} onClick={p.onAssemble}>导出成片</Button>
          <Button icon={<SlidersHorizontal size={15}/>} disabled={p.locked || !p.advancedAvailable} title={p.advancedAvailable ? "需要精修时使用：剪掉不要的部分、改速度、加小窗和图片、调颜色" : "高级编辑仅支持电脑版"} onClick={p.onOpenAdvanced}>高级编辑</Button>
          <div>
            <strong>已选 {included.length}/{clips.length} 段 · {known ? `共 ${formatStudioSeconds(total)}` : included.length ? "时长加载中" : "未选择片段"}</strong>
            {blocked ? <span className="is-error">{blocked}</span> : <span>{p.mock ? "测试响应，不产生模型费用" : "导出免费"}{captionMode === "off" && p.captionRecognition === false ? "。这次成片没有字幕" : ""}</span>}
            <span>{p.advancedAvailable ? "需要剪掉片段中的部分、改速度时，再用「高级编辑」。" : "高级编辑仅支持电脑版"}</span>
          </div>
        </div>}
      </div>
    </div>
    <StudioWorkResults works={p.works} onDownload={p.onDownload} renderNodeActions={p.renderNodeActions} anchor={results}/>
  </>;
}

function StudioWorkResults({ works, onDownload, renderNodeActions, anchor }: { renderNodeActions?: (node: CanvasNodeData) => ReactNode; works: CanvasNodeData[]; onDownload: (node: CanvasNodeData) => Promise<void>; anchor: RefObject<HTMLElement | null> }) {
  // 文件要先取回来才开始保存，片子越长等得越久：按钮要有反应，不然会被连点、下出好几份。
  const [downloading, setDownloading] = useState<string>();
  const [started, setStarted] = useState<string>();
  const download = (node: CanvasNodeData) => {
    if (downloading) return;
    setDownloading(node.id); setStarted(undefined);
    void onDownload(node).then(() => setStarted(node.id), () => undefined).finally(() => setDownloading(undefined));
  };
  if (!works.length) return null;
  return <section className="studio-work-results" ref={anchor} aria-label="已导出的成片"><h3>已导出的成片</h3>
    {[...works].reverse().map(node => <article key={node.id} className="studio-work-result"><h4>{node.title}</h4>{node.metadata?.studio?.exportedAt && <time className="studio-work-result-time">{formatDateTime(node.metadata.studio.exportedAt)}</time>}{renderNodeActions?.(node)}
      {node.metadata?.status === "loading" ? <p>导出中，通常需要几分钟。可返回画布继续创作。</p>
        : node.metadata?.content || node.metadata?.storageKey ? <><SignedVideo src={node.metadata.content} storageKey={node.metadata.storageKey} controls preload="metadata"/>
          <CaptionNote node={node}/>
          <Button type="primary" icon={downloading === node.id ? undefined : <Download size={15}/>} loading={downloading === node.id} disabled={!!downloading && downloading !== node.id} onClick={() => download(node)}>{downloading === node.id ? "正在准备下载" : "下载成片"}</Button>
          {started === node.id && <p className="studio-work-note" role="status">已开始下载，可在浏览器的下载列表中查看。</p>}</>
        : node.metadata?.status === "error" ? <><p className="studio-work-note is-warn" role="status">导出失败，片段不受影响，可以重新导出。</p><StudioErrorNotice error={studioNodeError(node)} once={`run:${node.metadata.studio?.runId || node.id}`} autoReport={false}/></>
        : <p>等待导出</p>}
    </article>)}
  </section>;
}

/** 手动字幕：一行一条，开始、结束和文字分开填，不用记格式。时间已按片段算好，通常只需要填文字；没写字的行不算。 */
function StudioCaptionRows({ text, seconds, total, problem, onChange }: { text: string; seconds?: number[]; total?: number; problem?: string; onChange: (text: string) => void }) {
  const fresh = () => { const parsed = studioCaptionRows(text); return parsed.length ? parsed : seconds?.length ? studioCaptionRowsFor(seconds) : [{ start: "0", end: "3", text: "" }]; };
  const [rows, setRows] = useState<StudioCaptionRow[]>(fresh);
  const emitted = useRef(text);
  // 只有外面改了（撤销、换集）才重新读；自己改的不读回去，否则没写字的行会被吃掉。
  useEffect(() => { if (text !== emitted.current) { emitted.current = text; setRows(fresh()); } }, [text]); // eslint-disable-line react-hooks/exhaustive-deps
  // 片段时长读到之前只有一行占位：读到后、还没写字时换成每段一行。
  const untouched = rows.every(r => !r.text.trim());
  const seconds0 = seconds?.join(",");
  useEffect(() => { if (untouched && seconds?.length) setRows(studioCaptionRowsFor(seconds)); }, [seconds0]); // eslint-disable-line react-hooks/exhaustive-deps
  const update = (next: StudioCaptionRow[]) => { setRows(next); const value = studioCaptionRowsText(next); emitted.current = value; onChange(value); };
  const edit = (i: number, change: Partial<StudioCaptionRow>) => update(rows.map((r, at) => at === i ? { ...r, ...change } : r));
  const time = (value: string) => value.replace(/[^\d.]/g, "");
  return <div className="studio-work-field">
    <span className="studio-work-field-head">字幕内容</span>
    <ol className="studio-work-caption-rows">{rows.map((row, i) => <li key={i}>
      <span className="studio-work-caption-time">
        <Input aria-label={`第 ${i + 1} 条字幕开始时间（秒）`} inputMode="decimal" value={row.start} onChange={e => edit(i, { start: time(e.target.value) })}/>
        <span>到</span>
        <Input aria-label={`第 ${i + 1} 条字幕结束时间（秒）`} inputMode="decimal" value={row.end} onChange={e => edit(i, { end: time(e.target.value) })}/>
        <span>秒</span>
      </span>
      <Input aria-label={`第 ${i + 1} 条字幕文字`} placeholder="这段时间要显示的文字" maxLength={160} value={row.text} onChange={e => edit(i, { text: e.target.value })}/>
      <Button aria-label={`删除第 ${i + 1} 条字幕`} disabled={rows.length < 2} onClick={() => update(rows.filter((_, at) => at !== i))}><Trash2 size={14}/></Button>
    </li>)}</ol>
    <span><Button icon={<Plus size={14}/>} onClick={() => update([...rows, studioNextCaptionRow(rows, total)])}>添加一条字幕</Button></span>
    {problem ? <p className="studio-work-note is-error" role="status">{problem}</p>
      : <p className="studio-work-note">{total !== undefined ? `成片共 ${formatStudioSeconds(total)}，时间已按片段分好，不想显示字幕的那段空着即可。` : "片段时长加载中。"}</p>}
  </div>;
}

function CaptionNote({ node }: { node: CanvasNodeData }) {
  const result = node.metadata?.studio?.captions;
  const note = result ? studioCaptionNote({ status: result.status, count: result.cues?.length }, { advanced: !!node.metadata?.studio?.request?.edit }) : undefined;
  return note ? <p className={`studio-work-note${note.warn ? " is-warn" : ""}`} role="status">{note.text}</p> : null;
}

type PreviewProps = {
  clips: CanvasNodeData[]; seconds: (node: CanvasNodeData) => number | undefined; ratio: string; voice?: CanvasNodeData; music?: CanvasNodeData; recognition?: boolean; draft: StudioWorkDraft;
  index: number; onIndex: (index: number) => void; solo?: CanvasNodeData; soloName?: string; onExitSolo: () => void;
};

/** 预览里音乐的音量：接近导出时压低后的效果，让人听得出加上了，又不盖住说话声。 */
const MUSIC_PREVIEW_VOLUME = 0.25;

/** Plays the chosen clips back to back, with the voiceover on the cut's clock and the text where the server puts it. */
function StudioWorkPreview({ clips, seconds, ratio, voice, music, recognition, draft, index, onIndex, solo, soloName, onExitSolo }: PreviewProps) {
  const video = useRef<HTMLVideoElement>(null), audio = useRef<HTMLAudioElement>(null), bgm = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false), [local, setLocal] = useState(0);
  const lengths = clips.map(seconds), offsets = studioClipOffsets(lengths);
  const total = lengths.reduce<number>((sum, s) => sum + (s || 0), 0);
  const at = Math.min(index, Math.max(0, clips.length - 1));
  const clip = solo || clips[at];
  const time = solo ? local : (offsets[at] ?? 0) + local;
  const captionMode = studioCaptionMode(draft, recognition);
  const captions = useMemo(() => { try { return captionMode === "manual" ? parseStudioCaptions(draft.captionText) : []; } catch { return []; } }, [captionMode, draft.captionText]);
  const caption = captions.find(c => time >= c.start && time < c.end);
  const showText = !solo;
  useEffect(() => { if (index !== at) onIndex(at); }, [index, at, onIndex]);

  const syncVoice = (play: boolean) => {
    const el = audio.current;
    if (!el) return;
    if (Math.abs(el.currentTime - time) > 0.3) el.currentTime = time;
    if (play && !(el.duration && time >= el.duration)) void el.play().catch(() => undefined); else el.pause();
  };
  const syncMusic = (play: boolean) => {
    const el = bgm.current;
    if (!el) return;
    el.volume = MUSIC_PREVIEW_VOLUME;
    if (el.duration && Math.abs(el.currentTime - time % el.duration) > 0.3) el.currentTime = time % el.duration;
    if (play) void el.play().catch(() => undefined); else el.pause();
  };
  // 播放中换了音乐：新音乐接着放，不用再点一次。
  useEffect(() => { if (playing && !solo) syncMusic(true); }, [music?.id]); // eslint-disable-line react-hooks/exhaustive-deps
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
    bgm.current?.pause(); if (bgm.current) bgm.current.currentTime = 0;
    if (video.current) video.current.currentTime = 0;
    onIndex(0);
  };

  return <aside className="studio-work-preview" aria-label="成片预览">
    <div className="studio-work-stage" style={{ aspectRatio: ratio === "16:9" ? "16 / 9" : "9 / 16" }}>
      {clip ? <SignedVideo key={clip.id} ref={video} src={clip.metadata?.content} storageKey={clip.metadata?.storageKey} playsInline preload="auto"
          muted={!!voice && !solo} autoPlay={playing && !solo} controls={!!solo}
          onTimeUpdate={e => setLocal(e.currentTarget.currentTime)}
          onPlay={() => { setPlaying(true); if (!solo) { syncVoice(true); syncMusic(true); } }}
          onPause={e => { if (e.currentTarget.ended) return; setPlaying(false); audio.current?.pause(); bgm.current?.pause(); }}
          onEnded={ended}/>
        : <p className="studio-work-stage-empty">勾选片段后可在此连续预览</p>}
      {showText && <div className="studio-work-overlay" aria-hidden="true">
        {draft.packagingEnabled && (draft.brand.trim() || draft.title.trim()) && <div className="studio-work-overlay-top">
          {draft.brand.trim() && <span>{draft.brand}</span>}{draft.title.trim() && <span className="is-title">{draft.title}</span>}</div>}
        {caption && <span className="studio-work-overlay-caption">{caption.text}</span>}
        {draft.packagingEnabled && draft.cta.trim() && <span className="studio-work-overlay-cta">{draft.cta}</span>}
      </div>}
    </div>
    {voice && <SignedAudio key={voice.id} ref={audio} src={voice.metadata?.content} storageKey={voice.metadata?.storageKey} className="studio-work-voice"/>}
    {music && <SignedAudio key={music.id} ref={bgm} src={music.metadata?.content} storageKey={music.metadata?.storageKey} loop className="studio-work-voice"/>}
    {solo ? <p className="studio-work-solo">正在单独预览「{soloName}」，此片段未加入成片。<button type="button" className="studio-work-link" onClick={onExitSolo}>返回成片预览</button></p>
      : <div className="studio-work-player">
        <button type="button" className="studio-work-play" disabled={!clip} aria-label={playing ? "暂停预览" : "播放整片预览"} onClick={toggle}>{playing ? <Pause size={16}/> : <Play size={16}/>}</button>
        <span className="studio-work-clock">{formatStudioClock(time)} / {formatStudioClock(total)}</span>
        <div className="studio-work-timeline" role="group" aria-label="成片时间线">{clips.map((c, i) => {
          const len = lengths[i], fill = i < at ? 1 : i === at && len ? Math.min(1, local / len) : 0;
          return <button type="button" key={c.id} style={{ flexGrow: len || 1 }} aria-label={`从第 ${i + 1} 段开始预览`} aria-current={i === at ? "step" : undefined} onClick={() => jump(i)}>
            <span style={{ width: `${fill * 100}%` }}/></button>;
        })}</div>
      </div>}
    <p className="studio-work-preview-note">{`预览按顺序连续播放勾选的片段${voice && music ? "，并同步播放配音和背景音乐" : voice ? "，并同步播放配音" : music ? "，并同步播放背景音乐" : ""}。${captionMode === "auto" ? "字幕在导出时自动生成，此处不显示。" : "画面和文字以导出后的成片为准。"}`}</p>
  </aside>;
}
