import { expect, test } from 'vitest';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { studioMissingVideoMention, studioVideoMentionSource, studioVideoPromptReferences as refs, rebindStudioVideoMentions as rebind } from './studio-video-references';
const nodes=['image','video','audio','image'].map((type,index)=>({id:String(index),type,title:`asset${index}`,metadata:{storageKey:`key${index}`}} as CanvasNodeData));
test('ordered inputs number each media type separately and ignore unavailable inputs',()=>{
  expect(refs(nodes,['3','1','0','2','missing']).map(r=>[r.nodeId,r.label])).toEqual([['3','@图1'],['1','@视频1'],['0','@图2'],['2','@音频1']]);
});
test('swap rewrites mentions simultaneously, preserving the asset rather than its old number',()=>{
  expect(rebind('@图1 看向 @图2。@视频1',refs(nodes,['0','3','1']),refs(nodes,['3','0','1']))).toBe('@图2 看向 @图1。@视频1');
});
test('removed reference never silently points at the next asset, including two digit numbering',()=>{
  expect(rebind('@图1 看向 @图2，@图10',refs(nodes,['0','3']),refs(nodes,['3']))).toBe('[已移除参考：asset0] 看向 @图1，@图10');
});

test('only a known original can fill an unbound video1 mention', () => {
  const original = { ...nodes[1], metadata: { ...nodes[1].metadata, origin: 'upload' as const } };
  const other = { ...original, id: 'other', metadata: { ...original.metadata, storageKey: 'other.mp4' } };
  const result = { ...nodes[1], id: 'generated', metadata: { storageKey: 'generated.mp4' } };
  expect(studioVideoMentionSource('参考@视频1', 0, 'generated', [original, other, result], 'key1')).toBe(original);
  expect(studioVideoMentionSource('参考＠视频 1', 0, 'generated', [original, result], undefined)).toBe(original);
  expect(studioVideoMentionSource('参考@视频1', 0, 'generated', [original, other], undefined)).toBeUndefined();
  expect(studioVideoMentionSource('参考@视频1', 0, 'generated', [original], null)).toBeUndefined();
  expect(studioVideoMentionSource('参考@视频1', 1, 'generated', [original], 'key1')).toBeUndefined();
  expect(studioVideoMentionSource('参考@视频1和@视频2', 0, 'generated', [original], 'key1')).toBeUndefined();
  expect(studioMissingVideoMention('参考视频1和 @视频10', 1)).toBe('@视频10');
});
