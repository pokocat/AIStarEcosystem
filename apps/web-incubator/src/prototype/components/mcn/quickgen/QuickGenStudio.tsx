/**
 * AI 视频 / AI 图片：选场景 → 放素材 → 写想法（或交给 AI 编导）→ 生成。
 * 生成在本地模拟；视频进入共享作品库，可送审到发布池，图片可一键做成视频；
 * 任何结果都能「发到导演台」放进当前项目。AI 导演台也通过 `embed` 复用同一个生成器，
 * 为某个镜头或资产出图 / 出视频，结果一键回填。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowUp, Check, ChevronDown, Clapperboard, CornerDownLeft, Cpu, Download, Film, ImageIcon, Play, Plus, Send, SlidersHorizontal, Sparkles, Trash2, Wand2, X,
} from 'lucide-react';
import type { Lang } from '../../../translations';
import type { SolutionId } from '../../../data/ipPlatform';
import { MOCK_ARTISTS, type Artist } from '../ArtistTypes';
import { addToPool, primeTimeSlot } from '../publishPoolStore';
import { addWork } from '../director/studioStorage';
import type { DirectorImport } from '../director/handoff';
import { TRACKS } from '../workshopData';
import {
  DEFAULT_IMAGE, DEFAULT_VIDEO, FREE_IMAGE, IMAGE_MODELS, IMAGE_OPTIONS, SHOT_VIDEO, VIDEO_MODELS, VIDEO_OPTIONS, defaultScene, findScene, groupsOf, imageCost,
  recommendedScenes, scenesOf, videoCost, writeScript, type GenKind, type ImageParams, type Scene, type VideoParams,
} from './sceneData';
import { ScenePicker } from './ScenePicker';
import { SendToDirectorMenu } from './SendToDirectorMenu';
import { SlotTile, emptySlot, slotFilled, type SlotValue } from './SlotTiles';
import { removeGeneration, startGeneration, updateGeneration, useQuickGen, type Generation } from './quickgenStore';

/** Running the generator for one shot or asset inside the AI 导演台. */
export interface QuickGenEmbed {
  /** Tags generations made for this target so the panel can list them, e.g. `scope:shot:id`. */
  target: string;
  /** Button on each result, e.g. 用到镜头 2. */
  useLabel: string;
  /** Recorded on the generation once used, e.g. 《雨夜》镜头 2. */
  usedLabel: string;
  prompt: string;
  ratio?: string;
  /** Current frame or asset image, pre-filled as the reference. */
  reference?: string;
  /** Frames the simulated render draws from (the project's style pool). */
  pool: string[];
  onUse: (g: Generation, image: string) => void;
}

interface Props {
  lang: Lang;
  kind: GenKind;
  solutionId: SolutionId;
  activeArtist: Artist;
  /** An image handed over from AI 图片 › 做成视频. */
  seed?: { image: string; id: number } | null;
  onMakeVideo?: (image: string) => void;
  onOpenDirector?: (preset: { name: string; description: string }) => void;
  onOpenPublish?: () => void;
  /** 发到导演台: hand a result to the AI 导演台's current or a new project. */
  onSendToDirector?: (handoff: DirectorImport) => void;
  embed?: QuickGenEmbed;
  /** Left of the input toolbar: the AI 创作 mode menu. */
  modeMenu?: React.ReactNode;
  /** Generating for one shot or asset: shown in the context strip, clearable. */
  target?: { label: string; onClear: () => void };
}

const uid = () => `qg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const LIMIT: Record<GenKind, number> = { video: 7000, image: 32000 };
const RENDER_MS: Record<GenKind, number> = { video: 5200, image: 2600 };
const ratioBox = (r: string) => { const [w, h] = r.split(':').map(Number); return `${w} / ${h}`; };
const isBlob = (u: string) => u.startsWith('blob:');
let poolCursor = 0;
const fromPool = (pool: string[]) => pool[poolCursor++ % pool.length];

const slotsFor = (scene: Scene, artistId: string, keep?: Record<string, SlotValue>) =>
  Object.fromEntries(scene.slots.map(d => {
    const prev = keep?.[d.id];
    return [d.id, prev && prev.type === emptySlot(d, artistId).type ? prev : emptySlot(d, artistId)];
  })) as Record<string, SlotValue>;

/** Result frames: the scene's own photography plus its siblings, so a batch is not one picture repeated. */
const framesFor = (scene: Scene, count: number, uploads: string[]) => {
  const siblings = scenesOf(scene.kind).filter(s => s.group === scene.group && s.id !== scene.id).map(s => s.cover);
  const pool = [...(scene.id === 'free' ? uploads : []), scene.cover, ...siblings];
  return Array.from({ length: count }, (_, i) => pool[i % pool.length]);
};

export const QuickGenStudio = ({ lang, kind, solutionId, activeArtist, seed, onMakeVideo, onOpenDirector, onOpenPublish, onSendToDirector, embed, modeMenu, target }: Props) => {
  const zh = lang === 'zh';
  const t = (v: { zh: string; en: string }) => (zh ? v.zh : v.en);
  const directorScope = `${solutionId}:${activeArtist.id}`;
  const recommended = useMemo(() => {
    const picks = recommendedScenes(solutionId, kind);
    return embed && kind === 'video' ? [SHOT_VIDEO, ...picks] : picks;
  }, [solutionId, kind, embed]);
  // Inside the AI 导演台 the panel opens on a single shot / free image, pre-filled from the target.
  const startScene = () => (embed ? (kind === 'video' ? SHOT_VIDEO : FREE_IMAGE) : defaultScene(solutionId, kind));
  const startSlots = (s: Scene) => {
    const base = slotsFor(s, activeArtist.id);
    const ref = embed?.reference && !isBlob(embed.reference) ? embed.reference : undefined;
    const slotId = ref && s.slots.find(d => d.type === 'image')?.id;
    return slotId && ref ? { ...base, [slotId]: { type: 'image' as const, images: [ref] } } : base;
  };
  const fitRatio = (options: string[], fallback: string) => (embed?.ratio && options.includes(embed.ratio) ? embed.ratio : fallback);
  const [scene, setScene] = useState<Scene>(startScene);
  const [slots, setSlots] = useState(() => startSlots(scene));
  const [prompt, setPrompt] = useState(() => embed?.prompt ?? '');
  const [vp, setVp] = useState<VideoParams>(() => (embed ? { ...DEFAULT_VIDEO, duration: 5, ratio: fitRatio(VIDEO_OPTIONS.ratios, DEFAULT_VIDEO.ratio) } : DEFAULT_VIDEO));
  const [ip, setIp] = useState<ImageParams>(() => (embed ? { ...DEFAULT_IMAGE, ratio: fitRatio(IMAGE_OPTIONS.ratios, DEFAULT_IMAGE.ratio) } : DEFAULT_IMAGE));
  const { gens, balance, progress } = useQuickGen();
  const mine = gens.filter(g => g.kind === kind && (!embed || g.target === embed.target));
  const library = embed ? gens.filter(g => g.kind === kind && g.status === 'done') : [];
  const [view, setView] = useState<'works' | 'library' | 'example'>(() => (mine.length ? 'works' : embed && library.length ? 'library' : 'example'));
  const [drafting, setDrafting] = useState(false);
  const [paramsOpen, setParamsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const streamRef = useRef<HTMLDivElement>(null);
  const urls = useRef<string[]>([]);
  const timers = useRef<number[]>([]);

  useEffect(() => () => { timers.current.forEach(clearTimeout); urls.current.forEach(u => URL.revokeObjectURL(u)); }, []);
  // Keep the newest generation in view, like a chat.
  useEffect(() => { streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: 'smooth' }); }, [mine.length]);
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(null), 2600); return () => clearTimeout(id); }, [toast]);
  // Following the console's active IP keeps the cast slot in sync when the user switches IP in the sidebar.
  useEffect(() => {
    setSlots(s => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.type === 'character' && v.artistId ? { ...v, artistId: activeArtist.id } : v])));
  }, [activeArtist.id]);

  // 做成视频: drop the image into the first image slot, switching to a scene that has one if needed.
  const handledSeed = useRef<number | null>(null);
  useEffect(() => {
    if (!seed || handledSeed.current === seed.id || kind !== 'video') return;
    handledSeed.current = seed.id;
    const target = scene.slots.some(d => d.type === 'image') ? scene
      : recommended.find(s => s.slots.some(d => d.type === 'image')) ?? findScene('video', 'seeding')!;
    const base = target === scene ? slots : slotsFor(target, activeArtist.id, slots);
    const slotId = target.slots.find(d => d.type === 'image')!.id;
    const cur = base[slotId];
    setScene(target);
    setSlots({ ...base, [slotId]: { type: 'image', images: [seed.image, ...(cur?.type === 'image' ? cur.images : [])].slice(0, 3) } });
    setView('example');
    setToast(zh ? '图片已放入素材，写几句想法就能生成视频' : 'Image added — describe the video to generate');
  }, [seed]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickScene = (s: Scene) => {
    setScene(s);
    setSlots(prev => slotsFor(s, activeArtist.id, prev));
    if (!mine.length) setView('example');
  };
  const reset = () => { const s = startScene(); setScene(s); setSlots(startSlots(s)); setPrompt(embed?.prompt ?? ''); setView(mine.length ? 'works' : 'example'); };

  const castId = Object.values(slots).find((v): v is Extract<SlotValue, { type: 'character' }> => v.type === 'character')?.artistId ?? null;
  const cast = MOCK_ARTISTS.find(a => a.id === castId);
  const uploads = Object.values(slots).flatMap(v => (v.type === 'image' ? v.images : []));
  const cost = kind === 'video' ? videoCost(vp) : imageCost(ip);
  const promptNeeded = kind === 'video' || scene.id === 'free';

  const missing = (() => {
    const slot = scene.slots.find(d => !d.optional && !slotFilled(slots[d.id]));
    if (slot) return zh ? `先放${slot.label.zh}` : `Add ${slot.label.en.toLowerCase()} first`;
    if (promptNeeded && !prompt.trim()) return kind === 'video' ? (zh ? '写几句想法，或点「AI 编导」' : 'Write an idea, or use AI Writer') : (zh ? '写一句想要的画面' : 'Describe the image you want');
    if (balance < cost) return zh ? '星币不足，请到 设置 › 订阅与账单 充值' : 'Not enough credits';
    return null;
  })();

  const insertChip = (label: string) => {
    const next = `${prompt}${prompt && !prompt.endsWith('\n') ? '\n' : ''}${label}${zh ? '：' : ': '}`;
    setPrompt(next.slice(0, LIMIT[kind]));
    requestAnimationFrame(() => { const el = textRef.current; if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } });
  };

  const aiDraft = () => {
    setDrafting(true);
    const id = window.setTimeout(() => {
      setPrompt(writeScript(scene, prompt, cast?.name ?? '', vp.duration, zh).slice(0, LIMIT.video));
      setDrafting(false);
    }, 700);
    timers.current.push(id);
  };

  const useExample = () => {
    if (kind === 'video') setPrompt(writeScript(scene, '', cast?.name ?? '', vp.duration, zh));
    else setPrompt(zh ? `${scene.tagline.zh}。${scene.guide[1].zh}，${scene.guide[5].zh}。` : `${scene.tagline.en}. ${scene.guide[1].en}. ${scene.guide[5].en}.`);
    textRef.current?.focus();
  };

  const generate = () => {
    if (missing) return;
    const id = uid();
    // Title from the user's own words: skip AI 编导 headers and numbered beats, unwrap "素材要点：".
    const firstLine = prompt.split('\n').map(l => l.trim())
      .filter(l => l && !/^[【[]/.test(l) && !/^\d+\./.test(l) && !/^(画面|Shot)[:：]/.test(l))
      .map(l => l.replace(/^(素材要点|Notes)[:：]\s*/, '').replace(/^[^：:]{1,8}[：:]\s*/, ''))
      .find(Boolean) ?? '';
    const title = `${t(scene.name)}${firstLine ? ` · ${firstLine.slice(0, 14)}` : ''}`;
    // In the AI 导演台 the render follows the project's frame pool (and keeps the reference frame for video).
    const images = embed
      ? (kind === 'video' ? [uploads.find(u => !isBlob(u)) ?? fromPool(embed.pool)] : Array.from({ length: ip.count }, () => fromPool(embed.pool)))
      : kind === 'video' ? [scene.cover] : framesFor(scene, ip.count, uploads);
    const g: Generation = {
      id, kind, sceneId: scene.id, title, prompt, createdAt: Date.now(), status: 'generating', images,
      ratio: kind === 'video' ? vp.ratio : ip.ratio, duration: kind === 'video' ? vp.duration : undefined, cost, target: embed?.target,
    };
    const ratio = vp.ratio, duration = vp.duration;
    startGeneration(g, RENDER_MS[kind], () => {
      // A single shot made for the director is part of its project, not a standalone work.
      if (kind !== 'video' || embed) return;
      const d = new Date();
      addWork({ id, title, status: 'Draft', plays: '-', date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`, formats: [`${ratio} · ${duration}s`] }, TRACKS);
    });
    setView('works');
  };

  const use = (g: Generation, image: string) => {
    if (!embed) return;
    updateGeneration(g.id, { usedIn: embed.usedLabel });
    embed.onUse(g, image);
  };

  const sendToDirector = (g: Generation, image: string, to: DirectorImport['to']) => {
    onSendToDirector?.({ media: { genId: g.id, kind: g.kind, image, title: g.title, prompt: g.prompt, duration: g.duration }, to });
  };

  const sendToPool = (g: Generation) => {
    const who = cast ?? activeArtist;
    addToPool({
      id: g.id, type: 'director', title: g.title, partnerName: who.name, platform: 'DY', account: `@${who.name}`, status: 'pending_review',
      scheduledAt: primeTimeSlot(1), preCheck: { auth: true, watermark: true, quality: null }, duration: `0:${String(g.duration ?? 15).padStart(2, '0')}`,
      thumbColor: '#7c3aed', thumbImage: g.images[0], formats: [g.ratio],
    });
    updateGeneration(g.id, { sentToPool: true });
    setToast(zh ? '已送审，作品在 发布中心 › 发布池 等待审核' : 'Sent to the publish pool for review');
  };

  const remove = (id: string) => removeGeneration(id);

  const models = kind === 'video' ? VIDEO_MODELS : IMAGE_MODELS;
  const model = kind === 'video' ? vp.model : ip.model;
  const setModel = (m: string) => (kind === 'video' ? setVp(p => ({ ...p, model: m })) : setIp(p => ({ ...p, model: m })));
  const paramSummary = kind === 'video'
    ? `${vp.lang === 'zh' ? (zh ? '中文' : 'Chinese') : (zh ? '英文' : 'English')} · ${vp.duration}${zh ? ' 秒' : 's'} · ${vp.ratio} · ${vp.res}`
    : `${ip.ratio} · ${ip.quality} · ${ip.count}${zh ? ' 张' : ''}`;
  const groupName = groupsOf(kind).find(g => g.id === scene.group)?.name;
  const imageRefs = uploads.length;
  const shown = view === 'library' ? library : mine;
  const tabs: Array<[typeof view, string]> = [
    ['works', `${embed ? (zh ? '本次生成' : 'Generated here') : (zh ? '作品' : 'Works')}${mine.length ? ` ${mine.length}` : ''}`],
    ...(embed ? [['library', `${zh ? '素材库' : 'Library'}${library.length ? ` ${library.length}` : ''}`] as [typeof view, string]] : []),
    ['example', zh ? '示例' : 'Example'],
  ];

  /** One generation: frames, progress and actions. Shared by the conversation stream and the works wall. */
  const card = (g: Generation) => {
    const pct = progress[g.id] ?? 100;
    const busy = g.status === 'generating';
    const s = findScene(g.kind, g.sceneId);
    const sendable = !embed && onSendToDirector;
    return (
      <article key={g.id} className="group overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className={`relative grid gap-0.5 ${g.images.length > 1 ? 'grid-cols-2' : ''}`}>
          {g.images.map((src, i) => (
            <div key={i} className="relative overflow-hidden bg-slate-100" style={{ aspectRatio: ratioBox(g.ratio) }}>
              <img src={src} alt="" loading="lazy" className={`h-full w-full object-cover transition ${busy ? 'scale-105 blur-md' : ''}`} />
              {!busy && g.kind === 'image' && embed && (
                <button type="button" onClick={() => use(g, src)}
                  className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium shadow"
                  style={{ background: 'rgba(124,58,237,.92)', color: '#ffffff' }}>
                  <CornerDownLeft className="h-3 w-3" />{g.images.length > 1 ? (zh ? '用这张' : 'Use this') : embed.useLabel}
                </button>
              )}
              {!busy && g.kind === 'image' && !embed && (
                <div className="absolute inset-x-1 bottom-1 flex justify-end gap-1 opacity-0 transition group-hover:opacity-100 focus-within:opacity-100">
                  {onMakeVideo && (
                    <button type="button" onClick={() => onMakeVideo(src)} className="rounded-md px-1.5 py-1 text-[11px]" style={{ background: 'rgba(15,23,42,.75)', color: '#ffffff' }}>
                      {zh ? '做成视频' : 'To video'}
                    </button>
                  )}
                  {sendable && <SendToDirectorMenu compact zh={zh} kind="image" scope={directorScope} onSend={to => sendToDirector(g, src, to)} />}
                  <a href={src} target="_blank" rel="noreferrer" aria-label={zh ? '查看原图' : 'Open'} className="rounded-md p-1" style={{ background: 'rgba(15,23,42,.75)', color: '#ffffff' }}>
                    <Download className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          ))}
          {busy && (
            <div className="absolute inset-0 grid place-items-center" style={{ background: 'rgba(255,255,255,.35)' }}>
              <div className="w-3/4 text-center">
                <div className="text-[12px] font-medium text-slate-800">{zh ? '生成中' : 'Generating'} {pct}%</div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/70"><div className="h-full rounded-full bg-violet-600 transition-all" style={{ width: `${pct}%` }} /></div>
              </div>
            </div>
          )}
          {!busy && g.kind === 'video' && (
            <span className="pointer-events-none absolute bottom-1.5 right-1.5 rounded px-1.5 py-0.5 text-[10px]" style={{ background: 'rgba(15,23,42,.7)', color: '#ffffff' }}>0:{String(g.duration ?? 0).padStart(2, '0')}</span>
          )}
          {!busy && (g.usedIn || (!embed && g.target)) && (
            <span className="pointer-events-none absolute left-1.5 top-1.5 flex max-w-[calc(100%-12px)] items-center gap-1 truncate rounded px-1.5 py-0.5 text-[10px]" style={{ background: 'rgba(15,23,42,.7)', color: '#ffffff' }}>
              <Clapperboard className="h-2.5 w-2.5 shrink-0" />
              <span className="truncate">{g.usedIn ? `${zh ? '已用于' : 'Used in'} ${g.usedIn}` : (zh ? '导演台生成' : 'From AI Director')}</span>
            </span>
          )}
        </div>
        <div className="p-2.5">
          <div className="truncate text-[13px] font-medium text-slate-900" title={g.title}>{g.title}</div>
          <div className="mt-0.5 flex items-center justify-between text-[11px] text-slate-400">
            <span>{s ? t(s.name) : ''} · ⬡ {g.cost}</span>
            {view === 'works' && (
              <button type="button" onClick={() => remove(g.id)} aria-label={zh ? '删除' : 'Delete'} className="rounded p-0.5 hover:bg-slate-100 hover:text-slate-600"><Trash2 className="h-3.5 w-3.5" /></button>
            )}
          </div>
          {!busy && g.kind === 'video' && embed && (
            <button type="button" onClick={() => use(g, g.images[0])}
              className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg py-1.5 text-[11px] font-medium"
              style={{ background: '#7c3aed', color: '#ffffff' }}>
              <CornerDownLeft className="h-3 w-3" />{embed.useLabel}
            </button>
          )}
          {!busy && g.kind === 'video' && !embed && (
            <div className="mt-2 flex gap-1.5">
              {g.sentToPool ? (
                <button type="button" onClick={onOpenPublish} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-50 py-1.5 text-[11px] font-medium text-emerald-700">
                  <Check className="h-3 w-3" />{zh ? '已送审 · 去发布池' : 'In review · open'}
                </button>
              ) : (
                <button type="button" onClick={() => sendToPool(g)} className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-violet-50 py-1.5 text-[11px] font-medium text-violet-700 hover:bg-violet-100">
                  <Send className="h-3 w-3" />{zh ? '送审发布' : 'Publish'}
                </button>
              )}
              {sendable && <SendToDirectorMenu zh={zh} kind="video" scope={directorScope} onSend={to => sendToDirector(g, g.images[0], to)} />}
            </div>
          )}
        </div>
      </article>
    );
  };

  const thread = [...mine].reverse().slice(-30);
  const starters = (kind === 'image' ? [FREE_IMAGE, ...recommended] : recommended).filter((x, i, all) => all.findIndex(y => y.id === x.id) === i).slice(0, 4);

  return (
    <div className="flex flex-col lg:h-full lg:flex-row lg:overflow-hidden">
      {/* ── Conversation: context strip · generation history · input box ── */}
      <section className="flex h-[640px] shrink-0 flex-col border-b border-gray-200 bg-white lg:h-full lg:w-[340px] lg:border-b-0 lg:border-r">
        <div className="flex min-h-[49px] shrink-0 items-center gap-2 border-b border-gray-100 px-3 py-2">
          {target ? (
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1.5">
              <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-violet-600" />
              <span className="min-w-0 flex-1 truncate text-[12px] text-violet-800">{zh ? '生成后用于' : 'Result goes to'} <b className="font-semibold">{target.label}</b></span>
              <button type="button" onClick={target.onClear} aria-label={zh ? '不针对这个目标' : 'Clear target'} title={zh ? '不针对这个目标' : 'Clear target'}
                className="grid h-5 w-5 shrink-0 place-items-center rounded text-violet-600 hover:bg-violet-100"><X className="h-3.5 w-3.5" /></button>
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-gray-500">{kind === 'video' ? (zh ? 'AI 视频 · 生成记录' : 'AI Video · history') : (zh ? 'AI 图片 · 生成记录' : 'AI Image · history')} <span className="text-gray-400">{mine.length}</span></div>
              <div className="mt-0.5 truncate text-[10px] text-gray-400">{zh ? '结果可单独送审，也可发到 AI 导演做镜头或资产' : 'Publish on its own or send to the AI Director'}</div>
            </div>
          )}
          <button type="button" onClick={reset} aria-label={zh ? '清空输入，重新开始' : 'Start over'} title={zh ? '清空输入，重新开始' : 'Start over'}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"><Plus className="h-3.5 w-3.5" /></button>
        </div>

        <div ref={streamRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {thread.length === 0 ? (
            <div>
              <div className="text-base font-bold text-gray-900">{zh ? '想做点什么？' : 'What would you like to make?'}</div>
              <p className="mt-1 text-[12px] text-gray-500">{zh ? '先挑一个场景，素材和写法会跟着变。更多场景在下方「场景模板库」。' : 'Pick a scene first; materials and tips follow. More in the scene library below.'}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {starters.map(sc => (
                  <button key={sc.id} type="button" onClick={() => { pickScene(sc); textRef.current?.focus(); }}
                    className={`group overflow-hidden rounded-xl border text-left transition ${sc.id === scene.id ? 'border-violet-300 ring-1 ring-violet-300' : 'border-gray-200 hover:border-violet-300'}`}>
                    <div className="aspect-[4/3] overflow-hidden bg-slate-100"><img src={sc.cover} alt="" loading="lazy" className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.04]" /></div>
                    <div className="p-2">
                      <div className="truncate text-[12px] font-semibold text-gray-900">{t(sc.name)}</div>
                      <div className="truncate text-[10px] text-gray-500">{t(sc.tagline)}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : thread.map(g => {
            const sc = findScene(g.kind, g.sceneId);
            const wide = g.images.length > 1;
            return (
              <motion.div key={g.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                <div className="flex justify-end">
                  <div className="max-w-[88%] rounded-2xl rounded-br-md px-3 py-2 text-[13px] leading-relaxed" style={{ background: '#7c3aed', color: '#ffffff' }}>
                    <div className="mb-0.5 text-[10px]" style={{ opacity: 0.8 }}>{sc ? t(sc.name) : ''} · {g.ratio}{g.duration ? ` · ${g.duration}${zh ? ' 秒' : 's'}` : ''}{g.kind === 'image' ? ` · ${g.images.length}${zh ? ' 张' : ''}` : ''}</div>
                    <div className="line-clamp-4 whitespace-pre-wrap">{g.prompt.trim() || (zh ? '按场景默认写法生成' : 'Using the scene defaults')}</div>
                  </div>
                </div>
                <div className={wide ? 'w-[260px] max-w-full' : 'w-[190px] max-w-full'}>{card(g)}</div>
              </motion.div>
            );
          })}
        </div>

        <div className="shrink-0 border-t border-gray-100 p-3 pt-2">
          {/* Positioned: the scene library and params popovers span the whole input box. */}
          <div className="relative rounded-2xl border border-gray-200 bg-gray-50 transition focus-within:border-purple-300 focus-within:bg-white">
            {scene.slots.length > 0 && (
              <div className="flex flex-wrap gap-2 px-2.5 pt-2.5">
                {scene.slots.map(d => slots[d.id] && (
                  <SlotTile key={`${scene.id}-${d.id}`} compact zh={zh} def={d} value={slots[d.id]} castName={cast?.name}
                    registerUrl={u => urls.current.push(u)} onChange={v => setSlots(s => ({ ...s, [d.id]: v }))} />
                ))}
              </div>
            )}
            <textarea ref={textRef} value={prompt} maxLength={LIMIT[kind]} onChange={e => setPrompt(e.target.value)} rows={3}
              onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); generate(); } }}
              placeholder={t(scene.placeholder)} aria-label={zh ? '提示词' : 'Prompt'}
              className="block max-h-40 min-h-[72px] w-full resize-none bg-transparent px-3 pt-2.5 text-[13px] leading-relaxed text-gray-900 outline-none placeholder:text-gray-400" />
            {(scene.chips.length > 0 || (kind === 'image' && imageRefs > 0)) && (
              <div className="flex flex-wrap gap-1 px-2.5 pb-1">
                {kind === 'image' && uploads.map((_, i) => (
                  <button key={`ref-${i}`} type="button" onClick={() => setPrompt(p => `${p}@${zh ? '图' : 'img'}${i + 1} `)}
                    className="rounded-md bg-violet-50 px-1.5 py-0.5 text-[11px] text-violet-700 hover:bg-violet-100">@{zh ? '图' : 'img'}{i + 1}</button>
                ))}
                {scene.chips.map(c => (
                  <button key={c.label.en} type="button" onClick={() => insertChip(t(c.label))}
                    className="rounded-md bg-white px-1.5 py-0.5 text-[11px] text-gray-600 ring-1 ring-gray-200 transition hover:bg-gray-100">+ {t(c.label)}</button>
                ))}
              </div>
            )}
            <div className="flex items-center justify-between px-3 pb-1 text-[10px] text-gray-400">
              <span>{prompt.length} / {LIMIT[kind]}</span>
              {kind === 'video' && (
                <button type="button" onClick={aiDraft} disabled={drafting}
                  className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-violet-700 transition hover:bg-violet-50 disabled:opacity-60">
                  <Wand2 className={`h-3 w-3 ${drafting ? 'animate-pulse' : ''}`} />{drafting ? (zh ? '编写中…' : 'Writing…') : prompt.trim() ? (zh ? 'AI 编导改写' : 'AI rewrite') : (zh ? 'AI 编导' : 'AI Writer')}
                </button>
              )}
            </div>

            <div className="flex items-center gap-1.5 px-2 pb-2">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                {modeMenu}
                <ScenePicker variant="pill" zh={zh} kind={kind} scene={scene} recommended={recommended} onPick={pickScene} />
                <button type="button" onClick={() => setParamsOpen(o => !o)} aria-expanded={paramsOpen} aria-label={zh ? `参数：${paramSummary}` : `Settings: ${paramSummary}`} title={paramSummary}
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg border transition ${paramsOpen ? 'border-violet-300 bg-violet-50 text-violet-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'}`}>
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </button>
              </div>
              <button type="button" onClick={generate} disabled={!!missing} aria-label={kind === 'video' ? (zh ? '生成视频' : 'Generate video') : (zh ? '生成图片' : 'Generate image')}
                title={missing ?? undefined}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-2 text-[12px] font-semibold transition disabled:cursor-not-allowed"
                style={missing ? { background: '#ddd6fe', color: '#5b21b6' } : { background: 'linear-gradient(135deg,#7c3aed,#0891b2)', color: '#ffffff' }}>
                ⬡ {cost}<ArrowUp className="h-3.5 w-3.5" />
              </button>
            </div>

            <AnimatePresence>
              {paramsOpen && (
                <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
                  className="absolute bottom-full left-0 right-0 z-30 mb-2 space-y-3 rounded-2xl border border-gray-200 bg-white p-3 shadow-xl">
                  <label className="flex min-w-0 items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-[12px] text-slate-700">
                    <Cpu className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    <select value={model} onChange={e => setModel(e.target.value)} aria-label={zh ? '模型' : 'Model'}
                      className="min-w-0 flex-1 cursor-pointer appearance-none truncate bg-transparent outline-none">
                      {models.map(m => <option key={m.id} value={m.id}>{t(m.name)} · {t(m.note)}</option>)}
                    </select>
                    <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  </label>
                  {kind === 'video' ? (
                    <>
                      <Seg label={zh ? '语言' : 'Language'} value={vp.lang} options={[['zh', zh ? '中文' : 'Chinese'], ['en', zh ? '英文' : 'English']]} onChange={v => setVp(p => ({ ...p, lang: v as 'zh' | 'en' }))} />
                      <Seg label={zh ? '时长' : 'Length'} value={String(vp.duration)} options={VIDEO_OPTIONS.durations.map(d => [String(d), `${d}${zh ? ' 秒' : 's'}`])} onChange={v => setVp(p => ({ ...p, duration: Number(v) }))} />
                      <Seg label={zh ? '比例' : 'Ratio'} value={vp.ratio} options={VIDEO_OPTIONS.ratios.map(r => [r, r])} onChange={v => setVp(p => ({ ...p, ratio: v }))} />
                      <Seg label={zh ? '清晰度' : 'Resolution'} value={vp.res} options={VIDEO_OPTIONS.res.map(r => [r, r])} onChange={v => setVp(p => ({ ...p, res: v as VideoParams['res'] }))} />
                    </>
                  ) : (
                    <>
                      <Seg label={zh ? '比例' : 'Ratio'} value={ip.ratio} options={IMAGE_OPTIONS.ratios.map(r => [r, r])} onChange={v => setIp(p => ({ ...p, ratio: v }))} />
                      <Seg label={zh ? '清晰度' : 'Quality'} value={ip.quality} options={IMAGE_OPTIONS.quality.map(r => [r, r])} onChange={v => setIp(p => ({ ...p, quality: v as ImageParams['quality'] }))} />
                      <Seg label={zh ? '数量' : 'Count'} value={String(ip.count)} options={IMAGE_OPTIONS.counts.map(c => [String(c), `${c}${zh ? ' 张' : ''}`])} onChange={v => setIp(p => ({ ...p, count: Number(v) }))} />
                    </>
                  )}
                  <button type="button" onClick={() => setParamsOpen(false)} className="w-full rounded-lg bg-slate-900 py-1.5 text-[12px] font-medium" style={{ color: '#ffffff' }}>{zh ? '完成' : 'Done'}</button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          <div className="mt-1.5 flex items-center justify-between gap-2 px-1 text-[10px]">
            <span className={`truncate ${missing ? 'text-gray-500' : 'text-emerald-600'}`}>{missing ?? `${zh ? '可以生成' : 'Ready'} · ${paramSummary}`}</span>
            <span className="shrink-0 text-gray-400">{zh ? '余额' : 'Balance'} ⬡ {balance.toLocaleString()}</span>
          </div>
        </div>
      </section>

      {/* ── Works wall / example ── */}
      <div className="flex min-w-0 flex-1 p-2 md:p-3 lg:min-h-0">
      <section className="relative flex min-w-0 flex-1 flex-col rounded-3xl border border-gray-200 bg-white lg:min-h-0">
        <div className="flex items-center justify-between gap-2 p-3">
          <div role="tablist" className="flex rounded-xl bg-slate-100 p-1">
            {tabs.map(([v, label]) => (
              <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)}
                className={`rounded-lg px-3.5 py-1 text-[13px] transition ${view === v ? 'bg-white font-medium text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                {label}
              </button>
            ))}
          </div>
          {!embed && kind === 'video' && scene.director && onOpenDirector && (
            <button type="button" onClick={() => onOpenDirector({ name: t(scene.name), description: prompt.trim() || t(scene.tagline) })}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] text-slate-600 hover:bg-slate-100">
              <Clapperboard className="h-3.5 w-3.5" />{zh ? '多镜头精修？交给 AI 导演' : 'Need multi-shot? Hand to AI Director'}
            </button>
          )}
        </div>

        <div className="flex-1 px-3 pb-3 lg:min-h-0 lg:overflow-y-auto">
          {view === 'example' ? (
            <div className="flex flex-col items-center gap-6 py-4 md:flex-row md:items-center md:justify-center md:gap-10 md:py-8">
              <div className="relative w-full max-w-[260px] overflow-hidden rounded-2xl shadow-lg" style={{ aspectRatio: kind === 'video' ? '9 / 16' : '3 / 4' }}>
                <img src={scene.cover} alt={t(scene.name)} className="h-full w-full object-cover" />
                <span className="absolute left-2.5 top-2.5 rounded-md px-1.5 py-0.5 text-[11px]" style={{ background: 'rgba(15,23,42,.65)', color: '#ffffff' }}>{zh ? '示例' : 'Example'}</span>
                {kind === 'video' && <span className="absolute inset-0 m-auto grid h-12 w-12 place-items-center rounded-full" style={{ background: 'rgba(255,255,255,.85)' }}><Play className="ml-0.5 h-5 w-5 text-slate-900" /></span>}
              </div>
              <div className="w-full max-w-[300px]">
                {groupName && <div className="text-[12px] text-slate-400">{t(groupName)}</div>}
                <h3 className="mt-1 text-[26px] font-bold tracking-tight text-slate-900" style={{ fontFamily: 'var(--font-display)' }}>{t(scene.name)}</h3>
                <p className="mt-1 text-[13px] text-slate-500">{t(scene.tagline)}</p>
                <ol className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                  {scene.guide.map((g, i) => (
                    <li key={i} className="flex gap-3 text-[13px] text-slate-700">
                      <span className="w-5 shrink-0 tabular-nums text-slate-400">{String(i + 1).padStart(2, '0')}</span>{t(g)}
                    </li>
                  ))}
                </ol>
                <button type="button" onClick={useExample}
                  className="mt-4 flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-[12px] text-slate-700 hover:bg-slate-50">
                  <Sparkles className="h-3.5 w-3.5 text-violet-600" />{zh ? '按示例写法填入' : 'Use this as a starting point'}
                </button>
              </div>
            </div>
          ) : shown.length === 0 ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-400">{kind === 'video' ? <Film className="h-5 w-5" /> : <ImageIcon className="h-5 w-5" />}</span>
              <div className="mt-3 text-[15px] font-semibold text-slate-900">{view === 'library' ? (zh ? '素材库还是空的' : 'Nothing in the library yet') : (zh ? '还没有作品' : 'No works yet')}</div>
              <p className="mt-1 text-[13px] text-slate-500">
                {view === 'library' ? (zh ? '在 AI 视频 / AI 图片里生成的结果都会出现在这里' : 'Results from AI Video / AI Image appear here')
                  : kind === 'video' ? (zh ? '放好素材、写几句想法，点「生成视频」' : 'Add materials, write an idea, then generate') : (zh ? '放好参考图，点「生成图片」' : 'Add references, then generate')}
              </p>
            </div>
          ) : (
            <div className={`grid gap-3 ${kind === 'video' ? 'grid-cols-2 sm:grid-cols-3 xl:grid-cols-4' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3'}`}>
              {shown.map(card)}
            </div>
          )}
        </div>

        <AnimatePresence>
          {toast && (
            <motion.div role="status" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
              className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-[12px] shadow-lg" style={{ background: '#0f172a', color: '#ffffff' }}>
              {toast}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
      </div>
    </div>
  );
};

const Seg = ({ label, value, options, onChange }: { label: string; value: string; options: string[][]; onChange: (v: string) => void }) => (
  <div>
    <div className="mb-1 text-[11px] text-slate-400">{label}</div>
    <div className="flex flex-wrap gap-1">
      {options.map(([v, l]) => (
        <button key={v} type="button" onClick={() => onChange(v)}
          className={`rounded-lg px-2.5 py-1 text-[12px] transition ${value === v ? 'font-medium' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          style={value === v ? { background: '#0f172a', color: '#ffffff' } : undefined}>{l}</button>
      ))}
    </div>
  </div>
);
