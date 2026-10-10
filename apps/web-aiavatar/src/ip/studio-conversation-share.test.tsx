// @vitest-environment jsdom
import { cleanup,fireEvent,render,screen,waitFor } from '@testing-library/react';
import { afterEach,beforeEach,expect,test,vi } from 'vitest';
import { StudioConversationShare } from './studio-conversation-share';
const api=vi.hoisted(()=>({preview:vi.fn(),create:vi.fn(),revoke:vi.fn(),save:vi.fn()}));
vi.mock('@/canvas-bridge/studio-share-api',()=>({previewConversationShare:api.preview,createConversationShare:api.create,revokeConversationShare:api.revoke}));
vi.mock('@/canvas-bridge/studio-save',()=>({saveStudioDocument:api.save}));
vi.mock('antd',()=>({Button:({loading,icon,...p}:any)=><button {...p} disabled={p.disabled||loading}>{p.children}</button>,Input:(p:any)=><input {...p}/>,Skeleton:()=> <p>loading</p>,Modal:({open,title,children}:any)=>open?<div role="dialog" aria-label={title}>{children}</div>:null}));
const snapshot={title:'角色讨论',mode:'general',turns:[{role:'user',content:'紫发女孩在咖啡店'},{role:'assistant',content:'先制作人物设定，再规划镜头'}]};
afterEach(cleanup);beforeEach(()=>{vi.clearAllMocks();api.save.mockResolvedValue(undefined);api.preview.mockResolvedValue({snapshot,snapshotHash:'hash'});api.create.mockResolvedValue({token:'abc',path:'/shared/conversations/abc',createdAt:'2026-10-08'});api.revoke.mockResolvedValue({revoked:true});});
test('preview persists first and publication requires a separate explicit click with exact hash',async()=>{
 render(<StudioConversationShare projectId="p" nodeId="n" disabled={false}/>);fireEvent.click(screen.getByRole('button',{name:'分享对话'}));await screen.findByText('紫发女孩在咖啡店');
 expect(api.save).toHaveBeenCalledWith('p');expect(api.create).not.toHaveBeenCalled();fireEvent.click(screen.getByRole('button',{name:'创建分享链接'}));await waitFor(()=>expect(api.create).toHaveBeenCalledWith('p','n','hash'));expect((screen.getByRole('textbox',{name:'对话分享链接'}) as HTMLInputElement).value).toContain('/shared/conversations/abc');
 fireEvent.click(screen.getByRole('button',{name:'撤销分享'}));await waitFor(()=>expect(api.revoke).toHaveBeenCalledWith('p','n','abc'));expect(screen.queryByRole('textbox',{name:'对话分享链接'})).toBeNull();
});
test('failed save does not preview or publish and a retry preserves the exact source',async()=>{
 api.save.mockRejectedValueOnce(new Error('save failed'));render(<StudioConversationShare projectId="p" nodeId="n" disabled={false}/>);fireEvent.click(screen.getByRole('button',{name:'分享对话'}));await screen.findByRole('alert');expect(api.preview).not.toHaveBeenCalled();expect(api.create).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('button',{name:'重新预览'}));await screen.findByText('先制作人物设定，再规划镜头');expect(api.preview).toHaveBeenCalledWith('p','n');
});
test('new or locked conversations cannot open sharing',()=>{
 render(<StudioConversationShare projectId="p" disabled/>);expect((screen.getByRole('button',{name:'分享对话'}) as HTMLButtonElement).disabled).toBe(true);expect(api.preview).not.toHaveBeenCalled();
});
