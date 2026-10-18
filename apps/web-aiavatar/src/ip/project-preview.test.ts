import { describe, it, expect } from 'vitest';
import type { IpProjectDoc, IpNode } from '@ai-star-eco/types';
import { projectPreview } from './project-preview';
const node = (type: string, metadata: IpNode['metadata'] = {}): IpNode => ({ id:type, type, title:type, metadata, position:{x:0,y:0}, width:200,height:200 });
const doc = (...nodes: IpNode[]): IpProjectDoc => ({ nodes, connections:[],viewport:{x:0,y:0,k:1} });
describe('project preview', () => {
  it('deduplicates images and prefers the explicitly selected take', () => {
    const result = projectPreview(doc(node('image', {storageKey:'a',url:'/a',primaryImageId:'b',images:[{id:'a',storageKey:'a',content:'/a'},{id:'b',storageKey:'b',content:'/b'}]})));
    expect(result.images.map(i=>i.key)).toEqual(['b','a']); expect(result.counts).toBe('2 张图片');
  });
  it('shows edited text and scripts as readable text without rendering markup', () => {
    expect(projectPreview(doc(node('text',{content:'# 春天\n**小林**走进花店。'}))).excerpt).toBe('春天 小林走进花店。');
    expect(projectPreview(doc(node('text',{studio:{script:{episodes:[{content:'真实剧本正文'}]}}}))).excerpt).toBe('真实剧本正文');
  });
  it('does not count pending workflow nodes as finished works', () => {
    const result = projectPreview(doc(node('image'),node('video',{videos:[{status:'loading'},{status:'error',storageKey:'bad'}]})));
    expect(result.counts).toBe(''); expect(result.steps).toHaveLength(2); expect(result.empty).toBe(false);
  });
  it('counts unique media and only uses actual positive duration', () => {
    const result = projectPreview(doc(node('video',{storageKey:'v',seconds:'12.5',videos:[{storageKey:'v',status:'success'}]}),node('audio',{storageKey:'a'})));
    expect(result.counts).toBe('1 段视频 · 1 段音频'); expect(result.duration).toBe(12.5);
    expect(projectPreview(doc()).empty).toBe(true);
  });
});
