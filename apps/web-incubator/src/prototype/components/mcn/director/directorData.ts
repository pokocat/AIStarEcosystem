import type { Lang } from '../../../translations';
import { MV_SHOTS, type ShotIdea, type SourceKind, type WorkshopProfile } from './workshopProfiles';

export type NodeKind = 'script' | 'product' | 'knowledge' | 'lyrics' | 'character' | 'shot' | 'audio' | 'vocal' | 'output';
export type GenStatus = 'idle' | 'generating' | 'done';
export type ShotSize = 'wide' | 'full' | 'medium' | 'close' | 'extreme';
export type CameraMove = 'static' | 'push' | 'pull' | 'pan' | 'follow';
export type ProjectMode = 'music' | 'video';

export interface CanvasNode {
  id: string;
  kind: NodeKind;
  x: number;
  y: number;
  title: string;
  prompt: string;
  image?: string;
  duration?: number;
  shotSize?: ShotSize;
  camera?: CameraMove;
  genre?: string;
  mood?: string;
  bpm?: number;
  voiceStyle?: string;
  /** Overrides the kind label, e.g. 数字代言人 instead of 艺人. */
  badge?: string;
  /** Storyboard frame → video: the shot's video render state (分镜 view). */
  videoStatus?: GenStatus;
  status: GenStatus;
}

export interface Edge { from: string; to: string }
export interface ChatMessage { id: string; role: 'user' | 'ai'; text: string; actions?: string[] }
export type LT = { zh: string; en: string };

/** What the user asked for when creating a project (template, deliverables, artist). */
export interface ProjectSpec {
  mode: ProjectMode;
  template: string;
  name: string;
  description: string;
  formats: string[];
  /** All deliverables offered by the chosen template. */
  available: string[];
  artistName: string;
  artistAvatar: string;
  /** Start from an empty canvas (空白画布). */
  blank?: boolean;
}

export const NODE_W = 232;
export const NODE_H: Record<NodeKind, number> = { script: 150, product: 170, knowledge: 170, lyrics: 170, character: 150, shot: 214, audio: 150, vocal: 150, output: 220 };

export const KIND_META: Record<NodeKind, { label: LT; color: string }> = {
  script: { label: { zh: '剧本', en: 'Script' }, color: '#6366f1' },
  product: { label: { zh: '商品卖点', en: 'Product' }, color: '#f97316' },
  knowledge: { label: { zh: '知识库', en: 'Knowledge' }, color: '#3b82f6' },
  lyrics: { label: { zh: '歌词', en: 'Lyrics' }, color: '#14b8a6' },
  character: { label: { zh: '艺人', en: 'Artist' }, color: '#ec4899' },
  shot: { label: { zh: '镜头', en: 'Shot' }, color: '#8b5cf6' },
  audio: { label: { zh: '编曲', en: 'Arrangement' }, color: '#f59e0b' },
  vocal: { label: { zh: '人声', en: 'Vocals' }, color: '#d946ef' },
  output: { label: { zh: '交付', en: 'Delivery' }, color: '#06b6d4' },
};

export const SHOT_SIZES: Array<{ id: ShotSize; label: LT }> = [
  { id: 'wide', label: { zh: '远景', en: 'Wide' } },
  { id: 'full', label: { zh: '全景', en: 'Full' } },
  { id: 'medium', label: { zh: '中景', en: 'Medium' } },
  { id: 'close', label: { zh: '近景', en: 'Close' } },
  { id: 'extreme', label: { zh: '特写', en: 'Extreme' } },
];

export const CAMERA_MOVES: Array<{ id: CameraMove; label: LT }> = [
  { id: 'static', label: { zh: '固定', en: 'Static' } },
  { id: 'push', label: { zh: '推镜', en: 'Push in' } },
  { id: 'pull', label: { zh: '拉镜', en: 'Pull out' } },
  { id: 'pan', label: { zh: '摇镜', en: 'Pan' } },
  { id: 'follow', label: { zh: '跟拍', en: 'Follow' } },
];

export const GENRES: Array<{ id: string; label: LT }> = [
  { id: 'electropop', label: { zh: '电子流行', en: 'Electro-pop' } },
  { id: 'rock', label: { zh: '摇滚', en: 'Rock' } },
  { id: 'ballad', label: { zh: '抒情', en: 'Ballad' } },
  { id: 'guofeng', label: { zh: '国风', en: 'C-style' } },
  { id: 'rap', label: { zh: '说唱', en: 'Rap' } },
  { id: 'rnb', label: { zh: 'R&B', en: 'R&B' } },
];

export const MOODS: Array<{ id: string; label: LT }> = [
  { id: 'hype', label: { zh: '燃', en: 'Hype' } },
  { id: 'healing', label: { zh: '治愈', en: 'Healing' } },
  { id: 'sad', label: { zh: '伤感', en: 'Sad' } },
  { id: 'dark', label: { zh: '暗黑', en: 'Dark' } },
];

export const VOICE_STYLES: Array<{ id: string; label: LT }> = [
  { id: 'natural', label: { zh: '原声', en: 'Natural' } },
  { id: 'airy', label: { zh: '空灵', en: 'Airy' } },
  { id: 'husky', label: { zh: '沙哑', en: 'Husky' } },
  { id: 'sweet', label: { zh: '甜美', en: 'Sweet' } },
];

export const STYLES: Array<{ id: string; label: LT }> = [
  { id: 'cyber', label: { zh: '赛博霓虹', en: 'Cyber neon' } },
  { id: 'film', label: { zh: '电影质感', en: 'Cinematic' } },
  { id: 'anime', label: { zh: '日系动漫', en: 'Anime' } },
];

export const RATIOS = ['9:16', '16:9', '1:1'] as const;
export type Ratio = typeof RATIOS[number];

export const labelOf = (list: Array<{ id: string; label: LT }>, id: string | undefined, lang: Lang) => list.find(o => o.id === id)?.label[lang] ?? '';
export const fmtDuration = (s = 0) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

// Images already used elsewhere in the project, reused as "generated" frames.
export const FRAME_POOL = [
  '/images/case-luna-07.webp',
  '/images/case-lin-qi.webp',
  '/images/case-mira.webp',
  '/images/case-erciyuan-moe.webp',
  '/images/scene-entrepreneur.webp',
  '/images/scene-artist-incubation.webp',
];

let seq = 0;
export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

/** Formats that need picture, e.g. MV视频 / Music Video. */
export const isVisualFormat = (format: string) => /MV|视频|Video|海报|Poster|可视化|Visualizer/i.test(format);

const withVars = (text: string, artist: string, product = '') => text.split('{A}').join(artist).split('{P}').join(product);

export const makeShot = (index: number, x: number, y: number, lang: Lang, ideas: ShotIdea[], artist: string, product = ''): CanvasNode => {
  const idea = ideas[index % ideas.length];
  return {
    id: uid('shot'), kind: 'shot', x, y,
    title: idea.title[lang], prompt: withVars(idea.prompt[lang], artist, product),
    shotSize: idea.size, camera: idea.camera, duration: idea.duration, status: 'idle',
  };
};

/** A close-up shot of the source material (product, dish, artifact, …). */
export const makeCloseUp = (x: number, y: number, lang: Lang, subject: string): CanvasNode => ({
  id: uid('shot'), kind: 'shot', x, y, status: 'idle', shotSize: 'extreme', camera: 'push', duration: 3,
  title: lang === 'zh' ? `特写 · ${subject}` : `Close-up · ${subject}`,
  prompt: lang === 'zh' ? `${subject} 特写，慢推镜头，突出细节与质感` : `Extreme close-up of ${subject}, slow push-in on detail and texture`,
});

export const writeLyrics = (lang: Lang, theme: string) => lang === 'zh'
  ? `[主歌]\n雨落在${theme}的霓虹里\n你的消息停在凌晨三点\n[副歌]\n别让我在人海里失约\n把心跳调成同一频率\n这一次 我会找到你`
  : `[Verse]\nRain falls on the neon of ${theme}\nYour message frozen at 3 a.m.\n[Chorus]\nDon't let me miss you in the crowd\nTune our heartbeats to one frequency\nThis time I will find you`;

export const shotIdeasFor = (mode: ProjectMode, profile: WorkshopProfile) => (mode === 'music' ? MV_SHOTS : profile.shots);

const SOURCE_ID = 'source-1';

export const createProject = (spec: ProjectSpec, lang: Lang, profile: WorkshopProfile): { nodes: CanvasNode[]; edges: Edge[] } => {
  if (spec.blank) return { nodes: [], edges: [] };
  const zh = lang === 'zh';
  const A = spec.artistName;
  const character: CanvasNode = {
    id: 'char-1', kind: 'character', x: 40, y: 270, status: 'done', image: spec.artistAvatar, title: A, badge: profile.cast[lang],
    prompt: zh ? `形象与声线已锁定，可作为${profile.cast.zh}出镜与配音` : `Look and voice locked; ready to appear and speak as the ${profile.cast.en.toLowerCase()}`,
  };
  const output: CanvasNode = {
    id: 'output-1', kind: 'output', x: 0, y: 200, status: 'idle',
    title: spec.mode === 'music' ? (zh ? '母带 · 交付' : 'Master · Delivery') : (zh ? `成片 · ${spec.formats[0] ?? ''}` : `Final · ${spec.formats[0] ?? ''}`),
    prompt: spec.mode === 'music' ? (zh ? '混音、母带处理并按交付格式导出' : 'Mix, master and export to each deliverable') : (zh ? '自动剪辑、字幕与配乐合成' : 'Auto edit, captions and music mix'),
  };

  if (spec.mode === 'music') {
    const lyrics: CanvasNode = { id: 'lyrics-1', kind: 'lyrics', x: 40, y: 40, status: 'done', title: zh ? `《${spec.name}》歌词` : `"${spec.name}" lyrics`, prompt: writeLyrics(lang, zh ? '城市' : 'the city') };
    const audio: CanvasNode = { id: 'audio-1', kind: 'audio', x: 360, y: 20, status: 'done', duration: 192, genre: 'electropop', mood: 'dark', bpm: 96, title: zh ? '编曲 · 伴奏' : 'Arrangement', prompt: zh ? '合成器铺底、808 鼓组，副歌加入弦乐' : 'Synth pads, 808 drums, strings in the chorus' };
    const vocal: CanvasNode = { id: 'vocal-1', kind: 'vocal', x: 360, y: 200, status: 'idle', duration: 192, voiceStyle: 'airy', title: zh ? `${A} · 主唱` : `${A} · lead vocal`, prompt: zh ? '按歌词演唱，副歌加和声' : 'Sing the lyrics with harmonies in the chorus' };
    const withMv = spec.formats.some(isVisualFormat);
    const shots = withMv ? [0, 1].map(i => ({ ...makeShot(i, 680, 20 + i * 236, lang, MV_SHOTS, A), id: `shot-${i + 1}`, status: (i === 0 ? 'done' : 'idle') as GenStatus, image: i === 0 ? FRAME_POOL[1] : undefined })) : [];
    const out = { ...output, x: withMv ? 1000 : 680, y: 160 };
    const edges: Edge[] = [
      { from: lyrics.id, to: vocal.id }, { from: character.id, to: vocal.id },
      { from: audio.id, to: out.id }, { from: vocal.id, to: out.id },
      ...shots.flatMap(s => [{ from: lyrics.id, to: s.id }, { from: character.id, to: s.id }, { from: s.id, to: out.id }]),
    ];
    return { nodes: [lyrics, character, audio, vocal, ...shots, out], edges };
  }

  const kind: SourceKind = profile.source.kind;
  const sourceTitle = withVars(profile.source.title[lang], A);
  const source: CanvasNode = {
    id: SOURCE_ID, kind, x: 40, y: 50, status: 'done',
    title: kind === 'script' ? `${spec.template} · ${spec.name}` : sourceTitle,
    prompt: kind === 'script' ? (spec.description || withVars(profile.source.prompt[lang], A)) : withVars(profile.source.prompt[lang], A),
  };
  const product = kind === 'product' ? sourceTitle : '';
  const shots: CanvasNode[] = [0, 1, 2].map(i => ({ ...makeShot(i, 360, 20 + i * 236, lang, profile.shots, A, product), id: `shot-${i + 1}`, status: 'done' as GenStatus, image: FRAME_POOL[(i + 1) % FRAME_POOL.length] }));
  shots[2] = { ...shots[2], status: 'idle', image: undefined };
  const audio: CanvasNode = { id: 'audio-1', kind: 'audio', x: 680, y: 520, status: 'done', duration: 30, genre: 'electropop', mood: 'dark', bpm: 96, title: zh ? '配乐' : 'Score', prompt: zh ? '跟随画面情绪起伏的背景音乐' : 'A score that follows the mood of the picture' };
  const out = { ...output, x: 960, y: 220 };
  const edges: Edge[] = [
    ...shots.flatMap(s => [{ from: source.id, to: s.id }, { from: character.id, to: s.id }, { from: s.id, to: out.id }]),
    { from: audio.id, to: out.id },
  ];
  return { nodes: [source, { ...character, y: 300 }, ...shots, audio, out], edges };
};

/** Shots in edit order: left to right, then top to bottom within a column. */
export const orderedShots = (nodes: CanvasNode[]) =>
  nodes.filter(n => n.kind === 'shot').sort((a, b) => (Math.abs(a.x - b.x) > 120 ? a.x - b.x : a.y - b.y));

/** Nodes that need generating before the deliverable can be rendered. */
export const isGeneratable = (n: CanvasNode) => n.kind === 'shot' || n.kind === 'audio' || n.kind === 'vocal' || n.kind === 'lyrics';

export type DirectorOp =
  | { type: 'addShots'; count: number }
  | { type: 'closeUp'; subject: string }
  | { type: 'restyle'; note: LT; shotSize?: ShotSize; firstOnly?: boolean }
  | { type: 'style'; id: string }
  | { type: 'format'; pattern: 'languages' | 'cards' | 'variants' }
  | { type: 'script'; action: 'rewrite' | 'dialogue' | 'continue' | 'opening' }
  | { type: 'assets'; action: 'generate' | 'outfit' | 'aged' }
  | { type: 'videos' }
  | { type: 'oneClick' }
  | { type: 'music'; genre?: string; bpm?: number; mood?: string }
  | { type: 'lyrics' }
  | { type: 'vocal' }
  | { type: 'generateAll' };

const CN_NUM: Record<string, number> = { 一: 1, 两: 2, 二: 2, 三: 3, 四: 4, 五: 5 };
const GENRE_WORDS: Array<[RegExp, string]> = [[/摇滚|rock/, 'rock'], [/抒情|ballad/, 'ballad'], [/国风|古风|地方特色|chinese|local/, 'guofeng'], [/说唱|rap|hip.?hop/, 'rap'], [/r&b|rnb/, 'rnb'], [/电子|electro|edm/, 'electropop']];
const MOOD_WORDS: Array<[RegExp, string]> = [[/燃|hype|energetic|轻快|upbeat/, 'hype'], [/治愈|轻松|healing|warm|light/, 'healing'], [/伤感|悲|sad/, 'sad'], [/暗黑|沉稳|dark|confident/, 'dark']];
const ADD = /加|增|多|新|做|拍|再|add|more|make/;

export interface PlanContext {
  mode: ProjectMode;
  selected?: CanvasNode;
  /** What close-ups focus on: the product, dish, artifact… */
  subject: string;
  advice: string;
}

/** Rule-based stand-in for the AI director: maps a request to canvas operations plus a reply. */
export const planDirectorReply = (text: string, lang: Lang, ctx: PlanContext): { reply: string; ops: DirectorOp[]; actions: string[] } => {
  const zh = lang === 'zh';
  const { mode, selected } = ctx;
  const t = text.toLowerCase();
  const ops: DirectorOp[] = [];
  const actions: string[] = [];
  const replies: string[] = [];
  const say = (action: string, reply: string) => { actions.push(action); replies.push(reply); };

  if (/一键制作|一键做|one.?click/.test(t)) {
    ops.push({ type: 'oneClick' });
    say(zh ? '一键制作已启动：剧本 → 资产图 → 分镜 → 视频 → 成片' : 'One-click run started: script → assets → storyboard → video → final',
      zh ? '我会按顺序把剩下的步骤连起来做完：先补齐资产图，再生成分镜和视频，最后合成成片。每一步都可以在左侧视图里随时查看和修改。' : 'I will chain the remaining steps: fill in asset images, then storyboard and video, then the final cut. You can check or edit each step in its view.');
    return { reply: replies.join(zh ? '' : ' '), ops, actions };
  }
  if (/续写|下一集|下一场|continue|next episode/.test(t)) {
    ops.push({ type: 'script', action: 'continue' });
    say(zh ? '已续写下一集' : 'Next episode drafted', zh ? '续写了下一集，延续上一集结尾的悬念，人物关系保持不变。你可以在「剧本」里展开查看。' : 'Drafted the next episode, picking up the cliffhanger with the same relationships. Open it in Script.');
  }
  if (/对白|台词|dialogue|lines/.test(t)) {
    ops.push({ type: 'script', action: 'dialogue' });
    say(zh ? '只改了对白，动作与场景保持不变' : 'Dialogue revised; action and scenes untouched', zh ? '只动了对白：更短、更口语，动作和场景描写都没改。' : 'Only the dialogue changed: shorter and more natural; action and scene lines are untouched.');
  }
  if (/开头|吸引|hook|opening/.test(t) && !/金句/.test(t)) {
    ops.push({ type: 'script', action: 'opening' }, { type: 'restyle', note: { zh: '开场更直接、更有冲击力', en: 'a punchier, more direct opening' }, firstOnly: true });
    say(zh ? '开头已改写，第一个镜头同步重做' : 'Opening rewritten; first shot redone', zh ? '开头的问题在于信息来得太慢。我把悬念提前到第一句，并让第一个镜头直接给出关键细节。' : 'The opening was too slow. I moved the hook to the first line and made shot one show the key detail.');
  }
  if (/写剧本|重写剧本|生成剧本|写脚本|重写脚本|rewrite the script|write (a |the )?script/.test(t)) {
    ops.push({ type: 'script', action: 'rewrite' });
    say(zh ? '剧本已重写' : 'Script rewritten', zh ? '按梗概重写了分场剧本，每段对应一个镜头，可以直接拿去做分镜。' : 'Rewrote the scene-by-scene script from the logline; each paragraph maps to one shot.');
  }
  if (/资产图|资产|asset/.test(t) && /生成|全部|补|generate|all/.test(t)) {
    ops.push({ type: 'assets', action: 'generate' });
    say(zh ? '开始生成缺少的资产图' : 'Generating missing asset images', zh ? '正在为缺少资产图的角色、场景和道具生成统一风格的设定图，同一人物不会重复新建。' : 'Generating consistent sheets for characters, scenes and props that lack images; no duplicates per person.');
  }
  if (/衣服|服装|换装|outfit|clothes|冬天|winter/.test(t)) {
    ops.push({ type: 'assets', action: 'outfit' });
    say(zh ? '已保留长相，只更换服装' : 'Kept the face, changed the outfit', zh ? '长相和发型锁定不变，只把服装换成冬季款，相关分镜会提示你是否同步重做。' : 'Face and hair stay locked; only the outfit changes to winter wear.');
  }
  if (/旧一些|更旧|做旧|older|worn|aged/.test(t)) {
    ops.push({ type: 'assets', action: 'aged' });
    say(zh ? '场景已做旧并重新生成' : 'Scene aged and regenerated', zh ? '给场景加了斑驳墙面、泛黄灯光和旧招牌，整体更有年代感。' : 'Added worn walls, yellowed light and an old sign for more age.');
  }
  if (/视频/.test(t) && /生成|批量|全部/.test(t) || /generate (all )?videos?|render videos?/.test(t)) {
    ops.push({ type: 'videos' });
    say(zh ? '开始批量生成片段视频' : 'Generating segment videos', zh ? '按分镜图逐段生成视频，已确认的片段不会被覆盖。' : 'Rendering each segment from its storyboard frame; confirmed segments are kept.');
  }
  const wantsCloseUp = /特写|close.?up/.test(t) && ADD.test(t) && !/改成|换成|make the selected|switch/.test(t);
  if (wantsCloseUp) {
    // "加一个美食特写" → 美食; generic words (商品/产品/文物) resolve to the real source subject.
    const named = text.match(/(?:一个|个|给)\s*([^\s，,。]{1,8}?)\s*特写/)?.[1];
    const subject = named && !/^(商品|产品|文物|这个)$/.test(named) ? named : ctx.subject;
    ops.push({ type: 'closeUp', subject });
    say(zh ? `新增「${subject}」特写镜头` : `Added a close-up of ${subject}`,
      zh ? `加了一个「${subject}」的特写，慢推镜头停留 3 秒，让细节和质感说话。` : `Added a 3-second slow push-in on ${subject} so the detail does the talking.`);
  }
  if (/a\/b|ab 版|两个.*版本|variant/.test(t)) {
    ops.push({ type: 'addShots', count: 2 }, { type: 'format', pattern: 'variants' });
    say(zh ? '新增 A/B 两个开场版本' : 'Added A/B opening variants',
      zh ? '做了两个不同的开场：A 版直接抛痛点，B 版先给结果再倒叙，投放后可以对比转化。' : 'Two openings: A leads with the pain point, B shows the result first; compare conversion after launch.');
  }
  if (!wantsCloseUp && !ops.some(o => o.type === 'addShots') && /镜头|分镜|shot|storyboard|scene|mv/.test(t) && ADD.test(t)) {
    const m = t.match(/(\d+)/) || t.match(/([一两二三四五])/);
    const count = Math.min(5, Math.max(1, m ? (Number(m[1]) || CN_NUM[m[1]] || 2) : 2));
    ops.push({ type: 'addShots', count });
    const what = mode === 'music' ? (zh ? 'MV 镜头' : 'MV shots') : (zh ? '镜头' : 'shots');
    say(zh ? `画布新增 ${count} 个${what}` : `Added ${count} ${what}`,
      mode === 'music'
        ? (zh ? `好的，我按歌曲段落补了 ${count} 个 MV 镜头，会对齐副歌和桥段的节拍。` : `Done. I added ${count} MV shots following the song sections, cut on the chorus and bridge beats.`)
        : (zh ? `好的，我在故事线后面续写了 ${count} 个镜头，保持和前面一致的人物与风格。` : `Done. I extended the sequence with ${count} shots, keeping cast and style consistent.`));
  }
  if (/英文|日文|多语言|翻译|english|japanese|multilingual|translat/.test(t)) {
    ops.push({ type: 'format', pattern: 'languages' });
    say(zh ? '已加入多语言版本交付' : 'Added multilingual deliverables',
      zh ? '会同步生成英文和日文的配音与字幕，数字形象口型自动对齐。' : 'English and Japanese voice-over and subtitles will be generated, with lip-sync on the avatar.');
  }
  if (/卡片|表情包|海报|cards?|stickers?|poster/.test(t) && /拆|做|出|生成|make|split|cut/.test(t)) {
    ops.push({ type: 'format', pattern: 'cards' });
    say(zh ? '已加入卡片/表情包交付' : 'Added cards / stickers to deliverables',
      zh ? '会从成片关键帧里自动拆出卡片和表情包，配上一句话文案。' : 'Cards and stickers will be cut from key frames, each with a one-line caption.');
  }
  if (/歌词|作词|写词|写一首|写歌|副歌|主歌|lyric|write a song|chorus|verse/.test(t)) {
    ops.push({ type: 'lyrics' }, { type: 'vocal' });
    say(zh ? '歌词已重写，人声将按新歌词重新演唱' : 'Lyrics rewritten; vocals re-sung to match',
      zh ? '新版歌词把副歌落在一个反复出现的钩子上，押同一个韵，方便记忆。人声会按新词重新演唱。' : 'The new lyrics land the chorus on a repeated hook with one rhyme so it sticks. Vocals will be re-sung to match.');
  }
  const styleId = /动漫|二次元|可爱|anime|cute/.test(t) ? 'anime' : /电影|cinematic|film/.test(t) ? 'film' : /赛博|霓虹|cyber/.test(t) ? 'cyber' : undefined;
  if (styleId && /风格|画风|改成|换成|style|make it|switch/.test(t)) {
    ops.push({ type: 'style', id: styleId });
    say(zh ? '画面风格已切换并重新生成镜头' : 'Visual style switched; shots regenerating',
      zh ? '已统一切换画面风格，所有镜头会按新风格重新生成，角色形象保持一致。' : 'Switched the visual style; every shot regenerates in the new look with the character kept consistent.');
  }
  if (mode === 'video' && /雨|夜|rain|night|特写|close/.test(t) && !wantsCloseUp && !styleId) {
    const close = /特写|close/.test(t);
    ops.push({ type: 'restyle', note: { zh: '雨夜霓虹，湿润反光', en: 'rainy neon night, wet reflections' }, shotSize: close ? 'extreme' : undefined });
    const target = selected?.kind === 'shot' ? (zh ? `「${selected.title}」` : `"${selected.title}"`) : (zh ? '全部镜头' : 'all shots');
    say(zh ? `已调整${target}并重新生成` : `Updated ${target} and regenerated`,
      zh ? `已把${target}改为雨夜氛围${close ? '，景别换成特写' : ''}，霓虹倒影会让画面更有情绪。` : `Switched ${target} to a rainy night look${close ? ' with an extreme close-up' : ''}; the neon reflections add mood.`);
  }
  if (/开场|金句|痛点|opening|hook|pain point/.test(t) && /换|改|更|强|狠|sharpen|stronger/.test(t)) {
    ops.push({ type: 'restyle', note: { zh: '开场更直接、更有冲击力', en: 'a punchier, more direct opening' }, firstOnly: true });
    say(zh ? '开场镜头已改写并重新生成' : 'Opening shot rewritten and regenerating',
      zh ? '开场改成第一句话就给结论，配合推镜和大字幕，前 3 秒留住人。' : 'The opening now states the point in the first line with a push-in and big caption to hold the first 3 seconds.');
  }
  const genre = GENRE_WORDS.find(([re]) => re.test(t))?.[1];
  const mood = MOOD_WORDS.find(([re]) => re.test(t))?.[1];
  const bpmMatch = t.match(/(\d{2,3})\s*bpm|bpm\s*(\d{2,3})/);
  const bpm = bpmMatch ? Math.min(180, Math.max(60, Number(bpmMatch[1] || bpmMatch[2]))) : undefined;
  if (/音乐|配乐|编曲|伴奏|曲风|bgm|music|arrangement|beat|score/.test(t) || bpm) {
    const op = { type: 'music' as const, genre: genre ?? (/燃|energetic/.test(t) ? 'rock' : undefined), mood, bpm: bpm ?? (mood === 'hype' ? 128 : undefined) };
    ops.push(op);
    const desc = [op.genre && labelOf(GENRES, op.genre, lang), op.mood && labelOf(MOODS, op.mood, lang), op.bpm && `${op.bpm} BPM`].filter(Boolean).join(' · ');
    say(zh ? `${mode === 'music' ? '编曲' : '配乐'}已更新${desc ? `：${desc}` : ''}` : `${mode === 'music' ? 'Arrangement' : 'Score'} updated${desc ? `: ${desc}` : ''}`,
      zh ? `重新生成${mode === 'music' ? '编曲' : '配乐'}${desc ? `为 ${desc}` : ''}，节拍会对齐镜头切换点。` : `Regenerating the ${mode === 'music' ? 'arrangement' : 'score'}${desc ? ` as ${desc}` : ''}, with beats aligned to the cuts.`);
  }
  if (/演唱|人声|唱|声线|vocal|sing|voice/.test(t) && !ops.some(o => o.type === 'vocal')) {
    ops.push({ type: 'vocal' });
    say(zh ? '人声开始生成' : 'Vocals generating', zh ? '正在用专属声线演唱，副歌会自动叠两轨和声。' : 'Singing with the signature voice; the chorus gets two stacked harmony tracks.');
  }
  if (/生成|渲染|成片|全部|render|generate/.test(t) && !ops.length) {
    ops.push({ type: 'generateAll' });
    say(zh ? '开始生成全部未完成内容' : 'Generating everything pending', zh ? '正在生成所有未完成的节点，完成后可以在交付节点一键导出。' : 'Generating every pending node; export from the delivery node when done.');
  }
  if (!replies.length) replies.push((zh ? '收到。' : 'Got it. ') + ctx.advice);
  return { reply: replies.join(zh ? '' : ' '), ops, actions };
};
