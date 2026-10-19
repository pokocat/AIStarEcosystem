// @vitest-environment jsdom
import {setupSelectFieldDom,createSelectFieldUser} from '../../../../scripts/vitest/select-field';
setupSelectFieldDom();
const selectFieldValue=createSelectFieldUser({fireEvent,screen});
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { Children, cloneElement } from "react";
import { ApiError } from "@ai-star-eco/api-client";
import { StudioBillingDialog, chooseStudioBilling } from "./studio-billing-dialog";
const api = vi.hoisted(() => ({ account: vi.fn(), mine: vi.fn(), myBalance: vi.fn(), policy: vi.fn(), balance: vi.fn() }));
vi.mock("@/canvas-bridge/studio-billing-preference", async importOriginal => ({ ...await importOriginal<object>(), loadStudioBillingAccount: api.account }));
vi.mock("@/canvas-bridge/enterprise-api", () => ({ EnterpriseApi: api }));
vi.mock("@/proto/api", () => ({ WalletApi: { balance: api.balance } }));
vi.mock("./studio-errors", () => ({ normalizeStudioError: (error: Error) => ({ message: error.message }) }));
vi.mock("antd", () => ({
  Checkbox: ({ children, checked, onChange }: any) => <label><input type="checkbox" checked={checked} onChange={onChange}/>{children}</label>,
  ConfigProvider: ({ children }: any) => children,
  Modal: ({ title, children, onOk, onCancel, okButtonProps, okText, cancelText }: any) => <section role="dialog" aria-label={title}>{children}<button onClick={onCancel}>{cancelText}</button><button onClick={onOk} disabled={okButtonProps.disabled}>{okText}</button></section>,
  Alert: ({ title, description, action }: any) => <div role="alert">{title}{description}{action}</div>,
  Button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
  Skeleton: () => <span>正在核对</span>,
  Radio: Object.assign(({ value, disabled, children, checked, onChange }: any) => <label><input type="radio" value={value} disabled={disabled} checked={checked} onChange={onChange}/>{children}</label>, { Group: ({ children, value, onChange, ...props }: any) => <fieldset {...props}>{Children.map(children, (child: any) => cloneElement(child, { checked: child.props.value === value, onChange: () => onChange({ target: { value: child.props.value } }) }))}</fieldset> }),
}));
beforeEach(() => { vi.resetAllMocks(); localStorage.clear(); api.account.mockResolvedValue({ userId: "user", context: { enterprise: { id: "team", name: "创作公司", status: "active" }, member: { status: "active" } } }); api.balance.mockResolvedValue({ totalBalance: 500 }); api.mine.mockResolvedValue([{ enterprise: { id: "team", name: "创作公司", status: "active" }, member: { status: "active" } }]); api.myBalance.mockResolvedValue({ totalBalance: 20, pendingBalance: 5 }); api.policy.mockResolvedValue({ allowedEndpointIds: ["model"], maxActiveJobs: 3 }); });
afterEach(cleanup);
test("new choices start on personal funds even when enterprise is available", async () => {
  const confirm = vi.fn(); render(<StudioBillingDialog details={{ operation: "image", expectedCost: 8, model: "model" }} onConfirm={confirm} onCancel={vi.fn()}/>);
  const submit = screen.getByRole("button", { name: "确认账户并生成" }); await waitFor(() => expect(submit.hasAttribute("disabled")).toBe(false)); fireEvent.click(submit); expect(confirm).toHaveBeenCalledWith({ mode: "personal" });
});
test("enterprise insufficiency never automatically switches to personal", async () => {
  const confirm = vi.fn(); render(<StudioBillingDialog details={{ operation: "video", expectedCost: 40, model: "model" }} onConfirm={confirm} onCancel={vi.fn()}/>);
  const enterprise = await screen.findByRole("radio", { name: /创作公司/ }); fireEvent.click(enterprise); await screen.findByText(/企业积分不足/);
  expect((enterprise as HTMLInputElement).checked).toBe(true); expect(screen.getByRole("button", { name: "确认账户并生成" }).hasAttribute("disabled")).toBe(true); expect(confirm).not.toHaveBeenCalled();
});
test("suspended membership disables enterprise while personal creation remains available", async () => {
  api.mine.mockResolvedValue([{ enterprise: { id: "team", name: "创作公司", status: "active" }, member: { status: "suspended" } }]);
  const confirm = vi.fn(); render(<StudioBillingDialog details={{ operation: "image", expectedCost: 8, model: "model" }} onConfirm={confirm} onCancel={vi.fn()}/>);
  await screen.findByText(/企业成员已停用/); expect(screen.getByRole("radio", { name: /创作公司/ }).hasAttribute("disabled")).toBe(true); fireEvent.click(screen.getByRole("button", { name: "确认账户并生成" })); expect(confirm).toHaveBeenCalledWith({ mode: "personal" });
});
test("a disallowed enterprise model still permits explicit personal payment", async () => {
  render(<StudioBillingDialog details={{ operation: "image", expectedCost: 8, model: "not-allowed" }} onConfirm={vi.fn()} onCancel={vi.fn()}/>);
  await screen.findByText(/此模型未获企业授权/); expect(screen.getByRole("radio", { name: /创作公司/ }).hasAttribute("disabled")).toBe(true);
});
test("text billing discloses the freeze ceiling and actual settlement", async () => {
  render(<StudioBillingDialog details={{ operation: "assistant", expectedCost: 300, model: "model" }} onConfirm={vi.fn()} onCancel={vi.fn()}/>); await screen.findByText(/按实际用量结算/); expect(screen.getByText(/本次最多冻结 300 积分/)).toBeTruthy(); expect(screen.getByText(/未用部分退回/)).toBeTruthy();
});

test("backend enterprise feature disabled permits explicit personal funds only for mine 404", async () => {
  api.mine.mockRejectedValue(new ApiError({ code: "NOT_FOUND", message: "Not found" }, 404));
  const confirm = vi.fn(); render(<StudioBillingDialog details={{ operation: "image", expectedCost: 8 }} onConfirm={confirm} onCancel={vi.fn()}/>);
  await screen.findByText(/企业功能暂未开放/); expect(screen.getByRole("radio", { name: /企业功能暂未开放/ }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "确认账户并生成" })); expect(confirm).toHaveBeenCalledWith({ mode: "personal" });
});
test("enterprise service network failures continue to block every new payment choice", async () => {
  api.mine.mockRejectedValue(new Error("网络暂时中断"));
  const confirm = vi.fn(); render(<StudioBillingDialog details={{ operation: "image", expectedCost: 8 }} onConfirm={confirm} onCancel={vi.fn()}/>);
  await screen.findByText(/网络暂时中断/); expect(screen.getByRole("button", { name: "确认账户并生成" }).hasAttribute("disabled")).toBe(true); expect(confirm).not.toHaveBeenCalled();
});

test("accounts without an enterprise generate with personal funds without a chooser", async () => {
  api.account.mockResolvedValue({ userId: "user" });
  expect(await chooseStudioBilling({ expectedCost: 21 })).toEqual({ mode: "personal" });
  expect(screen.queryByRole("dialog")).toBeNull(); expect(api.balance).not.toHaveBeenCalled();
});
test("saving a chosen enterprise skips future questions and is isolated by account and enterprise", async () => {
  const { readStudioBillingPreference } = await import("@/canvas-bridge/studio-billing-preference");
  const account = await api.account(); const confirm = vi.fn();
  render(<StudioBillingDialog account={account} details={{ operation: "image", expectedCost: 8, model: "model" }} onConfirm={confirm} onCancel={vi.fn()}/>);
  fireEvent.click(await screen.findByRole("radio", { name: /创作公司/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: "保存为默认，下次不再询问" }));
  fireEvent.click(screen.getByRole("button", { name: "确认账户并生成" }));
  expect(confirm).toHaveBeenCalledWith({ mode: "enterprise", enterpriseId: "team" }); cleanup();
  // Defaults do not silently switch payer even if the next job exceeds the available funds.
  expect(await chooseStudioBilling({ expectedCost: 1000 })).toEqual({ mode: "enterprise", enterpriseId: "team" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(readStudioBillingPreference({ ...account, userId: "other" })).toBeUndefined();
  expect(readStudioBillingPreference({ ...account, context: { ...account.context, enterprise: { ...account.context.enterprise, id: "other-team" } } })).toBeUndefined();
});
test("settings can change a default to personal or restore asking each time", async () => {
  const { StudioBillingSettings } = await import("./studio-billing-settings");
  const { readStudioBillingPreference } = await import("@/canvas-bridge/studio-billing-preference");
  render(<StudioBillingSettings />);
  const select = await screen.findByRole("combobox", { name: "生成付款账户" });
  await selectFieldValue(select, "personal");
  expect(await chooseStudioBilling({ expectedCost: 8 })).toEqual({ mode: "personal" });
  await selectFieldValue(select, "ask");
  expect(readStudioBillingPreference(await api.account())).toBeUndefined();
});
