// @vitest-environment jsdom
import { useCallback,useState } from 'react';
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,beforeEach,expect,test,vi } from 'vitest';
import { SocialAccountApi } from '@ai-star-eco/api-client';
import { StudioSocialBind } from './studio-social-bind';
vi.mock('@ai-star-eco/api-client',()=>({SocialAccountApi:{initBind:vi.fn(),pollBind:vi.fn(),cancelBind:vi.fn(),submitBindInteraction:vi.fn()}}));
vi.mock('./studio-errors',()=>({useStudioErrorState:()=>{const [v,s]=useState('');return [v,useCallback((e:any)=>s(e?.message||e||''),[])];},StudioErrorNotice:({error}:any)=><span>{error}</span>,reportStudioError:vi.fn()}));
vi.mock('antd',()=>({Modal:({children,onCancel}:any)=><div role="dialog">{children}<button onClick={onCancel}>关闭</button></div>,Button:({children,loading,...p}:any)=><button {...p} disabled={p.disabled||loading}>{children}</button>,Input:(p:any)=><input {...p}/>,Select:({options,...p}:any)=><select {...p}>{options.map((o:any)=><option key={o.value} value={o.value}>{o.label}</option>)}</select>}));
afterEach(cleanup);
beforeEach(()=>{vi.clearAllMocks();vi.mocked(SocialAccountApi.cancelBind).mockResolvedValue(undefined);vi.mocked(SocialAccountApi.pollBind).mockResolvedValue({status:'pending'});});
const init = {sessionTicket:'ticket-original',qrImageDataUrl:'data:image/png;base64,aW1hZ2U=',expiresAt:'2099-10-16T01:00:00Z'};
function start(){fireEvent.change(screen.getByRole('textbox',{name:'账号备注'}),{target:{value:'测试账号'}});fireEvent.click(screen.getByRole('button',{name:'获取登录二维码'}));}
test('closing during initialization cancels the late ticket instead of leaking a login session',async()=>{
  let finish!:(v:typeof init)=>void;vi.mocked(SocialAccountApi.initBind).mockImplementation(()=>new Promise(r=>{finish=r;}));
  const view=render(<StudioSocialBind onClose={()=>{}} onBound={()=>{}}/>);start();view.unmount();finish(init);
  await waitFor(()=>expect(SocialAccountApi.cancelBind).toHaveBeenCalledExactlyOnceWith('ticket-original'));
  expect(SocialAccountApi.pollBind).not.toHaveBeenCalled();
});
test('a poll failure resumes the same ticket and only a confirmed success completes binding',async()=>{
  vi.mocked(SocialAccountApi.initBind).mockResolvedValue(init);vi.mocked(SocialAccountApi.pollBind).mockRejectedValueOnce(new Error('网络中断'));
  const done=vi.fn(),close=vi.fn();render(<StudioSocialBind onClose={close} onBound={done}/>);start();
  await waitFor(()=>expect(screen.getByText('网络中断')).toBeDefined());expect(done).not.toHaveBeenCalled();
  const account={id:'a',userId:'u',platform:'douyin' as const,accountName:'owned',status:'active' as const,boundAt:'2026-10-16T01:00:00Z'};
  vi.mocked(SocialAccountApi.pollBind).mockResolvedValue({status:'success',account});
  fireEvent.click(screen.getByRole('button',{name:'继续查询本次绑定'}));
  await waitFor(()=>expect(done).toHaveBeenCalledExactlyOnceWith(account));
  expect(close).toHaveBeenCalledOnce();expect(SocialAccountApi.initBind).toHaveBeenCalledOnce();
  expect(SocialAccountApi.pollBind).toHaveBeenLastCalledWith('ticket-original');
  expect(SocialAccountApi.cancelBind).not.toHaveBeenCalled();
});
