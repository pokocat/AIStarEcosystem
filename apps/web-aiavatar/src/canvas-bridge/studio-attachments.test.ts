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
  const huge={name:'大图.png',size:51*1024*1024} as File;
  await expect(readAssistantAttachment(huge,[],story,media)).rejects.toThrow('50 MB');
  await expect(readAssistantAttachment({name:'文件.exe',size:1} as File,[],story,media)).rejects.toThrow('不支持');
  expect(media).not.toHaveBeenCalled();expect(story).not.toHaveBeenCalled();
});
test('视频节点铺满: an imported video with a known size lands in its clip shape, without one in the default box',async()=>{
  const portrait=attachmentNode({kind:'video',url:'/v.mp4',storageKey:'own/v.mp4',title:'竖屏',width:720,height:1280},[]);
  expect(portrait).toMatchObject({width:360,height:674});
  const wide=attachmentNode({kind:'video',url:'/w.mp4',storageKey:'own/w.mp4',title:'横屏',width:1920,height:1080},[]);
  expect(wide).toMatchObject({width:360,height:Math.round(358*1080/1920+38)});
  expect(attachmentNode({kind:'video',url:'/u.mp4',storageKey:'own/u.mp4',title:'未知'},[])).toMatchObject({width:360,height:270});
  const file=new File([new Uint8Array(4)],'clip.mp4',{type:'video/mp4'});
  const node=await readAssistantAttachment(file,[],vi.fn(),vi.fn().mockResolvedValue({mediaType:'video',key:'own/c.mp4',url:'/c.mp4',fileName:'clip.mp4',mimeType:'video/mp4',bytes:4,width:1080,height:1920,durationSec:5}));
  expect(node).toMatchObject({width:360,height:674,metadata:{naturalWidth:1080,naturalHeight:1920,origin:'upload'}});
});
