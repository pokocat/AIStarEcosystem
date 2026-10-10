import { expect, test } from 'vitest';
import { assistantContextIds, assistantMentionQuery, insertAssistantMention, readAssistantStory } from './studio-assistant-context';

test('mentions bind the active query without treating an email as a node reference', () => {
  expect(assistantMentionQuery('联系 hello@example.com', 20)).toBeUndefined();
  const text='请参考 @角色 做分镜';
  const query=assistantMentionQuery(text,7)!;
  expect(query).toEqual({start:4,end:7,query:'角色'});
  expect(insertAssistantMention(text,query,'角色 A')).toBe('请参考 @角色 A  做分镜');
  expect(assistantContextIds(['a','a',...Array.from({length:20},(_,i)=>String(i))])).toHaveLength(16);
});
const story=(name:string,content:string,size?:number)=>({name,size:size??new TextEncoder().encode(content).length,arrayBuffer:async()=>new TextEncoder().encode(content).buffer} as File);
test('a UTF-8 story is editable canvas text placed beyond current nodes',async()=>{
  const node=await readAssistantStory(story('故事.md','\uFEFF# 故事\n角色走进森林。'),[{position:{x:100,y:120},width:320} as any]);
  expect(node.title).toBe('故事');expect(node.metadata?.content).toBe('# 故事\n角色走进森林。');expect(node.type).toBe('text');expect(node.position.x).toBe(500);
});
test('unsupported, oversized, binary, empty and overlong attachments never create placeholders',async()=>{
  await expect(readAssistantStory(story('故事.exe','文字'),[])).rejects.toThrow('TXT');
  await expect(readAssistantStory(story('故事.txt','文字',300000),[])).rejects.toThrow('256 KB');
  await expect(readAssistantStory(story('故事.txt','\0二进制'),[])).rejects.toThrow('可用的文字');
  await expect(readAssistantStory(story('故事.txt',' '),[])).rejects.toThrow('可用的文字');
  await expect(readAssistantStory(story('故事.txt','字'.repeat(24001)),[])).rejects.toThrow('24000');
  await expect(readAssistantStory({name:'坏编码.txt',size:2,arrayBuffer:async()=>new Uint8Array([255,255]).buffer} as File,[])).rejects.toThrow('UTF-8');
});

test('PDF and both Word formats use the authenticated extractor and preserve editable text',async()=>{
  for(const format of ['pdf','doc','docx']){
    const file=story(`原作.${format}`,'binary');let seen:File|undefined;
    const node=await readAssistantStory(file,[],async upload=>{seen=upload;return {text:'第一场\n角色在森林相遇。'};});
    expect(seen).toBe(file);expect(node.title).toBe('原作');expect(node.metadata?.content).toBe('第一场\n角色在森林相遇。');
  }
});
test('document failures and oversized documents never become text placeholders',async()=>{
  await expect(readAssistantStory(story('故事.pdf','bytes',8*1024*1024+1),[],async()=>({text:'文字'}))).rejects.toThrow('8 MB');
  await expect(readAssistantStory(story('故事.docx','bytes'),[],async()=>{throw new Error('文件受密码保护');})).rejects.toThrow('密码');
  await expect(readAssistantStory(story('故事.pdf','bytes'),[],async()=>({text:''}))).rejects.toThrow('可用的文字');
  await expect(readAssistantStory(story('故事.doc','bytes'),[],async()=>({text:'字'.repeat(24001)}))).rejects.toThrow('24000');
});
