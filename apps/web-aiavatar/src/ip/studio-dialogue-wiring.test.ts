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
