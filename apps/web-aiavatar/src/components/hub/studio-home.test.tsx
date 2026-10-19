// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {StudioHome} from './studio-home';
const api=vi.hoisted(()=>({createProject:vi.fn(),updateProject:vi.fn(),getProject:vi.fn(),listProjects:vi.fn(),listTemplates:vi.fn(),listDemoExamples:vi.fn(),push:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:api.push})}));
vi.mock('@/ip/api',()=>({IpStudioApi:api}));
vi.mock('@/ip/studio-template-use',()=>({StudioTemplateUse:({template}:any)=><div role="dialog">套用 {template.name}</div>}));
vi.mock('@/ip/canvas-thumb',()=>({CanvasThumb:()=> <div>工作流预览</div>}));
const empty={id:'p',name:'新画布',status:'draft',docVersion:'v1',doc:{nodes:[],connections:[],viewport:{x:0,y:0,k:1}},runs:{},runsById:{}};
afterEach(cleanup);
beforeEach(()=>{vi.clearAllMocks();api.listProjects.mockResolvedValue([]);api.listTemplates.mockResolvedValue([]);api.listDemoExamples.mockResolvedValue([]);api.createProject.mockResolvedValue(empty);api.getProject.mockResolvedValue(empty);api.updateProject.mockImplementation(async(_id,body)=>({...empty,doc:body.doc}));});
test('the home opens on the conversation box: a brief creates a canvas that sends it as the first message; nothing is created until then',async()=>{
  render(<StudioHome ready/>);
  expect(screen.getByRole('link',{name:/更多创作方式/}).getAttribute('href')).toBe('/create');
  expect(screen.getByRole('link',{name:'我的画布'}).getAttribute('href')).toBe('/projects');
  expect(screen.getByRole('link',{name:'全部画布'}).getAttribute('href')).toBe('/projects');
  expect((screen.getByRole('button',{name:'开始对话'}) as HTMLButtonElement).disabled).toBe(true);
  expect(api.createProject).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox',{name:'想做什么'}),{target:{value:'把商品换成我的保温杯'}});
  fireEvent.click(screen.getByRole('button',{name:'开始对话'}));
  await waitFor(()=>expect(api.push).toHaveBeenCalledWith('/projects/p?start=assistant&send=1'));
  expect(api.createProject).toHaveBeenCalledOnce();
  expect(api.updateProject.mock.calls[0][1].doc.assistantConversations.at(-1).metadata.prompt).toBe('把商品换成我的保温杯');
});
test('a specific home tool still opens its intended workflow on explicit selection',async()=>{
  render(<StudioHome ready/>);fireEvent.click(screen.getByRole('button',{name:/视频创作/}));
  await waitFor(()=>expect(api.push).toHaveBeenCalledWith('/projects/p?start=video'));
  expect(api.createProject).toHaveBeenCalledOnce();
});
test('versioned personal template uses the shared direct-copy entry',async()=>{
  api.listTemplates.mockResolvedValue([{id:'t',versionId:'v',version:2,visibility:'personal',name:'一次设定图',summary:'',doc:{nodes:[],connections:[],viewport:{x:0,y:0,k:1}}}]);render(<StudioHome ready/>);fireEvent.click(screen.getByRole('button',{name:'我的模板'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:/一次设定图/})).toBeDefined());fireEvent.click(screen.getByRole('button',{name:/一次设定图/}));expect(screen.getByRole('dialog').textContent).toContain('一次设定图');expect(api.createProject).not.toHaveBeenCalled();
});
