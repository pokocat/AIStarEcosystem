import { describe, expect, test } from 'vitest';
import { studioPromptSpec } from '@/canvas-bridge/studio-composer-spec';
import { studioBriefNeedsReference } from './studio-entry';
// @ts-expect-error plain ESM data shared with the publish script (scripts/inspiration/publish.mjs)
import { INSPIRATIONS, ratioOf } from '../../../../scripts/inspiration/catalog.mjs';
// @ts-expect-error plain ESM used by the publish script
import { buildDoc, publishedAssets } from '../../../../scripts/inspiration/publish-core.mjs';

type Item = { id: string; kind: string; name: string; summary: string; ratio: string; seconds?: number; method: string[]; replace: string; prompt: string; request?: string; samples: string[]; hold?: boolean };
const items = INSPIRATIONS as Item[];
const allText = (item: Item) => [item.name, item.summary, item.replace, item.prompt, item.request ?? '', ...item.method].join('\n');

// What the catalogue writes is what the canvas and the assistant act on. These are the rules a prefilled request has to obey
// to behave once it lands there, and they must keep holding when someone edits an entry.
describe('inspiration catalogue', () => {
  test('ids are unique and fit a demo id; every ratio is one the canvas knows', () => {
    expect(new Set(items.map(i => i.id)).size).toBe(items.length);
    for (const item of items) {
      expect(`IPD-insp-${item.id}`).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
      expect(ratioOf(item.ratio)).toBeGreaterThan(0);
      expect(['image', 'video']).toContain(item.kind);
      if (item.kind === 'video') expect(item.seconds).toBeGreaterThan(0);
    }
  });

  test('a prefilled request goes to the assistant as a request, never into the copy-a-video checklist', () => {
    for (const item of items) for (const text of [item.prompt, item.request ?? '']) expect(studioBriefNeedsReference(text), item.id).toBe(false);
  });

  test('prompts state no ratio or duration: the node settings decide, a mismatch would stop the user before paying', () => {
    for (const item of items) expect(studioPromptSpec(item.prompt), item.id).toEqual({});
  });

  test('copy follows the interface rules and names no third-party brand or model', () => {
    const banned = /打造|赋能|助力|一站式|全方位|轻松|即可|开启|——|爱马仕|泡泡玛特|Seedance|GPT Image|Kling|Nano Banana|AGENTS\.md/;
    for (const item of items) expect(allText(item), item.id).not.toMatch(banned);
  });

  type Doc = { nodes: { id: string; type: string; title: string; metadata: any }[]; connections: { fromNodeId: string; toNodeId: string }[] };
  const withInput = items as (Item & { input?: { title: string; sample?: unknown } })[];
  const nodeOf = (doc: Doc, id: string) => doc.nodes.find(n => n.id === id)!;
  const clip = (key: string) => ({ key, mimeType: 'video/mp4', bytes: 1, width: 720, height: 1280, seconds: 6 });

  test('the published canvas is the real chain: reference -> one card holding the prompt and the result, assistant prefilled', () => {
    const video = withInput.find(i => i.kind === 'video' && i.input && !i.input.sample)!;
    const doc: Doc = buildDoc(video, [clip('k.mp4')]);
    expect(doc.nodes.map(n => n.id)).toEqual(['guide', 'input', 'result']);
    expect(nodeOf(doc, 'guide').metadata).toMatchObject({ studioStart: 'assistant', studioSkill: 'video-generation' });
    expect(nodeOf(doc, 'guide').metadata.prompt).toContain(video.prompt);
    expect(nodeOf(doc, 'guide').metadata.content).not.toMatch(/我的版本|示例效果/);
    expect(nodeOf(doc, 'input').metadata.studio.templateInput.required).toBe(false);
    expect(doc.connections).toEqual([{ id: 'c-input', fromNodeId: 'input', toNodeId: 'result' }]);
    expect(nodeOf(doc, 'result')).toMatchObject({ type: 'video', title: '成片' });
    expect(nodeOf(doc, 'result').metadata).toMatchObject({ prompt: video.prompt, seconds: video.seconds, storageKey: 'k.mp4', status: 'success', origin: 'example', naturalWidth: 720, primaryVideoId: 'take-1' });
    expect(nodeOf(doc, 'result').metadata.videos).toEqual([expect.objectContaining({ id: 'take-1', status: 'success', storageKey: 'k.mp4', prompt: video.prompt })]);
  });

  test('a reference that made the sample sits on the canvas and feeds the card it made', () => {
    const poster = withInput.find(i => i.input?.sample)!;
    const doc: Doc = buildDoc(poster, [clip('clip.mp4')], { key: 'poster.jpg', mimeType: 'image/jpeg', width: 1680, height: 2240 });
    expect(nodeOf(doc, 'input')).toMatchObject({ title: poster.input!.title, metadata: { storageKey: 'poster.jpg', status: 'success' } });
    expect(doc.connections).toEqual([{ id: 'c-input', fromNodeId: 'input', toNodeId: 'result' }]);
    expect(nodeOf(doc, 'guide').metadata.content).toContain(`「${poster.input!.title}」是生成这条示例用的参考图`);
  });

  test('images keep their takes the way a generated image does; several samples are versions of one card', () => {
    const image = items.find(i => i.kind === 'image')!;
    const doc: Doc = buildDoc(image, [{ key: 'a.jpg', mimeType: 'image/jpeg', bytes: 9, width: 1024, height: 1365 }]);
    expect(nodeOf(doc, 'result')).toMatchObject({ type: 'image', title: '成图', metadata: { size: image.ratio, count: 1, primaryImageId: 'take-1' } });
    expect(nodeOf(doc, 'result').metadata.images[0]).toMatchObject({ storageKey: 'a.jpg', naturalWidth: 1024, naturalHeight: 1365, content: '' });
    const twice = items.find(i => i.samples.length > 1)!;
    const versions = nodeOf(buildDoc(twice, [clip('1.mp4'), clip('2.mp4')]), 'result').metadata;
    expect(versions.videos.map((t: { storageKey: string }) => t.storageKey)).toEqual(['1.mp4', '2.mp4']);
    expect(versions.storageKey).toBe('1.mp4');
  });

  test('rebuild reuses the files already published, from the old layout or the new one, in the same order', () => {
    const twice = withInput.find(i => i.samples.length > 1)!;
    const live = { nodes: [
      { id: 'guide', type: 'text', metadata: { content: 'x' } },
      { id: 'input', type: 'image', metadata: { status: 'idle' } },
      { id: 'mine', type: 'video', metadata: { prompt: 'p' } },
      { id: 'sample-2', type: 'video', metadata: { storageKey: 'ipstudio_demo/d/2.mp4', mimeType: 'video/mp4', bytes: 2, naturalWidth: 720, naturalHeight: 1280, durationMs: 6000 } },
      { id: 'sample-1', type: 'video', metadata: { storageKey: 'ipstudio_demo/d/1.mp4', mimeType: 'video/mp4', bytes: 1, naturalWidth: 720, naturalHeight: 1280, durationMs: 6100 } },
    ] };
    const first = publishedAssets(live);
    expect(first.uploaded.map((a: { key: string }) => a.key)).toEqual(['ipstudio_demo/d/1.mp4', 'ipstudio_demo/d/2.mp4']);
    expect(first.inputAsset).toBeUndefined();
    const rebuilt = buildDoc(twice, first.uploaded, first.inputAsset);
    const again = publishedAssets(rebuilt);
    expect(again.uploaded.map((a: { key: string }) => a.key)).toEqual(['ipstudio_demo/d/1.mp4', 'ipstudio_demo/d/2.mp4']);
    expect(buildDoc(twice, again.uploaded, again.inputAsset)).toEqual(rebuilt);
  });
});
