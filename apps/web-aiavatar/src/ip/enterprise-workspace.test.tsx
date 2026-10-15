// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { webcrypto } from "node:crypto";
import { EnterpriseWorkspace } from "./enterprise-workspace";

const api = vi.hoisted(() => ({ mine: vi.fn(), wallet: vi.fn(), memberBalances: vi.fn(), myBalance: vi.fn(), recharges: vi.fn(), previewPoints: vi.fn(), transferPoints: vi.fn(), requestRecharge: vi.fn(), create: vi.fn(), accept: vi.fn() }));
vi.mock("@/canvas-bridge/enterprise-api", () => ({ EnterpriseApi: api }));
vi.mock("@/components/hub/auth", () => ({ useRequireAuth: () => "ok", PlatformGateScreen: () => <div>需要开通</div> }));
vi.mock("@/proto/api", () => ({ WalletApi: { balance: vi.fn().mockResolvedValue({ totalBalance: 200 }) } }));
vi.mock("next/link", () => ({ default: (props: any) => <a {...props}/> }));
vi.mock("./studio-page", () => ({ StudioPage: ({ title, actions, children }: any) => <main><h1>{title}</h1>{actions}{children}</main>, StudioPageFilters: ({ items, onChange }: any) => <nav>{items.map((item: any) => <button key={item.value} onClick={() => onChange(item.value)}>{item.label}</button>)}</nav> }));
vi.mock("./studio-errors", () => ({ normalizeStudioError: (error: any) => ({ code: error.code || "ERROR", message: error.message || String(error) }) }));
vi.mock("antd", () => ({
  ConfigProvider: ({ children }: any) => children,
  Alert: ({ title, description }: any) => <div role="alert">{title}{description}</div>,
  Button: ({ icon, loading, children, type, ...props }: any) => <button {...props} disabled={loading || props.disabled}>{children}</button>,
  Checkbox: ({ children, ...props }: any) => <label><input {...props} type="checkbox"/>{children}</label>,
  Empty: ({ description }: any) => <p>{description}</p>,
  Input: Object.assign((props: any) => <input {...props}/>, { Password: (props: any) => <input {...props}/>, TextArea: ({ showCount, ...props }: any) => <textarea {...props}/> }),
  InputNumber: ({ onChange, precision, ...props }: any) => <input {...props} type="number" value={props.value ?? ""} onChange={event => onChange(event.target.value ? Number(event.target.value) : null)}/>,
  Modal: ({ open, title, children, footer, onOk, okText, okButtonProps, confirmLoading }: any) => open ? <section role="dialog" aria-label={title}><h2>{title}</h2>{children}{footer || <button disabled={confirmLoading || okButtonProps?.disabled} onClick={onOk}>{okText}</button>}</section> : null,
  Pagination: () => null,
  Skeleton: () => <p>读取中</p>,
  Tag: ({ children }: any) => <span>{children}</span>,
  Table: ({ dataSource, rowSelection, columns }: any) => <table><tbody>{dataSource.map((row: any) => <tr key={row.memberId || row.id}>{rowSelection && <td><input type="checkbox" {...rowSelection.getCheckboxProps(row)} checked={rowSelection.selectedRowKeys.includes(row.memberId)} onChange={event => rowSelection.onChange(event.target.checked ? [...rowSelection.selectedRowKeys, row.memberId] : rowSelection.selectedRowKeys.filter((id: string) => id !== row.memberId))}/></td>}{columns.map((column: any, index: number) => <td key={index}>{column.render ? column.render(row[column.dataIndex], row) : row[column.dataIndex]}</td>)}</tr>)}</tbody></table>,
}));

const ownerContext = { enterprise: { id: "enterprise", name: "创作企业" }, member: { userId: "owner", role: "owner" }, permissions: ["points.manage", "billing.read", "billing.request"] };
const balances = [{ memberId: "m1", userId: "user", displayName: "张三", role: "member", status: "active", totalBalance: 50, pendingBalance: 10 }];
const preview = { enterpriseId: "enterprise", direction: "allocate", memberCount: 1, totalAmount: 100, rootAvailableBefore: 1000, rootAvailableAfter: 900, confirmationFingerprint: "fingerprint", items: [{ memberId: "m1", amount: 100, availableBefore: 50, availableAfter: 150, pendingBalance: 10 }] };
const page = (data: unknown[]) => ({ data, pagination: { total: data.length, totalPages: 1 } });
beforeEach(() => {
  vi.clearAllMocks(); vi.stubGlobal("crypto", webcrypto); vi.stubEnv("NEXT_PUBLIC_ENTERPRISE_ENABLED", "1");
  api.mine.mockResolvedValue([ownerContext]);
  api.wallet.mockResolvedValue({ unallocated: 1000, allocated: 50, pending: 10, spent: 20 });
  api.myBalance.mockResolvedValue(balances[0]); api.memberBalances.mockResolvedValue(page(balances)); api.recharges.mockResolvedValue(page([]));
  api.previewPoints.mockResolvedValue(preview); api.transferPoints.mockResolvedValue({ id: "batch" }); api.requestRecharge.mockResolvedValue({ id: "order" });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function openAllocation() {
  fireEvent.click(await screen.findByRole("checkbox", { name: "选择张三" }));
  fireEvent.click(screen.getByRole("button", { name: "分配积分" }));
  fireEvent.change(screen.getByLabelText("每人分配积分"), { target: { value: "100" } });
  fireEvent.click(screen.getByRole("button", { name: "预览本次操作" }));
  return await screen.findByRole("button", { name: "确认分配 100 积分" });
}

test("allocation requires server preview and an explicit total confirmation", async () => {
  render(<EnterpriseWorkspace/>);
  const confirm = await openAllocation();
  expect(api.previewPoints).toHaveBeenCalledWith("enterprise", "allocate", { items: [{ memberId: "m1", amount: 100 }] });
  expect(api.transferPoints).not.toHaveBeenCalled();
  fireEvent.click(confirm);
  await screen.findByText("分配完成，共 100 积分。");
  expect(api.transferPoints).toHaveBeenCalledWith("enterprise", "allocate", expect.objectContaining({ confirmationFingerprint: "fingerprint", items: [{ memberId: "m1", amount: 100 }] }));
  expect(api.memberBalances).toHaveBeenCalledTimes(2);
});

test("an uncertain submission retry keeps its idempotency key", async () => {
  api.transferPoints.mockRejectedValueOnce(new TypeError("网络中断")).mockResolvedValueOnce({ id: "batch" });
  render(<EnterpriseWorkspace/>);
  fireEvent.click(await openAllocation());
  await screen.findByText("网络中断");
  fireEvent.click(screen.getByRole("button", { name: "确认分配 100 积分" }));
  await screen.findByText("分配完成，共 100 积分。");
  expect(api.transferPoints.mock.calls[0][2].clientRequestId).toBe(api.transferPoints.mock.calls[1][2].clientRequestId);
});

test("stale balances require another preview and never auto-submit", async () => {
  api.transferPoints.mockRejectedValueOnce({ code: "ENTERPRISE_POINTS_PREVIEW_STALE", message: "余额已变化，请重新预览" });
  render(<EnterpriseWorkspace/>);
  fireEvent.click(await openAllocation());
  await screen.findByText("余额已变化，请重新预览");
  expect(screen.queryByRole("button", { name: "确认分配 100 积分" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "重新预览" }));
  await screen.findByRole("button", { name: "确认分配 100 积分" });
  expect(api.transferPoints).toHaveBeenCalledTimes(1);
  expect(api.previewPoints).toHaveBeenCalledTimes(2);
});

test("reclaim-all preserves null intent in preview and submit while frozen points stay visible", async () => {
  api.previewPoints.mockResolvedValue({ ...preview, direction: "reclaim", totalAmount: 50, rootAvailableAfter: 1050, items: [{ ...preview.items[0], amount: 50, availableAfter: 0 }] });
  render(<EnterpriseWorkspace/>);
  fireEvent.click(await screen.findByRole("checkbox", { name: "选择张三" }));
  fireEvent.click(screen.getByRole("button", { name: "回收积分" }));
  fireEvent.click(screen.getByLabelText("回收所选成员全部可用企业积分"));
  fireEvent.click(screen.getByRole("button", { name: "预览本次操作" }));
  fireEvent.click(await screen.findByRole("button", { name: "确认回收 50 积分" }));
  await screen.findByText("回收完成，共 50 积分。");
  expect(api.transferPoints).toHaveBeenCalledWith("enterprise", "reclaim", expect.objectContaining({ items: [{ memberId: "m1", amount: null }] }));
});

test("member scope hides management and team billing controls", async () => {
  api.mine.mockResolvedValue([{ ...ownerContext, member: { role: "member", userId: "user" }, permissions: ["enterprise.read"] }]);
  render(<EnterpriseWorkspace/>);
  await screen.findByText("张三");
  expect(screen.queryByRole("button", { name: "分配积分" })).toBeNull();
  expect(screen.queryByRole("button", { name: "申请充值" })).toBeNull();
  expect(api.recharges).not.toHaveBeenCalled();
  expect(api.wallet).not.toHaveBeenCalled();
  expect(screen.getByText("我的可用企业积分")).toBeDefined();
  expect(screen.queryByText("企业待分配积分")).toBeNull();
});

test("a failed summary does not display zero balances or a false empty enterprise", async () => {
  api.wallet.mockRejectedValue(new Error("余额读取失败"));
  render(<EnterpriseWorkspace/>);
  await screen.findByText(/余额读取失败/);
  expect(screen.queryByText("企业待分配积分")).toBeNull();
  expect(screen.queryByText("你还没有加入企业")).toBeNull();
});

test("a recharge requester can read own applications without team financial access", async () => {
  api.mine.mockResolvedValue([{ ...ownerContext, member: { role: "member", userId: "user" }, permissions: ["enterprise.read", "billing.request"] }]);
  render(<EnterpriseWorkspace/>);
  fireEvent.click(await screen.findByRole("button", { name: "我的充值申请" }));
  expect(api.recharges).toHaveBeenCalledWith("enterprise", 0, 20);
  expect(api.wallet).not.toHaveBeenCalled();
  expect(screen.getByText("这里仅展示你发起的申请，核准后积分进入企业待分配余额。")).toBeDefined();
});

test("recharge application reports pending processing and reloads authoritative data", async () => {
  render(<EnterpriseWorkspace/>);
  fireEvent.click(await screen.findByRole("button", { name: "申请充值" }));
  fireEvent.change(screen.getByLabelText("充值说明"), { target: { value: "联系张经理充值" } });
  fireEvent.click(screen.getByRole("button", { name: "提交申请" }));
  await screen.findByText("充值申请已提交，金额与积分由平台财务核准后入账。");
  expect(api.requestRecharge).toHaveBeenCalledWith("enterprise", expect.objectContaining({ note: "联系张经理充值" }));
  await waitFor(() => expect(api.wallet).toHaveBeenCalledTimes(2));
});

test("disabled feature exposes no controls and does not request enterprise APIs", () => {
  vi.stubEnv("NEXT_PUBLIC_ENTERPRISE_ENABLED", "0");
  render(<EnterpriseWorkspace/>);
  expect(screen.getByText(/企业管理尚未开放/)).toBeDefined();
  expect(api.mine).not.toHaveBeenCalled();
});
