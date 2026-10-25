// @vitest-environment node
import { expect, test } from 'vitest';
import { createHash } from 'node:crypto';
import { IP_NEGATIVE_PROMPTS, IP_PICTURE_TYPES, IP_PROMPT_STYLES, composePersonalIpPrompt } from './personal-ip-prompts';

test('all 30 uploaded bodies and both negative lists match the original document verbatim', () => {
  expect(IP_PROMPT_STYLES).toHaveLength(6);
  const bodies = IP_PROMPT_STYLES.flatMap(style => IP_PICTURE_TYPES.map(picture => style.prompts[picture.value]));
  expect(bodies).toHaveLength(30);
  // Digest captured directly from the uploaded document before importing it into the runtime data.
  const original = [...bodies, IP_NEGATIVE_PROMPTS.realistic, IP_NEGATIVE_PROMPTS.stylized].join('\n');
  expect(createHash('sha256').update(original).digest('hex')).toBe('f5b81a9bfffad935babf4ff4d05dc7965d0231d8056af6f594519d1c37a0c2c6');
});

const combinations = IP_PROMPT_STYLES.flatMap(style => IP_PICTURE_TYPES.map(picture => ({ style, picture })));
test.each(combinations)('$style.label / $picture.label keeps identity, the complete layout and one explicit output', ({ style, picture }) => {
  const prompt = composePersonalIpPrompt(['正脸照片', '侧脸照片'], { style: style.value, output: picture.value });
  expect(prompt).toContain(`用 @正脸照片、@侧脸照片 制作个人 IP，出一张${picture.label}。画幅比例：${picture.ratio}。`);
  expect(prompt).toContain(`风格：${style.label}`);
  expect(prompt).toContain('严格保留参考图人物的面部五官特征');
  expect(prompt).toContain(style.prompts[picture.value]);
  expect(prompt).toContain(`避免出现：${IP_NEGATIVE_PROMPTS[['business', 'chinese', 'forest'].includes(style.value) ? 'realistic' : 'stylized']}`);
  expect(prompt.length).toBeLessThan(4000);
  if (picture.value === 'sheet') {
    expect(prompt).toContain('上方60%');
    expect(prompt).toContain('下方40%');
    expect(prompt).toContain('4个1:1方形小图');
    expect(prompt).not.toContain('正视图、侧视图、后视图');
  }
  if (picture.value === 'turnaround') expect(prompt).toContain('正视图、侧视图、后视图');
  if (picture.value === 'actions') expect(prompt).toContain('3个不同');
});

test.each(IP_PROMPT_STYLES)('$label switches the entire scene prompt to landscape without affecting fixed picture ratios', style => {
  const prompt = composePersonalIpPrompt(['照片'], { style: style.value, output: 'scene', sceneRatio: '16:9' });
  expect(prompt).toContain('画幅比例：16:9');
  expect(prompt).toContain('16:9横版');
  expect(prompt).not.toContain('9:16');
  expect(composePersonalIpPrompt(['照片'], { style: style.value, output: 'avatar', sceneRatio: '16:9' })).toContain('画幅比例：1:1');
});
