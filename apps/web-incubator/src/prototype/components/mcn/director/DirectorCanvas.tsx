import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { AlignLeft, Clapperboard, FileText, Hand, Image as ImageIcon, LayoutGrid, LayoutTemplate, Loader2, Maximize2, Mic2, Minus, MousePointer2, Music2, Pause, Play, Plus, Upload, Video, Wand2 } from 'lucide-react';
import type { Lang } from '../../../translations';
import { CAMERA_MOVES, GENRES, KIND_META, MOODS, NODE_H, NODE_W, SHOT_SIZES, VOICE_STYLES, fmtDuration, isGeneratable, labelOf, orderedShots, type CanvasNode, type Edge, type ProjectMode } from './directorData';

interface Props {
  lang: Lang;
  nodes: CanvasNode[];
  edges: Edge[];
  selectedId: string | null;
  fitSignal: number;
  onSelect: (id: string | null) => void;
  onMove: (id: string, x: number, y: number) => void;
  onGenerate: (id: string) => void;
  onRender: () => void;
  onAdd: (kind: AddKind, at: Point) => void;
  onUpload: (file: File, at: Point) => void;
  onTidy: () => void;
  onTemplates: () => void;
  /** Width covered on the right by the floating inspector, kept clear when fitting. */
  reserveRight?: number;
  mode: ProjectMode;
  deliverables: string[];
}

export type AddKind = 'text' | 'image' | 'video' | 'audio';
export type Point = { x: number; y: number };
type View = { x: number; y: number; k: number };
type Drag = { mode: 'pan' | 'node'; id?: string; sx: number; sy: number; ox: number; oy: number };

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const WAVE = Array.from({ length: 36 }, (_, i) => 0.25 + Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)) * 0.75);

const StatusBadge = ({ node, zh }: { node: CanvasNode; zh: boolean }) => {
  if (node.status === 'generating') return <span className="inline-flex items-center gap-1 text-[10px] text-purple-600"><Loader2 className="w-3 h-3 animate-spin" />{zh ? '生成中' : 'Generating'}</span>;
  if (node.status === 'done') return <span className="text-[10px] text-emerald-600">{zh ? '就绪' : 'Ready'}</span>;
  return <span className="text-[10px] text-gray-400">{zh ? '待生成' : 'Pending'}</span>;
};

type BodyProps = { node: CanvasNode; nodes: CanvasNode[]; lang: Lang; mode: ProjectMode; deliverables: string[]; playing: boolean; onTogglePlay: (id: string) => void; onGenerate: (id: string) => void; onRender: () => void };

const Waveform = ({ color, dim, playing, seconds }: { color: string; dim: boolean; playing: boolean; seconds: number }) => (
  <div className="relative">
    <div className="flex items-end gap-[2px] h-8">
      {WAVE.map((h, i) => <span key={i} className="flex-1 rounded-full" style={{ height: `${h * 100}%`, background: color, opacity: dim ? 0.25 : 0.7 }} />)}
    </div>
    {playing && <motion.span aria-hidden className="absolute inset-y-0 left-0 rounded" style={{ background: `${color}33`, borderRight: `2px solid ${color}` }} initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: seconds, ease: 'linear' }} />}
  </div>
);

const GenerateChip = ({ id, color, label, onGenerate }: { id: string; color: string; label: string; onGenerate: (id: string) => void }) => (
  <button type="button" onClick={() => onGenerate(id)} className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium" style={{ background: color, color: '#fff' }}>
    <Wand2 className="w-3 h-3" />{label}
  </button>
);

const PREVIEW_SECONDS = 8;

const NodeBody = ({ node, nodes, lang, mode, deliverables, playing, onTogglePlay, onGenerate, onRender }: BodyProps) => {
  const zh = lang === 'zh';
  const color = KIND_META[node.kind].color;

  if (node.kind === 'shot') {
    const size = SHOT_SIZES.find(s => s.id === node.shotSize)?.label[lang];
    const cam = CAMERA_MOVES.find(c => c.id === node.camera)?.label[lang];
    return (
      <>
        <div className="relative h-[118px] mx-3 rounded-lg overflow-hidden bg-gray-100">
          {node.image && <img src={node.image} alt="" draggable={false} className={`w-full h-full object-cover transition ${node.status === 'generating' ? 'blur-sm scale-105' : ''}`} />}
          {node.status === 'generating' && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/40">
              <motion.div className="absolute inset-y-0 w-1/2" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,.7), transparent)' }} animate={{ x: ['-100%', '200%'] }} transition={{ duration: 1.2, repeat: Infinity }} />
              <Loader2 className="w-6 h-6 animate-spin" style={{ color }} />
            </div>
          )}
          {node.status === 'idle' && !node.image && (
            <div className="absolute inset-0 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
              <GenerateChip id={node.id} color={color} label={zh ? '生成画面' : 'Generate'} onGenerate={onGenerate} />
            </div>
          )}
        </div>
        <div className="px-3 pt-2.5">
          <div className="text-sm font-semibold text-gray-900 truncate">{node.title}</div>
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-500">
            <span className="rounded bg-gray-100 px-1.5 py-0.5">{size}</span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5">{cam}</span>
            <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono">{node.duration}s</span>
          </div>
        </div>
      </>
    );
  }
  if (node.kind === 'character') {
    return (
      <div className="px-3 flex gap-3 items-center">
        {node.image && <img src={node.image} alt="" draggable={false} className="w-16 h-16 rounded-xl object-cover" />}
        <div className="min-w-0">
          <div className="text-sm font-bold text-gray-900">{node.title}</div>
          <div className="text-[11px] text-gray-500 mt-1 leading-snug line-clamp-3">{node.prompt}</div>
        </div>
      </div>
    );
  }
  if (node.kind === 'lyrics') {
    return (
      <div className="px-3">
        <div className="text-sm font-bold text-gray-900 truncate">{node.title}</div>
        <div className={`mt-1.5 text-[11px] leading-[1.55] text-gray-600 whitespace-pre-line line-clamp-6 ${node.status === 'generating' ? 'animate-pulse' : ''}`}>
          {node.prompt.split('\n').map((line, i) => /^\[.*\]$/.test(line)
            ? <span key={i} className="block font-semibold" style={{ color }}>{line.slice(1, -1)}</span>
            : <span key={i} className="block">{line}</span>)}
        </div>
      </div>
    );
  }
  if (node.kind === 'audio' || node.kind === 'vocal') {
    const ready = node.status === 'done';
    const meta = node.kind === 'audio'
      ? [labelOf(GENRES, node.genre, lang), labelOf(MOODS, node.mood, lang), node.bpm && `${node.bpm} BPM`]
      : [labelOf(VOICE_STYLES, node.voiceStyle, lang), zh ? '专属声线' : 'Own voice'];
    return (
      <div className="px-3">
        <div className="flex items-center gap-2 mb-2">
          <button type="button" disabled={!ready} onClick={() => onTogglePlay(node.id)} aria-label={playing ? (zh ? '暂停试听' : 'Pause') : (zh ? '试听' : 'Preview')}
            className="w-7 h-7 shrink-0 rounded-full inline-flex items-center justify-center disabled:opacity-40" style={{ background: color, color: '#fff' }}>
            {playing ? <Pause className="w-3 h-3" /> : node.kind === 'vocal' && !ready ? <Mic2 className="w-3 h-3" /> : <Play className="w-3 h-3 ml-0.5" />}
          </button>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-gray-900 truncate">{node.title}</div>
            <div className="text-[10px] text-gray-500 truncate">{meta.filter(Boolean).join(' · ')}{node.duration ? ` · ${fmtDuration(node.duration)}` : ''}</div>
          </div>
        </div>
        <Waveform color={color} dim={!ready} playing={playing} seconds={PREVIEW_SECONDS} />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[10px] text-gray-500 truncate max-w-[60%]">{node.prompt}</span>
          {node.status === 'idle' && <GenerateChip id={node.id} color={color} label={node.kind === 'vocal' ? (zh ? '演唱' : 'Sing') : (zh ? '生成' : 'Generate')} onGenerate={onGenerate} />}
        </div>
      </div>
    );
  }
  if (node.kind === 'output') {
    const parts = nodes.filter(isGeneratable);
    const ready = parts.filter(n => n.status === 'done').length;
    const shots = orderedShots(nodes);
    const length = mode === 'music' ? (nodes.find(n => n.kind === 'audio')?.duration ?? 0) : shots.reduce((a, s) => a + (s.duration || 0), 0);
    const cover = shots.find(s => s.image)?.image ?? nodes.find(n => n.kind === 'character')?.image;
    return (
      <div className="px-3">
        <div className="relative h-[78px] rounded-lg overflow-hidden" style={{ background: '#111827' }}>
          {cover && <img src={cover} alt="" draggable={false} className={`w-full h-full object-cover ${node.status === 'done' ? '' : 'opacity-40 grayscale'}`} />}
          <div className="absolute inset-0 flex items-center justify-center">
            {node.status === 'generating'
              ? <Loader2 className="w-6 h-6 animate-spin" style={{ color: '#fff' }} />
              : <span className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,.9)' }}><Play className="w-3.5 h-3.5 ml-0.5" style={{ color }} /></span>}
          </div>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1 h-[18px] overflow-hidden">
          {deliverables.map(d => <span key={d} className="rounded px-1.5 text-[9px] leading-[18px]" style={{ background: `${color}14`, color: '#0e7490' }}>{d}</span>)}
        </div>
        <div className="mt-1 flex items-center justify-between text-[11px] text-gray-500">
          <span>{zh ? `${ready}/${parts.length} 项就绪` : `${ready}/${parts.length} ready`}</span>
          <span className="font-mono">{fmtDuration(length)}</span>
        </div>
        <button type="button" onClick={onRender} disabled={node.status === 'generating'}
          className="mt-1.5 w-full h-8 rounded-lg text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-60"
          style={{ background: node.status === 'done' ? '#ecfeff' : color, color: node.status === 'done' ? '#0e7490' : '#fff' }}>
          <Clapperboard className="w-3.5 h-3.5" />
          {node.status === 'generating' ? (mode === 'music' ? (zh ? '混音中…' : 'Mixing…') : (zh ? '合成中…' : 'Rendering…'))
            : node.status === 'done' ? (zh ? '已完成 · 重新制作' : 'Done · Redo')
            : mode === 'music' ? (zh ? '混音并制作交付' : 'Mix & deliver') : (zh ? '合成成片' : 'Render')}
        </button>
      </div>
    );
  }
  if (node.kind === 'product' || node.kind === 'knowledge') {
    // "卖点：30 秒出汁" style lines → label + value rows.
    const rows = node.prompt.split('\n').filter(Boolean).slice(0, 4).map(line => {
      const i = line.search(/[：:]/);
      return i > 0 ? [line.slice(0, i), line.slice(i + 1).trim()] : ['', line];
    });
    return (
      <div className="px-3">
        <div className="text-sm font-bold text-gray-900 truncate">{node.title}</div>
        <div className="mt-1.5 space-y-1">
          {rows.map(([k, v], i) => (
            <div key={i} className="flex gap-1.5 text-[11px] leading-snug">
              {k && <span className="shrink-0 rounded px-1 font-medium" style={{ background: `${color}14`, color }}>{k}</span>}
              <span className="text-gray-600 truncate">{v}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return <div className="px-3 text-[12px] text-gray-600 leading-relaxed line-clamp-4"><div className="text-sm font-bold text-gray-900 mb-1">{node.title}</div>{node.prompt}</div>;
};

const ADD_ITEMS: Array<{ kind: AddKind | 'upload'; icon: React.ComponentType<{ className?: string }>; label: { zh: string; en: string }; desc: { zh: string; en: string } }> = [
  { kind: 'text', icon: FileText, label: { zh: '文字', en: 'Text' }, desc: { zh: '写设定、剧本或提示词', en: 'Notes, script or prompts' } },
  { kind: 'image', icon: ImageIcon, label: { zh: '图片生成', en: 'Image' }, desc: { zh: '写一句描述出图，可以加参考图', en: 'Describe it, add a reference' } },
  { kind: 'video', icon: Video, label: { zh: '视频生成', en: 'Video' }, desc: { zh: '用描述或一张首帧出视频', en: 'From a prompt or first frame' } },
  { kind: 'audio', icon: Music2, label: { zh: '配音 / 配乐', en: 'Voice / music' }, desc: { zh: '选一个声音，把台词念出来', en: 'Pick a voice for your lines' } },
  { kind: 'upload', icon: Upload, label: { zh: '上传素材', en: 'Upload' }, desc: { zh: '图片、视频或音频', en: 'Images, video or audio' } },
];

type Tool = 'select' | 'hand';
type AddMenu = { left: number; top: number; at: Point } | null;

const RailButton = ({ icon: Icon, label, active, onClick, ariaExpanded, iconOnly }: { icon: React.ComponentType<{ className?: string }>; label: string; active?: boolean; onClick: () => void; ariaExpanded?: boolean; iconOnly?: boolean }) => (
  <button type="button" onClick={onClick} aria-pressed={active} aria-expanded={ariaExpanded} aria-label={label} title={iconOnly ? label : undefined}
    className={`w-full h-9 rounded-xl inline-flex items-center gap-2 text-xs font-medium transition ${iconOnly ? 'justify-center px-0' : 'px-2.5'} ${active ? '' : 'text-gray-600 hover:bg-gray-100'}`}
    style={active ? { background: '#111827', color: '#fff' } : undefined}>
    <Icon className="w-4 h-4 shrink-0" />{!iconOnly && label}
  </button>
);

export const DirectorCanvas = ({ lang, nodes, edges, selectedId, fitSignal, onSelect, onMove, onGenerate, onRender, onAdd, onUpload, onTidy, onTemplates, reserveRight = 0, mode, deliverables }: Props) => {
  const zh = lang === 'zh';
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadAt = useRef<Point>({ x: 0, y: 0 });
  const drag = useRef<Drag | null>(null);
  const [view, setView] = useState<View>({ x: 24, y: 24, k: 0.8 });
  const [panning, setPanning] = useState(false);
  const [tool, setTool] = useState<Tool>('select');
  const [spaceHeld, setSpaceHeld] = useState(false);
  const [menu, setMenu] = useState<AddMenu>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const handMode = tool === 'hand' || spaceHeld;
  // Narrow canvases (laptops with chat + rails) get an icon-only tool rail to leave room for nodes.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setNarrow(entry.contentRect.width < 760));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Simulated audition: stop after the preview length.
  useEffect(() => {
    if (!playingId) return;
    const t = window.setTimeout(() => setPlayingId(null), PREVIEW_SECONDS * 1000);
    return () => window.clearTimeout(t);
  }, [playingId]);
  const togglePlay = (id: string) => setPlayingId(p => (p === id ? null : id));
  const byId = new Map(nodes.map(n => [n.id, n]));

  // Hold Space to pan temporarily — only while the pointer is over the canvas, never while typing or on a focused control.
  const hovering = useRef(false);
  useEffect(() => {
    const busy = (e: KeyboardEvent) => (e.target as HTMLElement).closest('input, textarea, select, button, [contenteditable="true"]');
    const down = (e: KeyboardEvent) => { if (e.code === 'Space' && hovering.current && !busy(e)) { e.preventDefault(); setSpaceHeld(true); } };
    const up = (e: KeyboardEvent) => { if (e.code === 'Space') setSpaceHeld(false); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el || !nodes.length) return;
    const minX = Math.min(...nodes.map(n => n.x)), minY = Math.min(...nodes.map(n => n.y));
    const maxX = Math.max(...nodes.map(n => n.x + NODE_W)), maxY = Math.max(...nodes.map(n => n.y + NODE_H[n.kind]));
    const rect = el.getBoundingClientRect();
    const left = narrow ? 64 : 120; // keep clear of the tool rail
    const width = rect.width - (window.innerWidth >= 1024 ? reserveRight : 0) - left, height = rect.height;
    const k = clamp(Math.min((width - 40) / (maxX - minX), (height - 100) / (maxY - minY)), 0.35, 1.1);
    setView({ k, x: left + (width - (maxX - minX) * k) / 2 - minX * k, y: (height - (maxY - minY) * k) / 2 - minY * k });
  }, [nodes, reserveRight, narrow]);

  // Fit on mount and whenever the parent asks (e.g. after the AI adds nodes).
  const fitRef = useRef(fit);
  fitRef.current = fit;
  useEffect(() => { const t = window.setTimeout(() => fitRef.current(), 30); return () => window.clearTimeout(t); }, [fitSignal]);
  // Re-fit once the rail switches between compact and full width.
  useEffect(() => { const t = window.setTimeout(() => fitRef.current(), 30); return () => window.clearTimeout(t); }, [narrow]);

  const zoomAt = (factor: number, px?: number, py?: number) => setView(v => {
    const rect = ref.current?.getBoundingClientRect();
    const cx = px ?? (rect ? rect.width / 2 : 0), cy = py ?? (rect ? rect.height / 2 : 0);
    const k = clamp(v.k * factor, 0.3, 2);
    return { k, x: cx - (cx - v.x) * (k / v.k), y: cy - (cy - v.y) * (k / v.k) };
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('[data-ui]')) return;
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        zoomAt(Math.exp(-e.deltaY * 0.01), e.clientX - rect.left, e.clientY - rect.top);
      } else setView(v => ({ ...v, x: v.x - e.deltaX, y: v.y - e.deltaY }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Close the add menu on Escape or any press outside it (e.g. in the chat).
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: PointerEvent) => { if (!(e.target as HTMLElement).closest('[role="menu"], [aria-expanded]')) setMenu(null); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('pointerdown', onDown, true); window.removeEventListener('keydown', onKey); };
  }, [menu]);
  const capture = (id: number) => { try { ref.current?.setPointerCapture(id); } catch { /* pointer already released */ } };

  const toWorld = (clientX: number, clientY: number): Point => {
    const rect = ref.current?.getBoundingClientRect();
    return { x: Math.round((clientX - (rect?.left ?? 0) - view.x) / view.k), y: Math.round((clientY - (rect?.top ?? 0) - view.y) / view.k) };
  };
  const viewCenter = (): Point => {
    const rect = ref.current?.getBoundingClientRect();
    return toWorld((rect?.left ?? 0) + (rect?.width ?? 0) / 2 - NODE_W / 2, (rect?.top ?? 0) + (rect?.height ?? 0) / 2 - 100);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, [data-ui]')) return;
    setMenu(null);
    drag.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, ox: view.x, oy: view.y };
    setPanning(true);
    if (!handMode) onSelect(null);
    capture(e.pointerId);
  };
  const onNodePointerDown = (e: React.PointerEvent, node: CanvasNode) => {
    if (handMode || e.button !== 0 || (e.target as HTMLElement).closest('button')) return;
    e.stopPropagation();
    setMenu(null);
    onSelect(node.id);
    drag.current = { mode: 'node', id: node.id, sx: e.clientX, sy: e.clientY, ox: node.x, oy: node.y };
    capture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
    if (d.mode === 'pan') setView(v => ({ ...v, x: d.ox + dx, y: d.oy + dy }));
    else if (d.id) onMove(d.id, Math.round(d.ox + dx / view.k), Math.round(d.oy + dy / view.k));
  };
  const endDrag = () => { drag.current = null; setPanning(false); };

  const openMenuAt = (clientX: number, clientY: number, at: Point) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setMenu({ left: clamp(clientX - rect.left, 8, rect.width - 240), top: clamp(clientY - rect.top, 8, rect.height - 260), at });
  };
  const onDoubleClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-node], [data-ui], button')) return;
    openMenuAt(e.clientX, e.clientY, toWorld(e.clientX - NODE_W / 2, e.clientY - 40));
  };
  const choose = (kind: AddKind | 'upload', at: Point) => {
    setMenu(null);
    if (kind === 'upload') { uploadAt.current = at; fileRef.current?.click(); return; }
    onAdd(kind, at);
  };

  const cursor = panning ? 'cursor-grabbing' : handMode ? 'cursor-grab' : 'cursor-default';

  return (
    <div ref={ref} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endDrag} onPointerCancel={endDrag} onDoubleClick={onDoubleClick}
      onPointerEnter={() => { hovering.current = true; }} onPointerLeave={() => { hovering.current = false; setSpaceHeld(false); }}
      className={`relative h-full w-full overflow-hidden select-none touch-none ${cursor}`}
      style={{ background: '#f5f6fa', backgroundImage: 'radial-gradient(#d3d7e3 1px, transparent 1px)', backgroundSize: `${20 * view.k}px ${20 * view.k}px`, backgroundPosition: `${view.x}px ${view.y}px` }}>
      <style>{'@keyframes director-dash{to{stroke-dashoffset:-24}}.director-flow{animation:director-dash .8s linear infinite}'}</style>
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}>
        <svg className="absolute left-0 top-0 overflow-visible pointer-events-none" width="1" height="1">
          {edges.map(edge => {
            const a = byId.get(edge.from), b = byId.get(edge.to);
            if (!a || !b) return null;
            const x1 = a.x + NODE_W, y1 = a.y + NODE_H[a.kind] / 2, x2 = b.x, y2 = b.y + NODE_H[b.kind] / 2;
            const c = Math.max(60, Math.abs(x2 - x1) / 2);
            const hot = selectedId === a.id || selectedId === b.id;
            const busy = a.status === 'generating' || b.status === 'generating';
            return (
              <g key={`${edge.from}-${edge.to}`}>
                <path d={`M${x1},${y1} C${x1 + c},${y1} ${x2 - c},${y2} ${x2},${y2}`} fill="none" stroke={KIND_META[a.kind].color} strokeOpacity={hot ? 0.9 : 0.35} strokeWidth={hot ? 2.5 : 1.6}
                  strokeDasharray={busy ? '6 6' : undefined} className={busy ? 'director-flow' : undefined} />
                <circle cx={x2} cy={y2} r="3.5" fill="#fff" stroke={KIND_META[a.kind].color} strokeWidth="1.5" />
              </g>
            );
          })}
        </svg>

        {nodes.map(node => {
          const meta = KIND_META[node.kind];
          const selected = node.id === selectedId;
          return (
            <motion.div key={node.id} data-node initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
              onPointerDown={e => onNodePointerDown(e, node)}
              className={`absolute rounded-2xl bg-white ${handMode ? '' : 'cursor-move'}`}
              style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H[node.kind],
                boxShadow: selected ? `0 0 0 2px ${meta.color}, 0 16px 40px -12px ${meta.color}66` : '0 1px 2px rgba(15,23,42,.06), 0 8px 24px -12px rgba(15,23,42,.18)',
                border: selected ? 'none' : '1px solid #e5e7eb' }}>
              <div className="flex items-center justify-between px-3 pt-2.5 pb-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold" style={{ color: meta.color }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: meta.color }} />{node.badge ?? meta.label[lang]}
                </span>
                <StatusBadge node={node} zh={zh} />
              </div>
              <NodeBody node={node} nodes={nodes} lang={lang} mode={mode} deliverables={deliverables} playing={playingId === node.id} onTogglePlay={togglePlay} onGenerate={onGenerate} onRender={onRender} />
            </motion.div>
          );
        })}
      </div>

      {/* Tool rail */}
      <div data-ui onPointerDown={e => e.stopPropagation()} className={`absolute left-3 top-3 ${narrow ? 'w-[48px]' : 'w-[104px]'} rounded-2xl border border-gray-200 bg-white p-1.5 shadow-lg shadow-gray-900/5 space-y-0.5 cursor-default`}>
        <RailButton iconOnly={narrow} icon={Hand} label={zh ? '平移' : 'Pan'} active={tool === 'hand'} onClick={() => setTool('hand')} />
        <RailButton iconOnly={narrow} icon={MousePointer2} label={zh ? '选择' : 'Select'} active={tool === 'select'} onClick={() => setTool('select')} />
        <div className="h-px bg-gray-100 my-1" />
        <button type="button" aria-expanded={!!menu}
          onClick={e => { if (menu) { setMenu(null); return; } const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); openMenuAt(r.right + 8, r.top, viewCenter()); }}
          aria-label={zh ? '添加' : 'Add'} title={narrow ? (zh ? '添加' : 'Add') : undefined}
          className={`w-full h-9 rounded-xl inline-flex items-center gap-2 text-xs font-semibold transition ${narrow ? 'justify-center' : 'px-2.5'}`}
          style={{ background: 'linear-gradient(90deg, #06b6d4, #8b5cf6)', color: '#fff' }}>
          <Plus className="w-4 h-4" />{!narrow && (zh ? '添加' : 'Add')}
        </button>
        <RailButton iconOnly={narrow} icon={LayoutTemplate} label={zh ? '模板' : 'Templates'} onClick={onTemplates} />
        <RailButton iconOnly={narrow} icon={LayoutGrid} label={zh ? '整理' : 'Tidy up'} onClick={onTidy} />
      </div>

      {/* Add menu (rail button or double-click) */}
      {menu && (
        <div data-ui onPointerDown={e => e.stopPropagation()} role="menu" className="absolute z-20 w-[220px] rounded-2xl border border-gray-200 bg-white p-1.5 shadow-xl shadow-gray-900/10 cursor-default" style={{ left: menu.left, top: menu.top }}>
          {ADD_ITEMS.map((item, i) => (
            <React.Fragment key={item.kind}>
              {i === ADD_ITEMS.length - 1 && <div className="h-px bg-gray-100 my-1" />}
              <button type="button" role="menuitem" onClick={() => choose(item.kind, menu.at)} className="w-full rounded-xl px-2.5 py-2 text-left hover:bg-gray-50 flex items-center gap-2.5">
                <item.icon className="w-4 h-4 text-gray-500 shrink-0" />
                <span className="text-sm text-gray-800">{item.label[lang]}</span>
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Empty canvas */}
      {nodes.length === 0 && (
        <div data-ui onPointerDown={e => e.stopPropagation()} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(640px,calc(100%-160px))] rounded-3xl border border-gray-200 bg-white p-6 shadow-xl shadow-gray-900/5 text-center cursor-default">
          <div className="text-lg font-bold text-gray-900">{zh ? '这张画布还是空的' : 'This canvas is empty'}</div>
          <p className="text-xs text-gray-500 mt-1.5">{zh ? '在左边告诉 AI 导演你想做什么，它会把每一步放进画布。也可以自己选一个开始：' : 'Tell the AI director what you want on the left and it will build the canvas step by step. Or start here:'}</p>
          <div className="mt-5 grid grid-cols-2 sm:grid-cols-5 gap-2 text-left">
            {ADD_ITEMS.map(item => (
              <button key={item.kind} type="button" onClick={() => choose(item.kind, viewCenter())}
                className="rounded-2xl border border-gray-200 p-3 text-left hover:border-purple-300 hover:bg-purple-50/40 transition">
                <item.icon className="w-4 h-4 text-gray-700" />
                <div className="text-sm font-semibold text-gray-900 mt-2">{item.label[lang]}</div>
                <div className="text-[11px] text-gray-500 mt-1 leading-snug">{item.desc[lang]}</div>
              </button>
            ))}
          </div>
          <div className="mt-4 text-[11px] text-gray-500">
            {zh ? '双击画布空白处也能添加 · ' : 'Double-click empty space to add · '}
            <button type="button" onClick={onTemplates} className="text-[11px] font-medium text-purple-600 hover:underline">{zh ? '从模板开始' : 'Start from a template'}</button>
          </div>
        </div>
      )}

      {/* Zoom */}
      <div data-ui onPointerDown={e => e.stopPropagation()} className="absolute bottom-3 left-3 flex items-center gap-0.5 rounded-xl border border-gray-200 bg-white px-1 py-1 shadow-md shadow-gray-900/5 cursor-default">
        <button type="button" aria-label={zh ? '缩小' : 'Zoom out'} onClick={() => zoomAt(1 / 1.2)} className="w-7 h-7 rounded-lg text-gray-600 hover:bg-gray-100 inline-flex items-center justify-center"><Minus className="w-3.5 h-3.5" /></button>
        <span className="w-11 text-center text-[11px] font-mono text-gray-600">{Math.round(view.k * 100)}%</span>
        <button type="button" aria-label={zh ? '放大' : 'Zoom in'} onClick={() => zoomAt(1.2)} className="w-7 h-7 rounded-lg text-gray-600 hover:bg-gray-100 inline-flex items-center justify-center"><Plus className="w-3.5 h-3.5" /></button>
        <button type="button" aria-label={zh ? '适应画布' : 'Fit to screen'} onClick={fit} className="w-7 h-7 rounded-lg text-gray-600 hover:bg-gray-100 inline-flex items-center justify-center"><Maximize2 className="w-3.5 h-3.5" /></button>
        <span className="hidden xl:inline pl-2 pr-1.5 text-[10px] text-gray-400 border-l border-gray-100"><AlignLeft className="w-3 h-3 inline mr-1" />{zh ? '空格拖动平移 · ⌘/Ctrl + 滚轮缩放' : 'Space-drag to pan · ⌘/Ctrl + scroll to zoom'}</span>
      </div>

      <input ref={fileRef} type="file" accept="image/*,video/*,audio/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(f, uploadAt.current); e.target.value = ''; }} />
    </div>
  );
};
