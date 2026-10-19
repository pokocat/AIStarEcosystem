import { expect, test } from 'vitest';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import { studioNodeCommand } from './studio-node-command';
const node=(type:string,studio?:object)=>({id:'n',type,title:'n',position:{x:0,y:0},width:200,height:200,metadata:{studio}} as CanvasNodeData);
test.each(['assistant','batch','work'])('business %s overrides generic text and video routes',kind=>{
  for(const type of ['text','video'])for(const expanded of [false,true])expect(studioNodeCommand(node(type,{kind}),expanded)).toBe(kind);
});
test.each([['image','image'],['video','video'],['audio','speech'],['text','edit-text'],['group',undefined]])('ordinary %s keeps its own editor', (type,action)=>expect(studioNodeCommand(node(type!))).toBe(action));
test('completed scripts preview on click and expand only explicitly',()=>{
  const script=node('text',{kind:'script',script:{}});
  expect(studioNodeCommand(script)).toBe('script-preview');expect(studioNodeCommand(script,true)).toBe('editor');
  expect(studioNodeCommand(node('text',{kind:'script'}))).toBe('editor');
});
