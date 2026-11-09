import type { StudioVideoTakeInfo, StudioVideoTask, StudioVideoTaskCreate } from '@ai-star-eco/types/ip-studio-video-task';
import type { StudioTakeChange } from '@ai-star-eco/types/ip-studio-scenes';
import type { CanvasNodeData } from '@/canvas/types/canvas';

/**
 * 视频裂变（2026-11-09 用户要求，参考带货子应用的「派生变体」）：从一条已提交的任务再出几条，每条是独立的任务、各自扣费。
 * 怎么变有三种：原样（同一个脚本）、换变量（从脚本里找出能换的说法，页面直接替换，不调 AI）、AI 改写（编导按每条的变化重写一版）。
 * 已有任务的输入快照、请求和结果都不动；新任务进同一份草稿，同一份草稿里的视频在页面上排在一起。
 */

export const TAKE_COUNTS = [1, 2, 3, 4] as const;
export type TakeMode = StudioVideoTakeInfo['mode'];

/** 脚本里一处能换的说法。from 是脚本原文，values 是可以换成的说法，on = 这一处参与替换。 */
export interface TakeVariable { id: string; name: string; from: string; values: string[]; on: boolean }

/** 一处变量最多几个替换、一次最多几处：和服务端改写版本的上限一致（StudioSceneCatalog#variantChanges）。 */
const MAX_VALUES = 6, MAX_VARIABLES = 8, MAX_TEXT = 80;

/**
 * 找变量的结果：每行「名称｜原文｜替换1｜替换2｜替换3」（服务端 stage-scene-variables 的输出约定）。
 * 编号、项目符号、表头和引号去掉；原文不在脚本里的那行丢掉（模型编的），同一个原文只留第一行。
 */
export function parseTakeVariables(content: string, script: string): TakeVariable[] {
  const out: TakeVariable[] = [];
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim().replace(/^(?:[-*•·]\s*|\d+\s*[.、)）]\s*)/, '');
    if (!/[｜|]/.test(line)) continue;
    const parts = line.split(/[｜|]/).map(p => p.trim().replace(/^[「“"'『]+|[」”"'』]+$/g, '').trim()).filter(Boolean);
    if (parts.length < 3) continue;
    const [name, from, ...rest] = parts;
    if (name === '名称' || from === '原文' || name.length > MAX_TEXT || from.length > MAX_TEXT) continue;
    if (!script.includes(from) || out.some(v => v.from === from)) continue;
    const values = [...new Set(rest.filter(v => v !== from && v.length <= MAX_TEXT))].slice(0, MAX_VALUES);
    if (!values.length) continue;
    out.push({ id: `v${out.length + 1}`, name, from, values, on: true });
    if (out.length >= MAX_VARIABLES) break;
  }
  return out;
}

/** 可复现的伪随机（同一个种子出同一组），「换一组」就是换种子。 */
function random(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/**
 * 每条换哪一组：每处变量把替换打乱后按条轮着取，替换够多时每条都不一样。原样那条已经有了（就是原任务），这里每条都换。
 * 没有打开的变量就每条都是空的（AI 改写由编导自己换）。
 */
export function sampleTakes(variables: TakeVariable[], count: number, seed: number): StudioTakeChange[][] {
  const used = variables.filter(v => v.on && v.values.length);
  const orders = used.map((v, i) => {
    const next = random(seed * 31 + i + 1), order = [...v.values];
    for (let j = order.length - 1; j > 0; j--) { const k = Math.floor(next() * (j + 1)); [order[j], order[k]] = [order[k], order[j]]; }
    return order;
  });
  return Array.from({ length: count }, (_, take) => used.map((v, i) => ({ name: v.name, from: v.from, to: orders[i][take % orders[i].length] })));
}

/**
 * 把脚本切成「原文 / 换过的」几段（预览里高亮换过的地方；keep 只标不换）。先长后短地找，短的说法藏在长的里面时不会被拆坏；
 * 同一处说法在脚本里出现几次都换。
 */
export function changeSegments(text: string, changes: StudioTakeChange[], keep = false): { text: string; change?: StudioTakeChange }[] {
  let parts: { text: string; change?: StudioTakeChange }[] = [{ text }];
  for (const change of [...changes].filter(c => c.from && c.from !== c.to).sort((a, b) => b.from.length - a.from.length)) {
    parts = parts.flatMap(part => {
      if (part.change || !part.text.includes(change.from)) return [part];
      // keep：只标出要换的地方、不换（AI 改写还没写时，看原脚本哪些地方会变）。
      return part.text.split(change.from).flatMap((piece, i) => i === 0 ? [{ text: piece }] : [{ text: keep ? change.from : change.to, change }, { text: piece }]);
    });
  }
  return parts.filter(p => p.text);
}

export function applyChanges(text: string, changes: StudioTakeChange[]): string {
  return changeSegments(text, changes).map(p => p.text).join('');
}

/** 这条任务交出去的脚本（或补充要求）：换变量和 AI 改写都在它上面改。 */
export function takeScript(base: StudioVideoTaskCreate | undefined): string {
  return base?.configuration?.text ?? base?.video?.prompt ?? '';
}

/** 能用哪几种方式再来：复刻是照着参考视频做，只能原样；AI 改写要有编导写的脚本（拿补充要求去改写，出来的是另一种东西）。 */
export function takeModes(base: StudioVideoTaskCreate | undefined): { mode: TakeMode; reason?: string }[] {
  // 早期的任务没存提交时的请求，按原样再交不了，只能放回设置自己改。
  if (!base?.configuration) return (['same', 'variables', 'rewrite'] as const).map(mode => ({ mode, reason: '这条没有保存提交记录' }));
  const text = takeScript(base).trim();
  const recreation = base?.kind === 'recreation';
  return [
    { mode: 'same' },
    { mode: 'variables', reason: recreation ? '爆款复刻按参考视频生成，没有可替换的脚本' : !text ? '这条没有脚本' : undefined },
    { mode: 'rewrite', reason: recreation ? '爆款复刻按参考视频生成，没有可改写的脚本' : !base?.configuration?.hasScript ? '这条没有用 AI 编导写的脚本' : undefined },
  ];
}

/**
 * 和原任务一样的请求，只换请求编号和上限；付款账户提交时按默认重新选（原任务的账户可能已停用）。
 * take 记下这一条怎么来的；text 给了就换掉脚本（换变量、AI 改写），编辑框里的脚本也换成这一版，「修改后生成」放回的是它。
 */
export function takeRequest(base: StudioVideoTaskCreate, clientRequestId: string, budgetCap: number, videoRequestId: string,
  change: { take: StudioVideoTakeInfo; text?: string; scriptId?: string }): StudioVideoTaskCreate {
  const text = change.text;
  const { billing: _billing, ...rest } = base;
  const next: StudioVideoTaskCreate = { ...rest, clientRequestId, budgetCap };
  if (rest.configuration) {
    const { billing: _configBilling, ...configuration } = rest.configuration;
    next.configuration = { ...configuration, clientRequestId, budgetCap, ...(text !== undefined ? { text } : {}) };
  }
  if (rest.video) {
    // 报价批准（modelBilling）属于原来那次报价，不能带到新任务上。
    const { billing: _videoBilling, modelBilling: _approval, ...video } = rest.video;
    next.video = { ...video, clientRequestId: videoRequestId, ...(text !== undefined ? { prompt: text } : {}) };
  }
  const state = rest.input.sceneVideoState;
  if (text === undefined || !state) next.input = { ...rest.input, take: change.take };
  else {
    const edit = state.edit ? { ...state.edit, prompt: text, ...(change.scriptId ? { scriptId: change.scriptId } : {}) } : undefined;
    next.input = { ...rest.input, take: change.take, sceneVideoState: { ...state, ...(edit ? { edit } : { text }) } };
  }
  return next;
}

/** 报价按提交时的规格：模型、时长、画面、清晰度和素材张数，与「生成视频」按钮旁同一个接口。 */
export function takePriceQuery(base: StudioVideoTaskCreate) {
  const c = base.configuration;
  if (!c) return undefined;
  const slots = c.materials ?? [];
  return { kind: base.kind, model: c.model, mode: base.video?.video?.mode, tier: c.tier, duration: c.duration, ratio: c.ratio,
    images: slots.filter(m => m.slot === 'image').length, character: slots.some(m => m.slot === 'character'),
    voice: slots.some(m => m.slot === 'voice'), optimize: c.optimize !== false };
}

/** 同一份草稿是同一组：同一个作品改了再出、视频裂变，都在一起看（2026-11-09 用户：同一个商品、相同内容要能批量看到）。 */
export function sameTakes(items: StudioVideoTask[], task: StudioVideoTask): StudioVideoTask[] {
  // 列表十秒读一次，正在看的这条用页面上更新的那份，状态才对得上。
  const all = [...items.filter(t => t.projectId === task.projectId && t.id !== task.id), task];
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** 最近任务里同一份草稿只占一行：显示最新那条，并写共几条。顺序按每组最新一条的时间。 */
export function groupTakes(items: StudioVideoTask[]): { latest: StudioVideoTask; tasks: StudioVideoTask[] }[] {
  const groups = new Map<string, StudioVideoTask[]>();
  for (const task of items) groups.set(task.projectId, [...(groups.get(task.projectId) ?? []), task]);
  return [...groups.values()].map(tasks => {
    const sorted = [...tasks].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return { latest: sorted[sorted.length - 1], tasks: sorted };
  }).sort((a, b) => b.latest.createdAt.localeCompare(a.latest.createdAt));
}

/** 列表里这一条的标签：怎么来的、换了什么（换了什么写进悬停提示）。 */
export function takeTag(task: StudioVideoTask): { label?: string; detail?: string } {
  const take = task.input?.take;
  if (!take) return {};
  if (take.mode === 'same') return { label: '裂变' };
  const detail = take.changes?.length ? take.changes.map(c => `${c.name}：${c.to}`).join('；') : undefined;
  return { label: take.mode === 'rewrite' ? 'AI 改写' : '换变量', detail };
}

/** 草稿里给这条任务找变量 / AI 改写的节点（不是编导的版本，见 sceneTake）。 */
export function takeNodes(nodes: CanvasNodeData[], taskId?: string): CanvasNodeData[] {
  return nodes.filter(n => n.metadata?.studio?.sceneTake && (!taskId || n.metadata.studio.sceneTake.of === taskId));
}

/** 最近一次找到的变量；正在找或失败时 variables 为空。 */
export function latestVariables(nodes: CanvasNodeData[], taskId: string, script: string) {
  const node = takeNodes(nodes, taskId).filter(n => n.metadata!.studio!.sceneTake!.kind === 'variables')
    .sort((a, b) => a.metadata!.studio!.sceneTake!.at.localeCompare(b.metadata!.studio!.sceneTake!.at)).at(-1);
  const status = node?.metadata?.status;
  return { node, status, variables: node && status === 'success' ? parseTakeVariables(node.metadata?.content || '', script) : [] };
}

/** 最近一批 AI 改写的脚本，按第几版排。 */
export function latestRewrites(nodes: CanvasNodeData[], taskId: string): CanvasNodeData[] {
  const all = takeNodes(nodes, taskId).filter(n => n.metadata!.studio!.sceneTake!.kind === 'rewrite');
  const last = all.map(n => n.metadata!.studio!.sceneTake!).sort((a, b) => a.at.localeCompare(b.at)).at(-1);
  return last ? all.filter(n => n.metadata!.studio!.sceneTake!.batch === last.batch)
    .sort((a, b) => (a.metadata!.studio!.sceneTake!.index ?? 0) - (b.metadata!.studio!.sceneTake!.index ?? 0)) : [];
}
