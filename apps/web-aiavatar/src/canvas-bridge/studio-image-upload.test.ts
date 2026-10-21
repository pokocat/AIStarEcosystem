import { describe, it, expect } from 'vitest';
import type { StudioMediaImportResult } from '@ai-star-eco/types';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';
import { replaceStudioImage } from './studio-image-upload';
import { studioLinkedInputError, studioLinkedNodes } from './studio-linked-inputs';
import { studioNodeReferences } from './studio-script';

const slot: CanvasNodeData = { id: 'product', title: '商品参考', type: CanvasNodeType.Image,
  width: 360, height: 270, position: { x: 100, y: 200 }, metadata: { status: 'idle',
    studio: { kind: 'shot', templateInput: { required: true, label: '商品参考' } } } };
const output: CanvasNodeData = { ...slot, id: 'output', title: '商品镜头', metadata: { studio: { kind: 'shot' } } };
const edge = { id: 'product-ref', fromNodeId: 'product', toNodeId: 'output' };
const uploaded: StudioMediaImportResult = { mediaType: 'image', key: 'own/product.png', url: '/signed/product.png',
  fileName: 'product.png', bytes: 120, mimeType: 'image/png', width: 800, height: 600 };

describe('upload into a workflow image slot', () => {
  it('keeps the slot and its bindings, then resolves the uploaded file through the existing edge', () => {
    expect(studioLinkedInputError('output', [slot, output], [edge])).toContain('商品参考');
    const nodes = replaceStudioImage([slot, output], [edge], slot.id, uploaded);
    expect(nodes[0]).toMatchObject({ id: slot.id, title: slot.title, width: slot.width, height: slot.height,
      position: slot.position, metadata: { storageKey: uploaded.key, content: uploaded.url,
        studio: { templateInput: slot.metadata!.studio!.templateInput } } });
    expect(studioLinkedInputError('output', nodes, [edge])).toBeUndefined();
    expect(studioNodeReferences(studioLinkedNodes('output', nodes, [edge])[0], 'frame')[0].storageKey).toBe(uploaded.key);
    expect(nodes[1].metadata?.studio?.upstreamChanged).toBe(true);
    expect(slot.metadata?.storageKey).toBeUndefined();
  });

  it('clears old task identity when replacing a completed image and retains earlier takes', () => {
    const previous = { ...slot, metadata: { ...slot.metadata, runId: 'old', storageKey: 'own/old.png',
      images: [{ id: 'old', content: '/old', storageKey: 'own/old.png', status: 'success' as const,
        bytes: 10, naturalWidth: 1, naturalHeight: 1, mimeType: 'image/png' }],
      studio: { ...slot.metadata!.studio!, runId: 'old', task: { status: 'failed' as const, stage: 'failed', pct: 100 } } } };
    const next = replaceStudioImage([previous], [], slot.id, uploaded)[0];
    expect(next.metadata?.runId).toBeUndefined();
    expect(next.metadata?.studio?.runId).toBeUndefined();
    expect(next.metadata?.studio?.task).toBeUndefined();
    expect(next.metadata?.images).toHaveLength(2);
    expect(next.metadata?.primaryImageId).toBe(next.metadata?.images?.[1].id);
    expect(() => replaceStudioImage([], [], slot.id, uploaded)).toThrow('移出画布');
  });
});
