import { expect, test } from 'vitest';
import { applyScriptProposal, markdownToScript, scriptFramework, scriptMarkdownError, scriptToMarkdown } from './studio-script-markdown';
const original={title:'雨夜',outline:'一次相遇改变两个人。',characters:[{name:'林',description:'喜欢画画\n**目标**：找到家人。'}],scenes:[{name:'车站',description:'夜晚\n潮湿的霓虹。'}],props:[],episodes:[{no:1,title:'相遇',content:'#### 场次 1\n\n**林**：你在等谁？'},{no:3,title:'离开',content:'其他集保留。'}],shots:[{id:'s1',title:'车站',description:'远景',dialogue:'你好',durationSec:5,characters:['林'],episodeNo:1}]};
test('legacy scripts round trip into the five-section document without dropping episodes, formatting or shots',()=>{
 const markdown=scriptToMarkdown(original);expect(scriptMarkdownError(markdown)).toBeUndefined();expect(markdownToScript(markdown,original)).toEqual(original);
});
test('new framework is immediately editable and projects downstream scene, character and episode scaffolds',()=>{
 const markdown=scriptFramework('新故事');expect(scriptMarkdownError(markdown)).toBeUndefined();const script=markdownToScript(markdown);expect(script.title).toBe('新故事');expect(script.episodes[0].content).toContain('**对白**');expect(script.characters[0].name).toBe('主角');
});
test('fenced Markdown examples never become a section or episode',()=>{
 const markdown=scriptFramework().replace('核心冲突：','核心冲突：\n\n```md\n## 人物小传\n### 第 9 集 · 示例\n```');expect(scriptMarkdownError(markdown)).toBeUndefined();expect(markdownToScript(markdown).episodes).toHaveLength(1);expect(markdownToScript(markdown).outline).toContain('第 9 集');
});
test('missing and duplicate sections, duplicate or invalid episode numbers, and oversized revisions cannot be adopted',()=>{
 const markdown=scriptFramework();expect(scriptMarkdownError(markdown.replace('## 人物小传','## 自定义人物'))).toContain('人物小传');expect(scriptMarkdownError(markdown+'\n## 人物小传')).toContain('重复');expect(scriptMarkdownError(markdown+'\n### 第 1 集 · 又一集')).toContain('唯一');expect(scriptMarkdownError(markdown.replace('第 1 集','第 51 集'))).toContain('1–50');expect(scriptMarkdownError(markdown+'x'.repeat(48000))).toContain('48,000');
});
test('unheaded asset descriptions are preserved in the downstream projection',()=>{
 const markdown=scriptFramework().replace('## 人物小传\n\n','## 人物小传\n\n人物都来自同一个小镇。\n\n');expect(markdownToScript(markdown).characters[0]).toEqual({name:'人物小传补充',description:'人物都来自同一个小镇。'});
});
test('an AI proposal requires the exact base document; intervening manual edits remain untouched',()=>{
 const base=scriptFramework(),proposal={baseMarkdown:base,markdown:base.replace('核心冲突：','核心冲突：失去钥匙。')};expect(applyScriptProposal(base,proposal)).toEqual({markdown:proposal.markdown});expect(applyScriptProposal(base+'手动补充。',proposal).error).toContain('正文已修改');
});
test('formatted headings preserve semantic identities and escaped literal punctuation without rewriting the document',()=>{
 const markdown=scriptFramework('雨夜 \\*特别篇\\* \\#').replace('## 故事大纲','## **故事大纲**').replace('## 分集剧本','## ++分集剧本++').replace('### 主角','### **林 \\*A\\***').replace('### 第 1 集 · 开场','### ~~第 1 集 · 开场~~');
 expect(scriptMarkdownError(markdown)).toBeUndefined();
 const script=markdownToScript(markdown);expect(script.title).toBe('雨夜 *特别篇* #');expect(script.characters[0].name).toBe('林 *A*');expect(script.episodes[0]).toMatchObject({no:1,title:'开场'});
 expect(markdownToScript(markdown+'\n### **第 1 集 · 重复**').episodes).toHaveLength(2);expect(scriptMarkdownError(markdown+'\n### **第 1 集 · 重复**')).toContain('唯一');
 expect(markdown).toContain('## **故事大纲**');expect(script.episodes[0].content).toContain('**对白**');
});
