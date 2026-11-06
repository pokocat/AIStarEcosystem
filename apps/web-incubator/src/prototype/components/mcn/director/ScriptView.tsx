import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Loader2, RefreshCw, Sparkles, Wand2, Zap } from 'lucide-react';
import type { Lang } from '../../../translations';
import type { CanvasNode, ProjectMode } from './directorData';
import type { Asset, Episode, StudioView } from './studioModel';

interface Props {
  lang: Lang;
  mode: ProjectMode;
  name: string;
  outline: string;
  episodes: Episode[];
  lyrics?: CanvasNode;
  vocal?: CanvasNode;
  artistName: string;
  onSing: () => void;
  assets: Asset[];
  shots: CanvasNode[];
  outputDone: boolean;
  onOutline: (text: string) => void;
  onEpisode: (id: string, patch: Partial<Episode>) => void;
  onLyrics: (text: string) => void;
  onRewrite: () => void;
  onContinue: (id: string) => void;
  onExtractAssets: () => void;
  onGoto: (view: StudioView) => void;
  onOneClick: () => void;
  onDiscuss: (episodeId: string) => void;
}

const Tag = ({ children, tone }: { children: React.ReactNode; tone: 'green' | 'amber' }) => (
  <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold" style={tone === 'green' ? { background: '#ecfdf5', color: '#047857' } : { background: '#fffbeb', color: '#b45309' }}>{children}</span>
);

const AIButton = ({ onClick, label }: { onClick: () => void; label: string }) => (
  <button type="button" onClick={onClick} aria-label={label} title={label}
    className="w-7 h-7 rounded-full inline-flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #06b6d4, #8b5cf6)', color: '#fff' }}>
    <Sparkles className="w-3.5 h-3.5" />
  </button>
);

export const ScriptView = (p: Props) => {
  const { lang, mode, episodes, assets, shots } = p;
  const zh = lang === 'zh';
  const [open, setOpen] = useState<Record<string, boolean>>({ [episodes[0]?.id ?? '']: true });
  const [editingOutline, setEditingOutline] = useState(false);
  const allOpen = episodes.length > 0 && episodes.every(e => open[e.id]);
  const chars = mode === 'music' ? (p.lyrics?.prompt.length ?? 0) : episodes.reduce((a, e) => a + e.body.length, 0);
  const missing = assets.filter(a => a.status === 'missing').length;
  const framesDone = shots.filter(s => s.status === 'done').length;
  const videosDone = shots.filter(s => s.videoStatus === 'done').length;
  const rewriting = episodes.some(e => e.status === 'generating') || p.lyrics?.status === 'generating';

  // Point at whatever is actually unfinished, in production order.
  type Next = { title: string; desc: string; view?: StudioView; cta: string; action?: () => void };
  const next: Next | null = mode === 'music' && p.lyrics?.status !== 'done'
    ? null
    : mode === 'music' && p.vocal && p.vocal.status !== 'done'
      ? { title: zh ? '用声线演唱' : 'Record the vocals', desc: p.vocal.status === 'generating' ? (zh ? '人声正在演唱，完成后会推荐下一步。' : 'Vocals are being recorded; the next step appears when done.') : (zh ? `歌词和编曲已就绪，人声还没录。用 ${p.artistName} 的专属声线把歌词唱出来，副歌会自动叠两轨和声。` : `Lyrics and arrangement are ready. Sing them in ${p.artistName}'s own voice; the chorus gets stacked harmonies.`), cta: zh ? '开始演唱' : 'Start singing', action: p.vocal.status === 'generating' ? undefined : p.onSing }
    : missing > 0
      ? { title: zh ? '生成资产图' : 'Generate asset images', desc: zh ? `已提取 ${assets.length} 项资产，${missing} 项还缺资产图。到「资产」给角色、场景和道具生成资产图，分镜图和视频都照着它们画。改了正文可以重新提取，同一人物不会重复新建。` : `${assets.length} assets extracted, ${missing} still need images. Generate them in Assets; storyboards and videos follow them. Re-extract after editing — the same person is never duplicated.`, view: 'assets' as StudioView, cta: zh ? '前往资产' : 'Go to assets' }
      : videosDone < shots.length
        ? { title: zh ? '生成分镜视频' : 'Render storyboard videos', desc: zh ? `资产已齐。${shots.length} 个片段里分镜图 ${framesDone} 个、视频 ${videosDone} 个已完成，到「分镜」逐段确认后批量生成。` : `Assets are ready. ${framesDone}/${shots.length} frames and ${videosDone}/${shots.length} videos done — confirm and batch-render in Storyboard.`, view: 'storyboard' as StudioView, cta: zh ? '前往分镜' : 'Go to storyboard' }
        : { title: zh ? '合成成片' : 'Render the final cut', desc: p.outputDone ? (zh ? '成片已合成，可以到「成片」预览并导出到发布中心。' : 'The final cut is ready — preview and send it from Final.') : (zh ? '所有片段都已就绪，到「成片」合成并导出。' : 'Every segment is ready — render and export from Final.'), view: 'final' as StudioView, cta: zh ? '前往成片' : 'Go to final' };

  return (
    <div className="h-full overflow-y-auto p-4 md:p-5 space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-gray-900">{mode === 'music' ? (zh ? '歌词' : 'Lyrics') : (zh ? '剧本' : 'Script')}</h3>
          <p className="text-[11px] text-gray-500 mt-0.5">{mode === 'music' ? (zh ? `《${p.name}》 · 共 ${chars} 字` : `"${p.name}" · ${chars} chars`) : (zh ? `${episodes.length} 集 · 共 ${chars} 字` : `${episodes.length} episodes · ${chars} chars`)}</p>
        </div>
        <div className="flex items-center gap-2">
          {mode === 'video' && episodes.length > 0 && (
            <button type="button" onClick={() => setOpen(Object.fromEntries(episodes.map(e => [e.id, !allOpen])))} className="h-8 px-3 rounded-lg text-xs font-medium text-gray-700 hover:bg-gray-100">
              {allOpen ? (zh ? '全部收起' : 'Collapse all') : (zh ? '展开全部' : 'Expand all')}
            </button>
          )}
          <button type="button" onClick={p.onRewrite} disabled={rewriting} className="h-8 px-3 rounded-lg border border-gray-200 bg-white text-xs font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5 disabled:opacity-50">
            {rewriting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}{mode === 'music' ? (zh ? '重写歌词' : 'Rewrite lyrics') : (zh ? '重新生成剧本' : 'Regenerate script')}
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        {editingOutline ? (
          <div className="p-3">
            <textarea autoFocus value={p.outline} onChange={e => p.onOutline(e.target.value)} onBlur={() => setEditingOutline(false)} rows={2}
              className="w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-purple-300" />
          </div>
        ) : (
          <button type="button" onClick={() => setEditingOutline(true)} className="w-full flex items-center gap-2.5 px-4 py-3 text-left hover:bg-gray-50 rounded-xl">
            <BookOpen className="w-4 h-4 text-gray-700 shrink-0" />
            <span className="text-sm font-semibold text-gray-900 shrink-0">{zh ? '故事大纲' : 'Outline'}</span>
            <span className="text-sm text-gray-600 truncate flex-1">{p.outline || (zh ? '点击写一句梗概' : 'Click to write a logline')}</span>
            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
          </button>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-3">
        {next ? (
          <div className="rounded-xl bg-white p-4 border-2" style={{ borderColor: '#111827' }}>
            <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">{zh ? '下一步：' : 'Next: '}{next.title}<Tag tone="green">{zh ? '推荐' : 'Recommended'}</Tag></div>
            <p className="text-xs text-gray-500 mt-2 leading-relaxed">{next.desc}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {next.view === 'assets' && (
                <button type="button" onClick={p.onExtractAssets} className="h-9 px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5"><Wand2 className="w-3.5 h-3.5" />{zh ? '重新提取全剧资产' : 'Re-extract assets'}</button>
              )}
              <button type="button" onClick={() => (next.action ? next.action() : next.view && p.onGoto(next.view))} disabled={!next.action && !next.view}
                className="h-9 px-3.5 rounded-lg text-xs font-semibold disabled:opacity-50" style={{ background: '#111827', color: '#fff' }}>{next.cta}</button>
            </div>
          </div>
        ) : (
          <div className="rounded-xl bg-white p-4 border border-gray-200 text-xs text-gray-500">{zh ? '歌词生成中，完成后会推荐下一步。' : 'Lyrics are being written; the next step appears when done.'}</div>
        )}
        <div className="rounded-xl bg-white p-4 border border-gray-200">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">{zh ? '或者：一键制作' : 'Or: one-click'}<Tag tone="amber">{zh ? '快捷' : 'Fast'}</Tag></div>
          <p className="text-xs text-gray-500 mt-2 leading-relaxed">{zh ? '把后面的步骤连着自动做完，一直到成片。做的过程中随时可以切到各个视图检查和修改。' : 'Chain every remaining step automatically up to the final cut; check or edit any view along the way.'}</p>
          <button type="button" onClick={p.onOneClick} className="mt-3 h-9 px-3 rounded-lg border border-gray-200 text-xs font-medium text-gray-700 hover:bg-gray-50 inline-flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-amber-500" />{zh ? '一键制作' : 'One-click'}</button>
        </div>
      </div>

      {mode === 'music' ? (
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-900">{zh ? `《${p.name}》` : `"${p.name}"`}</span>
            <span className="text-[11px] text-gray-500">{zh ? '[段落名] 单独一行，例如 [副歌]' : 'Put [Section] on its own line, e.g. [Chorus]'}</span>
          </div>
          <textarea value={p.lyrics?.prompt ?? ''} onChange={e => p.onLyrics(e.target.value)} rows={14} disabled={p.lyrics?.status === 'generating'}
            className="w-full resize-y rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 leading-7 outline-none focus:border-purple-300 disabled:animate-pulse" />
        </div>
      ) : episodes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
          <div className="text-sm font-semibold text-gray-900">{zh ? '还没有剧本' : 'No script yet'}</div>
          <p className="text-xs text-gray-500 mt-1">{zh ? '先写一句故事大纲，再让 AI 导演写成分场剧本。' : 'Write a logline, then let the AI director turn it into scenes.'}</p>
          <button type="button" onClick={p.onRewrite} className="mt-4 h-9 px-4 rounded-lg text-xs font-semibold" style={{ background: 'linear-gradient(90deg, #06b6d4, #8b5cf6)', color: '#fff' }}>{zh ? 'AI 写剧本' : 'Write with AI'}</button>
        </div>
      ) : (
        episodes.map((ep, idx) => {
          const isOpen = !!open[ep.id];
          return (
            <div key={ep.id} className="rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center gap-2 px-3 py-2.5">
                <button type="button" onClick={() => setOpen(o => ({ ...o, [ep.id]: !isOpen }))} aria-expanded={isOpen} className="flex-1 min-w-0 flex items-center gap-2 text-left">
                  <ChevronDown className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${isOpen ? '' : '-rotate-90'}`} />
                  <span className="text-sm font-bold text-gray-900 shrink-0">{ep.name}</span>
                  <span className="text-xs text-gray-500 truncate">{ep.summary}</span>
                </button>
                <span className="hidden sm:inline text-[11px] text-gray-500 shrink-0">
                  {ep.body.length} {zh ? '字' : 'chars'}{idx === 0 ? ` · ${zh ? '分镜' : 'frames'} ${framesDone}/${shots.length} · ${zh ? '视频' : 'video'} ${videosDone}/${shots.length}` : ''}
                </span>
                <AIButton onClick={() => p.onDiscuss(ep.id)} label={zh ? '和 AI 讨论这一集' : 'Discuss this episode'} />
              </div>
              {isOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-gray-100 pt-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <label className="block">
                      <span className="text-xs font-medium text-gray-700">{zh ? '集名' : 'Title'}</span>
                      <input value={ep.name} onChange={e => p.onEpisode(ep.id, { name: e.target.value })} className="mt-1.5 w-full h-10 rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none focus:border-purple-300" />
                    </label>
                    <label className="block">
                      <span className="text-xs font-medium text-gray-700">{zh ? '本集摘要' : 'Summary'}</span>
                      <textarea value={ep.summary} onChange={e => p.onEpisode(ep.id, { summary: e.target.value })} rows={2} className="mt-1.5 w-full resize-none rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-purple-300" />
                    </label>
                  </div>
                  {ep.status === 'idle' && !ep.body ? (
                    <div className="rounded-lg border border-dashed border-gray-300 p-6 text-center">
                      <p className="text-xs text-gray-500">{zh ? '这一集还没写。' : 'This episode is not written yet.'}</p>
                      <button type="button" onClick={() => p.onContinue(ep.id)} className="mt-3 h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5" style={{ background: 'linear-gradient(90deg, #06b6d4, #8b5cf6)', color: '#fff' }}><Sparkles className="w-3.5 h-3.5" />{zh ? 'AI 续写' : 'Continue with AI'}</button>
                    </div>
                  ) : (
                    <textarea value={ep.body} onChange={e => p.onEpisode(ep.id, { body: e.target.value })} rows={14} disabled={ep.status === 'generating'}
                      className="w-full resize-y rounded-lg border border-gray-200 px-4 py-3 text-sm text-gray-900 leading-7 outline-none focus:border-purple-300 disabled:animate-pulse" />
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
};
