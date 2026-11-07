// @vitest-environment node
// 「存为角色、场景或道具」要真的挂到画布和资产页上（AGENTS.md §8.0.1 ⑥）。
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), 'src', path), 'utf8');

test('canvas image nodes can be saved from the right-click menu and the action bar', () => {
  expect(read('ip/studio-flow-canvas.tsx')).toMatch(/key: 'library-save'[^\n]*dispatchStudioCommand\('library-save', target\.id\)/);
  const workspace = read('ip/studio-workspace.tsx');
  expect(workspace).toContain('add("library-save"');
  expect(workspace).toContain("requestedAction === 'library-save'");
  expect(workspace).toContain('<LibrarySaveDialog ');
});

test('both asset pages offer it', () => {
  expect(read('ip/assets-hub.tsx')).toContain('<LibrarySaveDialog ');
  expect(read('ip/personal-asset-library.tsx')).toContain('<LibrarySaveDialog ');
});

test('crops, splits and frames reach the library; the inpaint mask does not', () => {
  const tools = read('ip/studio-flow-image-tools.tsx');
  expect(tools).toContain('projectId && remember ? { projectId, nodeId: id, title,');
  expect(tools).toMatch(/payload\.maskDataUrl[^\n]*source\.width, false\)/);
  expect(read('ip/studio-flow-video-frames.tsx')).toContain('projectId ? { projectId, nodeId: placeholder.id, title: placeholder.title }');
  const canvas = read('ip/studio-flow-canvas.tsx');
  expect(canvas).toContain('<StudioFlowImageTools projectId={projectId}');
  expect(canvas).toContain('<StudioFlowVideoFrames projectId={projectId}');
});

test('the source filter is on every asset view', () => {
  for (const file of ['ip/assets-hub.tsx', 'ip/assets-people.tsx', 'ip/assets-objects.tsx', 'ip/personal-asset-library.tsx'])
    expect(read(file)).toContain('<LibrarySourceSelect ');
});
