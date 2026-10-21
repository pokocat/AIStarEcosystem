// @vitest-environment node
// Structural guards for the threaded dialogue (AGENTS.md §8.0.1 ⑥ ⑫, §8 copy rules).
// The 375px behaviour is also checked by hand in the browser; this pins the rules that make it hold.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';

const src = resolve(process.cwd(), 'src');
const read = (path: string) => readFileSync(resolve(src, path), 'utf8');
const dialogueFiles = readdirSync(resolve(src, 'ip')).filter(f => /^studio-dialogue-.*\.tsx$/.test(f) && !f.includes('.test.')).map(f => `ip/${f}`)
  .concat(['ip/studio-assistant.tsx', 'ip/studio-assistant-plan.tsx']);

test('the dialogue is actually mounted and wired', () => {
  expect(read('app/layout.tsx')).toContain('import "../styles/studio-dialogue.css";');
  expect(read('ip/studio-workspace.tsx')).toMatch(/<StudioAssistant [^>]*connections=\{connections\}/);
  expect(read('ip/studio-node-content.tsx')).toMatch(/return <StudioCheckVerdict node=\{node\}/);
  const assistant = read('ip/studio-assistant.tsx');
  expect(assistant).toContain('useStudioDialogueSession(');
  expect(assistant).toContain('<StudioDialogueTimeline');
  expect(assistant).toContain('<StudioDialogueComposer');
  expect(assistant).toContain('window.addEventListener(STUDIO_CHECK_COMMAND');
  expect(read('ip/studio-dialogue-session.tsx')).toContain('subscribeStudioDialogue(');
  // S3: the plan badge and the operator draft action are reachable from the panel. 2026-10-21 (user feedback): no skill or
  // model control under the composer; the method shows only in the header label, whose hover text says how it is chosen,
  // and the 「which method」 rejection offers the skills as quick replies instead of a dropdown.
  expect(assistant).not.toContain('<Select');
  expect(assistant).not.toContain('aria-label="助手模型"');
  expect(assistant).not.toMatch(/studio-dialogue-chip(?!s)/);
  expect(assistant).toContain('title={modeLabelTitle(modeSkill?.name)}');
  expect(assistant).toContain('按你说的话自动选择；有制作在进行时保持不变，想换做法可以开一段新对话。');
  expect(assistant).toContain('aria-label="选一种做法"');
  expect(read('ip/studio-dialogue-composer.tsx')).not.toContain('{tools}');
  expect(assistant).toContain('<StudioDialogueSkillDraft');
  expect(assistant).toMatch(/completionActions: operator \? completionActions : undefined/);
  expect(read('ip/studio-dialogue-message.tsx')).toContain('handlers.completionActions?.(message)');
  expect(read('ip/studio-dialogue-message.tsx')).toContain('skillLabel={handlers.skillLabel?.(block.plan)}');
  expect(read('ip/studio-dialogue-session.tsx')).toContain('skillKey: input.skillKey');
  // The side-panel layout and the opening guidance are mounted, not just defined.
  expect(assistant).toContain('<StudioFloatingPanel title="创作助手"');
  expect(assistant).toContain('dockable defaultDocked resizable layoutKey="assistant"');
  expect(assistant).toContain('subheader={subheader}');
  // The new conversation opens on the four cards and their fill-in cards (docs/ip-studio-new-canvas-and-threads.md §5);
  // the recreation checklist is one of them now, not a second component.
  expect(assistant).toContain('<StudioAssistantStarterCards onPick={openStarter}/>');
  expect(assistant).toContain('<StudioAssistantStarterForm ');
  expect(assistant).not.toContain('StudioAssistantChecklist');
  expect(read('styles/ip-studio-workflow.css')).toContain('@container studio-welcome (max-width:359px)');
  expect(assistant).toContain('aria-label="使用说明"');
  expect(read('ip/studio-dialogue-execution.tsx')).toContain('role="progressbar"');
  expect(read('ip/studio-flow-canvas.tsx')).toContain("detail.action === 'focus'");
  // Dialogue-first start: the home hero and the mobile home open on the conversation box, the canvas sends the brief by
  // itself, and the assistant's new nodes come into view. The creation page (/create) has no box of its own: its first
  // entry is the 「新建画布」 card, the shared startNewCanvas() (docs/ip-studio-new-canvas-and-threads.md §2.2).
  expect(read('components/landing/ip-home.tsx')).toContain('<StudioConversationStart ');
  expect(read('components/hub/studio-home.tsx')).toContain('<StudioConversationStart ');
  expect(read('ip/studio-create-home.tsx')).not.toContain('StudioConversationStart');
  expect(read('ip/studio-create-home.tsx')).toContain('className="studio-create-new" aria-label="新建画布"');
  expect(read('ip/studio-create-home.tsx')).not.toContain('router.replace');
  expect(read('ip/studio-workspace.tsx')).toContain('autoSend={entryAutoSend}');
  expect(read('ip/studio-workspace.tsx')).toContain('>问助手</button>');
  // The empty canvas shows one guide card (docs/ip-studio-new-canvas-and-threads.md §2.3), with the assistant open or closed.
  expect(read('ip/studio-workspace.tsx')).toMatch(/studioCanvasGuideVisible\(\{nodeCount:nodes\.length,mode,panelOpen:[^}]*\}\)\s*&&<StudioCanvasGuide assistantOpen=\{assistantOpen\}/);
  expect(read('ip/studio-workspace.tsx')).not.toContain('studio-canvas-empty');
  expect(assistant).toContain('dispatchStudioCommand("reveal"');
  expect(read('ip/studio-flow-canvas.tsx')).toContain("detail.action === 'reveal'");
  // The assistant opens by default on desktop canvases; the stage steps its chrome aside for a docked panel.
  expect(read('ip/studio-workspace.tsx')).toContain('useState(readAssistantOpenPreference)');
  expect(read('ip/studio-floating-panel.tsx')).toContain("host.classList.add('has-docked-panel')");
  expect(read('styles/studio-flow.css')).toContain('.studio-flow-shell.has-docked-panel .studio-view-switch');
  // Canvas page redesign: no second toolbar row; the rail is seven tools; AI marks on nodes; the orb when the assistant is closed.
  const workspace = read('ip/studio-workspace.tsx'), canvas = read('ip/studio-flow-canvas.tsx');
  expect(workspace).not.toContain('className="studio-command-strip"');
  expect(workspace).toContain('className="studio-ai-orb"');
  expect(workspace).toContain('className="studio-tasks-launch"');
  const rail = canvas.slice(canvas.indexOf('<nav className="studio-flow-tools"'), canvas.indexOf('</nav>', canvas.indexOf('<nav className="studio-flow-tools"')));
  // Design Main board: seven tools. 专项创作 is not one of them (its items live in 模板, the video node's 「⋯」 and 素材库).
  for (const label of ['拖动画布', '选择工具', '添加内容', '素材库', '画布模板', '查找节点', '整理画布']) expect(rail).toContain(`aria-label="${label}"`);
  // Every rail tool carries a visible name that slides out on hover (icons alone were not recognisable).
  for (const name of ['平移', '选择', '添加', '素材库', '模板', '查找', '整理']) expect(rail).toContain(`<span className="studio-flow-tool-label">${name}</span>`);
  expect(rail).not.toContain('aria-label="专项创作"');
  expect(rail).not.toContain("label: '从资产库添加'");
  // Node operations left the rail for the context menu and the multi-select bar.
  for (const label of ['删除选中节点', '复制选中节点', '更多节点操作']) expect(rail).not.toContain(`aria-label="${label}"`);
  expect(canvas).toContain('className="studio-flow-ai-badge"');
  expect(read('ip/canvas-host.tsx')).toContain('className="studio-host-more-button"');
  expect(read('styles/ip-desktop.css')).toContain('--ai-gradient:');
  // Second pass against the design's Main board (2026-10-19): what the first pass left out.
  expect(canvas).toContain('className="studio-flow-origin">你上传的</span>');
  expect(canvas).not.toContain('>小地图</button>');
  expect(workspace).toContain('className="studio-context-more-button"');
  expect(workspace).toContain('toolbar width="auto"');
  expect(workspace).toContain('<AiMark size={18}/></button>}');
  expect(assistant).toContain('progress={execution && <StudioDialogueSteps');
  expect(assistant).toContain('aria-controls="studio-assistant-guide"');
  expect(read('styles/studio-flow.css')).toContain('.studio-flow-drag>.studio-flow-ai-badge,.studio-flow-drag>.studio-flow-origin { flex:none;');
  // Third pass: the dialogue and its button area (design Main board). A reply ends in one meta line; a confirmed card
  // collapses to one line. (The skill and model pills under the input were removed on 2026-10-21, with their styles.)
  expect(read('ip/studio-dialogue-message.tsx')).toContain('className="studio-dialogue-meta"');
  expect(read('ip/studio-dialogue-approval.tsx')).toContain('className="studio-dialogue-approval-done"');
  expect(read('styles/ip-studio-workflow.css')).not.toMatch(/studio-dialogue-chip(?!s)/);
});

test('the composer is never disabled as a whole', () => {
  const composer = read('ip/studio-dialogue-composer.tsx');
  const textarea = composer.slice(composer.indexOf('<Input.TextArea'), composer.indexOf('maxLength={4000}'));
  expect(textarea).not.toMatch(/\bdisabled=/);
  expect(read('ip/studio-assistant.tsx')).not.toMatch(/\blocked\b/);
});

test('dialogue styles stay inside the panel at phone width', () => {
  const css = read('styles/studio-dialogue.css').replace(/\/\*[\s\S]*?\*\//g, '');
  // Desktop / mobile differences follow html[data-layout], never width media queries.
  expect(css.match(/@media[^{]*/g) || []).toEqual(['@media (prefers-reduced-motion: reduce) ']);
  for (const [, value] of css.matchAll(/grid-template-columns:\s*([^;}]+)/g))
    expect(value.trim()).toMatch(/^(?:(?:auto|\d{1,2}px|minmax\(0, 1fr\)|repeat\(\d, minmax\(0, 1fr\)\))\s*)+$/);
  for (const [, px] of css.matchAll(/(?<![-\w])width:\s*(\d+)px/g)) expect(Number(px)).toBeLessThanOrEqual(120);
  for (const rule of css.split('}').map(r => r.trim()).filter(Boolean)) {
    const selector = rule.slice(0, rule.indexOf('{')).trim();
    if (selector.startsWith('@media')) continue;
    for (const part of selector.split(',').map(s => s.trim()))
      expect(part).toMatch(/^(\.ip-surface |html\[data-layout="(mobile|desktop)"\] \.ip-surface |\.studio-check-)/);
  }
});

test('visible copy follows the product rules', () => {
  for (const file of dialogueFiles) {
    const source = read(file);
    const strings = [...source.matchAll(/(['"`])((?:(?!\1)[^\\\n]|\\.)*)\1/g)].map(m => m[2]).concat([...source.matchAll(/>([^<>{}]+)</g)].map(m => m[1]));
    // Interpolations are code, not copy.
    const visible = strings.filter(s => /[\u4e00-\u9fff]/.test(s)).map(s => s.replace(/\$\{[^}]*\}/g, ''));
    for (const s of visible) {
      expect(s, `${file}: ${s}`).not.toContain('——');
      expect(s, `${file}: ${s}`).not.toMatch(/打造|赋能|助力|一站式|全方位|Skill|skill|tool_call|approval|plan\b|step\b/);
      expect(s, `${file}: ${s}`).not.toMatch(/(分钟|小时|天)前/);
    }
    expect(source, file).not.toMatch(/window\.(confirm|alert|prompt)\(|[^.\w](confirm|alert|prompt)\(/);
    expect(source, file).not.toMatch(/\.slice\(0, ?10\)/);
  }
});

// docs/ip-studio-new-canvas-and-threads.md §4: the card no longer tells people they can type their go-ahead, but typing
// a go-ahead still confirms it: the server's natural-approval guard (StudioNaturalApprovals, mirrored by the demo's
// mockSaysApprove) is unchanged, so the rule is pinned here by behaviour rather than by the card's copy.
test('the card does not teach typed confirmation, and typing a go-ahead still confirms', async () => {
  const { mockSaysApprove } = await import('./mocks/studio-dialogue');
  expect(read('ip/studio-dialogue-approval.tsx')).not.toMatch(/直接回复「.+?」/);
  expect(read('../../server/src/main/java/com/aistareco/aep/ipstudio/execution/StudioNaturalApprovals.java')).toMatch(/class StudioNaturalApprovals/);
  for (const yes of ['可以', '好', '行吧', '嗯，可以', '好的，开始制作']) expect(mockSaysApprove(yes)).toBe(true);
  for (const no of ['可以吗？', '先别开始', '再想想', '改成横屏', '可以把第 2 段换成横屏', '行不行', '不可以']) expect(mockSaysApprove(no)).toBe(false);
});

// 2026-10-19: one button language on the canvas page — AI actions use the AI gradient, other main actions are ink; no wheat yellow.
test('canvas page buttons use the AI gradient or ink, never the wheat action color', () => {
  for (const file of ['ip/canvas-host.tsx', 'ip/publish/publish-dialog.tsx']) expect(read(file)).not.toContain('var(--action)');
  expect(read('styles/studio-flow.css')).toContain('.studio-floating-panel .ant-btn-primary:not(:disabled):has(.studio-ai-icon)');
});

// §6.2 (docs/ip-studio-new-canvas-and-threads.md): the crop hint and the box-shape report are mounted, not just defined.
test('the first-frame crop hint and the media size report are wired', () => {
  const workspace = read('ip/studio-workspace.tsx');
  expect(workspace).toMatch(/<StudioFrameCropHint frame=\{cropFrame\} ratio=\{ratio\} ratios=\{cropRatios\} onFix=\{changeComposerRatio\}\/>/);
  expect(workspace).toContain('{composerBlocker}{frameCropHint}');
  const canvas = read('ip/studio-flow-canvas.tsx');
  expect(canvas.match(/onLoadedMetadata=\{videoLoaded\}/g)).toHaveLength(2);
  expect(canvas.match(/onLoad=\{imageLoaded\}/g)).toHaveLength(2);
  expect(canvas).toMatch(/onMediaSize: mediaSize/);
  expect(canvas).toContain('fitStudioNodeToMedia(n, size)');
});
