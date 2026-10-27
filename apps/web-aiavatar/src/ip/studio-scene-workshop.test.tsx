import { useState,useCallback } from 'react';
// @vitest-environment jsdom
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,beforeEach,expect,test,vi } from 'vitest';
import { StudioSceneWorkshop } from './studio-scene-workshop';
import { IpStudioApi } from './api';
const route = vi.hoisted(() => ({push:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>route,usePathname:()=>'/scenes'}));
vi.mock('next/link',()=>({default:({children,...p}:any)=><a {...p}>{children}</a>}));
vi.mock('@/components/hub/auth',()=>({useRequireAuth:()=> 'ok',PlatformGateScreen:()=>null}));
vi.mock('./api',()=>({IpStudioApi:{listTemplates:vi.fn(),listProjects:vi.fn(),createProject:vi.fn()}}));
vi.mock('./studio-template-use',()=>({StudioTemplateUse:({template,onClose}:any)=><div role="dialog">{template.name}<button onClick={onClose}>关闭预览</button></div>}));
vi.mock('./studio-errors',()=>({useStudioErrorState:()=>{const [v,s]=useState('');return [v,useCallback((e:any)=>s(e?.message||e||''),[])];},StudioErrorNotice:({error}:any)=><span>{error}</span>}));
vi.mock('@/components/hub/ui',()=>({HubTabBar:()=>null}));
afterEach(cleanup);
beforeEach(()=>{vi.clearAllMocks();vi.mocked(IpStudioApi.listTemplates).mockResolvedValue([{id:'IPD-scene-commerce',name:'commerce',enabled:true,visibility:'official',doc:{nodes:[],connections:[],viewport:{x:0,y:0,k:1}},summary:'',lookCount:0,estimatedCredits:0}]);vi.mocked(IpStudioApi.listProjects).mockResolvedValue([]);});
test('preview stays read-only; explicit start creates an ordinary copy through the original API',async()=>{
  render(<StudioSceneWorkshop/>);
  await waitFor(()=>expect(screen.getByRole('button',{name:'开始创作'})).toBeDefined());
  fireEvent.click(screen.getByRole('button',{name:'预览模板'}));
  expect(screen.getByRole('dialog')).toBeDefined();expect(IpStudioApi.createProject).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button',{name:'关闭预览'}));
  vi.mocked(IpStudioApi.createProject).mockResolvedValue({id:'owned-copy'} as any);
  fireEvent.click(screen.getByRole('button',{name:'开始创作'}));
  await waitFor(()=>expect(route.push).toHaveBeenCalledWith('/projects/owned-copy'));
  expect(IpStudioApi.createProject).toHaveBeenCalledExactlyOnceWith({templateId:'IPD-scene-commerce'});
});
test('missing or disabled templates never create an empty replacement canvas',async()=>{
  vi.mocked(IpStudioApi.listTemplates).mockResolvedValue([]);
  render(<StudioSceneWorkshop/>);
  await waitFor(()=>expect(screen.getAllByRole('button',{name:'敬请期待'})).toHaveLength(4));
  screen.getAllByRole('button',{name:'敬请期待'}).forEach(b=>expect((b as HTMLButtonElement).disabled).toBe(true));
  expect(IpStudioApi.createProject).not.toHaveBeenCalled();
});
