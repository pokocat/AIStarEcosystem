import React, { useState } from 'react';
import { CheckCircle2, Circle, Clapperboard, Loader2, Play, Send } from 'lucide-react';
import type { Lang } from '../../../translations';
import { fmtDuration, orderedShots, type CanvasNode, type ProjectMode } from './directorData';
import { DirectorTimeline } from './DirectorTimeline';

interface Props {
  lang: Lang;
  mode: ProjectMode;
  nodes: CanvasNode[];
  ratio: string;
  styleLabel: string;
  deliverables: string[];
  exported: boolean;
  playSignal: number;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onRender: () => void;
  onExport: () => void;
}

export const FinalView = ({ lang, mode, nodes, ratio, styleLabel, deliverables, exported, playSignal, selectedId, onSelect, onRender, onExport }: Props) => {
  const zh = lang === 'zh';
  const [frame, setFrame] = useState<CanvasNode | undefined>();
  const output = nodes.find(n => n.kind === 'output');
  const shots = orderedShots(nodes);
  const done = output?.status === 'done';
  const busy = output?.status === 'generating';
  const length = mode === 'music' ? (nodes.find(n => n.kind === 'audio')?.duration ?? 0) : shots.reduce((a, s) => a + (s.duration || 0), 0);
  const cover = frame?.image ?? shots.find(s => s.image)?.image ?? nodes.find(n => n.kind === 'character')?.image;
  const aspect = ratio === '16:9' ? '16 / 9' : ratio === '1:1' ? '1 / 1' : '9 / 16';
  const checks: Array<[string, boolean]> = [
    [zh ? `分镜图 ${shots.filter(s => s.status === 'done').length}/${shots.length}` : `Frames ${shots.filter(s => s.status === 'done').length}/${shots.length}`, shots.every(s => s.status === 'done')],
    [zh ? `片段视频 ${shots.filter(s => s.videoStatus === 'done').length}/${shots.length}` : `Videos ${shots.filter(s => s.videoStatus === 'done').length}/${shots.length}`, shots.every(s => s.videoStatus === 'done')],
    ...nodes.filter(n => n.kind === 'audio' || n.kind === 'vocal').map(n => [n.title, n.status === 'done'] as [string, boolean]),
  ];

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5 grid lg:grid-cols-[minmax(0,1fr)_300px] gap-4">
        <div className="rounded-2xl flex items-center justify-center p-4 min-h-[320px]" style={{ background: '#0b0f19' }}>
          <div className="relative h-full max-h-[56vh] max-w-full rounded-xl overflow-hidden" style={{ aspectRatio: aspect, background: '#111827' }}>
            {cover && <img src={cover} alt="" className={`w-full h-full object-cover ${done ? '' : 'opacity-60'}`} />}
            {frame && <span className="absolute left-3 bottom-3 rounded px-2 py-1 text-[11px]" style={{ background: 'rgba(0,0,0,.6)', color: '#fff' }}>{frame.title}</span>}
            {(!frame || busy) && (
              <span className="absolute inset-0 m-auto w-14 h-14 rounded-full inline-flex items-center justify-center" style={{ background: 'rgba(255,255,255,.9)' }}>
                {busy ? <Loader2 className="w-6 h-6 animate-spin text-purple-600" /> : <Play className="w-6 h-6 ml-0.5 text-purple-600" />}
              </span>
            )}
          </div>
        </div>

        <div className="space-y-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="text-sm font-bold text-gray-900">{output?.title ?? (zh ? '成片' : 'Final')}</div>
            <div className="text-[11px] text-gray-500 mt-0.5">{styleLabel} · {ratio} · {fmtDuration(length)}</div>
            <div className="mt-3 space-y-1.5">
              {checks.map(([label, ok]) => (
                <div key={label} className="flex items-center gap-2 text-xs text-gray-700">
                  {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Circle className="w-4 h-4 text-gray-300" />}{label}
                </div>
              ))}
            </div>
            <button type="button" onClick={onRender} disabled={busy || !output}
              className="mt-4 w-full h-10 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: done ? '#ecfeff' : 'linear-gradient(90deg, #06b6d4, #8b5cf6)', color: done ? '#0e7490' : '#fff' }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Clapperboard className="w-4 h-4" />}
              {busy ? (zh ? '合成中，会自动补齐未完成的片段…' : 'Rendering, filling in missing parts…') : done ? (zh ? '重新合成' : 'Re-render') : mode === 'music' ? (zh ? '混音并制作交付' : 'Mix & deliver') : (zh ? '合成成片' : 'Render final cut')}
            </button>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="text-xs font-semibold text-gray-900 mb-2">{zh ? '交付清单' : 'Deliverables'}</div>
            <div className="space-y-1.5">
              {deliverables.map(d => (
                <div key={d} className="flex items-center justify-between text-xs">
                  <span className="text-gray-700">{d}</span>
                  <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={done ? { background: '#ecfdf5', color: '#047857' } : { background: '#f3f4f6', color: '#6b7280' }}>{done ? (zh ? '已生成' : 'Ready') : (zh ? '待合成' : 'Pending')}</span>
                </div>
              ))}
            </div>
            <button type="button" onClick={onExport} disabled={!done || exported}
              className="mt-4 w-full h-10 rounded-xl text-sm font-semibold inline-flex items-center justify-center gap-2 disabled:opacity-50"
              style={{ background: '#111827', color: '#fff' }}>
              {exported ? <CheckCircle2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}{exported ? (zh ? '已推送到发布池' : 'Sent to publish pool') : (zh ? '导出到发布中心' : 'Send to Publish Center')}
            </button>
          </div>
        </div>
      </div>
      <DirectorTimeline lang={lang} nodes={nodes} selectedId={selectedId} onSelect={onSelect} onFrame={setFrame} playSignal={playSignal} />
    </div>
  );
};
