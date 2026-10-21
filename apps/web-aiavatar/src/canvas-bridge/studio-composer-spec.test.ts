import { describe, expect, test } from 'vitest';
import { mergeStudioSpec, studioDurationIssue, studioFrameCropNotice, studioPromptSpec, studioSpecConflict, studioSpecConflictText, studioSpecVideoDraft } from './studio-composer-spec';

// IPR-fde32da6c2cc4664974f (2026-10-20): the description as submitted, with the settings it was sent with.
const INCIDENT = '用我给你的人物和客厅图片来做视频，画幅 16:9，低饱和冷色调。\n\n镜 1（中景）：固定中全景，两人分坐在沙发两侧。无台词，仅安静底噪。时长 4 秒。';

test('the ratio and duration a description states are read; settings that differ are a conflict to ask about', () => {
  expect(studioPromptSpec(INCIDENT)).toEqual({ aspectRatio: '16:9', durationSec: 4 });
  const conflict = studioSpecConflict(INCIDENT, { aspectRatio: '9:16', durationSec: 8 });
  expect(conflict).toEqual({ aspectRatio: { said: '16:9', set: '9:16' }, durationSec: { said: 4, set: 8 } });
  expect(studioSpecConflictText(conflict!)).toEqual({ said: '16:9、4 秒', set: '9:16、8 秒' });
  expect(studioSpecConflict(INCIDENT, { aspectRatio: '16:9', durationSec: 4 })).toBeUndefined();
});

test('images compare only the ratio; vague or contradictory mentions are not guessed', () => {
  expect(studioSpecConflict('一张 3:4 的海报，人物在第 2 秒转身', { aspectRatio: '9:16' })).toEqual({ aspectRatio: { said: '3:4', set: '9:16' } });
  expect(studioPromptSpec('先 16:9 再改成 9:16 试试')).toEqual({});
  expect(studioPromptSpec('时长 4 秒，后面再接一段时长 6 秒')).toEqual({});
  expect(studioPromptSpec('第 3 秒她转身，镜头推近')).toEqual({});
  expect(studioPromptSpec('比分 2:1，时间 12:30')).toEqual({});
  expect(studioPromptSpec('一条 6 秒的短视频')).toEqual({ durationSec: 6 });
});

test('a duration the model cannot do is a message with the nearest fix, never a silent change', () => {
  expect(studioDurationIssue(4, { min: 5, max: 15 })).toEqual({ message: '所选模型支持 5–15 秒，现在设置的是 4 秒。', fix: 5 });
  expect(studioDurationIssue(20, { min: 5, max: 15 })?.fix).toBe(15);
  expect(studioDurationIssue(8, { min: 5, max: 15 })).toBeUndefined();
  expect(studioDurationIssue(8, { min: 4, max: 4 })).toEqual({ message: '所选模型只支持 4 秒，现在设置的是 8 秒。', fix: 4 });
  expect(studioDurationIssue(4, { options: [5, 6, 8] })).toEqual({ message: '所选模型可选 5 / 6 / 8 秒，没有 4 秒。', fix: 5 });
  expect(studioDurationIssue(7, { options: [5, 6, 8] })?.fix).toBe(6);
  expect(studioDurationIssue(4, { options: [] })).toBeUndefined();
});

test('roles, not canvas order, decide frames and reference sets', () => {
  const base = { mode: 'first_last_frame_video', firstId: 'male', lastId: 'female' };
  const spec = (references: { nodeId: string; role: 'character' | 'scene' | 'frame' }[]) => ({ references, source: 'assistant' as const, updatedAt: '' });
  // IPP-45bead91: two leads and a room are references, not first / last frames.
  expect(studioSpecVideoDraft(spec([{ nodeId: 'male', role: 'character' }, { nodeId: 'female', role: 'character' }, { nodeId: 'room', role: 'scene' }]), base))
    .toEqual({ mode: 'universal_reference_video', firstId: undefined, lastId: undefined });
  expect(studioSpecVideoDraft(spec([{ nodeId: 'room', role: 'frame' }]), base)).toEqual({ mode: 'i2v', firstId: 'room', lastId: undefined });
  expect(studioSpecVideoDraft(spec([{ nodeId: 'a', role: 'frame' }, { nodeId: 'b', role: 'frame' }]), base)).toEqual({ mode: 'first_last_frame_video', firstId: 'a', lastId: 'b' });
  expect(studioSpecVideoDraft(spec([]), base)).toEqual({ mode: 't2v', firstId: undefined, lastId: undefined });
  expect(studioSpecVideoDraft(undefined, base)).toBe(base);
  expect(mergeStudioSpec({ aspectRatio: '16:9', count: 4, source: 'assistant', updatedAt: '1' }, { durationSec: 8, source: 'assistant', updatedAt: '2' }))
    .toEqual({ aspectRatio: '16:9', count: 4, durationSec: 8, source: 'assistant', updatedAt: '2' });
});

// §6.2: production 2026-10-21 IPP-655ea55a, a 1:1 first frame sent for a 9:16 clip came back stretched.
describe('a first frame of another shape', () => {
  test('is said next to the send button with the server rule (centre crop, 2%), and a fix only when the model can do the frame', () => {
    expect(studioFrameCropNotice({ width: 1024, height: 1024 }, '9:16', ['9:16', '16:9', '1:1'])).toEqual({ text: '首帧图是 1:1，会按 9:16 居中裁剪', fix: '1:1' });
    expect(studioFrameCropNotice({ width: 1024, height: 1024 }, '9:16', ['9:16', '16:9'])).toEqual({ text: '首帧图是 1:1，会按 9:16 居中裁剪' });
    expect(studioFrameCropNotice({ width: 1920, height: 1080 }, '9:16', ['9:16', '16:9'])).toEqual({ text: '首帧图是 16:9，会按 9:16 居中裁剪', fix: '16:9' });
    expect(studioFrameCropNotice({ width: 1000, height: 1400 }, '9:16', ['9:16', '16:9', '1:1'])).toEqual({ text: '首帧图是 1000×1400，会按 9:16 居中裁剪' });
    expect(studioFrameCropNotice({ width: 768, height: 1344 }, '9:16', ['9:16'])).toBeUndefined();
    expect(studioFrameCropNotice(undefined, '9:16', ['9:16'])).toBeUndefined();
  });
});
