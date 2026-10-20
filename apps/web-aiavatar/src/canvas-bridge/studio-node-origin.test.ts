import { describe, expect, test } from 'vitest';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';
import { studioUploadedByUser } from './studio-node-origin';
import { attachmentNode, readAssistantAttachment, savedAssetPayload } from './studio-attachments';
import { replaceStudioImage } from './studio-image-upload';
import { replaceStudioVideo } from './studio-video-upload';

const node = (type: CanvasNodeType, metadata: CanvasNodeData['metadata']): CanvasNodeData =>
  ({ id: 'n', type, title: '素材', position: { x: 0, y: 0 }, width: 320, height: 240, metadata });

// Local e2e 2026-10-19: images, videos and voices imported from 素材库 「AI 生成」 and a crop of an AI image all read 「你上传的」.
describe('「你上传的」 is only for the user\'s own files', () => {
  test('a generated asset brought back from the library is not an upload, before or after a refresh', () => {
    for (const asset of [
      { id: 'a1', kind: 'image', title: '生成图', coverUrl: '', tags: [], createdAt: '', updatedAt: '', data: { dataUrl: '/cdn/x.png', storageKey: 'ipstudio_gen/u1/x.png', width: 1, height: 1, bytes: 1, mimeType: 'image/png' } },
      { id: 'a2', kind: 'video', title: '生成片', coverUrl: '', tags: [], createdAt: '', updatedAt: '', data: { url: '/cdn/x.mp4', storageKey: 'media/ipstudio_gen/u1/x.mp4', width: 1, height: 1, bytes: 1, mimeType: 'video/mp4' } },
      { id: 'a3', kind: 'audio', title: '配音', coverUrl: '', tags: [], createdAt: '', updatedAt: '', data: { url: '/cdn/x.wav', storageKey: 'ipstudio_gen/u1/x.wav', bytes: 1, mimeType: 'audio/wav' } },
    ] as const) {
      const imported = attachmentNode(savedAssetPayload(asset as any), []);
      expect(studioUploadedByUser(imported)).toBe(false);
      expect(studioUploadedByUser(JSON.parse(JSON.stringify(imported)))).toBe(false);
    }
  });

  test('a file the user picked is an upload, through every upload path', async () => {
    const file = new File([new Uint8Array(8)], 'mine.png', { type: 'image/png' });
    const picked = await readAssistantAttachment(file, [], async () => ({ text: '' }), async () =>
      ({ mediaType: 'image', key: 'ipstudio_source/u1/mine.png', url: '/cdn/mine.png', fileName: 'mine.png', mimeType: 'image/png', bytes: 8, width: 10, height: 10 } as any));
    expect(studioUploadedByUser(picked)).toBe(true);
    const intoImage = replaceStudioImage([node(CanvasNodeType.Image, {})], [], 'n',
      { mediaType: 'image', key: 'ipstudio_source/u1/a.png', url: '/cdn/a.png', mimeType: 'image/png', bytes: 1, width: 1, height: 1 } as any)[0];
    expect(studioUploadedByUser(intoImage)).toBe(true);
    const intoVideo = replaceStudioVideo([node(CanvasNodeType.Video, {})], [], 'n',
      { mediaType: 'video', key: 'ipstudio_source/u1/a.mp4', url: '/cdn/a.mp4', mimeType: 'video/mp4', bytes: 1, width: 1, height: 1, durationSec: 5 } as any)[0];
    expect(studioUploadedByUser(intoVideo)).toBe(true);
  });

  test('a crop, a person from the IP library and anything AI made carry no upload mark', () => {
    expect(studioUploadedByUser(node(CanvasNodeType.Image, { storageKey: 'ipstudio_source/u1/crop.png', origin: 'derived' }))).toBe(false);
    expect(studioUploadedByUser(node(CanvasNodeType.Image, { storageKey: 'dap/u1/look.png', studio: { kind: 'ip', references: [{ avatarId: 'A1', role: 'character' }] } as any }))).toBe(false);
    expect(studioUploadedByUser(node(CanvasNodeType.Image, { storageKey: 'ipstudio_source/u1/a.png', origin: 'upload', studio: { kind: 'shot', runId: 'IPR-1' } as any }))).toBe(false);
    expect(studioUploadedByUser(node(CanvasNodeType.Text, { storageKey: 'ipstudio_source/u1/a.txt', origin: 'upload' }))).toBe(false);
  });

  test('older uploads without a mark still read 「你上传的」 when the file sits in the upload area', () => {
    expect(studioUploadedByUser(node(CanvasNodeType.Video, { storageKey: 'ipstudio_source/u1/old.mp4' }))).toBe(true);
    expect(studioUploadedByUser(node(CanvasNodeType.Video, { storageKey: 'ipstudio_gen/u1/old.mp4' }))).toBe(false);
  });
});
