import {expect,test} from 'vitest';
import type {IpRun} from '@ai-star-eco/types';
import {CanvasNodeType,type CanvasNodeData} from '@/canvas/types/canvas';
import {applyStudioRunToDocument} from './studio-nodes';
import {filmStudyConnections} from './studio-film-study';
const node:CanvasNodeData={id:'analysis',type:CanvasNodeType.Text,title:'拉片',position:{x:500,y:100},width:720,height:320,metadata:{status:'loading',studio:{kind:'recreation',recreation:{mode:'segments',sourceNodeId:'v',sourceStorageKey:'original',sourceTitle:'恐龙'}}}};
const run={id:'r',kind:'studio-recreation',status:'running',nodeId:'analysis',stage:'film.analyze',pct:50,inputs:{operation:'recreation',mode:'segments'},output:{text:'# 视频拉片',filmStudy:{strategy:'model',source:{nodeId:'v',storageKey:'original',title:'恐龙',durationSec:3,frameTimes:[0,1,2],audioAnalyzed:false},segments:[{no:1,title:'片段1',startSec:0,endSec:1.2,status:'done',storageKey:'clip.mp4',url:'signed',coverUrl:'signed-cover',markdown:'# 片段1\n\n正文'},{no:2,title:'片段2',startSec:1.2,endSec:3,status:'pending'}]}}} as unknown as IpRun;
test('each completed segment materializes a real reusable video, Markdown document and source connections, once',()=>{
 const nodes=applyStudioRunToDocument([node],[],node.id,run);expect(nodes).toHaveLength(4);expect(nodes.find(n=>n.id==='analysis-segment-1-video')?.metadata).toMatchObject({storageKey:'clip.mp4',content:'signed',studio:{sourceRange:{startSec:0,endSec:1.2,storageKey:'original'}}});
 expect(JSON.stringify(nodes[0].metadata?.studio?.recreation?.study)).not.toContain('signed');
 const edited=nodes.map(n=>n.id==='analysis-segment-1-document'?{...n,metadata:{...n.metadata,content:'# 我编辑的正文'}}:n);
 expect(applyStudioRunToDocument(edited,[],node.id,run).find(n=>n.id==='analysis-segment-1-document')?.metadata?.content).toBe('# 我编辑的正文');
 const edges=filmStudyConnections([],node.id,run);expect(edges).toHaveLength(2);expect(filmStudyConnections(edges,node.id,run)).toHaveLength(2);
});
test('a later segment lands without duplicating previous outputs and user-deleted documents stay deleted',()=>{
 const first=applyStudioRunToDocument([node],[],node.id,run).filter(n=>n.id!=='analysis-segment-1-document');
 const final=structuredClone(run);final.status='done';Object.assign(final.output.filmStudy!.segments[1],{status:'done',storageKey:'second.mp4',url:'second-url',markdown:'# 第二段'});
 const nodes=applyStudioRunToDocument(first,[],node.id,final);expect(nodes).toHaveLength(6);expect(nodes.some(n=>n.id==='analysis-segment-1-document')).toBe(false);expect(nodes.some(n=>n.id==='analysis-segment-2-document')).toBe(true);
});

test('segment groups avoid existing full-film documents and retain one column',()=>{
 const occupied:CanvasNodeData={id:'full',type:CanvasNodeType.Text,title:'全片文档',position:{x:1300,y:100},width:720,height:1900};
 const final=structuredClone(run);final.status='done';Object.assign(final.output.filmStudy!.segments[1],{status:'done',storageKey:'second.mp4',markdown:'# 第二段'});
 const nodes=applyStudioRunToDocument([node,occupied],[],node.id,final),first=nodes.find(n=>n.id==='analysis-segment-1')!,second=nodes.find(n=>n.id==='analysis-segment-2')!;
 expect(first.position.x).toBeGreaterThanOrEqual(occupied.position.x+occupied.width);expect(second.position.x).toBe(first.position.x);
});
