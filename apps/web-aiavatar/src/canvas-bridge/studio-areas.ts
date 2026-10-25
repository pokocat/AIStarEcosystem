import { CanvasNodeType, type CanvasConnection, type CanvasNodeData } from '@/canvas/types/canvas';

/**
 * 圈选分组：在画布上圈一块区域，它就是一个分组（`CanvasNodeType.Group`）。
 * 成员关系仍是 `metadata.groupId`（拖动分组时成员跟着走）；圈出来的区域可以是空的，
 * 之后把节点拖进去就加入、拖出来就离开。分组不嵌套：已经在别的分组里的节点不会被圈走。
 */
export type StudioAreaRect = { x: number; y: number; width: number; height: number };

/** 区域的颜色只是用户自己区分用的，全部压低饱和度；不给分类配色（见 PRODUCT.md「不是彩虹分类」）。 */
export const STUDIO_AREA_TONES = [
  { key: 'slate', label: '默认', color: '#6b7690' },
  { key: 'blue', label: '群青', color: '#4a5fb0' },
  { key: 'teal', label: '青绿', color: '#2d8584' },
  { key: 'green', label: '苔绿', color: '#57843f' },
  { key: 'amber', label: '琥珀', color: '#a97416' },
  { key: 'rose', label: '玫瑰', color: '#b0526a' },
] as const;
export type StudioAreaTone = (typeof STUDIO_AREA_TONES)[number]['key'];
export const studioAreaTone = (tone?: string) => STUDIO_AREA_TONES.find(t => t.key === tone) || STUDIO_AREA_TONES[0];

/** 区域内边距：成员离边框留的空；顶部多留一点，放说明。 */
const PAD = 24, PAD_TOP = 32;
/** 小于这个尺寸（画布坐标）的拖动当成误触，不建区域。 */
export const STUDIO_AREA_MIN_SIZE = 48;

const isArea = (n: CanvasNodeData) => n.type === CanvasNodeType.Group;
const center = (n: CanvasNodeData) => ({ x: n.position.x + n.width / 2, y: n.position.y + n.height / 2 });
const inside = (p: { x: number; y: number }, r: StudioAreaRect) => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;
const rectOf = (n: CanvasNodeData): StudioAreaRect => ({ x: n.position.x, y: n.position.y, width: n.width, height: n.height });

/** 两个角点 → 规范化矩形（从右下往左上拖也一样）。 */
export function studioAreaRect(a: { x: number; y: number }, b: { x: number; y: number }): StudioAreaRect {
  return { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), width: Math.abs(a.x - b.x), height: Math.abs(a.y - b.y) };
}

/** 圈住的节点：中心点落在框里、本身不是分组、也还没属于别的分组（分组不嵌套）。 */
export function studioAreaCandidates(rect: StudioAreaRect, nodes: CanvasNodeData[]): CanvasNodeData[] {
  const areas = new Set(nodes.filter(isArea).map(n => n.id));
  return nodes.filter(n => !isArea(n) && !(n.metadata?.groupId && areas.has(n.metadata.groupId)) && inside(center(n), rect));
}

/** 「分组 3」：接着已有的编号往下数，不和现有名字撞。 */
export function nextStudioAreaTitle(nodes: CanvasNodeData[]) {
  const used = nodes.filter(isArea).map(n => /^分组\s*(\d+)$/.exec(n.title.trim())?.[1]).filter(Boolean).map(Number);
  return `分组 ${Math.max(nodes.filter(isArea).length, ...used, 0) + 1}`;
}

/** 框至少要把成员包住（加内边距）；只往外扩，不缩。 */
function wrap(rect: StudioAreaRect, members: CanvasNodeData[]): StudioAreaRect {
  if (!members.length) return rect;
  const left = Math.min(rect.x, ...members.map(n => n.position.x - PAD)), top = Math.min(rect.y, ...members.map(n => n.position.y - PAD_TOP));
  const right = Math.max(rect.x + rect.width, ...members.map(n => n.position.x + n.width + PAD)), bottom = Math.max(rect.y + rect.height, ...members.map(n => n.position.y + n.height + PAD));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/** 画出一块区域：新建分组节点，把圈住的节点收进去。分组排在成员前面，保持「组在下、成员在上」。 */
export function drawStudioArea(nodes: CanvasNodeData[], drawn: StudioAreaRect, id: string, title = nextStudioAreaTitle(nodes)) {
  const members = studioAreaCandidates(drawn, nodes), ids = new Set(members.map(n => n.id));
  const r = wrap(drawn, members);
  const area: CanvasNodeData = { id, type: CanvasNodeType.Group, title, position: { x: Math.round(r.x), y: Math.round(r.y) },
    width: Math.round(Math.max(r.width, STUDIO_AREA_MIN_SIZE)), height: Math.round(Math.max(r.height, STUDIO_AREA_MIN_SIZE)), metadata: { status: 'idle' } };
  const joined = nodes.map(n => ids.has(n.id) ? { ...n, metadata: { ...n.metadata, groupId: id } } : n);
  const at = joined.findIndex(n => ids.has(n.id));
  return { area, members: [...ids], nodes: at < 0 ? [...joined, area] : [...joined.slice(0, at), area, ...joined.slice(at)] };
}

/** 节点中心落在哪块区域里；几块叠着时取最小的那块（最贴近的那块）。 */
export function studioAreaAt(node: CanvasNodeData, nodes: CanvasNodeData[], skip?: Set<string>) {
  const c = center(node);
  return nodes.filter(n => isArea(n) && n.id !== node.id && !skip?.has(n.id) && inside(c, rectOf(n)))
    .sort((a, b) => a.width * a.height - b.width * b.height)[0];
}

/**
 * 拖动结束后按位置更新成员：拖进区域就加入（区域被撑大到能包住它），拖出来就离开。
 * 和所在分组一起被拖动的节点不变（它是跟着组走的）。没有变化时返回原数组。
 */
export function settleStudioAreaMembership(nodes: CanvasNodeData[], movedIds: Iterable<string>): CanvasNodeData[] {
  const moved = new Set(movedIds), byId = new Map(nodes.map(n => [n.id, n]));
  const assign = new Map<string, string | undefined>();
  for (const id of moved) {
    const node = byId.get(id);
    if (!node || isArea(node)) continue;
    const own = node.metadata?.groupId;
    if (own && moved.has(own) && byId.has(own)) continue;
    const target = studioAreaAt(node, nodes)?.id;
    if (target !== (own && byId.has(own) ? own : undefined)) assign.set(id, target);
  }
  if (!assign.size) return nodes;
  const next = nodes.map(n => assign.has(n.id) ? { ...n, metadata: { ...n.metadata, groupId: assign.get(n.id) } } : n);
  const joining = new Map<string, CanvasNodeData[]>();
  for (const [id, area] of assign) if (area) joining.set(area, [...(joining.get(area) || []), next.find(n => n.id === id)!]);
  return next.map(n => {
    const members = joining.get(n.id); if (!members) return n;
    const r = wrap(rectOf(n), members);
    return r.x === n.position.x && r.y === n.position.y && r.width === n.width && r.height === n.height ? n
      : { ...n, position: { x: Math.round(r.x), y: Math.round(r.y) }, width: Math.round(r.width), height: Math.round(r.height) };
  });
}

/**
 * 「建立分组 / 解除分组」（canvas-node-geometry 里的搬来实现）会顺手清掉画布上所有空分组和它们的连线 ——
 * 对按选中建的组没问题，但会把用户圈出来、还没放东西的区域一起删掉。操作前就是空的、也不是这次选中的区域放回去，
 * 连同它们的引用连线（另一端还在画布上的那些）；这次操作才变空的照旧清掉（否则会在原地留一个空框）。
 */
export function keepEmptyStudioAreas(before: { nodes: CanvasNodeData[]; connections: CanvasConnection[] }, after: { nodes: CanvasNodeData[]; connections: CanvasConnection[] }, selected: Set<string>) {
  const used = new Set(before.nodes.filter(n => !isArea(n) && n.metadata?.groupId).map(n => n.metadata!.groupId!));
  const present = new Set(after.nodes.map(n => n.id));
  const kept = before.nodes.filter(n => isArea(n) && !used.has(n.id) && !selected.has(n.id) && !present.has(n.id));
  if (!kept.length) return { nodes: after.nodes, connections: after.connections };
  const keptIds = new Set(kept.map(n => n.id)), alive = new Set([...present, ...keptIds]), had = new Set(after.connections.map(c => c.id));
  const links = before.connections.filter(c => !had.has(c.id) && (keptIds.has(c.fromNodeId) || keptIds.has(c.toNodeId)) && alive.has(c.fromNodeId) && alive.has(c.toNodeId));
  return { nodes: [...kept, ...after.nodes], connections: [...after.connections, ...links] };
}

/** 每块区域里有几个节点（区域标签上显示）。 */
export function studioAreaMemberCounts(nodes: CanvasNodeData[]) {
  const counts = new Map<string, number>();
  for (const n of nodes) if (!isArea(n) && n.metadata?.groupId) counts.set(n.metadata.groupId, (counts.get(n.metadata.groupId) || 0) + 1);
  return counts;
}
