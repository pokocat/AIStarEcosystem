import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckSquare, FileText, Film, Grid3X3, ListOrdered, Loader2, Play, RefreshCw, SlidersHorizontal, Sparkles, Square, Trash2, Wand2 } from 'lucide-react';
import type { Lang } from '../../../translations';
import { CAMERA_MOVES, SHOT_SIZES, labelOf, type CanvasNode, type ProjectMode } from './directorData';
import type { Asset, Episode } from './studioModel';

interface Props {
  lang: Lang;
  mode: ProjectMode;
  episodes: Episode[];
  lyrics?: CanvasNode;
  shots: CanvasNode[];
  assets: Asset[];
  styleLabel: string;
  ratio: string;
  selectedId: string | null;
  outputDone: boolean;
  onSelect: (id: string | null) => void;
  onChange: (id: string, patch: Partial<CanvasNode>) => void;
  onFrames: (ids: string[]) => void;
  onVideos: (ids: string[]) => void;
  onRewrite: (id: string) => void;
  onDelete: (id: string) => void;
  onDiscuss: (id: string) => void;
  onPreview: () => void;
  onExport: () => void;
  onGotoAssets: () => void;
}

const SmallBtn = ({ onClick, children, disabled, dark, label }: { onClick: () => void; children: React.ReactNode; disabled?: boolean; dark?: boolean; label?: string }) => (
  <button type="button" onClick={onClick} disabled={disabled} aria-label={label} title={label}
    className={`h-8 px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-45 ${dark ? '' : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'}`}
    style={dark ? { background: '#111827', color: '#fff' } : undefined}>
    {children}
  </button>
);

export const StoryboardView = (p: Props) => {
  const { lang, mode, shots, assets } = p;
  const zh = lang === 'zh';
  const [tab, setTab] = useState<'script' | 'episodes'>('script');
  const [checked, setChecked] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => { setChecked(c => c.filter(id => shots.some(s => s.id === id))); }, [shots]);
  useEffect(() => { if (p.selectedId) cardRefs.current[p.selectedId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }, [p.selectedId]);

  const allChecked = shots.length > 0 && checked.length === shots.length;
  const videosDone = shots.filter(s => s.videoStatus === 'done').length;
  const cast = assets.filter(a => a.type === 'character');
  const unvoiced = cast.filter(a => !a.voice);
  const linked = assets.filter(a => a.image).slice(0, 3);
  const toggle = (id: string) => setChecked(c => (c.includes(id) ? c.filter(x => x !== id) : [...c, id]));

  // Paragraph 0 is the scene heading; paragraph i maps to segment i.
  const episode = p.episodes[0];
  const paragraphs = mode === 'music'
    ? (p.lyrics?.prompt ?? '').split(/\n(?=\[)/)
    : (episode?.body ?? '').split('\n\n');

  return (
    <div className="h-full flex flex-col lg:flex-row min-h-0">
      <section className="lg:w-[300px] shrink-0 border-b lg:border-b-0 lg:border-r border-gray-200 bg-white flex flex-col max-h-[320px] lg:max-h-none">
        <div className="p-3 pb-0">
          <div role="tablist" className="grid grid-cols-2 rounded-xl border border-gray-200 bg-gray-50 p-1">
            {([['script', FileText, mode === 'music' ? (zh ? '歌词' : 'Lyrics') : (zh ? '本集剧本' : 'This episode')], ['episodes', ListOrdered, zh ? '分集' : 'Episodes']] as const).map(([id, Icon, label]) => (
              <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
                className={`h-8 rounded-lg text-xs font-medium inline-flex items-center justify-center gap-1.5 ${tab === id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>
                <Icon className="w-3.5 h-3.5" />{label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {tab === 'script' ? (
            <div className="rounded-xl border border-gray-200 p-3">
              <div className="flex items-center justify-between">
                <div className="text-sm font-bold text-gray-900 truncate">{mode === 'music' ? (p.lyrics?.title ?? '') : (episode?.name ?? (zh ? '暂无剧本' : 'No script'))}</div>
              </div>
              <p className="text-[11px] text-gray-500 mt-1 mb-2">{zh ? '点段落前的编号，跳到它对应的片段。' : 'Click a number to jump to its segment.'}</p>
              <div className="space-y-2.5">
                {paragraphs.map((para, i) => {
                  const shot = mode === 'music' ? shots[i] : i > 0 ? shots[i - 1] : undefined;
                  const n = mode === 'music' ? i + 1 : i;
                  const active = shot && shot.id === p.selectedId;
                  return (
                    <div key={i} className={`flex gap-2 text-xs leading-relaxed rounded-md ${active ? 'bg-purple-50' : ''}`}>
                      {shot ? (
                        <button type="button" onClick={() => p.onSelect(shot.id)} aria-label={zh ? `跳到片段 ${n}` : `Jump to segment ${n}`}
                          className="mt-0.5 w-5 h-5 shrink-0 rounded text-[10px] font-bold inline-flex items-center justify-center" style={{ background: active ? '#7c3aed' : '#111827', color: '#fff' }}>{n}</button>
                      ) : <span className="w-5 shrink-0" />}
                      <p className="text-gray-700 whitespace-pre-line">{para}</p>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              {(mode === 'music' ? [] : p.episodes).map((ep, i) => (
                <div key={ep.id} className="rounded-xl border border-gray-200 p-3">
                  <div className="text-sm font-semibold text-gray-900">{ep.name}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{i === 0 ? (zh ? `${shots.length} 个片段 · 视频 ${videosDone}/${shots.length}` : `${shots.length} segments · video ${videosDone}/${shots.length}`) : (ep.body ? (zh ? '已写完，待拆分镜' : 'Written, not storyboarded') : (zh ? '待续写' : 'Not written'))}</div>
                </div>
              ))}
              {mode === 'music' && <div className="text-xs text-gray-500">{zh ? '单曲只有一个 MV。' : 'A single has one MV.'}</div>}
            </div>
          )}
        </div>
      </section>

      <div className="flex-1 min-w-0 overflow-y-auto p-3 md:p-4 space-y-3" onClick={() => p.onSelect(null)}>
        <div className="rounded-xl border border-gray-200 bg-white p-2.5 space-y-2" onClick={e => e.stopPropagation()}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-500 mr-1">{zh ? `视频 ${videosDone}/${shots.length}` : `Video ${videosDone}/${shots.length}`}</span>
            <SmallBtn onClick={p.onPreview} disabled={!shots.some(s => s.image)}><Play className="w-3.5 h-3.5" />{zh ? '连播预览' : 'Play all'}</SmallBtn>
            <SmallBtn onClick={p.onExport} disabled={!shots.length} dark><Film className="w-3.5 h-3.5" />{p.outputDone ? (zh ? '已导出整集 · 去成片' : 'Exported · open final') : (zh ? '导出整集' : 'Export episode')}</SmallBtn>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2">
            <button type="button" onClick={() => setChecked(allChecked ? [] : shots.map(s => s.id))} className="inline-flex items-center gap-1.5 text-xs text-gray-700">
              {allChecked ? <CheckSquare className="w-4 h-4 text-purple-600" /> : <Square className="w-4 h-4 text-gray-400" />}{zh ? '全选' : 'Select all'}
            </button>
            <span className="text-xs text-gray-500">{zh ? `已选择 ${checked.length} 个片段` : `${checked.length} selected`}</span>
            <span className="flex-1" />
            <SmallBtn onClick={() => p.onFrames(checked)} disabled={!checked.length}><Grid3X3 className="w-3.5 h-3.5" />{zh ? '批量生成分镜图' : 'Generate frames'}</SmallBtn>
            <SmallBtn onClick={() => p.onVideos(checked)} disabled={!checked.length} dark><Film className="w-3.5 h-3.5" />{zh ? '批量生成视频' : 'Generate videos'}</SmallBtn>
          </div>
        </div>

        {shots.length === 0 && (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
            {mode === 'music' ? (zh ? '还没有 MV 镜头。对左侧 AI 导演说“加 2 个 MV 镜头”。' : 'No MV shots yet — ask the AI director to "add 2 MV shots".') : (zh ? '还没有片段。在画布上添加镜头，或让 AI 导演拆分剧本。' : 'No segments yet — add shots on the canvas or ask the AI director.')}
          </div>
        )}

        {shots.map((s, i) => {
          const sel = s.id === p.selectedId;
          const frameBusy = s.status === 'generating';
          const videoBusy = s.videoStatus === 'generating';
          const videoDone = s.videoStatus === 'done';
          const isEditing = editing === s.id;
          return (
            <div key={s.id} ref={el => { cardRefs.current[s.id] = el; }} onClick={e => { e.stopPropagation(); p.onSelect(s.id); }}
              className="rounded-xl bg-white p-3 md:p-4 border transition" style={{ borderColor: sel ? '#8b5cf6' : '#e5e7eb', boxShadow: sel ? '0 0 0 1px #8b5cf6' : undefined }}>
              <div className="flex flex-wrap items-center gap-2" onClick={e => e.stopPropagation()}>
                <button type="button" onClick={() => toggle(s.id)} aria-pressed={checked.includes(s.id)} aria-label={zh ? '选择片段' : 'Select segment'}>
                  {checked.includes(s.id) ? <CheckSquare className="w-4 h-4 text-purple-600" /> : <Square className="w-4 h-4 text-gray-400" />}
                </button>
                <span className="w-6 h-6 rounded-md text-xs font-bold inline-flex items-center justify-center" style={{ background: '#111827', color: '#fff' }}>{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold text-gray-900 truncate">{s.title}</div>
                  <div className="text-[11px] text-gray-500">{s.duration}{zh ? ' 秒' : 's'} · {labelOf(SHOT_SIZES, s.shotSize, lang)} · {labelOf(CAMERA_MOVES, s.camera, lang)} · {videoDone ? (zh ? '视频已确认' : 'Video confirmed') : s.status === 'done' ? (zh ? '分镜图已确认' : 'Frame confirmed') : (zh ? '待生成' : 'Pending')}</div>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => p.onDiscuss(s.id)} aria-label={zh ? '和 AI 讨论这一段' : 'Discuss this segment'} title={zh ? '和 AI 讨论这一段' : 'Discuss this segment'} className="w-7 h-7 rounded-full inline-flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)', color: '#fff' }}><Sparkles className="w-3.5 h-3.5" /></button>
                  <SmallBtn onClick={() => p.onRewrite(s.id)} label={zh ? '重写提示词' : 'Rewrite prompt'}><RefreshCw className="w-3.5 h-3.5" /><span className="hidden md:inline">{zh ? '重写' : 'Rewrite'}</span></SmallBtn>
                  <SmallBtn onClick={() => setEditing(isEditing ? null : s.id)} label={zh ? '编辑镜头' : 'Edit shot'}><SlidersHorizontal className="w-3.5 h-3.5" /><span className="hidden md:inline">{zh ? '编辑镜头' : 'Edit shot'}</span></SmallBtn>
                  <button type="button" onClick={() => p.onDelete(s.id)} aria-label={zh ? '删除片段' : 'Delete segment'} className="w-8 h-8 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 inline-flex items-center justify-center"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              <div className="mt-3 grid sm:grid-cols-[180px_minmax(0,1fr)] gap-4">
                <div>
                  <div className="relative rounded-xl overflow-hidden bg-gray-100" style={{ aspectRatio: p.ratio === '16:9' ? '16 / 9' : p.ratio === '1:1' ? '1 / 1' : '9 / 16', maxHeight: 300 }}>
                    {s.image && <img src={s.image} alt="" className={`w-full h-full object-cover ${frameBusy ? 'blur-sm' : ''}`} />}
                    {!s.image && !frameBusy && (
                      <div className="absolute inset-0 flex items-center justify-center" onClick={e => e.stopPropagation()}>
                        <SmallBtn onClick={() => p.onFrames([s.id])}><Wand2 className="w-3.5 h-3.5" />{zh ? '生成分镜图' : 'Generate frame'}</SmallBtn>
                      </div>
                    )}
                    {(frameBusy || videoBusy) && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center gap-1" style={{ background: 'rgba(255,255,255,.45)' }}>
                        <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                        <span className="text-[11px] font-medium text-purple-700">{videoBusy ? (zh ? '视频生成中' : 'Rendering video') : (zh ? '分镜图生成中' : 'Drawing frame')}</span>
                      </div>
                    )}
                    {videoDone && !videoBusy && (
                      <>
                        <span className="absolute inset-0 m-auto w-11 h-11 rounded-full inline-flex items-center justify-center" style={{ background: 'rgba(0,0,0,.45)' }}><Play className="w-5 h-5 ml-0.5" style={{ color: '#fff' }} /></span>
                        <span className="absolute left-2 bottom-2 rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'rgba(0,0,0,.6)', color: '#fff' }}>{zh ? '采用中' : 'In use'}</span>
                      </>
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 px-2 py-1.5">
                    <div className="flex -space-x-1.5">
                      {linked.map(a => <img key={a.id} src={a.image} alt={a.name} title={a.name} className="w-5 h-5 rounded-full object-cover ring-2 ring-white" />)}
                    </div>
                    <span className="text-[11px] text-gray-600">{zh ? `关联资产 ${linked.length}` : `${linked.length} linked assets`}</span>
                  </div>
                </div>

                <div className="min-w-0 space-y-2.5" onClick={e => e.stopPropagation()}>
                  <p className="text-sm text-gray-800 leading-relaxed">{s.prompt.split(/[，,。.]/)[0]}{zh ? '。' : '.'}</p>
                  {isEditing && (
                    <div className="grid grid-cols-3 gap-2">
                      <label className="text-[11px] text-gray-500">{zh ? '景别' : 'Size'}
                        <select value={s.shotSize} onChange={e => p.onChange(s.id, { shotSize: e.target.value as CanvasNode['shotSize'] })} className="mt-1 w-full h-8 rounded-md border border-gray-200 bg-white px-1.5 text-xs text-gray-900">
                          {SHOT_SIZES.map(o => <option key={o.id} value={o.id}>{o.label[lang]}</option>)}
                        </select>
                      </label>
                      <label className="text-[11px] text-gray-500">{zh ? '运镜' : 'Camera'}
                        <select value={s.camera} onChange={e => p.onChange(s.id, { camera: e.target.value as CanvasNode['camera'] })} className="mt-1 w-full h-8 rounded-md border border-gray-200 bg-white px-1.5 text-xs text-gray-900">
                          {CAMERA_MOVES.map(o => <option key={o.id} value={o.id}>{o.label[lang]}</option>)}
                        </select>
                      </label>
                      <label className="text-[11px] text-gray-500">{zh ? '时长（秒）' : 'Seconds'}
                        <input type="number" min={1} max={15} value={s.duration ?? 3} onChange={e => p.onChange(s.id, { duration: Math.min(15, Math.max(1, Number(e.target.value) || 1)) })} className="mt-1 w-full h-8 rounded-md border border-gray-200 px-1.5 text-xs text-gray-900" />
                      </label>
                    </div>
                  )}
                  <div className="rounded-xl bg-gray-50 border border-gray-100 p-3">
                    <div className="text-xs font-semibold text-gray-900">{zh ? '视频提示词' : 'Video prompt'}</div>
                    <p className="text-[11px] text-gray-500 mt-0.5">{zh ? '按分镜图逐镜生成：图 1 是分镜图，图 2 起是关联资产。' : 'Rendered shot by shot: image 1 is the frame, then linked assets.'}</p>
                    <textarea value={s.prompt} onChange={e => p.onChange(s.id, { prompt: e.target.value })} rows={4}
                      className="mt-2 w-full resize-y rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs text-gray-900 leading-relaxed outline-none focus:border-purple-300" />
                    <div className="mt-1 text-[10px] text-gray-400">{zh ? '修改即保存 · 生成视频时随镜头自动使用' : 'Saved as you type · used automatically when rendering'}</div>
                  </div>
                  {unvoiced.length > 0 && (
                    <div className="rounded-lg px-3 py-2 text-[11px] flex items-start gap-1.5" style={{ background: '#fffbeb', color: '#92400e' }}>
                      <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <span>{zh ? `${unvoiced.map(a => a.name).join('、')} 未绑定声音，各片段音色可能不一致。` : `${unvoiced.map(a => a.name).join(', ')} has no bound voice; segments may sound inconsistent. `}
                        <button type="button" onClick={p.onGotoAssets} className="underline font-medium">{zh ? '去「资产」绑定' : 'Bind in Assets'}</button></span>
                    </div>
                  )}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[11px] text-gray-500">{p.styleLabel} · {p.ratio} · {s.duration}{zh ? ' 秒' : 's'}</span>
                    <SmallBtn onClick={() => p.onVideos([s.id])} disabled={videoBusy || frameBusy}><Film className="w-3.5 h-3.5" />{videoDone ? (zh ? '重新生成视频' : 'Re-render video') : (zh ? '生成视频' : 'Render video')}</SmallBtn>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
