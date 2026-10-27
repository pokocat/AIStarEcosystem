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
// Production 2026-10-19: the 「复刻一条短视频」 example was sent at once, and the first paid reply could only ask for the video.
test('a brief that copies a reference video opens the canvas without sending, and the box says replies are charged',async()=>{
  render(<StudioHome ready/>);
  expect(screen.getByText(/助手每轮回复按实际用量扣少量积分/)).toBeDefined();
  fireEvent.click(screen.getByRole('button',{name:'复刻一条短视频'}));
  fireEvent.click(screen.getByRole('button',{name:'开始对话'}));
  await waitFor(()=>expect(api.push).toHaveBeenCalledWith('/projects/p?start=assistant'));
  expect(api.createProject).toHaveBeenCalledWith({name:'照这条视频的拍法'});
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
// docs/ip-studio-new-canvas-and-threads.md §2.2: 「新建空白画布」 is the shared 「新建」, opened with the assistant.
test('「新建空白画布」 creates one blank canvas and opens it with the assistant',async()=>{
  let resolve!:(p:any)=>void;api.createProject.mockReturnValue(new Promise(r=>{resolve=r;}));
  render(<StudioHome ready/>);
  const button=await screen.findByRole('button',{name:'新建空白画布'});
  fireEvent.click(button);fireEvent.click(button);
  await waitFor(()=>expect(api.createProject).toHaveBeenCalledOnce());
  expect(api.createProject).toHaveBeenCalledWith({name:'空白画布 · 新画布'});
  expect((screen.getByRole('button',{name:'新建空白画布'}) as HTMLButtonElement).disabled).toBe(true);
  resolve(empty);
  await waitFor(()=>expect(api.push).toHaveBeenCalledWith('/projects/p?start=assistant'));
  expect(api.updateProject).not.toHaveBeenCalled();
});
test('a failed 「新建空白画布」 says why and can be tried again',async()=>{
  api.createProject.mockRejectedValueOnce(new Error('网络断开'));
  render(<StudioHome ready/>);
  fireEvent.click(await screen.findByRole('button',{name:'新建空白画布'}));
  // 新建失败弹错误弹窗：哪个操作、原因（2026-10-27 起不再是页面中部的一行字）。
  expect((await screen.findAllByText('新建画布没有完成')).length).toBeGreaterThan(0);
  expect(screen.getAllByText('网络断开').length).toBeGreaterThan(0); // 原因一处，折叠的「错误详情」里一处
  fireEvent.click(screen.getByRole('button',{name:'新建空白画布'}));
  await waitFor(()=>expect(api.push).toHaveBeenCalledWith('/projects/p?start=assistant'));
});
test('the 「空白画布」 tool is the same 「新建」: reuses an untouched blank canvas and opens it with the assistant',async()=>{
  const recent=new Date(Date.now()-60_000).toISOString();
  api.listProjects.mockResolvedValueOnce([]).mockResolvedValue([{id:'blank',name:'空白画布 · 新画布',status:'draft',createdAt:recent,updatedAt:recent}]);
  api.getProject.mockResolvedValue({...empty,id:'blank'});
  render(<StudioHome ready/>);
  fireEvent.click(screen.getByRole('button',{name:/^空白画布/}));
  await waitFor(()=>expect(api.push).toHaveBeenCalledWith('/projects/blank?start=assistant'));
  expect(api.createProject).not.toHaveBeenCalled();
});
