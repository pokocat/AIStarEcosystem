// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,test,vi} from 'vitest';
import {ApiError} from '@ai-star-eco/api-client';
import {StudioConversationPublic} from './studio-conversation-public';
const api=vi.hoisted(()=>({read:vi.fn(),copy:vi.fn(),push:vi.fn(),authed:vi.fn()}));
vi.mock('next/navigation',()=>({useRouter:()=>({push:api.push})}));
vi.mock('@/proto/api',()=>({auth:{isAuthed:api.authed}}));
vi.mock('@/canvas-bridge/studio-share-api',()=>({readConversationShare:api.read,copyConversationShare:api.copy}));
afterEach(cleanup);beforeEach(()=>{vi.clearAllMocks();sessionStorage.clear();api.authed.mockReturnValue(true);api.read.mockResolvedValue({snapshot:{title:'角色讨论',mode:'general',turns:[{role:'user',content:'<script>unsafe</script>'},{role:'assistant',content:'先制作人物设定'}]},createdAt:'2026-10-08T00:00:00Z'});api.copy.mockResolvedValue({projectId:'new-p'});});
test('anonymous reader sees inert text and login returns to this share without copying',async()=>{
 api.authed.mockReturnValue(false);render(<StudioConversationPublic token="abc"/>);await screen.findByText('<script>unsafe</script>');expect(document.querySelector('script')).toBeNull();fireEvent.click(screen.getByRole('button',{name:'在 Studio 中继续创作'}));expect(api.push).toHaveBeenCalledWith('/login?next=%2Fshared%2Fconversations%2Fabc');expect(api.copy).not.toHaveBeenCalled();
});
test('copy failure and remount retry the same key and only navigate after accepted project',async()=>{
 api.copy.mockRejectedValueOnce(new Error('timeout'));const first=render(<StudioConversationPublic token="abc"/>);await screen.findByText('先制作人物设定');fireEvent.click(screen.getByRole('button',{name:'在 Studio 中继续创作'}));await screen.findByRole('alert');expect(api.push).not.toHaveBeenCalled();const key=api.copy.mock.calls[0][1];first.unmount();render(<StudioConversationPublic token="abc"/>);await screen.findByText('先制作人物设定');fireEvent.click(screen.getByRole('button',{name:'在 Studio 中继续创作'}));await waitFor(()=>expect(api.push).toHaveBeenCalledWith('/projects/new-p?start=assistant'));expect(api.copy.mock.calls[1][1]).toBe(key);
});
test('revoked link is a terminal empty state and cannot copy',async()=>{
 api.read.mockRejectedValue(new ApiError({code:'STUDIO_SHARE_NOT_FOUND',message:'revoked'},404));render(<StudioConversationPublic token="abc"/>);await screen.findByRole('heading',{name:'分享链接已失效'});expect(screen.queryByRole('button',{name:'在 Studio 中继续创作'})).toBeNull();expect(api.copy).not.toHaveBeenCalled();
});
