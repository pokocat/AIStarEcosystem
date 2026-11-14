import type { IpProjectDoc, IpTemplate } from '@ai-star-eco/types';

/** 从模板文档里读出挑选时要看的事实：只读、不打网络，卡片和详情弹窗共用一份。 */
type Nodes = IpProjectDoc['nodes'];
const MEDIA = new Set(['image', 'video', 'audio']);
const nodesOf = (doc?: Pick<IpProjectDoc, 'nodes'>): Nodes => doc?.nodes ?? [];

/** 模板里实际放着什么：有视频算视频，只有图算图片，都没有就是一套画布流程。 */
export function templateKind(t: Pick<IpTemplate, 'doc'>): 'video' | 'image' | 'canvas' {
  const nodes = nodesOf(t.doc);
  if (nodes.some(n => n.type === 'video' && (n.metadata?.storageKey || n.metadata?.content))) return 'video';
  if (nodes.some(n => n.type === 'image' && (n.metadata?.storageKey || n.metadata?.content))) return 'image';
  return 'canvas';
}

/** 写好描述、等着生成的那个节点。 */
const waitingNode = (doc?: Pick<IpProjectDoc, 'nodes'>) => nodesOf(doc).find(n => MEDIA.has(n.type) && !n.metadata?.storageKey && n.metadata?.prompt);
/**
 * 已经生成过的节点：提示词和结果在同一张卡上。灵感库示例的「成片」「成图」就是它，参考图没有提示词，不算。
 * 首帧 → 成片这种链上有两个，取视频：卡片上说的规格是成片的。
 */
const generatedNode = (doc?: Pick<IpProjectDoc, 'nodes'>) => {
  const generated = nodesOf(doc).filter(n => MEDIA.has(n.type) && n.metadata?.storageKey && n.metadata?.prompt);
  return generated.find(n => n.type === 'video') ?? generated[0];
};

/** 做同款后会带进画布的那段话。预览里不显示（用户 2026-11-06 要求），只用来判断有没有填好。 */
export function templatePrompt(doc?: Pick<IpProjectDoc, 'nodes'>) {
  return (waitingNode(doc) ?? generatedNode(doc) ?? nodesOf(doc).find(n => n.metadata?.prompt))?.metadata?.prompt?.trim() || '';
}

/** 「16:9 · 6 秒」。读不到的项不写，不猜。 */
export function templateSpec(doc?: Pick<IpProjectDoc, 'nodes'>) {
  const nodes = nodesOf(doc);
  const node = waitingNode(doc) ?? generatedNode(doc) ?? nodes.find(n => MEDIA.has(n.type) && n.metadata?.storageKey);
  const size = node?.metadata?.size;
  const seconds = node?.type === 'video' ? node.metadata?.seconds : undefined;
  return [size && /^\d+:\d+$/.test(size) ? size : undefined, seconds ? `${seconds} 秒` : undefined].filter(Boolean).join(' · ');
}

/** 用户要自己准备的素材：既没有文件、也没有描述的媒体节点，也就是等人放东西的位。 */
export function templateNeeds(doc?: Pick<IpProjectDoc, 'nodes'>) {
  return nodesOf(doc).filter(n => MEDIA.has(n.type) && !n.metadata?.storageKey && !n.metadata?.prompt).map(n => {
    const input = (n.metadata?.studio as { templateInput?: { label?: string; required?: boolean } } | undefined)?.templateInput;
    return { label: input?.label || n.title, optional: input?.required === false };
  });
}

/** 只读画布点开一个节点时的说明。不显示提示词，也不显示媒体节点的 content（那是派生地址）。 */
export function templateNodeNote(node?: { type?: string; metadata?: { groupDescription?: unknown; content?: unknown; prompt?: unknown } }): string {
  const meta = node?.metadata, written = (value: unknown) => (typeof value === 'string' ? value : '');
  return written(meta?.groupDescription) || (node?.type === 'text' ? written(meta?.content) : '')
    || (node?.type === 'group' ? '此分组尚未添加说明。' : meta?.prompt ? '做同款后可查看和修改提示词。' : '此节点尚未填写内容或添加参考素材。');
}

/** 搜索范围：名称、说明和提示词。搜「穿搭」要能搜到标题写「小红书封面」、提示词写穿搭的那条。 */
export const templateSearchText = (t: Pick<IpTemplate, 'name' | 'summary' | 'doc'>) =>
  [t.name, t.summary, ...nodesOf(t.doc).map(n => n.metadata?.prompt)].filter(Boolean).join(' ').toLocaleLowerCase();

/**
 * 发布新旧：比日期，不比到分秒。同一天发布的是一批，比到分秒就只是把排好的顺序倒过来，
 * 同一天的按传入的顺序（运营排好的）。没有发布时间的内置模板排最后。不改传入的数组。
 */
export function newestFirst<T extends Pick<IpTemplate, 'createdAt'>>(templates: readonly T[]): T[] {
  const day = (t: T) => {
    if (!t.createdAt) return -Infinity;
    const at = new Date(t.createdAt);
    return Number.isNaN(at.getTime()) ? -Infinity : new Date(at.getFullYear(), at.getMonth(), at.getDate()).getTime();
  };
  return templates.map((t, i) => ({ t, i, d: day(t) })).sort((a, b) => (b.d === a.d ? a.i - b.i : b.d - a.d)).map(x => x.t);
}

/** 首页按完整的发布时间倒序。没有发布时间的内置模板排最后。 */
export function homeRecommendations<T extends Pick<IpTemplate, 'createdAt'>>(templates: readonly T[]): T[] {
  return templates
    .map(item => {
      const time = Date.parse(item.createdAt ?? '');
      return { item, time: Number.isNaN(time) ? -Infinity : time };
    })
    .sort((a, b) => a.time === b.time ? 0 : b.time - a.time)
    .map(({ item }) => item);
}

/**
 * 作品的真实比例（宽 / 高），灵感墙按它摆，不裁图。先看成品上量到的尺寸，再看像素尺寸和设置的画幅；都没有就不猜。
 * 太长太扁的收一下（1:2 到 2:1），不让一张卡占掉一整屏。
 */
export function templateRatio(doc?: Pick<IpProjectDoc, 'nodes'>): number | undefined {
  const nodes = nodesOf(doc).filter(n => MEDIA.has(n.type) && n.type !== 'audio');
  // 生成结果排在参考图前面：海报变动态这类，参考图和成片不一定一样大，墙上摆的是成片。
  const done = nodes.filter(n => n.metadata?.storageKey).sort((a, b) => Number(!!b.metadata?.prompt) - Number(!!a.metadata?.prompt));
  const measured = done.find(n => Number(n.metadata?.naturalWidth) > 0 && Number(n.metadata?.naturalHeight) > 0);
  const raw = measured ? Number(measured.metadata?.naturalWidth) / Number(measured.metadata?.naturalHeight) : [...done, ...nodes].map(n => sizeRatio(n.metadata?.size)).find(Boolean);
  return raw ? Math.min(2, Math.max(.5, raw)) : undefined;
}
const sizeRatio = (size: unknown) => {
  const match = typeof size === 'string' ? size.match(/^(\d+)\s*[:x×]\s*(\d+)$/) : null;
  return match && Number(match[2]) > 0 ? Number(match[1]) / Number(match[2]) : undefined;
};

export type RatioKnown = Pick<IpTemplate, 'doc'>;
/** 图下面那行字占的高度，按一张卡的宽度算大约这么多。 */
const LABEL_SHARE = .22;
/** 比例未知的卡先按这个算位置，图到了只改这张卡的高度，不会换列。 */
const DEFAULT_RATIO = 4 / 5;

/**
 * 瀑布流：一张一张放进当前最矮的一列。结果只跟前面的卡片有关，所以滚到底加新卡时，已经在页面上的卡不会动。
 * 用 index 记住原来的次序。
 */
export function inspirationPlacement<T extends RatioKnown>(items: readonly T[], columns: number): { item: T; index: number }[][] {
  const out = Array.from({ length: Math.max(1, columns) }, () => [] as { item: T; index: number }[]);
  const heights = out.map(() => 0);
  items.forEach((item, index) => {
    const target = heights.indexOf(Math.min(...heights));
    out[target].push({ item, index });
    heights[target] += 1 / (templateRatio(item.doc) ?? DEFAULT_RATIO) + LABEL_SHARE;
  });
  return out;
}

/** 灵感的次序：新发布的在前；有成图的排在只有步骤的模板前面，墙上先看到做出来的东西。 */
export function inspirationOrder<T extends Pick<IpTemplate, 'createdAt' | 'coverUrl' | 'previewVideoUrl' | 'doc'>>(templates: readonly T[]): T[] {
  const pictured = (t: T) => !!t.coverUrl || !!t.previewVideoUrl || nodesOf(t.doc).some(n => n.metadata?.storageKey && MEDIA.has(n.type));
  return newestFirst(templates).map((t, i) => ({ t, i, p: pictured(t) })).sort((a, b) => Number(b.p) - Number(a.p) || a.i - b.i).map(x => x.t);
}

