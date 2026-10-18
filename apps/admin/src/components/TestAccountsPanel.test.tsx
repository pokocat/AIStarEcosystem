// @vitest-environment jsdom
import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {test,expect,vi,beforeEach,afterEach} from 'vitest';
import {TestAccountsPanel} from './TestAccountsPanel';
const api=vi.hoisted(()=>({list:vi.fn(),create:vi.fn(),login:vi.fn(),suspend:vi.fn()}));
vi.mock('@/api/test-accounts',()=>({TestAccountsApi:api}));
const account={uid:'TEST_0123456789ABCDEFGHJKMNPQRS',displayName:'测试 · 企业 A',status:'active'};
beforeEach(()=>{vi.clearAllMocks();api.list.mockResolvedValue({accounts:[account],total:1,page:0});api.create.mockResolvedValue(account);api.login.mockResolvedValue({loginUrl:'https://id.aibuzz.cn/test-login#ticket=opaque',expiresAt:'2026-10-19T00:00:00Z'});api.suspend.mockResolvedValue({});});
afterEach(cleanup);
test('creating an independent test account shows one-time entry without asking for a phone',async()=>{
 render(<TestAccountsPanel/>);await screen.findByText(account.displayName);fireEvent.change(screen.getByRole('textbox',{name:'测试账号名称'}),{target:{value:'企业 A'}});fireEvent.click(screen.getByRole('button',{name:'创建测试账号'}));
 await waitFor(()=>expect(api.create).toHaveBeenCalledWith('企业 A'));expect(await screen.findByRole('textbox',{name:'测试登录链接'})).toBeDefined();expect(api.login).toHaveBeenCalledWith(account.uid);expect(screen.queryByLabelText('手机号')).toBeNull();
});
test('create failure retains name and shows actionable error',async()=>{api.create.mockRejectedValue(new Error('服务暂不可用'));render(<TestAccountsPanel/>);fireEvent.change(screen.getByRole('textbox',{name:'测试账号名称'}),{target:{value:'保留名称'}});fireEvent.click(screen.getByRole('button',{name:'创建测试账号'}));expect(await screen.findByRole('alert')).toHaveProperty('textContent','服务暂不可用');expect((screen.getByRole('textbox',{name:'测试账号名称'}) as HTMLInputElement).value).toBe('保留名称');expect(api.login).not.toHaveBeenCalled();});
test('suspend sends only selected test uid and inactive rows cannot get new entries',async()=>{api.list.mockResolvedValueOnce({accounts:[account],total:1,page:0}).mockResolvedValue({accounts:[{...account,status:'suspended'}],total:1,page:0});render(<TestAccountsPanel/>);fireEvent.click(await screen.findByRole('button',{name:'停用'}));await waitFor(()=>expect(api.suspend).toHaveBeenCalledWith(account.uid));await screen.findByText('已停用');expect((screen.getByRole('button',{name:'生成登录入口'}) as HTMLButtonElement).disabled).toBe(true);});
