import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import type { Lang } from '../../../translations';
import { KIND_META, orderedShots, type CanvasNode } from './directorData';

const fmt = (s: number) => `00:${String(Math.floor(s)).padStart(2, '0')}`;

interface Props {
  lang: Lang;
  nodes: CanvasNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Reports the shot under the playhead (成片 preview). */
  onFrame?: (shot: CanvasNode | undefined) => void;
  /** Increment to restart playback from the beginning (连播预览). */
  playSignal?: number;
}

export const DirectorTimeline = ({ lang, nodes, selectedId, onSelect, onFrame, playSignal = 0 }: Props) => {
  const zh = lang === 'zh';
  const shots = orderedShots(nodes);
  const total = shots.reduce((a, s) => a + (s.duration || 0), 0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!playing) { last.current = null; return; }
    let raf = 0;
    const tick = (now: number) => {
      const dt = last.current == null ? 0 : (now - last.current) / 1000;
      last.current = now;
      setTime(t => {
        const next = t + dt;
        if (next >= total) { setPlaying(false); return total; }
        return next;
      });
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, total]);

  useEffect(() => { if (time > total) setTime(total); }, [total, time]);

  let acc = 0;
  const current = shots.find(s => { acc += s.duration || 0; return time < acc; }) ?? shots[shots.length - 1];
  const togglePlay = () => { if (!playing && time >= total) setTime(0); setPlaying(p => !p); };
  useEffect(() => { if (playSignal > 0) { setTime(0); setPlaying(true); } }, [playSignal]);
  const currentId = current?.id;
  const frameRef = useRef(onFrame);
  frameRef.current = onFrame;
  useEffect(() => { frameRef.current?.(shots.find(s => s.id === currentId)); }, [currentId, current?.image]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="shrink-0 border-t border-gray-200 bg-white pl-4 pr-4 lg:pr-16 py-3 flex items-center gap-4">
      <div className="hidden sm:block relative w-24 h-14 rounded-lg overflow-hidden shrink-0" style={{ background: '#111827' }}>
        {current?.image && <img src={current.image} alt="" className="w-full h-full object-cover" />}
        <span className="absolute bottom-1 left-1 rounded px-1 text-[9px] font-mono" style={{ background: 'rgba(0,0,0,.6)', color: '#fff' }}>{fmt(time)}</span>
      </div>
      <button type="button" onClick={togglePlay} disabled={!total} aria-label={playing ? (zh ? '暂停' : 'Pause') : (zh ? '播放预览' : 'Play preview')}
        className="w-9 h-9 rounded-full shrink-0 inline-flex items-center justify-center disabled:opacity-40" style={{ background: '#111827', color: '#fff' }}>
        {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-[11px] text-gray-500 mb-1.5">
          <span>{zh ? `时间线 · ${shots.length} 个镜头` : `Timeline · ${shots.length} shots`}</span>
          <span className="font-mono">{fmt(time)} / {fmt(total)}</span>
        </div>
        {shots.length === 0 ? (
          <div className="h-9 rounded-md border border-dashed border-gray-300 px-3 text-[11px] text-gray-500 flex items-center">
            {zh ? '还没有镜头。在画布上“添加”，或让 AI 导演帮你拆分镜。' : 'No shots yet. Use "Add" on the canvas or ask the AI director.'}
          </div>
        ) : (
        <div className="relative flex gap-1 h-9">
          {shots.map((s, i) => (
            <button key={s.id} type="button" onClick={() => onSelect(s.id)} title={s.title}
              className="relative h-full rounded-md overflow-hidden text-left transition"
              style={{ flexGrow: s.duration || 1, flexBasis: 0, background: s.image ? undefined : '#f3f4f6',
                boxShadow: s.id === selectedId ? `0 0 0 2px ${KIND_META.shot.color}` : 'inset 0 0 0 1px #e5e7eb' }}>
              {s.image && <img src={s.image} alt="" className="absolute inset-0 w-full h-full object-cover opacity-80" />}
              <span className="relative px-1.5 text-[10px] font-medium leading-9 truncate block" style={{ color: s.image ? '#fff' : '#6b7280', textShadow: s.image ? '0 1px 2px rgba(0,0,0,.6)' : undefined }}>{i + 1}. {s.title}</span>
            </button>
          ))}
          {total > 0 && <span aria-hidden className="pointer-events-none absolute -top-1 -bottom-1 w-0.5 rounded-full" style={{ left: `${(time / total) * 100}%`, background: '#ef4444' }} />}
        </div>
        )}
      </div>
    </div>
  );
};
