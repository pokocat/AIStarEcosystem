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
  // S3: the skill choice, the plan badge and the operator draft action are reachable from the panel.
  expect(assistant).toMatch(/<Select aria-label="技能"/);
  expect(assistant).toContain('<StudioDialogueSkillDraft');
  expect(assistant).toMatch(/completionActions: operator \? completionActions : undefined/);
  expect(read('ip/studio-dialogue-message.tsx')).toContain('handlers.completionActions?.(message)');
  expect(read('ip/studio-dialogue-message.tsx')).toContain('skillLabel={handlers.skillLabel?.(block.plan)}');
  expect(read('ip/studio-dialogue-session.tsx')).toContain('skillKey: input.skillKey');
  // The side-panel layout and the opening guidance are mounted, not just defined.
  expect(assistant).toContain('<StudioFloatingPanel title="创作助手"');
  expect(assistant).toContain('dockable defaultDocked resizable layoutKey="assistant"');
  expect(assistant).toContain('subheader={subheader}');
  expect(assistant).toContain('<StudioAssistantChecklist');
  expect(assistant).toContain('aria-label="使用说明"');
  expect(read('ip/studio-dialogue-execution.tsx')).toContain('role="progressbar"');
  expect(read('ip/studio-flow-canvas.tsx')).toContain("detail.action === 'focus'");
  // Dialogue-first start: the home hero, the mobile home and the creation page all open on the conversation box,
  // the canvas sends the brief by itself, and the assistant's new nodes come into view.
  expect(read('components/landing/ip-home.tsx')).toContain('<StudioConversationStart ');
  expect(read('components/hub/studio-home.tsx')).toContain('<StudioConversationStart ');
  expect(read('ip/studio-creation-brief.tsx')).toContain('<StudioConversationStart ');
  expect(read('ip/studio-workspace.tsx')).toContain('autoSend={entryAutoSend}');
  expect(read('ip/studio-workspace.tsx')).toContain('>问助手</button>');
  expect(read('ip/studio-workspace.tsx')).toContain('className="studio-start studio-canvas-empty"');
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
  // Third pass: the dialogue and its button area (design Main board). The skill pill stays visible once a thread is bound;
  // a reply ends in one meta line; a confirmed card collapses to one line; antd 6 Select parts are styled (not v5's .ant-select-selector).
  expect(assistant).toContain('studio-dialogue-chip is-skill is-static');
  expect(read('ip/studio-dialogue-message.tsx')).toContain('className="studio-dialogue-meta"');
  expect(read('ip/studio-dialogue-approval.tsx')).toContain('className="studio-dialogue-approval-done"');
  expect(read('styles/ip-studio-workflow.css')).toContain('.studio-dialogue-chip .ant-select-suffix { display:none; }');
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
    expect(value.trim()).toMatch(/^(?:(?:auto|minmax\(0, 1fr\)|repeat\(\d, minmax\(0, 1fr\)\))\s*)+$/);
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

// The confirmation card tells people what to type; that word must be one the server's natural-approval guard accepts
// (StudioNaturalApprovals, mirrored by the demo's mockSaysApprove). It said 「可以」, which the guard does not accept.
test('the word the confirmation card suggests actually confirms', async () => {
  const { mockSaysApprove } = await import('./mocks/studio-dialogue');
  const word = read('ip/studio-dialogue-approval.tsx').match(/直接回复「(.+?)」也行/)?.[1];
  expect(word).toBeDefined();
  expect(mockSaysApprove(word!)).toBe(true);
  for (const yes of ['可以', '好', '行吧', '嗯，可以', '好的，开始制作']) expect(mockSaysApprove(yes)).toBe(true);
  for (const no of ['可以吗？', '先别开始', '再想想', '改成横屏', '可以把第 2 段换成横屏', '行不行', '不可以']) expect(mockSaysApprove(no)).toBe(false);
});

// 2026-10-19: one button language on the canvas page — AI actions use the AI gradient, other main actions are ink; no wheat yellow.
test('canvas page buttons use the AI gradient or ink, never the wheat action color', () => {
  for (const file of ['ip/canvas-host.tsx', 'ip/publish/publish-dialog.tsx']) expect(read(file)).not.toContain('var(--action)');
  expect(read('styles/studio-flow.css')).toContain('.studio-floating-panel .ant-btn-primary:not(:disabled):has(.studio-ai-icon)');
});
