import { describe, it, expect } from 'vitest';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';
import { createStudioLinkedNode, studioLinkedInputError, studioLinkedNodes, withStudioLinkedText } from './studio-linked-inputs';
const source:CanvasNodeData={id:'source',type:CanvasNodeType.Image,title:'人物',width:320,height:400,position:{x:100,y:100},metadata:{storageKey:'owned.png',studio:{kind:'shot',runId:'source-task'}}};
describe('linked canvas creation and inputs',()=>{
  it.each([CanvasNodeType.Text,CanvasNodeType.Image,CanvasNodeType.Video])('creates a fresh %s draft near the dropped line without copying accepted task identity',type=>{
    const result=createStudioLinkedNode(source.id,type as CanvasNodeType.Text|CanvasNodeType.Image|CanvasNodeType.Video,{x:600,y:100},[source])!;
    expect(result.node.type).toBe(type);expect(result.node.position).toEqual({x:600,y:100});
    expect(result.node.metadata?.studio?.runId).toBeUndefined();expect(result.node.metadata?.studio?.request).toBeUndefined();expect(result.node.metadata?.storageKey).toBeUndefined();
    expect(source.metadata?.studio?.runId).toBe('source-task');
  });
  it('does not create an orphan if the source disappears while choosing a node type',()=>expect(createStudioLinkedNode('deleted',CanvasNodeType.Video,{x:600,y:100},[source])).toBeUndefined());
  it('uses the latest rich document, deduplicates sources and stops using a disconnected text',()=>{
    const text={...source,id:'story',type:CanvasNodeType.Text,metadata:{content:'过时正文',studio:{kind:'script' as const,scriptEditor:{draft:'# 最新雨夜故事',turns:[]}}}};
    const nodes=[source,text],edges=[{id:'one',fromNodeId:'story',toNodeId:'video'},{id:'two',fromNodeId:'story',toNodeId:'video'}];
    expect(withStudioLinkedText('推进镜头','video',nodes,edges)).toBe('推进镜头\n\n【引用文本：人物】\n# 最新雨夜故事');
    expect(withStudioLinkedText('推进镜头','video',nodes,[])).toBe('推进镜头');
    expect(withStudioLinkedText('改编','video',nodes,edges,'story')).toBe('改编');
  });
  it('expands the resources of a linked group without duplicating a separately linked member',()=>{
    const group={...source,id:'group',type:CanvasNodeType.Group},member={...source,metadata:{...source.metadata,groupId:'group'}};
    expect(studioLinkedNodes('video',[group,member],[{id:'group-edge',fromNodeId:'group',toNodeId:'video'},{id:'member-edge',fromNodeId:'source',toNodeId:'video'}])).toEqual([member]);
  });
});

it('checks missing template inputs only on the connected generation, and reads current text',()=>{
  const image={...source,metadata:{studio:{kind:'shot' as const,templateInput:{required:true,label:'商品参考'}}}};
  const text={...source,id:'brief',type:CanvasNodeType.Text,metadata:{studio:{kind:'script' as const,templateInput:{required:true,label:'创作要求'},scriptEditor:{draft:'',turns:[]}}}};
  const edges=[{id:'i',fromNodeId:image.id,toNodeId:'target'},{id:'t',fromNodeId:text.id,toNodeId:'target'}];
  expect(studioLinkedInputError('target',[image,text],edges)).toBe('请先为「商品参考」添加或生成图片');
  image.metadata={...image.metadata,storageKey:'my-product'} as any;
  expect(studioLinkedInputError('target',[image,text],edges)).toBe('请先填写「创作要求」');
  text.metadata.studio.scriptEditor.draft='新的商品卖点';
  expect(studioLinkedInputError('target',[image,text],edges)).toBeUndefined();
  expect(withStudioLinkedText('展示商品','target',[image,text],edges)).toContain('新的商品卖点');
  expect(studioLinkedInputError('target',[image,text],[])).toBeUndefined();
});
