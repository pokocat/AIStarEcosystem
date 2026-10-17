// @vitest-environment jsdom
import { useState,useCallback } from 'react';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,beforeEach,expect,test,vi } from 'vitest';
import { PublishJobApi,SocialAccountApi } from '@ai-star-eco/api-client';
import { StudioDistribution } from './studio-distribution';
vi.mock('next/navigation',()=>({usePathname:()=>'/distribution'}));
vi.mock('next/link',()=>({default:({children,...p}:any)=><a {...p}>{children}</a>}));
vi.mock('@/components/hub/ui',()=>({HubTabBar:()=>null}));
vi.mock('@/components/hub/auth',()=>({useRequireAuth:()=> 'ok',PlatformGateScreen:()=>null}));
vi.mock('@ai-star-eco/api-client',()=>({SocialAccountApi:{listSocialAccounts:vi.fn(),verifySocialAccount:vi.fn(),unbindSocialAccount:vi.fn()},PublishJobApi:{listBatches:vi.fn(),listPublishJobs:vi.fn(),createPublishJobs:vi.fn()},formatDateTime:(s:string)=>s,isProductNotEnrolledError:()=>false}));
vi.mock('./studio-social-bind',()=>({StudioSocialBind:()=>null,socialPlatformLabels:{douyin:'抖音'}}));
vi.mock('./studio-errors',()=>({useStudioErrorState:()=>{const [v,s]=useState('');return [v,useCallback((e:any)=>s(e?.message||e||''),[])];},StudioErrorNotice:({error}:any)=><span>{error}</span>}));
vi.mock('antd',()=>({ConfigProvider:({children}:any)=>children,Modal:({children,title,open}:any)=>open?<div role="dialog">{title}{children}</div>:null,Button:({children,loading,icon,...p}:any)=><button {...p}>{children}</button>}));
afterEach(cleanup);
beforeEach(()=>{vi.clearAllMocks();vi.mocked(SocialAccountApi.listSocialAccounts).mockResolvedValue([]);});
test('unfinished preparation cannot enqueue jobs or claim saved drafts',()=>{
  render(<StudioDistribution/>);
  expect(screen.queryByRole('button',{name:'保存草稿'})).toBeNull();
  expect(screen.getAllByText('【待建设】').length).toBeGreaterThan(0);
  expect(PublishJobApi.createPublishJobs).not.toHaveBeenCalled();
});
test('accounts read the shared owner API; failures remain retryable errors, not empty successes',async()=>{
  vi.mocked(SocialAccountApi.listSocialAccounts).mockRejectedValueOnce(new Error('connection unavailable'));
  render(<StudioDistribution view="accounts"/>);
  await waitFor(()=>expect(screen.getByText('connection unavailable')).toBeDefined());
  expect(screen.queryByText('还没有绑定发布账号')).toBeNull();
  vi.mocked(SocialAccountApi.listSocialAccounts).mockResolvedValue([{id:'a',userId:'u',platform:'douyin',accountName:'owned',displayName:'Account A',status:'expired',boundAt:'2026-10-16T01:00:00Z'}]);
  fireEvent.click(screen.getByRole('button',{name:'重新加载'}));
  await waitFor(()=>expect(screen.getByText('Account A')).toBeDefined());
  expect(screen.getAllByText('需重新授权').length).toBeGreaterThan(0);
});
test('batch pagination and detail retain the server batch identity and actual terminal states',async()=>{
  vi.mocked(PublishJobApi.listBatches).mockResolvedValue({success:true,data:[{projectId:'existing-batch',source:'manual',displayTitle:'Saved title',totalJobs:1,statusCounts:{live:1},progressPct:100,firstCreatedAt:'2026-10-16T01:00:00Z',lastCreatedAt:'2026-10-16T01:00:00Z',firstScheduledAt:null,lastScheduledAt:null,platforms:['douyin'],hasInflight:false}],pagination:{page:0,limit:20,total:21,totalPages:2,hasNext:true,hasPrev:false}});
  vi.mocked(PublishJobApi.listPublishJobs).mockResolvedValue([{id:'j',projectId:'existing-batch',platformId:'douyin',platformName:'抖音',status:'failed',progress:0,title:'Original work',createdAt:'2026-10-16T01:00:00Z',updatedAt:'2026-10-16T01:00:00Z'}]);
  render(<StudioDistribution view="records"/>);
  await waitFor(()=>expect(screen.getByText('Saved title')).toBeDefined());
  fireEvent.click(screen.getByRole('button',{name:/Saved title/}));
  await waitFor(()=>expect(PublishJobApi.listPublishJobs).toHaveBeenCalledWith({projectId:'existing-batch'}));
  await waitFor(()=>expect(screen.getByText('发布失败')).toBeDefined());
  expect(screen.queryByRole('link',{name:/查看平台作品/})).toBeNull();
  fireEvent.click(screen.getByRole('button',{name:'下一页'}));
  await waitFor(()=>expect(PublishJobApi.listBatches).toHaveBeenLastCalledWith({page:1,limit:20}));
  expect(PublishJobApi.createPublishJobs).not.toHaveBeenCalled();
});
