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
test('home video intent is saved and opens the video flow; generation is still an explicit next step',async()=>{
  render(<StudioHome ready/>);fireEvent.click(screen.getByRole('button',{name:'视频',exact:true}));fireEvent.change(screen.getByRole('textbox',{name:'创作想法'}),{target:{value:'让小紫介绍灵感杯'}});fireEvent.click(screen.getByRole('button',{name:'开始创作'}));
  await waitFor(()=>expect(api.push).toHaveBeenCalledWith('/projects/p?start=video'));expect(api.updateProject.mock.calls[0][1].doc.nodes[0].metadata.prompt).toBe('让小紫介绍灵感杯');
});
test('failed home save keeps the brief and retries the original workspace',async()=>{
  api.updateProject.mockRejectedValueOnce(new Error('保存失败'));render(<StudioHome ready/>);fireEvent.change(screen.getByRole('textbox',{name:'创作想法'}),{target:{value:'保留这段创作想法'}});fireEvent.click(screen.getByRole('button',{name:'开始创作'}));
  await waitFor(()=>expect(screen.getByRole('alert').textContent).toContain('画布已创建'));expect(api.push).not.toHaveBeenCalled();
  expect((screen.getByRole('textbox',{name:'创作想法'}) as HTMLTextAreaElement).value).toBe('保留这段创作想法');fireEvent.click(screen.getByRole('button',{name:'继续保存并打开'}));
  await waitFor(()=>expect(api.push).toHaveBeenCalledWith('/projects/p?start=assistant'));expect(api.createProject).toHaveBeenCalledTimes(1);
});
test('versioned personal template opens the shared input form without creating a workspace',async()=>{
  api.listTemplates.mockResolvedValue([{id:'t',versionId:'v',version:2,visibility:'personal',name:'一次设定图',summary:'',doc:{nodes:[],connections:[],viewport:{x:0,y:0,k:1}}}]);render(<StudioHome ready/>);fireEvent.click(screen.getByRole('button',{name:'我的模板'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:/一次设定图/})).toBeDefined());fireEvent.click(screen.getByRole('button',{name:/一次设定图/}));expect(screen.getByRole('dialog').textContent).toContain('一次设定图');expect(api.createProject).not.toHaveBeenCalled();
});
