import { expect,test } from 'vitest';
import { projectTemplateResults } from './template-projection';
import { CanvasNodeType,type CanvasNodeData } from '@/canvas/types/canvas';
import type { StudioTemplateExecution,IpRun } from '@ai-star-eco/types';

test('template queue polling replaces a changed position even when run and node status stay the same',()=>{
  const node:CanvasNodeData={id:'n',type:CanvasNodeType.Image,title:'queued',position:{x:0,y:0},width:300,height:400,metadata:{studio:{kind:'shot'}}};
  const run={id:'r',nodeId:'n',status:'running',stage:'endpoint.queued',pct:0,output:{},queue:{position:3,waiting:3,running:1,concurrencyLimit:1}} as IpRun;
  const state:StudioTemplateExecution={versionId:'v',version:1,complete:false,steps:[{id:'s',nodeId:'n',title:'queued',status:'running',requiresAdoption:false,accepted:false,run}]};
  const first=projectTemplateResults([node],state);
  const updated=projectTemplateResults(first,{...state,steps:[{...state.steps[0],run:{...run,queue:{...run.queue!,position:1,waiting:1}}}]});
  expect(updated[0].metadata?.studio?.task?.queue?.position).toBe(1);
  expect(first[0].metadata?.studio?.task?.queue?.position).toBe(3);
});

test('new upstream result retains original takes and clears adoption of the old identity',()=>{
  const node:CanvasNodeData={id:'n',type:CanvasNodeType.Image,title:'main',position:{x:0,y:0},width:300,height:400,metadata:{images:[{id:'old',storageKey:'old-key',content:'old-url',status:'success'}],storageKey:'old-key',studio:{kind:'ip',adoption:{avatarId:'old-person',ipId:'ip',version:1,storageKey:'old-key'}}}};
  const run={id:'new',nodeId:'n',status:'done',output:{candidates:[{key:'new-key',url:'new-url'}]}} as IpRun;
  const state:StudioTemplateExecution={versionId:'v1',version:1,complete:false,steps:[{id:'main',nodeId:'n',title:'main',outputRole:'main',status:'waiting_adoption',requiresAdoption:true,accepted:false,run,storageKey:'new-key'}]};
  const result=projectTemplateResults([node],state)[0];expect(result.metadata?.images).toHaveLength(2);expect(result.metadata?.storageKey).toBe('new-key');expect(result.metadata?.studio?.adoption).toBeUndefined();expect(node.metadata?.storageKey).toBe('old-key');
});

test('a restored sheet gains its role even when its run and selected image are already current',()=>{
  const node:CanvasNodeData={id:'sheet',type:CanvasNodeType.Image,title:'sheet',position:{x:0,y:0},width:300,height:400,metadata:{status:'success',storageKey:'sheet-key',studio:{kind:'ip',runId:'original-run',upstreamChanged:false}}};
  const run={id:'original-run',nodeId:'sheet',status:'done',output:{candidates:[{key:'sheet-key',url:'sheet-url'}]}} as IpRun;
  const execution:StudioTemplateExecution={versionId:'v',version:1,complete:false,steps:[{id:'sheet',nodeId:'sheet',title:'sheet',outputRole:'sheet',status:'waiting_adoption',requiresAdoption:true,accepted:false,run,storageKey:'sheet-key'}]};
  const projected=projectTemplateResults([node],execution)[0];
  expect(projected.metadata?.studio?.libraryAssetRole).toBe('sheet');
  expect(projected.metadata?.storageKey).toBe('sheet-key');
  expect(projected.metadata?.studio?.runId).toBe('original-run');
});

test('accepted video selection restores the chosen native candidate and retains the older take',()=>{
  const node:CanvasNodeData={id:'v',type:CanvasNodeType.Video,title:'video',position:{x:0,y:0},width:320,height:440,metadata:{videos:[{id:'old',storageKey:'old-video',content:'old-url',status:'success'}],studio:{kind:'shot'}}};
  const run={id:'batch',nodeId:'v',status:'done',inputs:{},output:{videoCandidates:[{index:0,jobId:'a',status:'done',storageKey:'first-video',url:'first-url',durationSec:5},{index:1,jobId:'b',status:'done',storageKey:'chosen-video',url:'chosen-url',durationSec:5}]}} as IpRun;
  const state:StudioTemplateExecution={versionId:'v1',version:1,complete:true,steps:[{id:'video',nodeId:'v',title:'video',operation:'video',outputRole:'video',status:'done',requiresAdoption:true,accepted:true,storageKey:'chosen-video',run}]};
  const projected=projectTemplateResults([node],state)[0];
  expect(projected.metadata?.storageKey).toBe('chosen-video');expect(projected.metadata?.primaryVideoId).toBe('batch:1');expect(projected.metadata?.videos).toHaveLength(3);expect(projected.metadata?.studio?.libraryAssetRole).toBeUndefined();expect(node.metadata?.videos).toHaveLength(1);
  expect(projected.metadata?.studio?.templateAccepted).toBe(true);
  const withdrawn=projectTemplateResults([projected],{...state,complete:false,steps:[{...state.steps[0],accepted:false,status:'waiting_adoption'}]})[0];
  expect(withdrawn.metadata?.studio?.templateAccepted).toBe(false);expect(withdrawn.metadata?.storageKey).toBe('chosen-video');
});
