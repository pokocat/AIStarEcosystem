// @vitest-environment jsdom
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,beforeEach,expect,test,vi } from 'vitest';
import type { StudioTemplateExecution,StudioTemplateInstance } from '@ai-star-eco/types';
import { StudioTemplateSource } from './studio-template-source';
import * as api from '@/canvas-bridge/template-api';
import { emitTemplateResults } from '@/canvas-bridge/template-projection';
vi.mock('@ai-star-eco/api-client',()=>({USE_MOCK:false}));
vi.mock('antd',()=>({
  Modal:({children,title,footer,open}:any)=>open?<div role="dialog">{title}{children}{footer}</div>:null,
  Alert:({title}:any)=><p>{title}</p>,Button:({children,loading,...p}:any)=><button {...p} disabled={p.disabled||loading}>{children}</button>,
  Input:Object.assign((p:any)=><input {...p}/>,{TextArea:(p:any)=><textarea {...p}/>}),Select:()=>null,
}));
vi.mock('@/canvas-bridge/template-api',()=>({readTemplateInstance:vi.fn(),readTemplateExecution:vi.fn(),executeTemplateStep:vi.fn(),acceptTemplateStep:vi.fn(),archiveTemplateStep:vi.fn(),listTemplatePackages:vi.fn().mockResolvedValue([]),createTemplatePackage:vi.fn(),readTemplateMetrics:vi.fn().mockResolvedValue(undefined)}));
vi.mock('@/canvas-bridge/studio-api',()=>({readStudioProject:vi.fn().mockResolvedValue({templateVersionId:'v1'}),listStudioIpAssets:vi.fn().mockResolvedValue([])}));
vi.mock('@/canvas-bridge/studio-save',()=>({saveStudioDocument:vi.fn().mockResolvedValue(undefined)}));
vi.mock('@/canvas-bridge/template-projection',()=>({emitTemplateResults:vi.fn()}));
vi.mock('@/canvas-bridge/signed-image',()=>({SignedImage:(p:any)=><img alt={p.alt} src={p.src}/>}));
vi.mock('@/canvas-bridge/signed-video',()=>({SignedVideo:({storageKey,...p}:any)=><video {...p}/>}));
const instance={source:{version:1,name:'pack'},project:{name:'my character',doc:{nodes:[{id:'m',metadata:{prompt:'main instruction'}}]}},plan:{imageCount:2,totalCost:16}} as StudioTemplateInstance;
let state:StudioTemplateExecution;
afterEach(cleanup);
beforeEach(()=>{vi.clearAllMocks();state={versionId:'v1',version:1,complete:false,steps:[{id:'main',nodeId:'m',title:'main',outputRole:'main',status:'ready',requiresAdoption:true,cost:8,accepted:false},{id:'side',nodeId:'s',title:'side',outputRole:'side',status:'waiting_dependency',requiresAdoption:false,cost:8,accepted:false}]};vi.mocked(api.readTemplateInstance).mockResolvedValue(instance);vi.mocked(api.readTemplateExecution).mockImplementation(async()=>state);});
async function open(){render(<StudioTemplateSource projectId="p"/>);await waitFor(()=>expect(screen.getByRole('button',{name:'模板 v1 · 制作计划'})).toBeDefined());fireEvent.click(screen.getByRole('button',{name:'模板 v1 · 制作计划'}));await waitFor(()=>expect(screen.getByText('main · 可以生成')).toBeDefined());}
test('opening a saved template canvas recovers its completed result while the plan stays closed',async()=>{
  state={...state,steps:[{...state.steps[0],status:'done',accepted:true,storageKey:'owned/main.png',run:{id:'original-run',status:'done'} as any}]};
  render(<StudioTemplateSource projectId="p"/>);
  await waitFor(()=>expect(emitTemplateResults).toHaveBeenCalledWith('p',state));
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(api.executeTemplateStep).not.toHaveBeenCalled();
});
test('unconfirmed dependencies are disabled and a fresh quote is required before native submission',async()=>{
  await open();expect(screen.getAllByRole('button',{name:'生成此步骤 · 8 积分'})[1].disabled).toBe(true);expect(api.executeTemplateStep).not.toHaveBeenCalled();
  state={...state,steps:[{...state.steps[0],cost:10},state.steps[1]]};fireEvent.click(screen.getAllByRole('button',{name:'生成此步骤 · 8 积分'})[0]);
  await waitFor(()=>expect(screen.getByRole('button',{name:'确认 10 积分并提交'})).toBeDefined());expect(api.executeTemplateStep).not.toHaveBeenCalled();
  vi.mocked(api.executeTemplateStep).mockResolvedValue({id:'run'} as any);fireEvent.click(screen.getByRole('button',{name:'确认 10 积分并提交'}));await waitFor(()=>expect(api.executeTemplateStep).toHaveBeenCalled());
  expect(api.executeTemplateStep).toHaveBeenCalledWith('p','main',{clientRequestId:expect.any(String),maxCost:10,replaceRunId:undefined,prompt:'main instruction'});
});
test('an uncertain submit retains its request id for a recovery click',async()=>{
  await open();vi.mocked(api.executeTemplateStep).mockRejectedValue(new Error('网络暂不可用'));fireEvent.click(screen.getAllByRole('button',{name:'生成此步骤 · 8 积分'})[0]);await waitFor(()=>expect(screen.getByRole('button',{name:'确认 8 积分并提交'})).toBeDefined());
  fireEvent.click(screen.getByRole('button',{name:'确认 8 积分并提交'}));await waitFor(()=>expect(screen.getAllByText('网络暂不可用').length).toBeGreaterThan(0));const first=vi.mocked(api.executeTemplateStep).mock.calls[0][2];
  expect((screen.getByRole('textbox',{name:'本次图片指令'}) as HTMLTextAreaElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button',{name:'确认 8 积分并提交'}));await waitFor(()=>expect(api.executeTemplateStep).toHaveBeenCalledTimes(2));expect(vi.mocked(api.executeTemplateStep).mock.calls[1][2]).toEqual(first);
});
test('video results preview and adopt as videos, with no character archive or image-package entry',async()=>{
  state={...state,steps:[{id:'video',nodeId:'v',title:'商品视频',operation:'video',outputRole:'video',status:'waiting_adoption',requiresAdoption:true,cost:20,accepted:false,storageKey:'own/video.mp4',url:'video-url',run:{id:'video-run',status:'done',inputs:{prompt:'video direction'}} as any}]};
  vi.mocked(api.readTemplateInstance).mockResolvedValue({...instance,plan:{...instance.plan,imageCount:0,videoCount:1,totalCost:20}});
  render(<StudioTemplateSource projectId="p"/>);await waitFor(()=>expect(screen.getByRole('button',{name:'模板 v1 · 制作计划'})).toBeDefined());fireEvent.click(screen.getByRole('button',{name:'模板 v1 · 制作计划'}));
  expect(screen.getByLabelText('商品视频结果').tagName).toBe('VIDEO');expect(screen.queryByRole('button',{name:'归档到 IP'})).toBeNull();expect((screen.getByRole('button',{name:'排版并下载资产包'}) as HTMLButtonElement).disabled).toBe(true);expect((screen.getByRole('button',{name:'整理成片'}) as HTMLButtonElement).disabled).toBe(true);
  vi.mocked(api.acceptTemplateStep).mockResolvedValue({...state,steps:[{...state.steps[0],status:'done',accepted:true}]});fireEvent.click(screen.getByRole('button',{name:'采用此视频'}));
  await waitFor(()=>expect(api.acceptTemplateStep).toHaveBeenCalledWith('p','video',{runId:'video-run',storageKey:'own/video.mp4',accepted:true}));expect(api.executeTemplateStep).not.toHaveBeenCalled();
  await waitFor(()=>expect((screen.getByRole('button',{name:'整理成片'}) as HTMLButtonElement).disabled).toBe(false));
});
