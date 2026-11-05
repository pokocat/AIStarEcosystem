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

/** 写好描述、等着生成的那个节点；灵感库示例里是「我的版本」。 */
const waitingNode = (doc?: Pick<IpProjectDoc, 'nodes'>) => nodesOf(doc).find(n => MEDIA.has(n.type) && !n.metadata?.storageKey && n.metadata?.prompt);

/** 做同款后会带进画布的那段话。 */
export function templatePrompt(doc?: Pick<IpProjectDoc, 'nodes'>) {
  return (waitingNode(doc) ?? nodesOf(doc).find(n => n.metadata?.prompt))?.metadata?.prompt?.trim() || '';
}

/** 「16:9 · 6 秒」。读不到的项不写，不猜。 */
export function templateSpec(doc?: Pick<IpProjectDoc, 'nodes'>) {
  const nodes = nodesOf(doc);
  const node = waitingNode(doc) ?? nodes.find(n => MEDIA.has(n.type) && n.metadata?.storageKey);
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

/** 搜索范围：名称、说明和提示词。搜「穿搭」要能搜到标题写「小红书封面」、提示词写穿搭的那条。 */
export const templateSearchText = (t: Pick<IpTemplate, 'name' | 'summary' | 'doc'>) =>
  [t.name, t.summary, ...nodesOf(t.doc).map(n => n.metadata?.prompt)].filter(Boolean).join(' ').toLocaleLowerCase();
