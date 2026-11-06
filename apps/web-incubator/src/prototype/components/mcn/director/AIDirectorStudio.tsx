/**
 * AI 导演台 — AI chat on the left, then five views over one shared project:
 * 画布 (node canvas) · 剧本 · 资产 · 分镜 · 成片. Generation is simulated client-side.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle2, Cloud, CloudOff, Library, Plus, Send, Settings2, X, Zap } from 'lucide-react';
import type { Lang } from '../../../translations';
import type { Artist } from '../ArtistTypes';
import type { SolutionId } from '../../../data/ipPlatform';
import { TRACKS } from '../workshopData';
import type { WorkshopIntent } from '../ProductionWorkshop';
import { addToPool, primeTimeSlot } from '../publishPoolStore';
import { loadSnapshot, loadWorks, saveSnapshot, saveWorks } from './studioStorage';
import { formatsForTemplate, getWorkshopProfile, promptsFor, type WorkshopProfile } from './workshopProfiles';
import { DirectorCanvas, type AddKind, type Point } from './DirectorCanvas';
import { DirectorChat, type ChatScopeOption } from './DirectorChat';
import { DirectorInspector } from './DirectorInspector';
import { DirectorTimeline } from './DirectorTimeline';
import { NewProjectDialog, type DialogTemplate, type NewProjectInput } from './NewProjectDialog';
import { WorksDrawer, type Work } from './WorksDrawer';
import { ScriptView } from './ScriptView';
import { AssetsView } from './AssetsView';
import { StoryboardView } from './StoryboardView';
import { FinalView } from './FinalView';
import { ViewRail } from './ViewRail';
import {
  FRAME_POOL, KIND_META, NODE_H, STYLES, createProject, fmtDuration, isGeneratable, isVisualFormat, makeCloseUp, makeShot, orderedShots,
  planDirectorReply, shotIdeasFor, uid, writeLyrics,
  type CanvasNode, type ChatMessage, type DirectorOp, type Edge, type ProjectSpec, type Ratio,
} from './directorData';
import {
  ASSET_LABELS, CONTEXT_LINKS, buildAssets, buildEpisodes, startersFor, suggestionsFor, writeScreenplay,
  type Asset, type AssetType, type Episode, type StudioView,
} from './studioModel';

interface Props {
  lang: Lang;
  activeArtist: Artist;
  solutionId: SolutionId;
  intent?: WorkshopIntent | null;
  /** Opens 发布中心 after an export. */
  onOpenPublish?: () => void;
}

const LYRIC_THEMES = { zh: ['霓虹', '星海', '雨夜', '旧城'], en: ['neon', 'the star sea', 'the rainy night', 'the old town'] };

// Deliverable groups the AI can switch on by name; fallbacks are used when the template doesn't offer one.
const FORMAT_PATTERNS = {
  languages: { re: /多语言|字幕|Subtitle|language/i, fallback: { zh: '多语言字幕', en: 'Multilingual subtitles' } },
  cards: { re: /卡片|表情包|海报|Card|Sticker|Poster/i, fallback: { zh: '知识卡片', en: 'Cards' } },
  variants: { re: /A\/B|版本|variant/i, fallback: { zh: 'A/B 版本', en: 'A/B variants' } },
} as const;

const welcomeFor = (spec: ProjectSpec, lang: Lang, profile: WorkshopProfile) => {
  const zh = lang === 'zh';
  const who = profile.director[lang];
  const formats = spec.formats.join(zh ? '、' : ', ');
  if (spec.blank) {
    return zh
      ? `你好，我是你的${who}。这是一张空白画布：直接告诉我想做什么，我会把每一步放进画布；也可以从画布左侧“添加”开始。`
      : `Hi, I am your ${who}. This canvas is empty — tell me what you want and I will build it step by step, or use "Add" on the canvas.`;
  }
  if (spec.mode === 'music') {
    return zh
      ? `你好，我是你的${who}。已按「${spec.template}」模板为 ${spec.artistName} 搭好《${spec.name}》：歌词、编曲、人声${spec.formats.some(isVisualFormat) ? '和 MV 镜头' : ''}都在画布上，交付格式是 ${formats}。人声还没演唱。`
      : `Hi, I am your ${who}. I set up "${spec.name}" for ${spec.artistName} from the "${spec.template}" template, delivering ${formats}. Vocals are not sung yet.`;
  }
  return zh
    ? `你好，我是你的${who}。已按「${spec.template}」模板为${profile.cast.zh} ${spec.artistName} 写好《${spec.name}》第 1 集，并拆成 3 个片段，第 3 个还没出分镜图，交付格式是 ${formats}。选中正文、片段或资产旁的 AI 按钮，我就知道你要改哪里。`
    : `Hi, I am your ${who}. I wrote episode 1 of "${spec.name}" (${spec.template}) for ${spec.artistName} and split it into 3 segments; segment 3 has no frame yet. Delivering ${formats}. Use the AI button next to any text, segment or asset to point me at it.`;
};

/** Grab a first-frame thumbnail from an uploaded video (best effort). */
const videoThumb = (url: string) => new Promise<string | undefined>(resolve => {
  const v = document.createElement('video');
  const done = (r?: string) => { resolve(r); v.removeAttribute('src'); v.load(); };
  const timer = window.setTimeout(() => done(undefined), 4000);
  v.muted = true; v.preload = 'auto'; v.src = url;
  v.onloadeddata = () => { v.currentTime = Math.min(0.1, v.duration || 0); };
  v.onseeked = () => {
    try {
      const c = document.createElement('canvas');
      c.width = v.videoWidth; c.height = v.videoHeight;
      c.getContext('2d')?.drawImage(v, 0, 0);
      window.clearTimeout(timer); done(c.toDataURL('image/jpeg', 0.7));
    } catch { window.clearTimeout(timer); done(undefined); }
  };
  v.onerror = () => { window.clearTimeout(timer); done(undefined); };
});

export const AIDirectorStudio = ({ lang, activeArtist, solutionId, intent = null, onOpenPublish }: Props) => {
  const storageScope = `${solutionId}:${activeArtist.id}`;
  const zh = lang === 'zh';
  const profile = useMemo(() => getWorkshopProfile(solutionId, activeArtist.type), [solutionId, activeArtist.type]);
  const templates = useMemo<DialogTemplate[]>(() => [
    ...profile.templates.map(t => ({ name: t.name[lang], mode: t.mode, formats: formatsForTemplate(profile, t).map(f => f[lang]) })),
    { name: zh ? '空白画布' : 'Blank canvas', mode: 'video' as const, formats: profile.formats.map(f => f[lang]), blank: true },
  ], [profile, lang, zh]);

  const buildSpec = (input: NewProjectInput): ProjectSpec => {
    const tpl = templates.find(t => t.name === input.template) ?? templates[0];
    return {
      mode: tpl.mode, template: tpl.name, name: tpl.blank && input.name === tpl.name ? (zh ? '未命名作品' : 'Untitled') : input.name, description: input.description || (tpl.blank ? '' : profile.defaultBrief[lang]),
      formats: input.formats.length ? input.formats : tpl.formats.slice(0, 1), available: tpl.formats,
      artistName: activeArtist.name, artistAvatar: activeArtist.avatar, blank: tpl.blank,
    };
  };

  const [initial] = useState(() => {
    // Resume the last auto-saved project for this solution + artist, if any.
    const saved = loadSnapshot(storageScope);
    if (saved) return { ...saved, restored: true };
    const first = templates[0];
    const spec = buildSpec({ template: first.name, name: profile.defaultName[lang], description: profile.defaultBrief[lang], formats: first.formats.slice(0, 2) });
    const project = createProject(spec, lang, profile);
    return {
      spec, ...project, episodes: buildEpisodes(spec, profile, project.nodes, lang), assets: buildAssets(spec, project.nodes, lang, profile.cast[lang]),
      style: 'cyber', ratio: '9:16' as Ratio, view: 'canvas' as StudioView, messages: null as ChatMessage[] | null, exported: false, savedAt: 0, restored: false,
    };
  });
  const [spec, setSpec] = useState<ProjectSpec>(initial.spec);
  const [nodes, setNodes] = useState<CanvasNode[]>(initial.nodes);
  const [edges, setEdges] = useState<Edge[]>(initial.edges);
  const [episodes, setEpisodes] = useState<Episode[]>(initial.episodes);
  const [assets, setAssets] = useState<Asset[]>(initial.assets);
  const [view, setView] = useState<StudioView>(initial.view);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null);
  const [activeEpisodeId, setActiveEpisodeId] = useState<string>(initial.episodes[0]?.id ?? '');
  const [scopeChoice, setScopeChoice] = useState<string | null>(null);
  const [style, setStyle] = useState(initial.style);
  const [ratio, setRatio] = useState<Ratio>(initial.ratio);
  const [thinking, setThinking] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [fitSignal, setFitSignal] = useState(0);
  const [playSignal, setPlaySignal] = useState(0);
  const [exported, setExported] = useState(initial.exported);
  const [savedAt, setSavedAt] = useState<number | false>(initial.savedAt);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [worksOpen, setWorksOpen] = useState(false);
  const [works, setWorks] = useState<Work[]>(() => loadWorks(TRACKS));
  useEffect(() => { saveWorks(works); }, [works]);
  const welcome = (s: ProjectSpec): ChatMessage[] => [{ id: uid('m'), role: 'ai', text: welcomeFor(s, lang, profile) }];
  const [messages, setMessages] = useState<ChatMessage[]>(() => initial.messages?.length
    ? [...initial.messages.filter(m => !m.id.startsWith('restored-')), { id: uid('restored-'), role: 'ai', text: zh ? '已恢复你上次的项目，可以继续编辑。' : 'Restored your last project — pick up where you left off.' }]
    : welcome(initial.spec));

  // Debounced local auto-save of the whole project.
  useEffect(() => {
    const t = window.setTimeout(() => {
      setSavedAt(saveSnapshot(storageScope, { spec, nodes, edges, episodes, assets, style, ratio, view, messages, exported }));
    }, 600);
    return () => window.clearTimeout(t);
  }, [storageScope, spec, nodes, edges, episodes, assets, style, ratio, view, messages, exported]);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const assetsRef = useRef(assets);
  assetsRef.current = assets;
  const styleRef = useRef(style);
  styleRef.current = style;
  const frameCursor = useRef(3);
  const lyricCursor = useRef(1);
  const ideaCursor = useRef(3);
  const scriptVariant = useRef(1);
  const objectUrls = useRef<string[]>([]);
  const timers = useRef<number[]>([]);
  const later = useCallback((fn: () => void, ms: number) => { timers.current.push(window.setTimeout(fn, ms)); }, []);
  useEffect(() => () => { timers.current.forEach(t => window.clearTimeout(t)); objectUrls.current.forEach(u => URL.revokeObjectURL(u)); }, []);

  // Links from elsewhere (音乐工坊 / 创作内容 → new project, 查看全部 → works library). Each intent id is handled once.
  const handledIntent = useRef<number | null>(null);
  useEffect(() => {
    if (!intent || handledIntent.current === intent.id) return;
    handledIntent.current = intent.id;
    if (intent.kind === 'new') setDialogOpen(true); else setWorksOpen(true);
  }, [intent]);

  // A new selection or view resets any manually chosen chat scope.
  useEffect(() => { setScopeChoice(null); }, [selectedId, selectedAssetId, view]);

  const selected = nodes.find(n => n.id === selectedId);
  const output = nodes.find(n => n.kind === 'output');
  const lyricsNode = nodes.find(n => n.kind === 'lyrics');
  const shots = orderedShots(nodes);
  const mode = spec.mode;
  const styleLabel = STYLES.find(s => s.id === style)?.label[lang] ?? '';
  const propLabel = nodes.some(n => n.kind === 'product') ? { zh: '商品', en: 'Product' } : undefined;

  const patchNode = (id: string, patch: Partial<CanvasNode>) => setNodes(ns => ns.map(n => (n.id === id ? { ...n, ...patch } : n)));
  // Any content change makes a finished delivery stale.
  const staleOutput = (ns: CanvasNode[]) => ns.map(n => (n.kind === 'output' && n.status === 'done' ? { ...n, status: 'idle' as const } : n));
  const touch = () => setExported(false);
  const nextFrame = () => {
    const offset = Math.max(0, STYLES.findIndex(s => s.id === styleRef.current)) * 2;
    return FRAME_POOL[(frameCursor.current++ + offset) % FRAME_POOL.length];
  };

  /* ───────── generation (simulated) ───────── */

  const generate = (id: string, delay = 0) => {
    later(() => {
      touch();
      // A new frame invalidates the segment video rendered from the old one.
      setNodes(ns => staleOutput(ns.map(n => (n.id === id ? { ...n, status: 'generating' as const, videoStatus: n.videoStatus === 'done' ? 'idle' as const : n.videoStatus } : n))));
    }, delay);
    later(() => {
      setNodes(ns => ns.map(n => {
        if (n.id !== id) return n;
        if (n.kind === 'shot') return { ...n, status: 'done' as const, image: nextFrame() };
        if (n.kind === 'lyrics') {
          const themes = LYRIC_THEMES[lang];
          return { ...n, status: 'done' as const, prompt: writeLyrics(lang, themes[lyricCursor.current++ % themes.length]) };
        }
        return { ...n, status: 'done' as const };
      }));
    }, delay + 1300 + Math.random() * 700);
  };

  /** Renders segment videos, drawing missing frames first. Returns when the last one finishes (ms). */
  const generateVideos = (ids: string[]) => {
    let end = 0;
    ids.forEach((id, i) => {
      const n = nodesRef.current.find(x => x.id === id);
      if (!n || n.kind !== 'shot') return;
      let start = i * 400;
      if (n.status !== 'done' || !n.image) { if (n.status !== 'generating') generate(id, start); start += 2200; }
      later(() => { touch(); setNodes(ns => staleOutput(ns.map(x => (x.id === id ? { ...x, videoStatus: 'generating' as const } : x)))); }, start);
      const finish = start + 1800 + Math.random() * 600;
      later(() => patchNode(id, { videoStatus: 'done' }), finish);
      end = Math.max(end, finish);
    });
    return end;
  };

  const generateAll = () => {
    const pending = nodesRef.current.filter(n => isGeneratable(n) && n.status === 'idle');
    pending.forEach((n, i) => generate(n.id, i * 350));
    return pending.length;
  };

  const renderOutput = () => {
    const output = nodesRef.current.find(n => n.kind === 'output');
    if (!output) return;
    const others = nodesRef.current.filter(n => isGeneratable(n) && n.kind !== 'shot' && n.status === 'idle');
    others.forEach((n, i) => generate(n.id, i * 350));
    const videoEnd = generateVideos(orderedShots(nodesRef.current).filter(s => s.videoStatus !== 'done').map(s => s.id));
    touch();
    patchNode(output.id, { status: 'generating' });
    later(() => patchNode(output.id, { status: 'done' }), Math.max(videoEnd, others.length * 350 + 2000) + 1500);
  };

  const generateAsset = (id: string, delay = 0) => {
    later(() => setAssets(as => as.map(a => (a.id === id ? { ...a, status: 'generating' } : a))), delay);
    later(() => {
      const image = nextFrame();
      const asset = assetsRef.current.find(a => a.id === id);
      setAssets(as => as.map(a => (a.id === id ? { ...a, status: 'confirmed', image } : a)));
      // Keep the canvas character in sync with its asset sheet.
      if (asset?.type === 'character') setNodes(ns => ns.map(n => (n.kind === 'character' && n.title === asset.name ? { ...n, image } : n)));
    }, delay + 1500 + Math.random() * 600);
  };
  const generateMissingAssets = () => {
    const missing = assetsRef.current.filter(a => a.status === 'missing');
    missing.forEach((a, i) => generateAsset(a.id, i * 400));
    return missing.length * 400 + 2100;
  };

  /* ───────── canvas structure ───────── */

  const sourceNode = (ns: CanvasNode[]) => ns.find(n => n.kind === 'lyrics') ?? ns.find(n => n.kind === 'script' || n.kind === 'product' || n.kind === 'knowledge');
  const linkTargets = (ns: CanvasNode[]) => ({ source: sourceNode(ns), character: ns.find(n => n.kind === 'character'), out: ns.find(n => n.kind === 'output') });
  // The {P} placeholder in shot ideas: the canvas product, else the workshop's default product (e.g. on a blank canvas).
  const productName = () => {
    const s = sourceNode(nodesRef.current);
    if (s?.kind === 'product') return s.title;
    return profile.source.kind === 'product' ? profile.source.title[lang] : '';
  };

  const insertNodes = (created: CanvasNode[], links: (c: CanvasNode) => Array<Edge | false | undefined>) => {
    nodesRef.current = [...nodesRef.current, ...created];
    setNodes(prev => staleOutput([...prev, ...created]));
    setEdges(prev => [...prev, ...created.flatMap(c => links(c).filter((e): e is Edge => Boolean(e)))]);
    touch();
  };

  const addShots = (count: number, make?: (x: number, y: number) => CanvasNode) => {
    const ns = nodesRef.current;
    const existing = orderedShots(ns);
    const last = existing[existing.length - 1];
    const { source, character, out } = linkTargets(ns);
    const x = last ? last.x : mode === 'music' ? 680 : 360;
    const created = Array.from({ length: count }, (_, i) => {
      const y = (last ? last.y + 236 : 20) + i * 236;
      return make ? make(x, y) : makeShot(existing.length + i, x, y, lang, shotIdeasFor(mode, profile), spec.artistName, productName());
    });
    // Make room for the MV column in music projects that started without picture.
    setNodes(prev => prev.map(n => (n.kind === 'output' && n.x < x + 300 ? { ...n, x: x + 320 } : n)));
    insertNodes(created, c => [source && { from: source.id, to: c.id }, character && { from: character.id, to: c.id }, out && { from: c.id, to: out.id }]);
    // Keep the script in step: each new segment gets its own paragraph in episode 1.
    if (mode === 'video') {
      const extra = writeScreenplay(spec, profile, created, lang, scriptVariant.current).split('\n\n').slice(1).join('\n\n');
      setEpisodes(es => es.map((e, i) => (i === 0 && e.body ? { ...e, body: `${e.body}\n\n${extra}` } : e)));
    }
    // Picture now exists, so make sure a visual deliverable (e.g. MV视频) is selected.
    const visual = spec.available.find(isVisualFormat);
    if (visual) setSpec(s => (s.formats.some(isVisualFormat) ? s : { ...s, formats: [...s.formats, visual] }));
    setFitSignal(s => s + 1);
    return created;
  };

  const ensureNode = (kind: 'audio' | 'vocal' | 'lyrics') => {
    const ns = nodesRef.current;
    const existing = ns.find(n => n.kind === kind);
    if (existing) return existing;
    const { character, out } = linkTargets(ns);
    const maxY = ns.length ? Math.max(...ns.map(n => n.y)) + 240 : 40;
    const base = { id: uid(kind), x: kind === 'lyrics' ? 40 : 680, y: maxY, status: 'idle' as const };
    const node: CanvasNode = kind === 'audio'
      ? { ...base, kind, duration: 180, genre: 'electropop', mood: 'hype', bpm: 120, title: mode === 'music' ? (zh ? '编曲 · 伴奏' : 'Arrangement') : (zh ? '配乐' : 'Score'), prompt: zh ? '描述你想要的曲风与情绪' : 'Describe the genre and mood' }
      : kind === 'vocal'
        ? { ...base, kind, duration: 180, voiceStyle: 'natural', title: zh ? `${spec.artistName} · 演唱` : `${spec.artistName} · vocals`, prompt: zh ? '按歌词演唱' : 'Sing the lyrics' }
        : { ...base, kind, title: zh ? '歌词' : 'Lyrics', prompt: '' };
    const lyrics = ns.find(n => n.kind === 'lyrics');
    const vocal = ns.find(n => n.kind === 'vocal');
    insertNodes([node], c => [
      c.kind !== 'lyrics' && out && { from: c.id, to: out.id },
      c.kind === 'vocal' && character && { from: character.id, to: c.id },
      c.kind === 'vocal' && lyrics && { from: lyrics.id, to: c.id },
      c.kind === 'lyrics' && vocal && { from: c.id, to: vocal.id },
    ]);
    setFitSignal(s => s + 1);
    return node;
  };

  const ensureOutput = () => {
    const ns = nodesRef.current;
    const existing = ns.find(n => n.kind === 'output');
    if (existing) return existing;
    const node: CanvasNode = { id: uid('output'), kind: 'output', x: Math.max(360, ...ns.map(n => n.x)) + 320, y: 200, status: 'idle', title: zh ? `成片 · ${spec.formats[0] ?? ''}` : `Final · ${spec.formats[0] ?? ''}`, prompt: zh ? '自动剪辑、字幕与配乐合成' : 'Auto edit, captions and music mix' };
    insertNodes([node], () => []);
    setEdges(prev => [...prev, ...ns.filter(n => n.kind === 'shot' || n.kind === 'audio' || n.kind === 'vocal').map(n => ({ from: n.id, to: node.id }))]);
    return node;
  };

  /** Canvas "添加" menu: text / image / video / audio at a canvas position. */
  const addFromCanvas = (kind: AddKind, at: Point) => {
    if (kind === 'audio') { const n = ensureNode('audio'); if (n.y !== at.y) patchNode(n.id, { x: at.x, y: at.y }); setSelectedId(n.id); return; }
    if (kind === 'text') {
      const node: CanvasNode = { id: uid('text'), kind: 'script', x: at.x, y: at.y, status: 'done', title: zh ? '文字' : 'Text', prompt: '' };
      insertNodes([node], () => []);
      setSelectedId(node.id);
      return;
    }
    if (!nodesRef.current.some(n => n.kind === 'output')) ensureOutput();
    const [shot] = addShots(1, () => {
      const s = makeShot(ideaCursor.current++, at.x, at.y, lang, shotIdeasFor(mode, profile), spec.artistName, productName());
      return kind === 'video' ? { ...s, duration: 5, title: `${zh ? '视频' : 'Video'} · ${s.title}` } : s;
    });
    setSelectedId(shot.id);
  };

  const uploadToCanvas = async (file: File, at: Point) => {
    const url = URL.createObjectURL(file);
    objectUrls.current.push(url);
    const name = file.name.replace(/\.[^.]+$/, '');
    if (file.type.startsWith('audio/')) {
      const node: CanvasNode = { id: uid('audio'), kind: 'audio', x: at.x, y: at.y, status: 'done', duration: 60, title: name, prompt: zh ? '上传的音频素材' : 'Uploaded audio' };
      const out = linkTargets(nodesRef.current).out;
      insertNodes([node], c => [out && { from: c.id, to: out.id }]);
      setSelectedId(node.id);
      return;
    }
    const isVideo = file.type.startsWith('video/');
    const image = isVideo ? await videoThumb(url) : url;
    if (!nodesRef.current.some(n => n.kind === 'output')) ensureOutput();
    const [shot] = addShots(1, () => ({
      id: uid('shot'), kind: 'shot', x: at.x, y: at.y, status: 'done', image, duration: isVideo ? 5 : 3, shotSize: 'medium', camera: 'static',
      videoStatus: isVideo ? 'done' : 'idle', title: name, prompt: zh ? `上传素材 · ${file.name}` : `Uploaded · ${file.name}`,
    }));
    setSelectedId(shot.id);
  };

  /** 整理: lay nodes out in production order, one column per stage. */
  const tidy = () => {
    const ns = nodesRef.current;
    const isSource = (n: CanvasNode) => ['script', 'product', 'knowledge', 'lyrics', 'character'].includes(n.kind);
    const sound = (n: CanvasNode) => n.kind === 'audio' || n.kind === 'vocal';
    const columns = (mode === 'music'
      ? [ns.filter(isSource), ns.filter(sound), orderedShots(ns), ns.filter(n => n.kind === 'output')]
      : [ns.filter(isSource), orderedShots(ns), ns.filter(sound), ns.filter(n => n.kind === 'output')]).filter(c => c.length);
    const heights = columns.map(c => c.reduce((a, n) => a + NODE_H[n.kind] + 36, -36));
    const tallest = Math.max(...heights, 0);
    const pos = new Map<string, Point>();
    columns.forEach((col, ci) => {
      let y = 20 + (tallest - heights[ci]) / 2;
      col.forEach(n => { pos.set(n.id, { x: 40 + ci * 320, y: Math.round(y) }); y += NODE_H[n.kind] + 36; });
    });
    setNodes(prev => prev.map(n => (pos.has(n.id) ? { ...n, ...pos.get(n.id)! } : n)));
    setFitSignal(s => s + 1);
  };

  /* ───────── script & assets ───────── */

  const rewriteScript = (episodeId?: string) => {
    if (mode === 'music') { generate(ensureNode('lyrics').id); return; }
    let current = orderedShots(nodesRef.current);
    if (!current.length) current = addShots(3);
    const targets = episodeId ? [episodeId] : episodes.length ? episodes.filter(e => e.body || e.status === 'done').map(e => e.id) : [];
    const variant = scriptVariant.current++;
    if (!targets.length) {
      const ep: Episode = { id: uid('ep'), status: 'generating', name: zh ? `第 1 集 · ${spec.name}` : `Ep. 1 · ${spec.name}`, summary: spec.description, body: '' };
      setEpisodes([ep]); setActiveEpisodeId(ep.id);
      later(() => setEpisodes(es => es.map(e => (e.id === ep.id ? { ...e, status: 'done', body: writeScreenplay(spec, profile, current, lang, variant) } : e))), 1600);
      return;
    }
    setEpisodes(es => es.map(e => (targets.includes(e.id) ? { ...e, status: 'generating' } : e)));
    later(() => setEpisodes(es => es.map(e => (targets.includes(e.id) ? { ...e, status: 'done', body: writeScreenplay(spec, profile, current, lang, variant) } : e))), 1600);
  };

  const continueEpisode = (episodeId?: string) => {
    const pending = episodes.find(e => (episodeId ? e.id === episodeId : !e.body));
    const variant = scriptVariant.current++;
    const current = orderedShots(nodesRef.current);
    if (pending) {
      setEpisodes(es => es.map(e => (e.id === pending.id ? { ...e, status: 'generating' } : e)));
      later(() => setEpisodes(es => es.map(e => (e.id === pending.id ? { ...e, status: 'done', name: e.name.replace(/待续写|to be written/, zh ? '新的线索' : 'A New Lead'), body: writeScreenplay(spec, profile, current, lang, variant) } : e))), 1600);
      return;
    }
    const n = episodes.length + 1;
    const ep: Episode = { id: uid('ep'), status: 'generating', name: zh ? `第 ${n} 集 · 新的线索` : `Ep. ${n} · A New Lead`, summary: zh ? `延续第 ${n - 1} 集结尾的悬念` : `Picks up the episode ${n - 1} cliffhanger`, body: '' };
    setEpisodes(es => [...es, ep]);
    later(() => setEpisodes(es => es.map(e => (e.id === ep.id ? { ...e, status: 'done', body: writeScreenplay(spec, profile, current, lang, variant) } : e))), 1600);
  };

  const extractAssets = () => {
    const product = profile.source.kind === 'product' ? { title: profile.source.title[lang], prompt: profile.source.prompt[lang] } : undefined;
    const fresh = buildAssets(spec, nodesRef.current, lang, profile.cast[lang], product);
    // Same name → same asset: keep confirmed images and voice bindings instead of duplicating.
    setAssets(prev => {
      const byName = new Map(prev.map(a => [`${a.type}:${a.name}`, a]));
      const merged = fresh.map(a => { const old = byName.get(`${a.type}:${a.name}`); return old ? { ...a, id: old.id, image: old.image ?? a.image, status: old.image ? 'confirmed' as const : a.status, voice: old.voice ?? a.voice } : a; });
      const custom = prev.filter(a => !merged.some(m => m.id === a.id) && !fresh.some(f => f.type === a.type && f.name === a.name) && a.desc === '');
      return [...merged, ...custom];
    });
  };

  const addAsset = (type: AssetType) => {
    const a: Asset = { id: uid('asset'), type, name: zh ? `新${type === 'prop' && propLabel ? propLabel.zh : ASSET_LABELS[type].zh}` : `New ${ASSET_LABELS[type].en.toLowerCase()}`, scope: zh ? '全剧' : 'Whole project', desc: '', status: 'missing', voice: type === 'character' ? false : undefined };
    setAssets(as => [...as, a]);
    setSelectedAssetId(a.id);
  };

  const scopedAsset = (type?: AssetType) => {
    const as = assetsRef.current;
    const chosen = as.find(a => a.id === selectedAssetId);
    if (chosen && (!type || chosen.type === type)) return chosen;
    return as.find(a => a.type === (type ?? 'character'));
  };

  /* ───────── AI ops ───────── */

  const applyOps = (ops: DirectorOp[], target?: CanvasNode) => {
    const rewritesLyrics = ops.some(o => o.type === 'lyrics');
    ops.forEach(op => {
      if (op.type === 'addShots') addShots(op.count).forEach((c, i) => generate(c.id, 400 + i * 350));
      if (op.type === 'generateAll') generateAll();
      if (op.type === 'lyrics') generate(ensureNode('lyrics').id);
      if (op.type === 'vocal') generate(ensureNode('vocal').id, rewritesLyrics ? 2300 : 0);
      if (op.type === 'music') {
        const audio = ensureNode('audio');
        patchNode(audio.id, { ...(op.genre && { genre: op.genre }), ...(op.mood && { mood: op.mood }), ...(op.bpm && { bpm: op.bpm }) });
        generate(audio.id);
      }
      if (op.type === 'closeUp') addShots(1, (x, y) => makeCloseUp(x, y, lang, op.subject)).forEach(c => generate(c.id, 400));
      if (op.type === 'style') {
        setStyle(op.id);
        styleRef.current = op.id;
        orderedShots(nodesRef.current).forEach((n, i) => generate(n.id, i * 300));
      }
      if (op.type === 'format') {
        const { re, fallback } = FORMAT_PATTERNS[op.pattern];
        setSpec(s => {
          if (s.formats.some(f => re.test(f))) return s;
          const f = s.available.find(x => re.test(x)) ?? fallback[lang];
          return { ...s, formats: [...s.formats, f], available: s.available.includes(f) ? s.available : [...s.available, f] };
        });
        setNodes(ns => staleOutput(ns));
        touch();
      }
      if (op.type === 'restyle') {
        const shotsNow = orderedShots(nodesRef.current);
        const targets = op.firstOnly ? shotsNow.slice(0, 1) : target?.kind === 'shot' ? [target] : shotsNow;
        const note = op.note[lang];
        setNodes(ns => ns.map(n => targets.some(t => t.id === n.id)
          ? { ...n, prompt: n.prompt.includes(note) ? n.prompt : `${n.prompt}${zh ? '，' : ', '}${note}`, shotSize: op.shotSize ?? n.shotSize }
          : n));
        targets.forEach((t, i) => generate(t.id, i * 300));
      }
      if (op.type === 'script') {
        if (op.action === 'continue') continueEpisode();
        else rewriteScript(op.action === 'rewrite' ? undefined : (episodes[0]?.id));
      }
      if (op.type === 'assets') {
        if (op.action === 'generate') generateMissingAssets();
        else {
          const a = scopedAsset(op.action === 'aged' ? 'scene' : 'character');
          if (a) {
            const note = op.action === 'aged' ? (zh ? '做旧：斑驳墙面、泛黄灯光' : 'aged: worn walls, yellowed light') : (zh ? '服装换成冬季款，长相不变' : 'winter outfit, same face');
            setAssets(as => as.map(x => (x.id === a.id ? { ...x, desc: x.desc.includes(note) ? x.desc : `${x.desc}${x.desc ? (zh ? '；' : '; ') : ''}${note}` } : x)));
            generateAsset(a.id);
          }
        }
      }
      if (op.type === 'videos') generateVideos(orderedShots(nodesRef.current).map(s => s.id));
      if (op.type === 'oneClick') {
        if (mode === 'music') { generateAll(); later(renderOutput, 2600); return; }
        if (!episodes.length) rewriteScript();
        if (!assetsRef.current.length) later(() => { extractAssets(); later(generateMissingAssets, 60); }, 100);
        const t = assetsRef.current.some(a => a.status === 'missing') ? generateMissingAssets() : 2400;
        if (!nodesRef.current.some(n => n.kind === 'output')) ensureOutput();
        later(renderOutput, t + 300);
      }
    });
  };

  /* ───────── chat scope ───────── */

  const activeEpisode = episodes.find(e => e.id === activeEpisodeId) ?? episodes[0];
  const selectedAsset = assets.find(a => a.id === selectedAssetId);
  const scopes: ChatScopeOption[] = [
    { id: 'project', label: zh ? '整部作品' : 'Whole project' },
    ...episodes.map(e => ({ id: `ep:${e.id}`, label: view === 'storyboard' ? `${e.name} · ${zh ? '全部片段' : 'all segments'}` : e.name })),
    ...(selected && (view === 'canvas' || view === 'storyboard') ? [{ id: `node:${selected.id}`, label: `${selected.badge ?? KIND_META[selected.kind].label[lang]} · ${selected.title}` }] : []),
    ...(selectedAsset && view === 'assets' ? [{ id: `asset:${selectedAsset.id}`, label: `${ASSET_LABELS[selectedAsset.type][lang]} · ${selectedAsset.name}` }] : []),
  ];
  // Each view scopes the chat to what it shows: assets → asset, canvas/storyboard → node, script/storyboard → episode.
  const autoScope = view === 'assets' ? (selectedAsset ? `asset:${selectedAsset.id}` : 'project')
    : (view === 'canvas' || view === 'storyboard') && selected ? `node:${selected.id}`
      : (view === 'script' || view === 'storyboard') && activeEpisode ? `ep:${activeEpisode.id}` : 'project';
  const scopeId = scopes.some(s => s.id === scopeChoice) ? scopeChoice! : autoScope;
  const scopeLabel = scopes.find(s => s.id === scopeId)?.label ?? scopes[0].label;
  const chooseScope = (id: string) => {
    setScopeChoice(id);
    if (id.startsWith('ep:')) setActiveEpisodeId(id.slice(3));
  };

  const onSend = (text: string) => {
    const target = scopeId.startsWith('node:') ? nodesRef.current.find(n => n.id === scopeId.slice(5)) : undefined;
    const src = sourceNode(nodesRef.current);
    const subject = src && src.kind !== 'lyrics' && src.kind !== 'script' ? src.title : spec.artistName;
    const plan = planDirectorReply(text, lang, { mode, selected: target, subject, advice: profile.advice[lang] });
    setMessages(m => [...m, { id: uid('m'), role: 'user', text }]);
    setThinking(true);
    setStreaming(true);
    later(() => {
      setThinking(false);
      const id = uid('m');
      setMessages(m => [...m, { id, role: 'ai', text: '' }]);
      applyOps(plan.ops, target);
      let i = 0;
      const step = () => {
        i = Math.min(plan.reply.length, i + 3);
        const done = i >= plan.reply.length;
        setMessages(m => m.map(x => (x.id === id ? { ...x, text: plan.reply.slice(0, i), actions: done ? plan.actions : undefined } : x)));
        if (done) setStreaming(false); else later(step, 22);
      };
      step();
    }, 700);
  };

  /* ───────── project lifecycle ───────── */

  const startProject = (input: NewProjectInput) => {
    const next = buildSpec(input);
    const project = createProject(next, lang, profile);
    timers.current.forEach(t => window.clearTimeout(t));
    timers.current = [];
    const eps = buildEpisodes(next, profile, project.nodes, lang);
    setSpec(next); setNodes(project.nodes); setEdges(project.edges); setSelectedId(null); setSelectedAssetId(null);
    setEpisodes(eps); setActiveEpisodeId(eps[0]?.id ?? ''); setAssets(buildAssets(next, project.nodes, lang, profile.cast[lang]));
    setThinking(false); setStreaming(false); setExported(false); setDialogOpen(false); setView('canvas');
    setMessages([{ id: uid('m'), role: 'ai', text: welcomeFor(next, lang, profile) + (input.description ? (zh ? `\n\n我记下了你的要求：“${input.description}”。` : `\n\nNoted your brief: "${input.description}".`) : '') }]);
    setFitSignal(s => s + 1);
  };

  const deleteNode = useCallback((id: string) => {
    setNodes(ns => staleOutput(ns.filter(n => n.id !== id)));
    setEdges(es => es.filter(e => e.from !== id && e.to !== id));
    setSelectedId(s => (s === id ? null : s));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      if (dialogOpen || view !== 'canvas' || !selectedId || el.closest('input, textarea, select, [contenteditable="true"]')) return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const node = nodesRef.current.find(n => n.id === selectedId);
        if (node && node.kind !== 'output') { e.preventDefault(); deleteNode(node.id); }
      }
      if (e.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, deleteNode, dialogOpen, view]);

  const onRatio = (r: Ratio) => {
    setRatio(r);
    if (mode === 'video' && output) {
      const label = r === '9:16' ? (zh ? '竖屏' : 'vertical') : r === '16:9' ? (zh ? '横屏' : 'landscape') : (zh ? '方屏' : 'square');
      setNodes(ns => ns.map(n => (n.id === output.id ? { ...n, title: `${zh ? '成片' : 'Final'} · ${label} ${r}` } : n)));
    }
    setNodes(ns => staleOutput(ns));
    touch();
  };
  const onStyle = (id: string) => { setStyle(id); setNodes(ns => staleOutput(ns)); touch(); };
  const onToggleFormat = (f: string) => {
    setSpec(s => {
      const has = s.formats.includes(f);
      if (has && s.formats.length === 1) return s; // keep at least one deliverable
      return { ...s, formats: has ? s.formats.filter(x => x !== f) : [...s.formats, f] };
    });
    setNodes(ns => staleOutput(ns));
    touch();
  };
  const onChange = (id: string, patch: Partial<CanvasNode>) => { touch(); setNodes(ns => staleOutput(ns.map(n => (n.id === id ? { ...n, ...patch } : n)))); };

  const exportWork = () => {
    const today = new Date().toISOString().slice(0, 10);
    const id = uid('work');
    const length = mode === 'music' ? (nodes.find(n => n.kind === 'audio')?.duration ?? 0) : shots.reduce((a, s) => a + (s.duration || 0), 0);
    setWorks(w => [{ id, title: spec.name, status: 'Review', plays: '-', date: today, formats: spec.formats }, ...w]);
    // Lands in 发布中心 › 发布池 as "待审" with auth/watermark passed and QC pending.
    addToPool({
      id, type: 'director', title: `${spec.name} · ${spec.template}`, partnerName: spec.artistName, platform: 'DY', account: `@${spec.artistName}`,
      status: 'pending_review', scheduledAt: primeTimeSlot(1), preCheck: { auth: true, watermark: true, quality: null },
      duration: fmtDuration(length), thumbColor: '#8b5cf6', thumbImage: [shots.find(s => s.image)?.image, nodes.find(n => n.kind === 'character')?.image].find(u => u && !u.startsWith('blob:')),
      formats: spec.formats,
    });
    setExported(true);
  };

  const rewriteSegment = (id: string) => {
    const s = makeShot(ideaCursor.current++, 0, 0, lang, shotIdeasFor(mode, profile), spec.artistName, productName());
    patchNode(id, { prompt: s.prompt });
    generate(id);
  };

  // The AI buttons select the item (which scopes the chat to it) and move focus to the chat input.
  const [chatFocus, setChatFocus] = useState(0);
  const discuss = () => setChatFocus(n => n + 1);

  const inspectorProps = {
    lang, nodes, selected, mode, template: spec.template, formats: spec.available, deliverables: spec.formats, style, ratio,
    onToggleFormat, onStyle, onRatio, onChange, onGenerate: (id: string) => generate(id), onGenerateAll: generateAll, onDelete: deleteNode,
  };
  const missingAssets = assets.filter(a => a.status === 'missing').length;
  const inspectorVisible = nodes.length > 0 && (!!selected || settingsOpen);

  return (
    <div className="lg:h-full flex flex-col bg-gray-50 lg:overflow-hidden">
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-b border-gray-200 bg-white">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-gray-900 truncate">{spec.artistName} · {zh ? `《${spec.name}》` : `"${spec.name}"`}</div>
          <div className="text-[11px] text-gray-500 flex items-center gap-1 truncate">
            {savedAt === false
              ? <><CloudOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />{zh ? '浏览器未允许本地保存' : 'Browser blocked local save'}</>
              : <><Cloud className="w-3.5 h-3.5 text-emerald-500 shrink-0" />{savedAt ? `${zh ? '已自动保存' : 'Saved'} ${new Date(savedAt).toLocaleTimeString(zh ? 'zh-CN' : 'en-US', { hour: '2-digit', minute: '2-digit' })}` : (zh ? '未保存' : 'Not saved yet')}</>}
            <span className="text-gray-300">·</span>{spec.template} · {spec.formats.join(' / ')}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden md:inline-flex items-center h-9 rounded-xl border border-gray-200 bg-white px-3 text-xs text-gray-600">{styleLabel} · {ratio}</span>
          <button type="button" onClick={() => onSend(zh ? '一键制作' : 'One-click production')} disabled={streaming} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 h-9 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
            <Zap className="w-3.5 h-3.5 text-amber-500" />{zh ? '一键制作' : 'One-click'}
          </button>
          <button type="button" onClick={() => setDialogOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 h-9 text-xs font-medium text-gray-700 hover:bg-gray-50">
            <Plus className="w-3.5 h-3.5" />{zh ? '新建项目' : 'New project'}
          </button>
          <button type="button" onClick={() => setWorksOpen(o => !o)} aria-pressed={worksOpen} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 h-9 text-xs font-medium text-gray-700 hover:bg-gray-50">
            <Library className="w-3.5 h-3.5" />{zh ? `作品库 ${works.length}` : `Works ${works.length}`}
          </button>
          {exported ? (
            <button type="button" onClick={onOpenPublish} disabled={!onOpenPublish}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-50 border border-emerald-200 px-3 h-9 text-xs font-medium text-emerald-700 hover:bg-emerald-100">
              <CheckCircle2 className="w-4 h-4" />{zh ? '已进入发布池 · 去发布中心查看' : 'In publish pool · open Publish Center'}<ArrowRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button type="button" onClick={exportWork} disabled={output?.status !== 'done'}
              title={output?.status !== 'done' ? (zh ? '请先在「成片」完成合成' : 'Render in Final first') : undefined}
              className="inline-flex items-center gap-1.5 rounded-xl px-3.5 h-9 text-xs font-semibold disabled:opacity-45"
              style={{ background: 'linear-gradient(90deg, #06b6d4, #8b5cf6)', color: '#fff' }}>
              <Send className="w-3.5 h-3.5" />{zh ? '导出到发布中心' : 'Send to Publish Center'}
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        <DirectorChat lang={lang} messages={messages} typing={thinking} busy={streaming}
          directorName={profile.director[lang]} focus={`${profile.focus[lang]} · ${profile.cast[lang]}`}
          scopeLabel={scopeLabel} contextLinks={CONTEXT_LINKS(view)[lang]} scopes={scopes} scopeId={scopeId} onScope={chooseScope}
          starters={startersFor(mode)} suggestions={suggestionsFor(view, mode, promptsFor(profile, mode))}
          focusSignal={chatFocus} onSend={onSend} onReset={() => { setMessages(welcome(spec)); setScopeChoice(null); }} />

        <ViewRail lang={lang} mode={mode} view={view} onView={v => { setView(v); if (v === 'canvas') setFitSignal(s => s + 1); }}
          badges={{ assets: missingAssets, storyboard: shots.filter(s => s.status !== 'done').length }} />

        <div className="relative flex-none min-w-0 lg:flex-1 flex flex-col">
          {view === 'canvas' && (
            <>
              {/* Mobile: fixed-height canvas so the timeline and inspector stack below it. */}
              <div className="relative h-[560px] flex-none lg:h-auto lg:flex-1 lg:min-h-0">
                <DirectorCanvas lang={lang} nodes={nodes} edges={edges} selectedId={selectedId} fitSignal={fitSignal} mode={mode} deliverables={spec.formats}
                  reserveRight={inspectorVisible ? 290 : 0}
                  onSelect={setSelectedId} onMove={(id, x, y) => patchNode(id, { x, y })}
                  onGenerate={id => generate(id)} onRender={renderOutput}
                  onAdd={addFromCanvas} onUpload={uploadToCanvas} onTidy={tidy} onTemplates={() => setDialogOpen(true)} />
                {nodes.length > 0 && !inspectorVisible && (
                  <button type="button" onClick={() => setSettingsOpen(true)}
                    className="hidden lg:inline-flex absolute right-3 top-3 h-9 items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 shadow-md shadow-gray-900/5 hover:bg-gray-50">
                    <Settings2 className="w-3.5 h-3.5" />{zh ? '项目设置' : 'Project settings'}
                  </button>
                )}
                {inspectorVisible && (
                  <div className="hidden lg:flex flex-col absolute right-3 top-3 bottom-3 w-[272px] rounded-2xl border border-gray-200 bg-white shadow-xl shadow-gray-900/10 overflow-hidden">
                    <div className="shrink-0 flex items-center justify-between px-4 h-10 border-b border-gray-100">
                      <span className="text-xs font-semibold text-gray-900">{selected ? (zh ? '节点属性' : 'Node properties') : (zh ? '项目设置' : 'Project settings')}</span>
                      <button type="button" onClick={() => { setSelectedId(null); setSettingsOpen(false); }} aria-label={zh ? '关闭面板' : 'Close panel'}
                        className="w-7 h-7 rounded-lg text-gray-400 hover:bg-gray-100 inline-flex items-center justify-center"><X className="w-4 h-4" /></button>
                    </div>
                    <DirectorInspector {...inspectorProps} className="flex-1 min-h-0" />
                  </div>
                )}
              </div>
              <DirectorTimeline lang={lang} nodes={nodes} selectedId={selectedId} onSelect={setSelectedId} />
              {nodes.length > 0 && <DirectorInspector {...inspectorProps} className="lg:hidden border-t border-gray-200" />}
            </>
          )}
          {view === 'script' && (
            <ScriptView lang={lang} mode={mode} name={spec.name} outline={spec.description} episodes={episodes} lyrics={lyricsNode} assets={assets}
              vocal={nodes.find(n => n.kind === 'vocal')} artistName={spec.artistName} onSing={() => generate(ensureNode('vocal').id)} shots={shots} outputDone={output?.status === 'done'}
              onOutline={text => setSpec(s => ({ ...s, description: text }))}
              onEpisode={(id, patch) => setEpisodes(es => es.map(e => (e.id === id ? { ...e, ...patch } : e)))}
              onLyrics={text => lyricsNode && onChange(lyricsNode.id, { prompt: text })}
              onRewrite={() => rewriteScript()} onContinue={id => continueEpisode(id)} onExtractAssets={extractAssets}
              onGoto={setView} onOneClick={() => onSend(zh ? '一键制作' : 'One-click production')}
              onDiscuss={id => { setActiveEpisodeId(id); discuss(); }} />
          )}
          {view === 'assets' && (
            <AssetsView lang={lang} assets={assets} selectedId={selectedAssetId} propLabel={propLabel}
              onSelect={setSelectedAssetId} onChange={(id, patch) => setAssets(as => as.map(a => (a.id === id ? { ...a, ...patch } : a)))}
              onGenerate={id => generateAsset(id)} onGenerateAll={generateMissingAssets} onExtract={extractAssets} onAdd={addAsset}
              onDiscuss={id => { setSelectedAssetId(id); discuss(); }} />
          )}
          {view === 'storyboard' && (
            <StoryboardView lang={lang} mode={mode} episodes={episodes} lyrics={lyricsNode} shots={shots} assets={assets} styleLabel={styleLabel} ratio={ratio}
              selectedId={selectedId} outputDone={output?.status === 'done'}
              onSelect={setSelectedId} onChange={onChange}
              onFrames={ids => ids.forEach((id, i) => generate(id, i * 350))} onVideos={ids => { generateVideos(ids); }}
              onRewrite={rewriteSegment} onDelete={deleteNode} onDiscuss={id => { setSelectedId(id); discuss(); }}
              onPreview={() => { setView('final'); setPlaySignal(s => s + 1); }}
              onExport={() => { if (output?.status === 'done') setView('final'); else { if (!output) ensureOutput(); later(renderOutput, 0); setView('final'); } }}
              onGotoAssets={() => setView('assets')} />
          )}
          {view === 'final' && (
            <FinalView lang={lang} mode={mode} nodes={nodes} ratio={ratio} styleLabel={styleLabel} deliverables={spec.formats} exported={exported} playSignal={playSignal}
              selectedId={selectedId} onSelect={setSelectedId}
              onRender={() => { if (!output) ensureOutput(); later(renderOutput, 0); }} onExport={exportWork} />
          )}
          <WorksDrawer lang={lang} open={worksOpen} works={works} onClose={() => setWorksOpen(false)} />
        </div>
      </div>

      <NewProjectDialog lang={lang} open={dialogOpen} workshopName={profile.focus[lang]} templates={templates} briefPlaceholder={profile.defaultBrief[lang]}
        onClose={() => setDialogOpen(false)} onCreate={startProject} />
    </div>
  );
};
