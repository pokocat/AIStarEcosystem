// @vitest-environment node
// Reachability and request/event guards. Presentation is reviewed on the real page.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

const src = resolve(process.cwd(), 'src');
const read = (path: string) => readFileSync(resolve(src, path), 'utf8');
// Leave presentation policies out; actual interactions have their own suites.
test('the dialogue is mounted and connected to its event and execution handlers', () => {
  const workspace = read('ip/studio-workspace.tsx');
  const assistant = read('ip/studio-assistant.tsx');
  const session = read('ip/studio-dialogue-session.tsx');
  expect(workspace).toMatch(/<StudioAssistant [^>]*connections=\{connections\}/);
  for (const component of ['StudioDialogueTimeline', 'StudioDialogueComposer', 'StudioDialogueSkillDraft']) expect(assistant).toContain(`<${component}`);
  expect(session).toContain('subscribeStudioDialogue(');
  expect(session).toContain('skillKey: input.skillKey');
  expect(assistant).toMatch(/completionActions: operator \? completionActions : undefined/);
  expect(read('ip/studio-dialogue-message.tsx')).toContain('handlers.completionActions?.(message)');
  expect(read('ip/studio-node-content.tsx')).toMatch(/return <StudioCheckVerdict node=\{node\}/);
});

test('the composer is never disabled as a whole', () => {
  const composer = read('ip/studio-dialogue-composer.tsx');
  const textarea = composer.slice(composer.indexOf('<Input.TextArea'), composer.indexOf('maxLength={4000}'));
  expect(textarea).not.toMatch(/\bdisabled=/);
  expect(read('ip/studio-assistant.tsx')).not.toMatch(/\blocked\b/);
});

// docs/ip-studio-new-canvas-and-threads.md §4: the card no longer tells people they can type their go-ahead, but typing
// a go-ahead still confirms it: the server's natural-approval guard (StudioNaturalApprovals, mirrored by the demo's
// mockSaysApprove) is unchanged, so the rule is pinned here by behaviour rather than by the card's copy.
test('typing a go-ahead confirms, while questions and refusals do not', async () => {
  const { mockSaysApprove } = await import('./mocks/studio-dialogue');
  for (const yes of ['可以', '好', '行吧', '嗯，可以', '好的，开始制作']) expect(mockSaysApprove(yes)).toBe(true);
  for (const no of ['可以吗？', '先别开始', '再想想', '改成横屏', '可以把第 2 段换成横屏', '行不行', '不可以']) expect(mockSaysApprove(no)).toBe(false);
});

// §6.2 (docs/ip-studio-new-canvas-and-threads.md): the crop hint and the box-shape report are mounted, not just defined.
test('the first-frame crop hint and the media size report are wired', () => {
  const workspace = read('ip/studio-workspace.tsx');
  expect(workspace).toMatch(/<StudioFrameCropHint frame=\{cropFrame\} ratio=\{ratio\} ratios=\{cropRatios\} onFix=\{changeComposerRatio\}\/>/);
  expect(workspace).toContain('{composerBlocker}{frameCropHint}');
  const canvas = read('ip/studio-flow-canvas.tsx');
  expect(canvas).toMatch(/onMediaSize: mediaSize/);
  expect(canvas).toContain('fitStudioNodeToMedia(n, size)');
});

// 视频节点铺满与抽帧（2026-10-21）：§8.0.1 ⑥ —— both entries really send video-frames, and the panel is mounted on the canvas.
test('抽帧 is reachable from the editor and the right-click menu, and its panel is mounted', () => {
  const workspace = read('ip/studio-workspace.tsx');
  expect(workspace).toMatch(/add\("video-frames",<button [^>]*onClick=\{\(\)=>dispatchStudioCommand\("video-frames",selected\.id\)\}><Camera size=\{15\}\/>抽帧<\/button>\)/);
  expect(workspace).toContain('aria-label="节点编辑操作"');
  const canvas = read('ip/studio-flow-canvas.tsx');
  expect(canvas).toContain("{key:'video-frames',label:'抽帧',onClick:()=>dispatchStudioCommand('video-frames',target.id)}");
  expect(canvas).toMatch(/<StudioFlowVideoFrames projectId=\{projectId\} nodes=\{project\.nodes\} pending=\{pendingFrames\} onPendingChange=\{setPendingFrames\}/);
  // Placeholders are drawn from local state only, never written to the document.
  expect(canvas).toContain('flowNodes(pendingFrames.map(p => p.node), new Set())');
  const frames = read('ip/studio-flow-video-frames.tsx');
  expect(frames).toContain("action !== 'video-frames'");
  expect(frames).toContain('fetchAssetBlob(storageKey)');
  expect(frames).not.toMatch(/status: ?'loading'/);
  // Video nodes keep the clip ratio while resized and are drawn edge to edge once in shape.
  expect(canvas).toContain('keepAspectRatio={videoShaped}');
  expect(canvas).toContain('onVideoResized: videoResized');
});

// 右键菜单（2026-10-21）：菜单渲染成一排平铺按钮、直接调 item.onClick，带 children 的项点了就报错（「素材拆解」）。
test('the node right-click menu has no nested items, and 解析视频 / 拉片 are direct entries', () => {
  const canvas = read('ip/studio-flow-canvas.tsx');
  const menu = canvas.slice(canvas.indexOf('const nodeMenu = target ? ['), canvas.indexOf('const paneMenu = ['));
  expect(menu).not.toContain('children');
  expect(menu).toContain("{key:'analyze',label:'解析视频',onClick:()=>dispatchStudioCommand('recreation',target.id)}");
  expect(menu).toContain("{key:'film-study',label:'拉片',onClick:()=>dispatchStudioCommand('film-study',target.id)}");
});
