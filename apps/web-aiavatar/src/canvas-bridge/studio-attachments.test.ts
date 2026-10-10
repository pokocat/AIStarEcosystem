import { expect, test, vi } from 'vitest';
import { attachmentNode, savedAssetPayload, readAssistantAttachment } from './studio-attachments';
import type { IpSavedAsset } from '@ai-star-eco/types';
test('saved audio remains audio and reuse keeps the existing node identity',()=>{
  const asset={kind:'audio',title:'配音',data:{storageKey:'own/voice.wav',url:'/voice.wav',mimeType:'audio/wav'}} as IpSavedAsset;
  const payload=savedAssetPayload(asset),first=attachmentNode(payload,[]);
  expect(first.type).toBe('audio');expect(first.metadata).toMatchObject({storageKey:'own/voice.wav',content:'/voice.wav',mimeType:'audio/wav'});
  expect(attachmentNode(payload,[first])).toBe(first);
});
test('imports are positioned after earlier attachments instead of stacking',()=>{
  const a=attachmentNode({kind:'text',title:'第一章',content:'A'},[]),b=attachmentNode({kind:'text',title:'第二章',content:'B'},[a]);
  expect(b.position.x).toBeGreaterThan(a.position.x+a.width);
});
test('oversized media and unsupported files never call upload',async()=>{
  const media=vi.fn(),story=vi.fn();
  const huge={name:'大图.png',size:9*1024*1024} as File;
  await expect(readAssistantAttachment(huge,[],story,media)).rejects.toThrow('8 MB');
  await expect(readAssistantAttachment({name:'文件.exe',size:1} as File,[],story,media)).rejects.toThrow('不支持');
  expect(media).not.toHaveBeenCalled();expect(story).not.toHaveBeenCalled();
});
