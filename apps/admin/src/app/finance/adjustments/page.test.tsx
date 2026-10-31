// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {afterEach,beforeEach,expect,test,vi} from 'vitest';
const mocks=vi.hoisted(()=>({identity:{id:'root',role:'SUPER_ADMIN',accountSource:'admin'},list:vi.fn(),grant:vi.fn(),approve:vi.fn(),success:vi.fn(),danger:vi.fn()}));
vi.mock('@/lib/useAdminRole',()=>({useAdminIdentity:()=>mocks.identity}));
vi.mock('@/components/feedback',()=>({useToast:()=>({success:mocks.success,danger:mocks.danger,warning:vi.fn()})}));
vi.mock('@/api',()=>({AdjustmentsApi:{listRequests:mocks.list,grant:mocks.grant,approveRequest:mocks.approve,rejectRequest:vi.fn(),compensate:vi.fn()}}));
import AdminAdjustmentsPage from './page';
beforeEach(()=>{
 vi.clearAllMocks();mocks.identity={id:'root',role:'SUPER_ADMIN',accountSource:'admin'};
 mocks.list.mockResolvedValue([{id:'original',type:'grant',targetUserId:'user',amount:10000,makerId:'root',reason:'用户授权'}]);
 mocks.approve.mockResolvedValue({});mocks.grant.mockResolvedValue({pending:false,amount:10000});
});
afterEach(cleanup);
test('super admin can approve their original pending request and sees the correct policy',async()=>{
 render(<AdminAdjustmentsPage/>);
 expect(screen.getByText('超管发放即时到账，无需他人复核')).toBeDefined();
 const approve=await screen.findByRole('button',{name:'批准入账'});expect((approve as HTMLButtonElement).disabled).toBe(false);
 fireEvent.click(approve);await waitFor(()=>expect(mocks.approve).toHaveBeenCalledWith('original'));
 expect(mocks.success).toHaveBeenCalledWith({title:'已批准并入账'});
});
test('super admin large grant announces immediate credit instead of pending approval',async()=>{
 render(<AdminAdjustmentsPage/>);
 fireEvent.change(screen.getAllByPlaceholderText('用户 userId')[1],{target:{value:'user'}});
 fireEvent.change(screen.getByPlaceholderText('如 100'),{target:{value:'10000'}});
 fireEvent.change(screen.getByPlaceholderText('如 拉新激励'),{target:{value:'用户授权'}});
 fireEvent.click(screen.getByRole('button',{name:'发放赠送'}));
 await waitFor(()=>expect(mocks.grant).toHaveBeenCalledWith(expect.objectContaining({userId:'user',amount:10000,reason:'用户授权'})));
 expect(mocks.success).toHaveBeenCalledWith(expect.objectContaining({title:expect.stringContaining('已发放')}));
});
test('finance cannot approve their own request, and an operator cannot approve',async()=>{
 for(const role of ['FINANCE_ADMIN','OPERATOR']) {
  mocks.identity={id:'root',role,accountSource:'admin'};
  const view=render(<AdminAdjustmentsPage/>);
  const approve=await screen.findByRole('button',{name:'批准入账'});expect((approve as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(approve);expect(mocks.approve).not.toHaveBeenCalled();view.unmount();
 }
});
test('restricted approval identifies the destination and expiry before approving',async()=>{
 mocks.list.mockResolvedValue([{id:'restricted',type:'scoped_grant',targetUserId:'member-user',walletId:'member-wallet',
  campaignId:'image-trial',expiresAt:'2030-01-01T00:00:00Z',amount:6000,makerId:'operator',reason:'模型试用'}]);
 render(<AdminAdjustmentsPage/>);
 expect(await screen.findByText(/模型赠款 · \+6,000/)).toBeDefined();
 expect(screen.getByText(/消费账户 member-wallet · 有效期至/)).toBeDefined();
 expect(screen.getByText(/活动 image-trial/)).toBeDefined();
 fireEvent.click(screen.getByRole('button',{name:'批准入账'}));
 await waitFor(()=>expect(mocks.approve).toHaveBeenCalledWith('restricted'));
});
