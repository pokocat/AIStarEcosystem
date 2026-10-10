import { describe, it, expect } from 'vitest';
import { CanvasNodeType, type CanvasNodeData } from '@/canvas/types/canvas';
import { changeFlowNodes, copyFlowSelection, flowNodes, changeFlowEdges, arrangeFlowNodes,placeStudioNode } from './flow-document';
const image: CanvasNodeData = { id:'image', type:CanvasNodeType.Image, title:'角色', position:{x:20,y:40}, width:320,height:400,
  metadata:{storageKey:'owned/image.png',content:'signed-url',studio:{kind:'shot',runId:'done-run',request:{clientRequestId:'accepted',nodeId:'image',operation:'image',prompt:'角色',references:[]}}} };
describe('React Flow document bridge',()=>{
  it.each([undefined,'known-revision'])('cannot duplicate an active script edit regardless of whether its run ID is known: %s',runId=>{
    const script={...image,id:'script',type:CanvasNodeType.Text,metadata:{status:'success' as const,studio:{kind:'script' as const,scriptEditor:{draft:'# 草稿',turns:[],pending:{request:{nodeId:'script',clientRequestId:'one-paid-key',operation:'assistant' as const,prompt:'改稿'},baseMarkdown:'# 草稿',runId}}}}};
    expect(copyFlowSelection([script],[],new Set(['script'])).nodes).toEqual([]);
  });
  it('a copied finished script keeps its text but never its source revision proposal identity',()=>{
    const source={...image,id:'script',type:CanvasNodeType.Text,metadata:{studio:{kind:'script' as const,scriptEditor:{draft:'# 已编辑',turns:[],proposal:{markdown:'# 建议',baseMarkdown:'# 已编辑',summary:'建议',runId:'source-revision'}}}}};
    const [copied]=copyFlowSelection([source],[],new Set(['script'])).nodes;
    expect(copied.metadata?.studio?.scriptEditor?.draft).toBe('# 已编辑');expect(copied.metadata?.studio?.scriptEditor?.proposal).toBeUndefined();expect(source.metadata.studio.scriptEditor.proposal.runId).toBe('source-revision');
  });
  it('places an automatic addition beyond occupied cards while preserving existing layout, metadata and a free position',()=>{
    const second={...image,id:'second',position:{x:400,y:40}};
    const added={...image,id:'added'};const placed=placeStudioNode(added,[image,second]);
    expect(placed.position.x).toBeGreaterThanOrEqual(second.position.x+second.width+48);
    expect(placed.position.y).toBe(added.position.y);expect(placed.metadata).toBe(added.metadata);
    expect(image.position).toEqual({x:20,y:40});expect(second.position).toEqual({x:400,y:40});
    const free={...added,position:{x:20,y:900}};expect(placeStudioNode(free,[image,second])).toBe(free);
  });
  it('moves a node without rewriting media, task identity, or other node data',()=>{
    const [moved]=changeFlowNodes([image],[{type:'position',id:'image',position:{x:120,y:80},dragging:true}]);
    expect(moved.position).toEqual({x:120,y:80}); expect(moved.metadata).toBe(image.metadata);expect(image.position.x).toBe(20);
  });
  it('does not persist measured dimensions unless this is an explicit resize',()=>{
    expect(changeFlowNodes([image],[{type:'dimensions',id:'image',dimensions:{width:10,height:10}}])[0]).toBe(image);
    expect(changeFlowNodes([image],[{type:'dimensions',id:'image',dimensions:{width:480,height:600},setAttributes:true}])[0].width).toBe(480);
  });
  it('selection lives in the interaction projection, never in the saved document',()=>{
    expect(flowNodes([image],new Set(['image']))[0].selected).toBe(true);expect(image).not.toHaveProperty('selected');
  });
  it('copies media and internal connections but never reclaims the accepted task',()=>{
    const child={...image,id:'child',metadata:{...image.metadata,studio:{...image.metadata!.studio!,parentNodeId:'image'}}};
    const result=copyFlowSelection([image,child],[{id:'edge',fromNodeId:'image',toNodeId:'child'}],new Set(['image','child']));
    expect(result.nodes[0].metadata?.storageKey).toBe('owned/image.png'); expect(result.nodes[0].metadata?.studio?.request).toBeUndefined();
    expect(result.nodes[0].metadata?.studio?.runId).toBeUndefined();expect(result.nodes[1].metadata?.studio?.parentNodeId).toBe(result.nodes[0].id);
    expect(result.connections[0].fromNodeId).toBe(result.nodes[0].id);expect(image.metadata?.studio?.runId).toBe('done-run');
  });
  it('a copied template result is a free draft and no longer controls the source execution step',()=>{
    const source={...image,metadata:{...image.metadata,templateStepId:'main',studio:{...image.metadata!.studio!,templateAccepted:true}}};
    const [draft]=copyFlowSelection([source],[],new Set(['image'])).nodes;
    expect(draft.metadata?.templateStepId).toBeUndefined();expect(draft.metadata?.studio?.templateAccepted).toBeUndefined();
    expect(draft.metadata?.storageKey).toBe('owned/image.png');expect(source.metadata.templateStepId).toBe('main');
  });
  it('copying a single generator retains existing upstream references, but never creates dangling cross-canvas edges',()=>{
    const source={...image,id:'reference'},target={...image,id:'generator'};
    const edge={id:'ref-edge',fromNodeId:'reference',toNodeId:'generator'};
    const same=copyFlowSelection([source,target],[edge],new Set(['generator']));
    expect(same.connections[0]).toMatchObject({fromNodeId:'reference',toNodeId:same.nodes[0].id});
    expect(copyFlowSelection([source,target],[edge],new Set(['generator']),new Set()).connections).toEqual([]);
  });
  it('protects accepted active work from deletion or copying',()=>{
    const active={...image,metadata:{...image.metadata,status:'loading' as const}};
    expect(changeFlowNodes([active],[{type:'remove',id:'image'}])).toEqual([active]);
    expect(copyFlowSelection([active],[],new Set(['image'])).nodes).toEqual([]);
  });
  it('removes only requested connections',()=>{
    const edges=[{id:'one',fromNodeId:'a',toNodeId:'b'},{id:'two',fromNodeId:'a',toNodeId:'c'}];
    expect(changeFlowEdges(edges,[{type:'remove',id:'one'}])).toEqual([edges[1]]);
  });
  it('moves group members exactly once and keeps their absolute document positions',()=>{
    const frame={...image,id:'frame',type:CanvasNodeType.Group,position:{x:0,y:0},metadata:{}};
    const member={...image,metadata:{...image.metadata,groupId:'frame'}};
    const moved=changeFlowNodes([frame,member],[{type:'position',id:'frame',position:{x:100,y:200}}]);
    expect(moved[1].position).toEqual({x:120,y:240});expect(moved[1].metadata).toBe(member.metadata);
    const multi=changeFlowNodes([frame,member],[{type:'position',id:'frame',position:{x:100,y:200}},{type:'position',id:'image',position:{x:120,y:240}}]);
    expect(multi[1].position).toEqual({x:120,y:240});
  });
  it('duplicates a selected group with fresh membership and internal edges',()=>{
    const frame={...image,id:'frame',type:CanvasNodeType.Group,metadata:{}};
    const member={...image,metadata:{...image.metadata,groupId:'frame'}};
    const result=copyFlowSelection([frame,member],[{id:'edge',fromNodeId:'image',toNodeId:'frame'}],new Set(['frame']));
    expect(result.nodes).toHaveLength(2);expect(result.nodes[1].metadata?.groupId).toBe(result.nodes[0].id);
    expect(result.connections).toHaveLength(1);expect(result.nodes[1].metadata?.studio?.request).toBeUndefined();
  });
  it('arranges unequal node sizes without overlap and preserves group offsets and accepted metadata',()=>{
    const frame={...image,id:'frame',type:CanvasNodeType.Group,width:600,height:500,metadata:{}};
    const member={...image,metadata:{...image.metadata,groupId:'frame'}};
    const outside={...image,id:'other',position:{x:20,y:40}};
    const result=arrangeFlowNodes([outside,frame,member]);
    expect(result[1].position.x).toBeGreaterThanOrEqual(result[0].position.x+result[0].width+80);
    expect(result[2].position.x-result[1].position.x).toBe(member.position.x-frame.position.x);
    expect(result[2].metadata).toBe(member.metadata);expect(result[0].metadata?.studio?.request).toEqual(image.metadata?.studio?.request);
  });
});
