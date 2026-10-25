import { expect, test } from 'vitest';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';
import { applyGroupSelection } from '@/canvas/lib/canvas/canvas-node-geometry';
import { drawStudioArea, keepEmptyStudioAreas, nextStudioAreaTitle, settleStudioAreaMembership, studioAreaAt, studioAreaCandidates, studioAreaMemberCounts, studioAreaRect } from './studio-areas';

const card = (id: string, x: number, y: number, groupId?: string): CanvasNodeData =>
  ({ id, type: CanvasNodeType.Image, title: id, position: { x, y }, width: 200, height: 150, metadata: { status: 'idle', ...(groupId ? { groupId } : {}) } });
const area = (id: string, x: number, y: number, width: number, height: number, title = '分组'): CanvasNodeData =>
  ({ id, type: CanvasNodeType.Group, title, position: { x, y }, width, height, metadata: { status: 'idle' } });

test('dragging in any direction gives the same rectangle', () => {
  expect(studioAreaRect({ x: 300, y: 400 }, { x: 100, y: 50 })).toEqual({ x: 100, y: 50, width: 200, height: 350 });
});

test('a drawn area takes in the loose nodes whose centre it covers, and wraps them fully', () => {
  // b's centre (420,175) is inside, but its right half sticks out; c is outside.
  const nodes = [card('a', 100, 100), card('b', 320, 100), card('c', 900, 100)];
  const { area: made, nodes: next, members } = drawStudioArea(nodes, { x: 80, y: 60, width: 380, height: 260 }, 'g1');
  expect(members).toEqual(['a', 'b']);
  expect(next.find(n => n.id === 'a')?.metadata?.groupId).toBe('g1');
  expect(next.find(n => n.id === 'c')?.metadata?.groupId).toBeUndefined();
  expect(made.position.x + made.width).toBeGreaterThanOrEqual(320 + 200 + 24);
  expect(made.position.y).toBe(60);
  // The area sits below its members (groups render underneath).
  expect(next.findIndex(n => n.id === 'g1')).toBeLessThan(next.findIndex(n => n.id === 'a'));
  expect(made.title).toBe('分组 1');
});

test('an empty area is kept as drawn, and nodes already in another area are never taken (areas do not nest)', () => {
  const nodes = [area('old', 0, 0, 600, 400), card('inside', 50, 80, 'old')];
  expect(studioAreaCandidates({ x: 0, y: 0, width: 800, height: 600 }, nodes)).toEqual([]);
  const { area: made, members } = drawStudioArea(nodes, { x: 1000, y: 0, width: 300, height: 200 }, 'g2');
  expect(members).toEqual([]);
  expect(made).toMatchObject({ position: { x: 1000, y: 0 }, width: 300, height: 200 });
});

test('names count on from the existing ones', () => {
  expect(nextStudioAreaTitle([area('a', 0, 0, 10, 10, '分组 4'), area('b', 0, 0, 10, 10, '第一集')])).toBe('分组 5');
  expect(nextStudioAreaTitle([card('x', 0, 0)])).toBe('分组 1');
});

test('dragging a node into an area joins it (the area grows to hold it); dragging it out leaves', () => {
  const start = [area('g', 0, 0, 400, 300), card('n', 300, 200)];
  const joined = settleStudioAreaMembership(start, ['n']);
  expect(joined.find(n => n.id === 'n')?.metadata?.groupId).toBe('g');
  const grown = joined.find(n => n.id === 'g')!;
  expect(grown.width).toBe(300 + 200 + 24);
  expect(grown.height).toBe(200 + 150 + 24);
  const out = settleStudioAreaMembership(joined.map(n => n.id === 'n' ? { ...n, position: { x: 1200, y: 0 } } : n), ['n']);
  expect(out.find(n => n.id === 'n')?.metadata?.groupId).toBeUndefined();
  expect(out.some(n => n.id === 'g')).toBe(true);
});

test('members moved along with their own area keep it; nothing changed returns the same array', () => {
  const nodes = [area('g', 0, 0, 400, 300), card('n', 1000, 1000, 'g')];
  expect(settleStudioAreaMembership(nodes, ['g', 'n'])).toBe(nodes);
  const settled = [area('g', 0, 0, 400, 300), card('n', 50, 60, 'g')];
  expect(settleStudioAreaMembership(settled, ['n'])).toBe(settled);
});

test('overlapping areas: the smallest one under the node wins', () => {
  const nodes = [area('big', 0, 0, 2000, 2000), area('small', 100, 100, 500, 400), card('n', 150, 150)];
  expect(studioAreaAt(nodes[2], nodes)?.id).toBe('small');
});

test('grouping a selection keeps empty areas the user drew (and their links), but still clears groups it emptied', () => {
  const before = [area('drawn', 2000, 0, 300, 200), area('old', 0, 0, 500, 300), card('a', 20, 60, 'old'), card('b', 600, 60), card('c', 2600, 0)];
  const links = [{ id: 'l1', fromNodeId: 'drawn', toNodeId: 'c' }, { id: 'l2', fromNodeId: 'a', toNodeId: 'b' }];
  const frame = area('new', 0, 0, 900, 300);
  const result = applyGroupSelection(new Set(['a', 'b']), before, links, frame)!;
  // The moved implementation drops every empty group, and the links on it.
  expect(result.nodes.some(n => n.id === 'drawn')).toBe(false);
  expect(result.connections.some(c => c.id === 'l1')).toBe(false);
  const kept = keepEmptyStudioAreas({ nodes: before, connections: links }, result, new Set(['a', 'b']));
  expect(kept.nodes.some(n => n.id === 'drawn')).toBe(true);
  expect(kept.nodes.some(n => n.id === 'old')).toBe(false);
  expect(kept.connections.map(c => c.id).sort()).toEqual(['l1', 'l2']);
  expect(studioAreaMemberCounts(kept.nodes).get('new')).toBe(2);
});

test('a kept area does not bring back a link whose other end is gone', () => {
  const before = [area('drawn', 2000, 0, 300, 200), card('gone', 0, 0)];
  const kept = keepEmptyStudioAreas({ nodes: before, connections: [{ id: 'l', fromNodeId: 'drawn', toNodeId: 'gone' }] }, { nodes: [], connections: [] }, new Set());
  expect(kept.nodes.map(n => n.id)).toEqual(['drawn']);
  expect(kept.connections).toEqual([]);
});
