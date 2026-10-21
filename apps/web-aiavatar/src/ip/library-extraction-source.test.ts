// 纯函数，node 环境就够（原在 library-extraction-panel.test.tsx 的 jsdom 里，2026-10-20 挪过来）。
import { expect, test } from 'vitest';
import { extractionSourceHash } from './library-extraction-source';

const run = { id: 'run', status: 'done', cost: 4, output: { assetExtraction: { items: [] } } };

test('episode-only snapshots and legacy runs keep the original full-document guard', async () => {
  const scoped = { ...run, inputs: { scriptEdit: { markdown: '第一集正文' } } };
  expect(await extractionSourceHash(scoped as any, 'full-document-hash', 1)).toBe('full-document-hash');
  expect(await extractionSourceHash(run as any, 'legacy-original-hash')).toBe('legacy-original-hash');
});
