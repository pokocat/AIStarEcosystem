import { expect, test } from 'vitest';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';
import { placeNodeInViewport } from './viewport-placement';

const node: CanvasNodeData = { id: 'new', type: CanvasNodeType.Text, title: '文字', width: 320, height: 240, position: { x: 0, y: 0 } };
const bounds = { x: -4200, y: 1100, width: 1800, height: 1000 };
const isVisible = (n: CanvasNodeData) => n.position.x >= bounds.x && n.position.y >= bounds.y && n.position.x + n.width <= bounds.x + bounds.width && n.position.y + n.height <= bounds.y + bounds.height;

test('a panned and zoomed viewport centers a toolbar draft instead of the farthest existing node', () => {
  const distant = { ...node, id: 'distant', position: { x: 8000, y: 100 } };
  const result = placeNodeInViewport(node, [distant], bounds);
  expect(result.position).toEqual({ x: -3460, y: 1480 });
  expect(isVisible(result)).toBe(true);
});
test('nearby gaps are preferred without crossing the viewport boundary', () => {
  const occupied = { ...node, id: 'occupied', position: { x: -3460, y: 1480 } };
  const result = placeNodeInViewport(node, [occupied], bounds);
  expect(isVisible(result)).toBe(true);
  expect(result.position).not.toEqual(occupied.position);
  expect(result.position.y + result.height <= occupied.position.y || result.position.y >= occupied.position.y + occupied.height || result.position.x + result.width <= occupied.position.x || result.position.x >= occupied.position.x + occupied.width).toBe(true);
});
test('a completely occupied viewport still places the new draft in sight', () => {
  const occupied = { ...node, id: 'occupied', position: { x: bounds.x, y: bounds.y }, width: bounds.width, height: bounds.height };
  expect(isVisible(placeNodeInViewport(node, [occupied], bounds))).toBe(true);
});
test('right-click additions honor the clicked position and constrain edge clicks', () => {
  const at = { x: -4000, y: 1300 };
  expect(placeNodeInViewport(node, [], bounds, at).position).toEqual(at);
  const result = placeNodeInViewport(node, [], bounds, { x: -2400, y: 2100 });
  expect(isVisible(result)).toBe(true);
});
test('group containers do not push a draft away from its contents', () => {
  const group = { ...node, id: 'group', type: CanvasNodeType.Group, position: { x: bounds.x, y: bounds.y }, width: bounds.width, height: bounds.height };
  expect(placeNodeInViewport(node, [group], bounds).position).toEqual(placeNodeInViewport(node, [], bounds).position);
});
