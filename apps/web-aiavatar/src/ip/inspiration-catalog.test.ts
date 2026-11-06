import { describe, expect, test } from 'vitest';
import { studioPromptSpec } from '@/canvas-bridge/studio-composer-spec';
import { studioBriefNeedsReference } from './studio-entry';
// @ts-expect-error plain ESM data shared with the publish script (scripts/inspiration/publish.mjs)
import { INSPIRATIONS, ratioOf } from '../../../../scripts/inspiration/catalog.mjs';
// @ts-expect-error plain ESM used by the publish script
import { buildDoc } from '../../../../scripts/inspiration/publish-core.mjs';

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

  test('the published canvas: assistant prefilled, an optional input that blocks nothing, samples kept apart from my version', () => {
    const withInput = items as (Item & { input?: { sample?: unknown } })[];
    const video = withInput.find(i => i.kind === 'video' && i.input && !i.input.sample)!;
    const sample = { key: 'k.mp4', mimeType: 'video/mp4', bytes: 1, width: 720, height: 1280, seconds: 6 };
    const doc = buildDoc(video, [sample]);
    const node = (id: string) => doc.nodes.find((n: { id: string }) => n.id === id);
    expect(node('guide').metadata).toMatchObject({ studioStart: 'assistant', studioSkill: 'video-generation' });
    expect(node('guide').metadata.prompt).toContain(video.prompt);
    expect(node('guide').metadata.content.length).toBeGreaterThan(0);
    expect(node('input').metadata.studio.templateInput.required).toBe(false);
    expect(doc.connections).toEqual([{ id: 'c-input', fromNodeId: 'input', toNodeId: 'mine' }]);
    expect(node('mine').metadata).toMatchObject({ prompt: video.prompt, status: 'idle', seconds: video.seconds });
    expect(node('mine').metadata.storageKey).toBeUndefined();
    expect(node('sample-1').metadata).toMatchObject({ storageKey: 'k.mp4', origin: 'example', status: 'success', naturalWidth: 720 });
  });
});
