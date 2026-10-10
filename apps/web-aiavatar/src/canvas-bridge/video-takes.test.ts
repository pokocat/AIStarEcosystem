import { describe, expect, it } from 'vitest';
import { CanvasNodeType,type CanvasNodeData,type CanvasNodeVideoTake } from '@/canvas/types/canvas';
import { adoptStudioTake,canDeleteStudioVideoTake,deleteStudioVideoTake,nextStudioVideoTake,prepareStudioVideoRegeneration,applyStudioRun,studioGenerationPending } from './studio-nodes';
import type { IpRun } from '@ai-star-eco/types';
const takes:CanvasNodeVideoTake[]=[{id:'pending',status:'loading'},{id:'bad',status:'error',storageKey:'failed.mp4'},{id:'third',status:'success',storageKey:'third.mp4',content:'/third.mp4'},{id:'fourth',status:'success',storageKey:'fourth.mp4',content:'/fourth.mp4'}];
const node:CanvasNodeData={id:'v',type:CanvasNodeType.Video,title:'video',position:{x:0,y:0},width:320,height:400,metadata:{status:'success',storageKey:'fourth.mp4',content:'/fourth.mp4',primaryVideoId:'fourth',videos:takes,studio:{kind:'shot',episodeNo:2,order:3,includeInWork:false,references:[{storageKey:'character',role:'character'}]}}};
const child={...node,id:'child',metadata:{studio:{kind:'work' as const,parentNodeId:'v'}}};
describe('mixed native video candidates',()=>{
 it('wraps only through successful keyed takes and reaches nonadjacent successes',()=>{
  const mixed=[takes[2],takes[0],takes[3],takes[1],{id:'no-key',status:'success' as const}];
  expect(nextStudioVideoTake(mixed,'third',1)?.id).toBe('fourth');expect(nextStudioVideoTake(mixed,'third',-1)?.id).toBe('fourth');expect(nextStudioVideoTake(mixed,'fourth',1)?.id).toBe('third');
 });
 it('disables navigation when there is only one playable take',()=>expect(nextStudioVideoTake([takes[0],takes[1],takes[3]],'fourth',1)).toBeUndefined());
 it('adoption rejects pending and failed media, including failed slots carrying a key',()=>{
  const nodes=[node,child];expect(adoptStudioTake(nodes,'v','pending')).toBe(nodes);expect(adoptStudioTake(nodes,'v','bad')).toBe(nodes);expect(adoptStudioTake(nodes,'v','fourth')).toBe(nodes);
 });
 it('both adoption entry points update the selected key and invalidate downstream inputs',()=>{
  const result=adoptStudioTake([node,child],'v','third');expect(result[0].metadata).toMatchObject({storageKey:'third.mp4',primaryVideoId:'third'});expect(result[1].metadata?.studio?.upstreamChanged).toBe(true);
 });
 it('deleting adoption falls back to success and retains media rather than adopting a leading empty slot',()=>{
  const result=deleteStudioVideoTake([node,child],'v','fourth');expect(result[0].metadata).toMatchObject({primaryVideoId:'third',storageKey:'third.mp4',content:'/third.mp4'});expect(result[0].metadata?.videos?.map(t=>t.id)).toEqual(['pending','bad','third']);expect(result[1].metadata?.studio?.upstreamChanged).toBe(true);
 });
 it('the last playable adoption cannot be deleted even when failed and pending slots remain',()=>{
  const last={...node,metadata:{...node.metadata,videos:[takes[0],takes[1],takes[3]]}};const nodes=[last];expect(canDeleteStudioVideoTake(last,'fourth')).toBe(false);expect(deleteStudioVideoTake(nodes,'v','fourth')).toBe(nodes);
 });
 it('deleting a non-adopted slot retains the selected media and downstream state',()=>{
  const result=deleteStudioVideoTake([node,child],'v','bad');expect(result[0].metadata?.primaryVideoId).toBe('fourth');expect(result[1]).toBe(child);
 });
});
describe('native regeneration and persisted submit state',()=>{
 it.each(['running','done','failed'] as const)('preserves adoption and Studio context across a %s replacement batch',status=>{
  const pending=prepareStudioVideoRegeneration(node,{status:'loading',prompt:'new prompt',videoCount:'4'},takes);
  const request={clientRequestId:'same-key',nodeId:'v',operation:'video' as const,prompt:'new prompt',count:4,maxCost:1280};
  pending.metadata!.studio={...pending.metadata!.studio!,request,runId:undefined};
  const run:IpRun={id:'batch',projectId:'p',nodeId:'v',kind:'studio-video',status,stage:'',pct:0,cost:0,inputs:{},output:{videoCandidates:[{index:0,jobId:'job',status:status==='done'?'done':status==='failed'?'failed':'running',pct:0,durationSec:8,...(status==='done'?{storageKey:'new.mp4',url:'/new.mp4'}:{})}]},createdAt:''};
  const updated=applyStudioRun(pending,run);expect(updated.metadata).toMatchObject({storageKey:'fourth.mp4',primaryVideoId:'fourth',content:'/fourth.mp4'});expect(updated.metadata?.studio).toMatchObject({episodeNo:2,order:3,includeInWork:false,references:[{storageKey:'character',role:'character'}],request});expect(updated.metadata?.videos).toHaveLength(5);
 });
 it('unknown and known active requests remain blocked after serialization; terminal failure reopens normal generation',()=>{
  const pending={...node,metadata:{...node.metadata,status:'loading' as const,studio:{...node.metadata!.studio!,request:{clientRequestId:'original',nodeId:'v',operation:'video' as const,prompt:'saved'}}}};
  expect(studioGenerationPending(JSON.parse(JSON.stringify(pending)))).toBe(true);expect(studioGenerationPending({...pending,metadata:{...pending.metadata,studio:{...pending.metadata.studio,runId:'accepted'}}})).toBe(true);expect(studioGenerationPending({...pending,metadata:{...pending.metadata,status:'error'}})).toBe(false);
 });
});
