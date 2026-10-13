import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';

type Bounds = { x: number; y: number; width: number; height: number };

/** User additions stay in the visible canvas. A crowded viewport may overlap; it never sends the draft offscreen. */
export function placeNodeInViewport(node: CanvasNodeData, existing: CanvasNodeData[], bounds: Bounds, preferred?: { x: number; y: number }): CanvasNodeData {
  const maxX = bounds.x + Math.max(0, bounds.width - node.width), maxY = bounds.y + Math.max(0, bounds.height - node.height);
  const clampX = (x: number) => Math.max(bounds.x, Math.min(x, maxX));
  const clampY = (y: number) => Math.max(bounds.y, Math.min(y, maxY));
  const center = { x: clampX(preferred?.x ?? bounds.x + (bounds.width - node.width) / 2), y: clampY(preferred?.y ?? bounds.y + (bounds.height - node.height) / 2) };
  // Groups are containers, not occupied content. Ignore distant cards before searching nearby gaps.
  const visible = existing.filter(n => n.id !== node.id && n.type !== CanvasNodeType.Group && n.position.x + n.width > bounds.x && n.position.x < bounds.x + bounds.width && n.position.y + n.height > bounds.y && n.position.y < bounds.y + bounds.height);
  const gap = 24;
  const nearest = (values: number[], origin: number) => [...new Set(values)].sort((a, b) => Math.abs(a - origin) - Math.abs(b - origin)).slice(0, 32);
  const xs = nearest([center.x, bounds.x, maxX, ...visible.flatMap(n => [clampX(n.position.x - node.width - gap), clampX(n.position.x + n.width + gap)])], center.x);
  const ys = nearest([center.y, bounds.y, maxY, ...visible.flatMap(n => [clampY(n.position.y - node.height - gap), clampY(n.position.y + n.height + gap)])], center.y);
  const candidates = xs.flatMap(x => ys.map(y => ({ x, y }))).sort((a, b) => (a.x - center.x) ** 2 + (a.y - center.y) ** 2 - (b.x - center.x) ** 2 - (b.y - center.y) ** 2);
  const position = candidates.find(p => visible.every(n => p.x + node.width + gap <= n.position.x || p.x >= n.position.x + n.width + gap || p.y + node.height + gap <= n.position.y || p.y >= n.position.y + n.height + gap)) || center;
  return { ...node, position };
}
