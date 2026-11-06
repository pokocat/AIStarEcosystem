/**
 * Data behind the 剧本 / 资产 / 分镜 views of the AI Director. Episodes and assets are derived
 * from the canvas when a project is created and then edited independently.
 */
import type { Lang } from '../../../translations';
import { orderedShots, type CanvasNode, type GenStatus, type LT, type ProjectMode, type ProjectSpec } from './directorData';
import type { WorkshopProfile } from './workshopProfiles';

export type StudioView = 'canvas' | 'script' | 'assets' | 'storyboard' | 'final';

export interface Episode { id: string; name: string; summary: string; body: string; status: GenStatus }

export type AssetType = 'character' | 'scene' | 'prop';
export interface Asset {
  id: string;
  type: AssetType;
  name: string;
  scope: string;
  desc: string;
  image?: string;
  status: 'confirmed' | 'missing' | 'generating';
  /** Characters only: whether a voice is bound (otherwise segments may sound inconsistent). */
  voice?: boolean;
}

export interface Starter { title: LT; desc: LT; need: LT; prompt: LT }

const L = (zh: string, en: string): LT => ({ zh, en });
let seq = 0;
const sid = (p: string) => `${p}-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export const VIEW_LABELS = (mode: ProjectMode): Record<StudioView, LT> => ({
  canvas: L('画布', 'Canvas'),
  script: mode === 'music' ? L('歌词', 'Lyrics') : L('剧本', 'Script'),
  assets: L('资产', 'Assets'),
  storyboard: mode === 'music' ? L('MV 分镜', 'MV') : L('分镜', 'Shots'),
  final: L('成片', 'Final'),
});

/** "卖点：30 秒出汁" → a spoken voice-over line rather than reading the raw note. */
const voiceOver = (note: string, lang: Lang) => {
  const zh = lang === 'zh';
  const m = note.match(/^([^：:]+)[：:]\s*(.+)$/);
  if (!m) return note;
  const [, label, value] = m;
  if (/卖点|Selling/i.test(label)) return zh ? `${value}，就这么简单。` : `${value} — that simple.`;
  if (/人群|客群|学生|Audience|Visitors|Students/i.test(label)) return zh ? `专为${value}准备。` : `Made for ${value}.`;
  if (/禁用|审核|需审核|Banned|Review/i.test(label)) return zh ? '每一句都按品牌规范来。' : 'Every line stays on-brand.';
  return zh ? `${value}。` : `${value}.`;
};

const DIALOGUE: LT[] = [
  L('（看一眼墙上的钟）又是这个时间。', '(glances at the clock) This time again.'),
  L('你到底是谁？', 'Who are you, really?'),
  L('原来一直是你。', 'So it was you all along.'),
  L('这一次，我不会再错过。', 'This time I will not miss it.'),
  L('等等，我好像在哪里见过你。', 'Wait, have we met before?'),
  L('走吧，没时间了。', "Let's go, we're out of time."),
];

/** One paragraph per shot so the 分镜 view can line script and segments up. */
export const writeScreenplay = (spec: ProjectSpec, profile: WorkshopProfile, shots: CanvasNode[], lang: Lang, variant = 0) => {
  const zh = lang === 'zh';
  const source = profile.source.kind;
  const notes = profile.source.prompt[lang].split('\n').filter(Boolean).map(l => voiceOver(l, lang));
  const place = shots[0]?.title ?? spec.name;
  const heading = source === 'script'
    ? (zh ? `【${place} · ${variant % 2 ? '日' : '夜'}】` : `[${place} · ${variant % 2 ? 'DAY' : 'NIGHT'}]`)
    : spec.blank ? (zh ? `【${place}】` : `[${place}]`) : (zh ? `【${spec.template} · ${place}】` : `[${spec.template} · ${place}]`);
  const speaker = source === 'script' ? spec.artistName : `${spec.artistName}${zh ? '（旁白）' : ' (V.O.)'}`;
  const paragraphs = shots.map((s, i) => {
    const line = source === 'script'
      ? DIALOGUE[(i + variant) % DIALOGUE.length][lang]
      : notes[(i + variant) % Math.max(1, notes.length)] ?? '';
    return `${s.prompt}${zh ? '。' : '.'}\n${speaker}${zh ? '：' : ': '}${line}`;
  });
  return [heading, ...paragraphs].join('\n\n');
};

export const buildEpisodes = (spec: ProjectSpec, profile: WorkshopProfile, nodes: CanvasNode[], lang: Lang): Episode[] => {
  if (spec.mode === 'music' || spec.blank) return [];
  const zh = lang === 'zh';
  const shots = orderedShots(nodes);
  const first: Episode = {
    id: 'ep-1', status: 'done',
    name: zh ? `第 1 集 · ${spec.name}` : `Ep. 1 · ${spec.name}`,
    summary: spec.description,
    body: writeScreenplay(spec, profile, shots, lang),
  };
  const serial = /连续|剧集|系列|番外|Series|Episod|Side story/i.test(spec.template);
  return serial ? [first, { id: 'ep-2', status: 'idle', name: zh ? '第 2 集 · 待续写' : 'Ep. 2 · to be written', summary: zh ? '延续第 1 集结尾的悬念' : 'Picks up the episode 1 cliffhanger', body: '' }] : [first];
};

export const buildAssets = (spec: ProjectSpec, nodes: CanvasNode[], lang: Lang, cast: string, fallbackProduct?: { title: string; prompt: string }): Asset[] => {
  if (spec.blank && !nodes.length) return [];
  const zh = lang === 'zh';
  const whole = spec.mode === 'music' ? (zh ? '全曲' : 'Whole song') : (zh ? '全剧' : 'Whole project');
  const assets: Asset[] = [];
  const characters = nodes.filter(n => n.kind === 'character');
  characters.forEach(n => assets.push({
    id: sid('asset'), type: 'character', name: n.title, scope: whole, desc: `${cast} · ${n.prompt}`, image: n.image, status: 'confirmed', voice: spec.mode === 'music',
  }));
  // The active artist is always cast, even on a free-form canvas without a character node.
  if (!characters.length) assets.push({
    id: sid('asset'), type: 'character', name: spec.artistName, scope: whole, desc: zh ? `${cast} · 形象与声线已锁定` : `${cast} · look and voice locked`,
    image: spec.artistAvatar || undefined, status: spec.artistAvatar ? 'confirmed' : 'missing', voice: spec.mode === 'music',
  });
  const shots = orderedShots(nodes);
  shots.slice(0, 2).forEach((s, i) => assets.push({
    id: sid('asset'), type: 'scene', name: s.title, scope: i === 0 ? whole : (zh ? '第 1 集' : 'Ep. 1'), desc: s.prompt,
    image: s.image, status: s.image ? 'confirmed' : 'missing',
  }));
  const source = nodes.find(n => n.kind === 'product' || n.kind === 'knowledge') ?? (fallbackProduct ? { kind: 'product' as const, ...fallbackProduct } : undefined);
  if (source?.kind === 'product') {
    assets.push({ id: sid('asset'), type: 'prop', name: source.title, scope: whole, desc: source.prompt.split('\n').slice(0, 2).join(zh ? '；' : '; '), status: 'missing' });
  } else if (!source && shots[2]) {
    assets.push({ id: sid('asset'), type: 'prop', name: shots[2].title, scope: zh ? '第 1 集' : 'Ep. 1', desc: shots[2].prompt, status: 'missing' });
  }
  return assets;
};

export const ASSET_LABELS: Record<AssetType, LT> = { character: L('角色', 'Character'), scene: L('场景', 'Scene'), prop: L('道具', 'Prop') };

export const startersFor = (mode: ProjectMode): Starter[] => mode === 'music'
  ? [
    { title: L('写歌词', 'Write lyrics'), desc: L('一句主题写成主歌、副歌完整的歌词', 'Turn a theme into full verses and chorus'), need: L('一句主题', 'A theme'), prompt: L('帮我重写一版副歌歌词', 'Rewrite the chorus lyrics') },
    { title: L('换编曲', 'Change arrangement'), desc: L('指定曲风、情绪和速度重新编曲', 'Re-arrange by genre, mood and tempo'), need: L('曲风或参考', 'Genre or reference'), prompt: L('编曲换成摇滚，BPM 140', 'Switch to rock, 140 BPM') },
    { title: L('用声线演唱', 'Sing it'), desc: L('用艺人的专属声线把歌词唱出来', "Sing the lyrics in the artist's voice"), need: L('歌词 + 编曲', 'Lyrics + arrangement'), prompt: L('用艺人声线演唱', "Sing it in the artist's voice") },
    { title: L('一键制作', 'One-click'), desc: L('从歌词一路做到母带和 MV', 'From lyrics all the way to master and MV'), need: L('一句主题', 'A theme'), prompt: L('一键制作', 'One-click production') },
  ]
  : [
    { title: L('写剧本', 'Write the script'), desc: L('一句梗概写成能拍的分场剧本', 'Turn a logline into a shootable script'), need: L('一句梗概', 'A logline'), prompt: L('帮我重写剧本', 'Rewrite the script') },
    { title: L('生成资产图', 'Asset images'), desc: L('角色、场景、道具统一出设定图', 'Consistent sheets for cast, scenes and props'), need: L('剧本', 'A script'), prompt: L('生成全部资产图', 'Generate all asset images') },
    { title: L('做分镜视频', 'Storyboard → video'), desc: L('按剧本逐段生成分镜和视频', 'Storyboard and render each segment'), need: L('资产图', 'Asset images'), prompt: L('批量生成全部视频', 'Generate all videos') },
    { title: L('一键制作', 'One-click'), desc: L('从剧本一路自动做到成片', 'From script to final cut automatically'), need: L('一句梗概', 'A logline'), prompt: L('一键制作', 'One-click production') },
  ];

export const suggestionsFor = (view: StudioView, mode: ProjectMode, profileHints: LT[]): LT[] => {
  if (view === 'script') return mode === 'music'
    ? [L('帮我重写一版副歌歌词', 'Rewrite the chorus lyrics'), L('用艺人声线演唱', "Sing it in the artist's voice")]
    : [L('先看看这个开头，哪里不够吸引人？', 'Is the opening hooky enough?'), L('只改对白，其他别动', 'Only change the dialogue'), L('续写下一集', 'Write the next episode')];
  if (view === 'assets') return [L('生成全部资产图', 'Generate all asset images'), L('保留长相，只换成冬天的衣服', 'Keep the face, switch to winter clothes'), L('这个场景再旧一些', 'Make this scene look older')];
  if (view === 'storyboard') return [L('这一段先给手部特写，再切人物反应', 'Open on a hand close-up, then the reaction'), L('缩短对白，保留动作', 'Trim dialogue, keep the action'), L('批量生成全部视频', 'Generate all videos')];
  if (view === 'final') return [L('一键制作', 'One-click production'), L('配一段更燃的音乐', 'Add more energetic music')];
  return profileHints.slice(0, 3);
};

export const CONTEXT_LINKS = (view: StudioView): LT => ({
  canvas: L('画布节点、连线与生成状态', 'Canvas nodes, links and status'),
  script: L('故事大纲、人物与资产设定、当前正文', 'Outline, cast & assets, current text'),
  assets: L('故事大纲、人物与资产设定、分集摘要', 'Outline, cast & assets, episode summaries'),
  storyboard: L('本集剧本、全部片段的镜头和提示词', 'Episode script, every segment and prompt'),
  final: L('全部片段、配乐与交付格式', 'All segments, music and deliverables'),
}[view]);
