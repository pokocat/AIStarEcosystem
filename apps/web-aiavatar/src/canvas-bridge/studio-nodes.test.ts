import { describe, expect, it } from "vitest";
import type { IpRun } from "@ai-star-eco/types";
import { applyStudioRun, makeStudioNode, selectStudioTake } from "./studio-nodes";
import { resetInterruptedGeneration } from "@/canvas/lib/canvas/canvas-generation-helpers";
import { CanvasNodeType } from "@/canvas/types/canvas";

const run = (id: string, key: string): IpRun => ({ id,projectId:"p",nodeId:"n",kind:"studio-image",status:"done",stage:"done",pct:100,cost:0,
  inputs:{},output:{mock:true,candidates:[{key,url:`/cdn/${key}`}]},createdAt:"2026-10-08T00:00:00Z" });
describe("Studio adoption and recovery", () => {
  it("projecting the same completed script task never replaces the user's saved Markdown or editor draft",()=>{
    const node=makeStudioNode('script'),script={title:'原生成',outline:'旧大纲',characters:[],scenes:[],props:[],episodes:[{no:1,title:'One',content:'原文'}],shots:[]};
    const task={...run('script-run','unused'),kind:'studio-script' as const,output:{script}};
    const generated=applyStudioRun(node,task);
    generated.metadata!.studio!.script={...script,title:'用户编辑',outline:'最新大纲'};
    generated.metadata!.studio!.scriptMarkdown='# 用户编辑';
    generated.metadata!.studio!.scriptEditor={draft:'# 尚在编辑',turns:[],proposal:{markdown:'# AI 版本',summary:'建议',baseMarkdown:'# 用户编辑',runId:'revision'}};
    const projected=applyStudioRun(generated,task);
    expect(projected.metadata?.studio?.script).toEqual(generated.metadata?.studio?.script);expect(projected.metadata?.studio?.scriptMarkdown).toBe('# 用户编辑');expect(projected.metadata?.studio?.scriptEditor).toEqual(generated.metadata?.studio?.scriptEditor);
    const fresh=applyStudioRun(generated,{...task,id:'new-generation'});
    expect(fresh.metadata?.studio?.scriptMarkdown).toBeUndefined();expect(fresh.metadata?.studio?.scriptEditor?.draft).toBeUndefined();expect(fresh.metadata?.studio?.script).toEqual(script);
  });
  it("updates queue positions without losing adopted media and clears them on admission",()=>{
    const initial=applyStudioRun(makeStudioNode('image'),run('old','adopted.jpg'));
    const queued={...run('queued','unused'),status:'running' as const,stage:'endpoint.queued',pct:0,output:{},queue:{position:3,waiting:3,running:2,concurrencyLimit:2}};
    const first=applyStudioRun(initial,queued);
    const advanced=applyStudioRun(first,{...queued,queue:{...queued.queue,position:1,waiting:1}});
    expect(advanced.metadata?.studio?.task?.queue?.position).toBe(1);
    expect(advanced.metadata?.storageKey).toBe('adopted.jpg');
    const running=applyStudioRun(advanced,{...queued,stage:'image.generate.1',pct:20,queue:null});
    expect(running.metadata?.studio?.task?.queue).toBeNull();expect(running.metadata?.studio?.task?.pct).toBe(20);
    expect(running.metadata?.storageKey).toBe('adopted.jpg');
  });
  it("names storyboard videos after their shot and preserves authored order independent of submission order",()=>{
    const first=makeStudioNode("image"),second=makeStudioNode("image");
    first.title="Watering";second.title="Moving the flower";
    first.metadata!.studio!.shot={id:"one",title:first.title,description:"",dialogue:"",durationSec:5,characters:[],episodeNo:2};first.metadata!.studio!.order=0;
    second.metadata!.studio!.shot={...first.metadata!.studio!.shot,id:"two",title:second.title};second.metadata!.studio!.order=1;
    const videos=[makeStudioNode("video",second),makeStudioNode("video",first)].sort((a,b)=>(a.metadata!.studio!.order||0)-(b.metadata!.studio!.order||0));
    expect(videos.map(n=>n.title)).toEqual(["Watering · 视频","Moving the flower · 视频"]);
    expect(videos.every(n=>n.metadata?.studio?.episodeNo===2)).toBe(true);
  });
  it("completed scripts replace the initial brief draft so later edits are the rewrite source",()=>{
    const node=makeStudioNode("script");
    node.metadata!.studio!.composerDraft={operation:"script",prompt:"obsolete first brief",referenceNodeIds:[],aspectRatio:"9:16",count:1,durationSec:5,settings:{},video:{mode:"t2v",tier:"768p"}};
    const script={title:"New script",outline:"Edited outline",characters:[],scenes:[],props:[],episodes:[{no:1,title:"One",content:"Current body"}],shots:[]};
    const result=applyStudioRun(node,{...run("script-run","unused"),kind:"studio-script",output:{script}});
    expect(result.metadata?.studio?.composerDraft).toBeUndefined();expect(result.metadata?.studio?.script).toEqual(script);
    expect(node.metadata?.studio?.composerDraft?.prompt).toBe("obsolete first brief");
  });
  it("extracts a lip-sync take while preserving its raw comparison and other adopted takes",()=>{
    const raw={...run("lip","unused"),kind:"studio-lip-sync" as const,output:{storageKey:"compare.mp4",url:"/cdn/compare.mp4",durationSec:3.52}};
    const first=applyStudioRun(makeStudioNode("video"),raw);
    const extracted={...raw,output:{storageKey:"right.mp4",url:"/cdn/right.mp4",durationSec:3.52,lipSyncNormalized:true,comparisonStorageKey:"compare.mp4",comparisonUrl:"/cdn/compare.mp4"}};
    const next=applyStudioRun(first,extracted);expect(next.metadata?.storageKey).toBe("right.mp4");expect(next.metadata?.videos).toHaveLength(2);
    expect(next.metadata?.studio?.lipSyncNormalized).toBe(true);
    const comparison=selectStudioTake(next,"lip:comparison");expect(comparison.metadata?.storageKey).toBe("compare.mp4");
    expect(applyStudioRun(comparison,extracted).metadata?.storageKey).toBe("compare.mp4");
  });
  it("recovers native lip-sync inputs without silently adopting its new clip",()=>{
    const n=makeStudioNode("video");n.metadata={status:"loading",studio:{kind:"shot",includeInWork:false,lipSyncRequest:{clientRequestId:"same-lip-request",nodeId:n.id,model:"lips",videoStorageKey:"original.mp4",audioStorageKey:"voice.wav",maxCost:40}}};
    expect(resetInterruptedGeneration([n])[0].metadata?.status).toBe("loading");
    const result=applyStudioRun(n,{...run("lip-task","unused"),kind:"studio-lip-sync",output:{storageKey:"lips.mp4",url:"/cdn/lips.mp4",durationSec:3.52,lipSync:true}});
    expect(result.metadata?.studio?.lipSyncRequest?.videoStorageKey).toBe("original.mp4");expect(result.metadata?.studio?.includeInWork).toBe(false);
    expect(result.metadata?.videos).toHaveLength(1);expect(result.metadata?.storageKey).toBe("lips.mp4");
  });
  it("restores a saved speech request and keeps native audio out of video takes",()=>{
    const n={...makeStudioNode("script"),type:CanvasNodeType.Audio,metadata:{status:"loading" as const,studio:{kind:"audio" as const,speechRequest:{clientRequestId:"original",nodeId:"n",model:"tts",text:"台词。",speaker:"Vivian",maxCost:8}}}};
    expect(resetInterruptedGeneration([n])[0].metadata?.status).toBe("loading");
    const completed=applyStudioRun(n,{...run("speech","unused"),kind:"studio-audio",output:{storageKey:"voice.wav",url:"/cdn/voice.wav",mimeType:"audio/wav",durationSec:4}});
    expect(completed.metadata?.content).toBe("/cdn/voice.wav");expect(completed.metadata?.videos).toBeUndefined();
    expect(completed.metadata?.studio?.speechRequest?.clientRequestId).toBe("original");
  });
  it("restoring a second-episode frame and deriving its clip preserves the authored episode",()=>{
    const n=makeStudioNode("image");n.metadata!.studio!.shot={id:"ep2-shot",title:"第二集",episodeNo:2,description:"画面",dialogue:"",durationSec:5,characters:[]};
    const restored=applyStudioRun(n,run("frame","frame.jpg"));
    expect(restored.metadata?.studio?.episodeNo).toBe(2);
    expect(makeStudioNode("video",restored).metadata?.studio?.episodeNo).toBe(2);
  });
  it("restoring the same completed assistant run does not duplicate its reply",()=>{
    const n=makeStudioNode("assistant");n.metadata!.studio!.conversation={mode:"general",turns:[{role:"user",content:"建议"}]};
    const r={...run("reply","ignored"),kind:"studio-assistant",output:{text:"建议内容",plan:{summary:"建议内容",steps:[],questions:[]}}};
    const first=applyStudioRun(n,r),restored=applyStudioRun(first,r);
    expect(restored.metadata?.studio?.conversation?.turns).toEqual([{role:"user",content:"建议"},{role:"assistant",content:"建议内容"}]);
  });
  it("keeps the selected image while adding another generated version", () => {
    const first=applyStudioRun(makeStudioNode("image"),run("r1","first.jpg"));
    const second=applyStudioRun(first,run("r2","second.jpg"));
    expect(second.metadata?.storageKey).toBe("first.jpg");
    expect(second.metadata?.images).toHaveLength(2);
    expect(selectStudioTake(second,"r2").metadata?.storageKey).toBe("second.jpg");
    expect(selectStudioTake(second,"r1").metadata?.content).toBe("/cdn/first.jpg");
  });
  it("does not erase the previous adopted image on a failed retry", () => {
    const first=applyStudioRun(makeStudioNode("image"),run("r1","first.jpg"));
    const failed=applyStudioRun(first,{...run("r2","ignored.jpg"),status:"failed",errorMessage:"测试失败",output:{}});
    expect(failed.metadata?.storageKey).toBe("first.jpg");
    expect(failed.metadata?.status).toBe("error");
  });
  it("keeps committed candidates when a multi-image run partially fails",()=>{
    const first=applyStudioRun(makeStudioNode("image"),run("r1","first.jpg"));
    const partial=applyStudioRun(first,{...run("r2","committed.jpg"),status:"failed",errorMessage:"第二张未完成"});
    expect(partial.metadata?.status).toBe("error");expect(partial.metadata?.storageKey).toBe("first.jpg");
    expect(selectStudioTake(partial,"r2").metadata?.storageKey).toBe("committed.jpg");
  });
  it("preserves a pending request across reload, including an unknown acceptance outcome", () => {
    const node=makeStudioNode("script");
    node.metadata={...node.metadata,status:"loading",studio:{kind:"script",request:{clientRequestId:"same-request",nodeId:node.id,operation:"script",prompt:"brief"}}};
    const restored=resetInterruptedGeneration([node])[0];
    expect(restored.metadata?.status).toBe("loading");
    expect(restored.metadata?.studio?.request?.clientRequestId).toBe("same-request");
  });
});

describe('video batch adoption and recovery',()=>{
  const batch=(status:'running'|'done'|'failed',states:('running'|'done'|'failed')[]):IpRun=>({...run('batch','unused'),kind:'studio-video',status,output:{videoCandidates:states.map((state,index)=>({index,jobId:`job${index}`,status:state,pct:state==='running'?20:100,durationSec:8,...(state==='done'?{storageKey:`take${index}.mp4`,url:`/cdn/take${index}.mp4`}:state==='failed'?{errorMessage:'引擎失败'}:{})}))}});
  it('keeps all four stable slots and exposes a successful take before the other jobs finish',()=>{
    const pending=applyStudioRun(makeStudioNode('video'),batch('running',['running','done','failed','running']));
    expect(pending.metadata?.videos?.map(t=>t.id)).toEqual(['batch','batch:1','batch:2','batch:3']);
    expect(pending.metadata?.status).toBe('loading');expect(pending.metadata?.storageKey).toBe('take1.mp4');
    expect(selectStudioTake(pending,'batch:2')).toBe(pending);
    const adopted=selectStudioTake(pending,'batch:1');
    const complete=applyStudioRun(adopted,batch('done',['done','done','failed','done']));
    expect(complete.metadata?.videos).toHaveLength(4);expect(complete.metadata?.primaryVideoId).toBe('batch:1');
    expect(applyStudioRun(complete,batch('done',['done','done','failed','done'])).metadata?.videos).toHaveLength(4);
  });
  it('retains the previous adopted clip when a whole new batch fails',()=>{
    const old=applyStudioRun(makeStudioNode('video'),{...run('old','unused'),kind:'studio-video',output:{storageKey:'old.mp4',url:'/cdn/old.mp4'}});
    const failed=applyStudioRun(old,batch('failed',['failed','failed']));
    expect(failed.metadata?.storageKey).toBe('old.mp4');expect(failed.metadata?.primaryVideoId).toBe('old');
    expect(failed.metadata?.videos).toHaveLength(3);expect(failed.metadata?.status).toBe('error');
  });
});
