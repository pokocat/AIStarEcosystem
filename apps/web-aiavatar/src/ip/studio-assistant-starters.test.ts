// @vitest-environment node
// Check skill routing, required material and preservation of user input/options.
// Display copy and generated sentence boilerplate may change without test edits.
import { expect, test } from 'vitest';
import { STUDIO_STARTERS, composeStarter, isMentionResidue, starterClause, starterDefaults, starterSlotNodes, studioStarter } from './studio-assistant-starters';

const nodes = (...titles: string[]) => titles.map(title => ({ title }));

test('each card routes to its skill and initializes its options', () => {
  expect(STUDIO_STARTERS.map(c => [c.key, c.skill])).toEqual([
    ['ip', 'image-generation'], ['script', 'script-writing'],
    ['video', 'video-generation'], ['recreation', 'reference-video-recreation'],
  ]);
  expect(starterDefaults(studioStarter('ip'))).toEqual({ style: 'business', output: 'sheet', sceneRatio: '9:16' });
  expect(starterDefaults(studioStarter('script'))).toEqual({ type: '短剧', length: '60 秒', tone: '有反转' });
  expect(starterDefaults(studioStarter('video'))).toEqual({ ratio: '9:16', length: '5 秒', camera: '自动' });
  expect(starterDefaults(studioStarter('recreation'))).toEqual({ keep: 'shots' });
});

test('制作个人 IP: the defaults, the photos as @ tags, options and the photo limits', () => {
  expect(composeStarter('ip', {}).missing.map(m => m.kind)).toEqual(['slot']);
  const prompt = composeStarter('ip', { slots: { photos: nodes('自拍') } });
  expect(prompt.missing).toEqual([]);
  expect(prompt.text).toContain('@自拍');
  expect(prompt.text).toContain('3:4');
  const avatar = composeStarter('ip', { slots: { photos: nodes('自拍', '侧脸') }, options: { style: 'toy', output: 'avatar' } });
  for (const token of ['@自拍', '@侧脸', '1:1']) expect(avatar.text).toContain(token);
  expect(composeStarter('ip', { slots: { photos: nodes('a') }, options: { style: 'toy', output: 'turnaround' } }).text).toContain('16:9');
  expect(composeStarter('ip', { slots: { photos: nodes('a', 'b', 'c', 'd') } }).missing.map(m => m.kind)).toEqual(['slot']);
  // A value the card does not offer falls back to the default.
  expect(composeStarter('ip', { slots: { photos: nodes('a') }, options: { style: '油画' } }).text)
    .toBe(composeStarter('ip', { slots: { photos: nodes('a') } }).text);
});

test('写剧本: requires a synopsis and preserves it together with the chosen options', () => {
  expect(composeStarter('script', {}).missing.map(m => m.kind)).toEqual(['field']);
  const prompt = composeStarter('script', { fields: { synopsis: '  外卖员送错一单，意外救了老板的女儿。 ' } });
  expect(prompt.missing).toEqual([]);
  expect(prompt.text).toContain('外卖员送错一单，意外救了老板的女儿');
  expect(prompt.text).not.toContain('。。');
  const selected = composeStarter('script', { fields: { synopsis: '外卖员送错一单' }, options: { type: '微电影', length: '分 3 集', tone: '悬疑' } });
  for (const value of ['外卖员送错一单', '微电影', '分 3 集', '悬疑']) expect(selected.text).toContain(value);
  expect(composeStarter('script', { fields: { synopsis: '   ' } }).missing.map(m => m.kind)).toEqual(['field']);
});

test('生成短视频: the first frame and a camera move only appear when chosen', () => {
  expect(composeStarter('video', {}).missing.map(m => m.kind)).toEqual(['field']);
  const plain = composeStarter('video', { fields: { description: '女孩在海边回头微笑，风吹起围巾' } });
  expect(plain.missing).toEqual([]);
  expect(plain.text).toContain('女孩在海边回头微笑，风吹起围巾');
  expect(plain.text).not.toContain('@');
  const selected = composeStarter('video', { fields: { description: '女孩在海边回头微笑' }, slots: { frame: nodes('海边') }, options: { ratio: '16:9', length: '10 秒', camera: '环绕' } });
  for (const value of ['女孩在海边回头微笑', '@海边', '16:9', '10 秒', '环绕']) expect(selected.text).toContain(value);
  expect(composeStarter('video', { fields: { description: 'x' }, options: { camera: '缓慢推近' } }).text).toContain('缓慢推近');
  // The first frame is optional, but only one.
  expect(composeStarter('video', { fields: { description: 'x' }, slots: { frame: nodes('a', 'b') } }).missing.map(m => m.kind)).toEqual(['slot']);
});

test('复刻视频: both pieces of material are required; the selling point is optional and leaves nothing behind when empty', () => {
  expect(composeStarter('recreation', {}).missing.map(m => m.kind)).toEqual(['slot', 'slot']);
  const material = { reference: nodes('带货样片'), subject: nodes('保温杯') };
  const plain = composeStarter('recreation', { slots: material });
  expect(plain.missing).toEqual([]);
  for (const value of ['@带货样片', '@保温杯']) expect(plain.text).toContain(value);
  const withPoints = composeStarter('recreation', { slots: material, options: { keep: 'rhythm' }, fields: { points: '保温 12 小时，一键开盖。' } });
  expect(withPoints.text).toContain('保温 12 小时，一键开盖');
  expect(withPoints.text).not.toContain('。。');
  expect(composeStarter('recreation', { slots: material, options: { keep: 'voice' } }).text).not.toBe(plain.text);
  expect(composeStarter('recreation', { slots: { reference: nodes('a', 'b'), subject: nodes('1', '2', '3', '4') } }).missing.map(m => m.kind)).toEqual(['slot', 'slot']);
});

test('material is matched to slots by node type', () => {
  const referenced = [{ type: 'image', title: '自拍' }, { type: 'video', title: '样片' }, { type: 'text', title: '台词' }, { type: 'image', title: '杯子' }];
  expect(starterSlotNodes(studioStarter('recreation'), referenced)).toEqual({ reference: [referenced[1]], subject: [referenced[0], referenced[3]] });
  expect(starterSlotNodes(studioStarter('script'), referenced)).toEqual({});
});

test('a pending @ pick after the sentence is still the card\'s text; any other edit is the user\'s', () => {
  const base = '做一条 5 秒、9:16 的短视频。';
  expect(isMentionResidue(`${base} @`, base)).toBe(true);
  expect(isMentionResidue(`${base} @海边`, base)).toBe(true);
  expect(isMentionResidue(`${base} @海边 图 `, base)).toBe(true);
  expect(isMentionResidue(`${base}再亮一点`, base)).toBe(false);
  expect(isMentionResidue(`${base} @a @b`, base)).toBe(false);
  expect(isMentionResidue('改过的', base)).toBe(false);
  expect(isMentionResidue(`${base} @`, undefined)).toBe(false);
  expect(starterClause(' 一句话。。 ')).toBe('一句话');
});
