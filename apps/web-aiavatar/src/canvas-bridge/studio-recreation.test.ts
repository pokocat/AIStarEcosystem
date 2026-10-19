import { describe,test,expect } from 'vitest';
import { recreationNode,recreationSource,recreationText } from './studio-recreation';
import { applyStudioRun,applyStudioRunToDocument } from './studio-nodes';
import { studioNodeCommand } from '@/ip/studio-node-command';
import type { CanvasNodeData } from '@/canvas/types/canvas';
import type { IpRun } from '@ai-star-eco/types';
import type { StudioRecreationReport } from '@ai-star-eco/types/ip-studio-workflow';
const video:CanvasNodeData={id:'v',type:'video' as never,title:'参考恐龙',position:{x:0,y:0},width:320,height:200,metadata:{storageKey:'original.mp4',content:'/signed-old',status:'success'}};
const report:StudioRecreationReport={title:'拆解',creativePremise:'恐龙对抗',visualGenes:[],skeleton:[],techniques:[],motifs:['雨'],retain:['体型对比'],uncertainties:['无音轨'],recreationPrompt:'雨夜对峙',source:{nodeId:'v',title:'恐龙',storageKey:'original.mp4',durationSec:17,frameTimes:[0,1,16.9],audioAnalyzed:false}};
describe('recreation source and report lineage',()=>{
 test('report is a distinct node with a precise source snapshot and business command',()=>{
  const node=recreationNode(video);expect(node.id).not.toBe(video.id);expect(node.type).toBe('text');expect(studioNodeCommand(node)).toBe('recreation');
  expect(node.metadata?.studio?.recreation?.sourceStorageKey).toBe('original.mp4');expect(recreationSource(node,[video])).toBe(video);
  expect(recreationSource(node,[{...video,metadata:{...video.metadata,storageKey:'replacement'}}])).toBeUndefined();
 });
 test('persisted report comes from the run, reapplying does not replace it or mutate video',()=>{
  const node=recreationNode(video);const run={id:'r',kind:'studio-recreation',status:'done',output:{recreation:report,text:'完整报告'}} as unknown as IpRun;
  const result=applyStudioRun(node,run);expect(result.metadata?.studio?.recreation?.report).toEqual(report);expect(result.metadata?.content).toBe('完整报告');
  expect(applyStudioRun(result,run)).toEqual(result);expect(video.metadata?.content).toBe('/signed-old');
 });
 test('starting creation carries the extracted report without claiming another generation',()=>{
  const text=recreationText(report);expect(text).toContain('雨夜对峙');expect(text).toContain('体型对比');expect(text).toContain('恐龙对抗');
 });
});


test('analysis creates one canvas document group and reusable image nodes without duplicating on reload',()=>{
 const node=recreationNode(video);const completed={...report,references:[{storageKey:'frame.jpg',url:'/frame.jpg',frame:2,timeSec:1,width:640,height:360}]};
 const run={id:'analysis',nodeId:node.id,kind:'studio-recreation',status:'done',output:{recreation:completed,text:'完整拆解'}} as unknown as IpRun;
 const result=applyStudioRunToDocument([video,node],[],node.id,run);
 expect(result.filter(n=>n.type==='group')).toHaveLength(1);expect(result.filter(n=>n.type==='image')).toHaveLength(1);
 const document=result.find(n=>n.id===node.id)!;expect(document.width).toBe(720);expect(document.metadata?.content).toBe('完整拆解');
 expect(result.find(n=>n.type==='image')?.metadata).toMatchObject({storageKey:'frame.jpg',content:'/frame.jpg',groupId:document.metadata?.groupId});
 expect(document.metadata?.studio?.recreation?.report?.references?.[0]).not.toHaveProperty('url');
 expect(applyStudioRunToDocument(result,[],node.id,run)).toEqual(result);
});
