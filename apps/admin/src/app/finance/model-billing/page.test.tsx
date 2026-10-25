// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import type { CreditCampaign, ModelBillingTargetOption, ModelDiscount, ModelPrice } from '@ai-star-eco/types';
const mocks = vi.hoisted(() => ({ identity: { id: 'operator', role: 'OPERATOR' }, targets: vi.fn(), prices: vi.fn(), discounts: vi.fn(), campaigns: vi.fn(), grants: vi.fn(),
  walletOptions: vi.fn(), userOptions: vi.fn(), enterpriseOptions: vi.fn(), savePrice: vi.fn(), saveDiscount: vi.fn(), saveCampaign: vi.fn(), grantScoped: vi.fn() }));
vi.mock('@/lib/useAdminRole', () => ({ useAdminIdentity: () => mocks.identity }));
vi.mock('@/api/model-billing', () => mocks);
vi.mock('@/api/adjustments', () => ({ grantScoped: mocks.grantScoped }));
import Page from './page';
import { ApiError } from '@/api/_client';
import { targetKey } from './shared';
const image: ModelBillingTargetOption = { id: 'image', label: 'Studio · 生图 · 图片模型 · 1024x1024', channelName: '免费渠道',
  target: { appCode: 'aiavatar', action: 'image', endpointId: 'image-channel', providerModel: 'image-v1', specKey: '1024x1024', unit: 'image' } };
const speech: ModelBillingTargetOption = { id: 'speech', label: 'Studio · 配音 · 配音模型', channelName: '声音渠道',
  target: { appCode: 'aiavatar', action: 'speech', endpointId: 'speech-channel', providerModel: 'speech-v1', specKey: 'standard', unit: 'second' } };
const campaign: CreditCampaign = { id: 'trial', name: '图片体验', targets: [image.target], totalIssueLimit: 10000, perWalletIssueLimit: 1000,
  resourceLimit: 100, perWalletDailyResourceLimit: 10, maxConcurrentPerWallet: 1, startsAt: '2020-01-01T00:00:00Z', expiresAt: '2030-01-01T03:04:05.123Z', active: true,
  version: 4, issued: 100, resourceReserved: 0, resourceUsed: 0, updatedAt: '2026-10-25T00:00:00Z' };
const wallet = { id: 'wallet-one', userId: 'user-one', displayName: '测试客户', phone: '13800000001', accountType: 'personal' as const };
const page = <T,>(data: T[], number = 0, total = data.length) => ({ success: true, data, pagination: { page: number, limit: 20, total, totalPages: Math.ceil(total / 20), hasNext: (number + 1) * 20 < total, hasPrev: number > 0 } });
beforeEach(() => {
  vi.resetAllMocks(); sessionStorage.clear(); mocks.identity = { id: 'operator', role: 'OPERATOR' };
  mocks.targets.mockResolvedValue([image, speech]); mocks.prices.mockResolvedValue(page([])); mocks.discounts.mockResolvedValue(page([]));
  mocks.campaigns.mockResolvedValue(page([campaign])); mocks.walletOptions.mockResolvedValue(page([wallet])); mocks.enterpriseOptions.mockResolvedValue(page([]));
  mocks.userOptions.mockResolvedValue(page([{ id: 'new-user', displayName: '尚未消费的新客户' }]));
  mocks.grants.mockResolvedValue(page([])); mocks.savePrice.mockResolvedValue({}); mocks.saveDiscount.mockResolvedValue({}); mocks.saveCampaign.mockResolvedValue({});
});
afterEach(()=>{cleanup();window.history.replaceState({},'', '/');});

test('opening allowance settings from an endpoint row preselects that same endpoint',async()=>{
  window.history.replaceState({},'', '/finance/model-billing?endpointId=image-channel');
  render(<Page />);
  fireEvent.click(await screen.findByRole('button',{name:'新增折扣'}));
  expect((screen.getByLabelText('模型接入点') as HTMLSelectElement).value).toBe('image-channel');
  fireEvent.click(screen.getByRole('button',{name:'取消'}));
  fireEvent.click(screen.getByRole('button',{name:'赠款活动'}));
  fireEvent.click(await screen.findByRole('button',{name:'创建活动'}));
  expect((screen.getByRole('checkbox',{name:/图片模型/}) as HTMLInputElement).checked).toBe(true);
});

test('standard prices link to existing endpoint configuration without creating a second price form', async () => {
  render(<Page />);
  expect(await screen.findByRole('link', { name: '管理模型接入点' })).toBeDefined();
  expect(screen.queryByRole('button', { name: '新增价格' })).toBeNull();
  expect(mocks.prices).not.toHaveBeenCalled();expect(mocks.savePrice).not.toHaveBeenCalled();
});

test('finance can view and issue allowances but cannot change price configuration', async () => {
  mocks.identity = { id: 'finance', role: 'FINANCE_ADMIN' }; render(<Page />);
  expect(await screen.findByRole('link', { name: '管理模型接入点' })).toBeDefined();
  expect(screen.queryByRole('button', { name: '新增价格' })).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '发放与查询' }));
  expect(await screen.findByRole('button', { name: /测试客户.*个人账户/ })).toBeDefined();
});

test('discount editing preserves version and untouched timestamps and retains the draft on conflict', async () => {
  const discount: ModelDiscount = { id: 'discount', name: '原优惠', target: image.target, audience: 'all', factor: 0.8, allowGrants: true,
    startsAt: campaign.startsAt, expiresAt: campaign.expiresAt, active: true, version: 7, updatedAt: campaign.updatedAt };
  mocks.discounts.mockResolvedValue(page([discount])); mocks.saveDiscount.mockRejectedValue(new ApiError({ code: 'MODEL_CONFIG_VERSION_CONFLICT', message: '配置已变更，请刷新后重新编辑' }, 409));
  render(<Page />); fireEvent.click(screen.getByRole('button', { name: '客户折扣' }));
  fireEvent.click(await screen.findByRole('button', { name: '编辑' }));
  fireEvent.change(screen.getByLabelText('优惠名称'), { target: { value: '修改后的八折' } });
  fireEvent.submit(screen.getByRole('form', { name: '编辑客户折扣' }));
  await waitFor(() => expect(mocks.saveDiscount).toHaveBeenCalledWith('discount', expect.objectContaining({ factor: 0.8, expectedVersion: 7, expiresAt: campaign.expiresAt })));
  expect(await screen.findByRole('alert')).toBeDefined(); expect((screen.getByLabelText('优惠名称') as HTMLInputElement).value).toBe('修改后的八折');
});

test('an activity selects endpoint IDs without restricting their metering units', async () => {
  render(<Page />); fireEvent.click(screen.getByRole('button', { name: '赠款活动' }));
  fireEvent.click(await screen.findByRole('button', { name: '创建活动' }));
  const picture = screen.getByRole('checkbox', { name: /图片模型/ }); const sound = screen.getByRole('checkbox', { name: /配音模型/ }) as HTMLInputElement;
  fireEvent.click(picture); expect(sound.disabled).toBe(false); fireEvent.click(sound); expect(sound.checked).toBe(true);
  expect(screen.queryByLabelText(/资源总量/)).toBeNull();
});

test('an activity that already issued grants keeps its endpoints fixed while other fields stay editable', async () => {
  render(<Page />); fireEvent.click(screen.getByRole('button', { name: '赠款活动' }));
  fireEvent.click(await screen.findByRole('button', { name: '编辑' }));
  expect((screen.getByRole('checkbox', { name: /图片模型/ }) as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByRole('checkbox', { name: /配音模型/ }) as HTMLInputElement).disabled).toBe(true);
  expect(screen.getByText(/已经发过赠款，适用模型不能再改/)).toBeDefined();
  fireEvent.change(screen.getByLabelText('活动名称'), { target: { value: '图片体验（续）' } });
  fireEvent.submit(screen.getByRole('form', { name: '编辑赠款活动' }));
  await waitFor(() => expect(mocks.saveCampaign).toHaveBeenCalledWith('trial', expect.objectContaining({ name: '图片体验（续）', targets: [image.target], expectedVersion: 4 })));
});

test('a personal discount can be configured before a customer has a wallet', async () => {
  mocks.walletOptions.mockResolvedValue(page([]));
  render(<Page />); fireEvent.click(screen.getByRole('button', { name: '客户折扣' }));
  fireEvent.click(await screen.findByRole('button', { name: '新增折扣' }));
  fireEvent.change(screen.getByLabelText('优惠名称'), { target: { value: '新客户八折' } });
  fireEvent.change(screen.getByLabelText('模型接入点'), { target: { value: targetKey(image.target) } });
  fireEvent.change(screen.getByLabelText('优惠对象'), { target: { value: 'user' } });
  fireEvent.click(await screen.findByRole('button', { name: '尚未消费的新客户' }));
  fireEvent.submit(screen.getByRole('form', { name: '新增客户折扣' }));
  await waitFor(() => expect(mocks.saveDiscount).toHaveBeenCalledWith(undefined, expect.objectContaining({ audience: 'user', audienceId: 'new-user', factor: 0.8 })));
  expect(mocks.walletOptions).not.toHaveBeenCalled();
});

test('discount paging uses server totals and requests the next page', async () => {
  const discount: ModelDiscount = { id: 'discount', name: '第一条', target: image.target, audience: 'all', factor: 0.8,
    allowGrants: true, startsAt: campaign.startsAt, expiresAt: campaign.expiresAt, active: true, version: 1, updatedAt: campaign.updatedAt };
  mocks.discounts.mockImplementation((number: number) => Promise.resolve(page([{ ...discount, name: number === 0 ? '第一条' : '第二页' }], number, 21)));
  render(<Page />); fireEvent.click(screen.getByRole('button', { name: '客户折扣' }));
  expect(await screen.findByText('第一条')).toBeDefined();fireEvent.click(screen.getByRole('button', { name: '下一页' }));
  expect(await screen.findByText('第二页')).toBeDefined();expect(mocks.discounts).toHaveBeenLastCalledWith(1, expect.any(AbortSignal));
});

test('an uncertain grant survives reload and retries the same payload without allowing an account switch', async () => {
  mocks.grantScoped.mockRejectedValueOnce(new Error('连接中断')).mockResolvedValueOnce({ id: 'approval-one', status: 'pending_approval', amount: 100 });
  const first = render(<Page />); fireEvent.click(screen.getByRole('button', { name: '发放与查询' }));
  fireEvent.click(await screen.findByRole('button', { name: /测试客户.*个人账户/ }));
  const form = await screen.findByRole('form', { name: '发放模型赠款' });
  fireEvent.click(await within(form).findByRole('radio', { name: /图片体验/ }));
  fireEvent.change(within(form).getByLabelText('发放额度（积分）'), { target: { value: '100' } });
  fireEvent.change(within(form).getByLabelText('发放原因'), { target: { value: '模型试用' } }); fireEvent.submit(form);
  expect(await screen.findByRole('alert')).toBeDefined();
  expect((screen.getByRole('button', { name: '模型价格' }) as HTMLButtonElement).disabled).toBe(true);
  const original = mocks.grantScoped.mock.calls[0][0]; expect(sessionStorage.getItem('model-scoped-grant:operator')).toContain(original.requestId);
  first.unmount(); render(<Page />); fireEvent.click(screen.getByRole('button', { name: '发放与查询' }));
  fireEvent.click(await screen.findByRole('button', { name: '重试原请求' }));
  await waitFor(() => expect(mocks.grantScoped).toHaveBeenCalledTimes(2)); expect(mocks.grantScoped.mock.calls[1][0]).toEqual(original);
  expect(await screen.findByText(/已提交审批，批准后到账/)).toBeDefined(); expect(sessionStorage.getItem('model-scoped-grant:operator')).toBeNull();
});

test('account search failure is shown and retried rather than reported as an empty list', async () => {
  mocks.walletOptions.mockRejectedValueOnce(new Error('账户查询失败')).mockResolvedValueOnce(page([wallet]));
  render(<Page />); fireEvent.click(screen.getByRole('button', { name: '发放与查询' }));
  expect(await screen.findByRole('alert')).toBeDefined(); expect(screen.queryByText('没有匹配的账户')).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: '重试查询' })); expect(await screen.findByRole('button', { name: /测试客户.*个人账户/ })).toBeDefined();
});

test('a confirmed grant refreshes issuance totals and preserves the selected campaign deadline', async () => {
  mocks.campaigns.mockResolvedValueOnce(page([campaign])).mockResolvedValue(page([{ ...campaign, issued: 200 }]));
  mocks.grantScoped.mockResolvedValue({ id: 'approval-one', status: 'approved', amount: 100 });
  render(<Page />); fireEvent.click(screen.getByRole('button', { name: '发放与查询' }));
  fireEvent.click(await screen.findByRole('button', { name: /测试客户.*个人账户/ }));
  const form = await screen.findByRole('form', { name: '发放模型赠款' });
  fireEvent.click(await within(form).findByRole('radio', { name: /图片体验/ }));
  fireEvent.change(within(form).getByLabelText('发放额度（积分）'), { target: { value: '100' } });
  fireEvent.change(within(form).getByLabelText('发放原因'), { target: { value: '体验发放' } }); fireEvent.submit(form);
  expect(await screen.findByText(/已发放模型赠款/)).toBeDefined();
  await waitFor(() => expect(within(form).getByRole('radio', { name: /已发 200/ })).toBeDefined());
  expect(mocks.grantScoped).toHaveBeenCalledWith(expect.objectContaining({ expiresAt: campaign.expiresAt }));
  fireEvent.click(within(form).getByRole('button', { name: '再发一笔' }));
  expect((within(form).getByRole('button', { name: '确认发放' }) as HTMLButtonElement).disabled).toBe(true);
  expect((within(form).getByRole('radio') as HTMLInputElement).checked).toBe(false);
});
