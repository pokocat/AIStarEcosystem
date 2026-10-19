// @vitest-environment node
// The skill editor merges the form back onto the version's own front matter object (StudioSkillPublishRequest
// accepts JSON), so fields the form does not own survive a publish untouched.
import { expect, test } from 'vitest';
import { changedParts, formFromVersion, frontmatterFromForm, stableJson, triggersSummary, validateSkillForm } from './studio-skill-form';

const frontmatter = {
  key: 'reference-video-recreation', name: '参考视频复刻', version: 2, status: 'active', planning: 'dynamic', summary: '照着原片做',
  methodExamples: ['remap-subject'], operations: { analysis: ['recreation', 'text'], production: ['text', 'video', 'check'] },
  limits: { maxSourceSec: 60, maxSegments: 8, maxSegmentSec: 'model', maxSteps: 'maxSegments * 3 + 4', maxAutoFixPerSegment: 2 },
  checks: ['subject-replaced', 'product-facts'], autoFixChecks: [], requiredCapabilities: ['video-generation'], futureField: { keep: true },
};
const version = { frontmatter, bodyMd: '# 方法\n先看片。' };

test('an untouched form merges back to the same front matter, keeping fields it does not edit', () => {
  const form = formFromVersion(version);
  expect(form).toMatchObject({ name: '参考视频复刻', segmentByModel: true, maxSegments: '8', checks: ['subject-replaced', 'product-facts'], triggerDefault: false });
  expect(stableJson(frontmatterFromForm(frontmatter, form))).toBe(stableJson(frontmatter));
  expect(validateSkillForm(form)).toEqual([]);
});

test('edits land in place: limits, auto-fix checks, triggers; the step-cap expression and unknown keys stay', () => {
  const form = { ...formFromVersion(version), name: '复刻 2', segmentByModel: false, maxSegmentSec: '12', autoFixChecks: ['product-facts'],
    triggerMedia: ['video' as const], triggerKeywords: ['复刻'], triggerDefault: true };
  const next = frontmatterFromForm(frontmatter, form);
  expect(next).toMatchObject({ key: 'reference-video-recreation', version: 2, planning: 'dynamic', name: '复刻 2', futureField: { keep: true },
    limits: { maxSegmentSec: 12, maxSteps: 'maxSegments * 3 + 4' }, autoFixChecks: ['product-facts'], triggers: { media: ['video'], keywords: ['复刻'], default: true } });
  // Clearing every trigger removes the block (absent = no triggers).
  expect(frontmatterFromForm(next, { ...form, triggerMedia: [], triggerKeywords: [], triggerDefault: false })).not.toHaveProperty('triggers');
  expect(triggersSummary(next.triggers as never)).toBe('带视频 · 说到「复刻」 · 默认');
  expect(changedParts(version, { frontmatter: next, bodyMd: version.bodyMd })).toEqual(['名称', '上限', '自动修正项', '路由提示']);
});

test('autoFixChecks must be a subset of checks; ids, stages and limits are checked before a round trip', () => {
  const form = formFromVersion(version);
  expect(validateSkillForm({ ...form, autoFixChecks: ['old-subject-residue'] })).toContain('自动修正项「old-subject-residue」不在检查项里，先把它加进检查项');
  expect(validateSkillForm({ ...form, checks: ['Bad Id'] })).toContain('检查项「Bad Id」只能用小写字母、数字和连字符');
  expect(validateSkillForm({ ...form, operations: { ...form.operations, production: [] } })).toContain('制作阶段至少要开放一种操作');
  expect(validateSkillForm({ ...form, maxSegments: '0' })).toContain('最多段数要填正整数');
  expect(validateSkillForm({ ...form, autoFixChecks: ['product-facts'], maxAutoFixPerSegment: '0' })).toContain('开了自动修正项，每段自动修正次数至少要 1 次');
  // A stray auto-fix id never leaves the editor even if validation were skipped.
  expect(frontmatterFromForm(frontmatter, { ...form, autoFixChecks: ['gone'] }).autoFixChecks).toEqual([]);
});
