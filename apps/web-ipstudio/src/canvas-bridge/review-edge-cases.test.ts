// @vitest-environment jsdom
// Codex 独立复核：这些是第一轮修复后的边界，不以旧审查结论为断言。
import { beforeEach, afterEach, it, expect, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
const m = vi.hoisted(() => ({get:vi.fn(),put:vi.fn()}));
vi.mock('@/api',()=>({IpStudioApi:{getProject:m.get,updateProject:m.put}}));
vi.mock('./models',()=>({loadServerModels:vi.fn().mockResolvedValue({}),endpointIdFor:vi.fn()}));
vi.mock('./api',()=>({setCurrentProjectId:vi.fn(),signKeys:vi.fn(),uploadImage:vi.fn()}));
import { useProjectSync } from './project-sync';
import { useCanvasStore } from '@/canvas/stores/canvas/use-canvas-store';
import { resumableImageRuns } from '@/canvas/lib/canvas/canvas-generation-helpers';
import { isVideoTaskFailed } from './video';
import { publishWithLatestDoc } from './publish-gate';
const doc={nodes:[],connections:[],viewport:{x:0,y:0,k:1}};
beforeEach(()=>{vi.useFakeTimers();m.get.mockResolvedValue({id:'A',name:'A',doc,docVersion:'v1'});m.put.mockResolvedValue({docVersion:'v2'});useCanvasStore.setState({projects:[],deletedProjects:[],hydrated:false});});
afterEach(()=>{cleanup();vi.useRealTimers();vi.clearAllMocks();});
it('保存冲突之后再次发布仍必须阻止',async()=>{
 const h=renderHook(()=>useProjectSync('A'));await act(async()=>{});
 m.put.mockRejectedValue({code:'IP_PROJECT_STALE'});
 act(()=>useCanvasStore.getState().renameProject('A','unsaved change'));
 await act(async()=>{expect(await h.result.current.saveNow()).toBe('conflict');});
 const publish=vi.fn().mockResolvedValue({});
 await expect(publishWithLatestDoc(h.result.current.saveNow,publish)).rejects.toThrow();
 expect(publish).not.toHaveBeenCalled();
});
it('保存中再改一笔然后离开仍须把最后一笔保存',async()=>{
 let finish!:(v:unknown)=>void;m.put.mockImplementationOnce(()=>new Promise(r=>{finish=r;}));
 const h=renderHook(()=>useProjectSync('A'));await act(async()=>{});
 act(()=>useCanvasStore.getState().renameProject('A','first'));
 await act(async()=>{await vi.advanceTimersByTimeAsync(950);});
 act(()=>useCanvasStore.getState().renameProject('A','last'));
 h.unmount();await act(async()=>{finish({docVersion:'v2'});});
 expect(m.put).toHaveBeenCalledTimes(2);
 expect(m.put.mock.calls[1][1].name).toBe('last');
});
it('网络失败或停止留下的任务号依然可对账恢复',()=>{
 const n={id:'n',type:'image',metadata:{status:'error',images:[{id:'i',status:'error',content:'',runId:'R'}]}} as any;
 expect(resumableImageRuns(n)).toHaveLength(1);
});
it('网络错误不能判为视频服务端终态失败并清除任务号',()=>{
 expect(isVideoTaskFailed(new TypeError('Failed to fetch'))).toBe(false);
});
it('离开后立即重新打开同项目不应读回尾部保存之前的旧文档',async()=>{
 let persisted={id:'A',name:'A',doc,docVersion:'v1'};
 let finish!:()=>void;
 m.get.mockImplementation(async()=>({...persisted}));
 m.put.mockImplementationOnce((_id,payload)=>new Promise(resolve=>{finish=()=>{persisted={...persisted,name:payload.name,doc:payload.doc,docVersion:'v2'};resolve({docVersion:'v2'});};}));
 const h=renderHook(()=>useProjectSync('A'));await act(async()=>{});
 act(()=>useCanvasStore.getState().renameProject('A','latest edit'));
 h.unmount();
 renderHook(()=>useProjectSync('A'));await act(async()=>{});
 await act(async()=>{finish();});
 expect(useCanvasStore.getState().projects[0]?.title).toBe('latest edit');
});
it('重新进入项目应等待在途保存及排队的最后一笔全部完成',async()=>{
 let persisted={id:'A',name:'A',doc,docVersion:'v1'};
 const finishes:Array<()=>void>=[];
 m.get.mockImplementation(async()=>({...persisted}));
 m.put.mockImplementation((_id,payload)=>new Promise(resolve=>{finishes.push(()=>{persisted={...persisted,name:payload.name,doc:payload.doc,docVersion:`v${finishes.length+1}`};resolve({docVersion:persisted.docVersion});});}));
 const h=renderHook(()=>useProjectSync('A'));await act(async()=>{});
 act(()=>useCanvasStore.getState().renameProject('A','first'));
 await act(async()=>{await vi.advanceTimersByTimeAsync(950);});
 act(()=>useCanvasStore.getState().renameProject('A','latest edit'));
 h.unmount();
 const reopened=renderHook(()=>useProjectSync('A'));await act(async()=>{});
 await act(async()=>{finishes[0]();});
 expect(finishes).toHaveLength(2);
 // 第一次 PUT 落地仍不能读项目；第二次 PUT 才包含最后一笔。
 const stillLoading=reopened.result.current.state;
 await act(async()=>{finishes[1]();});
 expect(stillLoading).toBe('loading');
 expect(useCanvasStore.getState().projects[0]?.title).toBe('latest edit');
});
it('等待尾部保存超时应明确报错而不是展示旧文档为可编辑状态',async()=>{
 let finish!:(v:unknown)=>void;
 m.get.mockResolvedValue({id:'A',name:'A',doc,docVersion:'v1'});
 m.put.mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve;}));
 const h=renderHook(()=>useProjectSync('A'));await act(async()=>{});
 act(()=>useCanvasStore.getState().renameProject('A','latest edit'));
 h.unmount();
 const reopened=renderHook(()=>useProjectSync('A'));await act(async()=>{});
 await act(async()=>{await vi.advanceTimersByTimeAsync(9000);});
 const timedOutState=reopened.result.current.state;
 const timedOutError=reopened.result.current.error;
 await act(async()=>{finish({docVersion:'v2'});});
 expect(timedOutState).toBe('error');
 expect(timedOutError).toBeTruthy();
});
