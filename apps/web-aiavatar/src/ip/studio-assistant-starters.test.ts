// @vitest-environment node
// The sentence each opening card writes and what it still needs (docs/ip-studio-new-canvas-and-threads.md §5.2).
import { expect, test } from 'vitest';
import { STUDIO_STARTERS, composeStarter, isMentionResidue, starterClause, starterDefaults, starterSlotNodes, studioStarter } from './studio-assistant-starters';

const nodes = (...titles: string[]) => titles.map(title => ({ title }));

test('four cards, each naming what it makes, what it needs and the skill it sends', () => {
  expect(STUDIO_STARTERS.map(c => [c.title, c.gets, c.needs, c.skill])).toEqual([
    ['制作个人 IP', '真人照片变成数字形象，出多角度设定图', '1–3 张照片', 'image-generation'],
    ['写剧本', '一句梗概写成能拍的分场剧本', '一句梗概', 'script-writing'],
    ['做个短视频', '一句描述出视频，也可以从一张图动起来', '画面描述', 'video-generation'],
    ['复刻视频', '照爆款的节奏和镜头，换成你的商品或人物', '参考视频 + 你的素材', 'reference-video-recreation'],
  ]);
  expect(starterDefaults(studioStarter('ip'))).toEqual({ style: 'business', output: 'sheet', sceneRatio: '9:16' });
  expect(starterDefaults(studioStarter('script'))).toEqual({ type: '短剧', length: '60 秒', tone: '有反转' });
  expect(starterDefaults(studioStarter('video'))).toEqual({ ratio: '9:16', length: '5 秒', camera: '自动' });
  expect(starterDefaults(studioStarter('recreation'))).toEqual({ keep: 'shots' });
});

test('制作个人 IP: the defaults, the photos as @ tags, options and the photo limits', () => {
  expect(composeStarter('ip', {}).missing).toEqual([{ reason: '还差照片', kind: 'slot' }]);
  const prompt = composeStarter('ip', { slots: { photos: nodes('自拍') } });
  expect(prompt.missing).toEqual([]);
  expect(prompt.text).toContain('用 @自拍 制作个人 IP，出一张IP 全视角图鉴。画幅比例：3:4。');
  expect(prompt.text).toContain('严格保留参考图人物的面部五官特征');
  expect(prompt.text).toContain('避免出现：');
  expect(composeStarter('ip', { slots: { photos: nodes('自拍', '侧脸') }, options: { style: 'toy', output: 'avatar' } }).text)
    .toContain('用 @自拍、@侧脸 制作个人 IP，出一张胸像头像特写。画幅比例：1:1。风格：3D潮玩Q版风。');
  expect(composeStarter('ip', { slots: { photos: nodes('a') }, options: { style: 'toy', output: 'turnaround' } }).text)
    .toContain('出一张标准三视图。画幅比例：16:9。');
  expect(composeStarter('ip', { slots: { photos: nodes('a', 'b', 'c', 'd') } }).missing).toEqual([{ reason: '照片最多 3 张', kind: 'slot' }]);
  // A value the card does not offer falls back to the default.
  expect(composeStarter('ip', { slots: { photos: nodes('a') }, options: { style: '油画' } }).text).toContain('风格：超写实商务知性风。');
});

test('写剧本: no synopsis leaves no empty 「：」; the synopsis loses its own full stop; every option lands in the sentence', () => {
  expect(composeStarter('script', {})).toEqual({
    text: '写一个 60 秒的短剧剧本。有反转，分场写清画面、台词和时长。', missing: [{ reason: '先写一句梗概', kind: 'field' }] });
  expect(composeStarter('script', { fields: { synopsis: '  外卖员送错一单，意外救了老板的女儿。 ' } })).toEqual({
    text: '写一个 60 秒的短剧剧本：外卖员送错一单，意外救了老板的女儿。有反转，分场写清画面、台词和时长。', missing: [] });
  expect(composeStarter('script', { fields: { synopsis: '外卖员送错一单' }, options: { type: '微电影', length: '分 3 集', tone: '悬疑' } }).text)
    .toBe('写一个分 3 集的微电影剧本：外卖员送错一单。悬疑，分场写清画面、台词和时长。');
  expect(composeStarter('script', { fields: { synopsis: '   ' } }).missing).toEqual([{ reason: '先写一句梗概', kind: 'field' }]);
});

test('做个短视频: the first frame and a camera move only appear when chosen', () => {
  expect(composeStarter('video', {})).toEqual({ text: '做一条 5 秒、9:16 的短视频。', missing: [{ reason: '先写画面描述', kind: 'field' }] });
  expect(composeStarter('video', { fields: { description: '女孩在海边回头微笑，风吹起围巾' } })).toEqual({
    text: '做一条 5 秒、9:16 的短视频：女孩在海边回头微笑，风吹起围巾。', missing: [] });
  expect(composeStarter('video', { fields: { description: '女孩在海边回头微笑' }, slots: { frame: nodes('海边') }, options: { ratio: '16:9', length: '10 秒', camera: '环绕' } }).text)
    .toBe('做一条 10 秒、16:9 的短视频：女孩在海边回头微笑。从 @海边 开始动起来。镜头环绕。');
  expect(composeStarter('video', { fields: { description: 'x' }, options: { camera: '缓慢推近' } }).text).toBe('做一条 5 秒、9:16 的短视频：x。镜头缓慢推近。');
  // The first frame is optional, but only one.
  expect(composeStarter('video', { fields: { description: 'x' }, slots: { frame: nodes('a', 'b') } }).missing).toEqual([{ reason: '首帧图只要 1 张', kind: 'slot' }]);
});

test('复刻视频: both pieces of material are required; the selling point is optional and leaves nothing behind when empty', () => {
  expect(composeStarter('recreation', {})).toEqual({
    text: '照参考视频的拍法，把里面的商品或人物换成我的，保留节奏和镜头。',
    missing: [{ reason: '还差参考视频', kind: 'slot' }, { reason: '还差商品或人物图', kind: 'slot' }] });
  const material = { reference: nodes('带货样片'), subject: nodes('保温杯') };
  expect(composeStarter('recreation', { slots: material })).toEqual({ text: '照 @带货样片 的拍法，把里面的商品或人物换成 @保温杯，保留节奏和镜头。', missing: [] });
  expect(composeStarter('recreation', { slots: material, options: { keep: 'rhythm' }, fields: { points: '保温 12 小时，一键开盖。' } }).text)
    .toBe('照 @带货样片 的拍法，把里面的商品或人物换成 @保温杯，只保留节奏，口播改成介绍：保温 12 小时，一键开盖。');
  expect(composeStarter('recreation', { slots: material, options: { keep: 'voice' } }).text).toBe('照 @带货样片 的拍法，把里面的商品或人物换成 @保温杯，保留节奏、镜头和口播。');
  expect(composeStarter('recreation', { slots: { reference: nodes('a', 'b'), subject: nodes('1', '2', '3', '4') } }).missing.map(m => m.reason)).toEqual(['参考视频只要 1 条', '商品或人物图最多 3 张']);
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
