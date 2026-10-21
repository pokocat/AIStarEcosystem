// @vitest-environment jsdom
import { useState } from 'react';
import { act,cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { beforeEach,afterEach,expect,test,vi } from 'vitest';
import { ApiError } from '@ai-star-eco/api-client';
import { StudioRecreation } from './studio-recreation';
import type { CanvasNodeData,CanvasConnection } from '@/canvas/types/canvas';
const api=vi.hoisted(()=>({submit:vi.fn(),save:vi.fn(),read:vi.fn(),onRun:vi.fn(),close:vi.fn(),error:vi.fn(),success:vi.fn()}));
vi.mock('@/canvas-bridge/studio-api',()=>({submitStudioRun:api.submit,importStudioMedia:vi.fn()}));
vi.mock('@/canvas-bridge/api',()=>({readRun:api.read}));
vi.mock('@/canvas-bridge/studio-save',()=>({saveStudioDocument:api.save}));
vi.mock('@/canvas-bridge/image-storage',()=>({refreshImageUrl:async()=>'/renewed.mp4'}));
vi.mock('@/canvas-bridge/signed-video',()=>({SignedVideo:({storageKey,...p}:any)=><video {...p}/>}));
vi.mock('./studio-errors',()=>({useStudioErrorState:()=>useState(''),useStudioApp:()=>({message:{success:api.success,error:api.error}}),StudioErrorNotice:({error}:any)=><p role="alert">{String(error)}</p>}));
vi.mock('./studio-floating-panel',()=>({StudioFloatingPanel:({title,children,footer}:any)=><section role="dialog" aria-label={title}>{children}<footer>{footer}</footer></section>}));
vi.mock('antd',()=>{const Input={TextArea:({autoSize,...p}:any)=><textarea {...p}/>};return {Popover:({children,content}:any)=><>{children}{content}</>,Input,Button:({loading,type,icon,...p}:any)=><button {...p} disabled={loading||p.disabled}>{p.children}</button>,Select:({options,value,onChange,...p}:any)=><select aria-label={p['aria-label']} disabled={p.disabled} value={value||''} onChange={e=>onChange(e.target.value)}><option value=""/>{options.map((o:any)=><option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>)}</select>};});
const video:CanvasNodeData={id:'video',type:'video' as never,title:'恐龙',position:{x:0,y:0},width:320,height:200,metadata:{storageKey:'owned.mp4',content:'/video.mp4',status:'success'}};
const capabilities={mock:false,operations:[],imageCost:0,textCost:0,videoCost:null,textModels:[{endpointId:'vision',name:'画面模型',isDefault:true,supportsVision:true,tokenPricing:{inputCreditsPerK:.18,outputCreditsPerK:1.08,maxInputTokens:65536,maxOutputTokens:8192,maxCost:21}}]};
let nodes:CanvasNodeData[]=[],edges:CanvasConnection[]=[];
function Host({caps=capabilities,initial=[video],mode}:any){const[list,setNodes]=useState<CanvasNodeData[]>(initial);nodes=list;const[connections,setConnections]=useState<CanvasConnection[]>([]);edges=connections;return <StudioRecreation mode={mode} projectId="p" initialNodeId={initial[0].id} nodes={list} capabilities={caps} setNodes={setNodes} setConnections={setConnections} onClose={api.close} onFocus={()=>{}} onRun={api.onRun}/>;}
beforeEach(()=>{vi.clearAllMocks();api.save.mockResolvedValue('saved');api.submit.mockImplementation(async(_:string,r:any)=>({id:'r',nodeId:r.nodeId,status:'running',stage:'queued',pct:0,kind:'studio-recreation',inputs:r,output:{}}));});afterEach(cleanup);
test('opening a video fixes the source without upload or replacement; start saves a linked report',async()=>{
 render(<Host/>);expect(screen.queryByRole('button',{name:'上传参考视频'})).toBeNull();expect(screen.queryByRole('combobox',{name:'复刻参考视频'})).toBeNull();expect(api.submit).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'开始解析'}));
 await waitFor(()=>expect(api.onRun).toHaveBeenCalledTimes(1));expect(api.save.mock.invocationCallOrder[0]).toBeLessThan(api.close.mock.invocationCallOrder[0]);expect(api.close.mock.invocationCallOrder[0]).toBeLessThan(api.submit.mock.invocationCallOrder[0]);
 expect(nodes).toHaveLength(2);expect(nodes[0]).toEqual(video);expect(edges).toHaveLength(1);
 expect(api.submit.mock.calls[0][1]).toMatchObject({operation:'recreation',contextNodeIds:['video'],model:'vision',maxCost:21});
 expect(edges[0]).toMatchObject({fromNodeId:'video',toNodeId:api.submit.mock.calls[0][1].nodeId});
});
test('unknown response confirms original identity without creating another report or charge request',async()=>{
 api.submit.mockRejectedValueOnce(new TypeError('network lost'));
 render(<Host/>);fireEvent.click(screen.getByRole('button',{name:'开始解析'}));await screen.findByRole('button',{name:'确认原任务'});
 const first=api.submit.mock.calls[0][1];fireEvent.click(screen.getByRole('button',{name:'确认原任务'}));
 await waitFor(()=>expect(api.onRun).toHaveBeenCalled());expect(api.submit.mock.calls[1][1]).toEqual(first);expect(nodes).toHaveLength(2);expect(edges).toHaveLength(1);
});
test('save failure never submits; retry uses the same report node',async()=>{
 api.save.mockRejectedValueOnce(new Error('save failed'));
 render(<Host/>);fireEvent.click(screen.getByRole('button',{name:'开始解析'}));await screen.findByRole('button',{name:'重新解析'});expect(api.submit).not.toHaveBeenCalled();const id=nodes[1].id;
 fireEvent.click(screen.getByRole('button',{name:'重新解析'}));await waitFor(()=>expect(api.onRun).toHaveBeenCalled());expect(nodes).toHaveLength(2);expect(api.submit.mock.calls[0][1].nodeId).toBe(id);
});
test('a text-only configured model cannot initiate a fictitious video analysis',()=>{
 render(<Host caps={{...capabilities,textModels:[{...capabilities.textModels[0],supportsVision:false}]}}/>);expect(screen.getByRole('button',{name:'开始解析'}).hasAttribute('disabled')).toBe(true);expect(api.submit).not.toHaveBeenCalled();
});
test('reopening the source video resumes its pending report instead of offering a second analysis',()=>{
 const pending:CanvasNodeData={id:'report',type:'text' as never,title:'拆解',position:{x:500,y:0},width:480,height:300,metadata:{status:'loading',studio:{kind:'recreation',recreation:{sourceNodeId:'video',sourceStorageKey:'owned.mp4',sourceTitle:'恐龙'},request:{clientRequestId:'same-key',nodeId:'report',operation:'recreation',prompt:'关注构图',model:'vision',contextNodeIds:['video'],maxCost:21}}}};
 render(<Host initial={[video,pending]}/>);expect(screen.queryByRole('button',{name:'开始解析'})).toBeNull();expect(screen.getByRole('button',{name:'确认原任务'})).toBeDefined();expect(api.submit).not.toHaveBeenCalled();
});

test('closing the confirmation panel does not discard the accepted request or its result',async()=>{
 let resolveReply!:(v:unknown)=>void;api.submit.mockImplementation(()=>new Promise(resolve=>{resolveReply=resolve;}));
 const view=render(<Host/>);fireEvent.click(screen.getByRole('button',{name:'开始解析'}));await waitFor(()=>expect(api.close).toHaveBeenCalled());
 const request=api.submit.mock.calls[0][1];view.unmount();
 await act(async()=>resolveReply({id:'accepted',nodeId:request.nodeId,kind:'studio-recreation',status:'running',stage:'queued',pct:0,inputs:request,output:{}}));
 await waitFor(()=>expect(api.onRun).toHaveBeenCalledTimes(1));expect(api.submit).toHaveBeenCalledTimes(1);
});

test('a missing Hypit runtime is a rejected task that can be retried, not an unknown submission',async()=>{
 api.submit.mockRejectedValueOnce(new ApiError({code:'STUDIO_HYPIT_UNAVAILABLE',message:'视频处理工具不可用'},503));
 render(<Host/>);fireEvent.click(screen.getByRole('button',{name:'开始解析'}));await screen.findByRole('button',{name:'重新解析'});expect(nodes[1].metadata?.status).toBe('error');expect(api.onRun).not.toHaveBeenCalled();
});

test('film study starts independently from a pending full-film report and saves the segments request',async()=>{
 const full={...video,id:'full',type:'text',metadata:{status:'loading',studio:{kind:'recreation',recreation:{sourceNodeId:'video',sourceStorageKey:'owned.mp4',sourceTitle:'恐龙'}}}};
 render(<Host mode="segments" initial={[video,full]}/>);fireEvent.click(screen.getByRole('button',{name:'开始拉片'}));await waitFor(()=>expect(api.onRun).toHaveBeenCalled());
 expect(api.submit.mock.calls[0][1]).toMatchObject({operation:'recreation',mode:'segments',contextNodeIds:['video']});expect(nodes).toHaveLength(3);
});
test('a failed segment task keeps its original run as a resume source on explicit retry',async()=>{
 const failed={id:'film',type:'text',title:'拉片',position:{x:0,y:0},width:720,height:320,metadata:{status:'error',studio:{kind:'recreation',runId:'previous',recreation:{mode:'segments',sourceNodeId:'video',sourceStorageKey:'owned.mp4',sourceTitle:'恐龙'}}}};
 render(<Host initial={[failed,video]}/>);fireEvent.click(screen.getByRole('button',{name:'继续拉片'}));await waitFor(()=>expect(api.onRun).toHaveBeenCalled());expect(nodes[0].metadata?.studio?.recreation?.resumeRunId).toBe('previous');expect(api.submit.mock.calls[0][1].nodeId).toBe('film');
});
