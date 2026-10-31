// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { StudioRechargeDialog } from "./studio-recharge-dialog";
const api = vi.hoisted(() => ({ channels: vi.fn(), order: vi.fn(), syncOrder: vi.fn(), checkout: vi.fn() }));
vi.mock("@/proto/api", () => ({ WalletApi: api }));
vi.mock("antd", () => ({
  Modal: ({children, footer}: any) => <div role="dialog">{children}{footer}</div>,
  Button: ({children, onClick, disabled}: any) => <button disabled={disabled} onClick={onClick}>{children}</button>,
  Radio: Object.assign(({children}: any) => <span>{children}</span>, {Group: ({children}: any) => <div>{children}</div>}),
  Space: ({children}: any) => <div>{children}</div>, Spin: () => <span>loading</span>,
  Alert: ({title}: any) => <div role="alert">{title}</div>, QRCode: ({value}: any) => <div data-testid="qr">{value}</div>,
}));
const pack = {id:"pkg",tag:"标准包",credits:10000,priceCents:9900};
const order = {id:"ro-test",packageId:"pkg",credits:10000,priceCents:9900,status:"pending",wayCode:"WX_NATIVE"};
beforeEach(() => { vi.clearAllMocks(); window.history.replaceState({},"","/studio#/membership"); api.channels.mockResolvedValue([{code:"wechat",label:"微信支付",defaultWayCode:"WX_NATIVE",wayCodes:[]}]); api.order.mockResolvedValue(order); });
afterEach(cleanup);
test("Native order displays QR; only server-paid result refreshes balance", async () => {
  api.checkout.mockResolvedValue({orderId:"ro-test",payDataType:"qr",payData:"weixin://wxpay/test"});
  api.syncOrder.mockResolvedValue({...order,status:"paid"});
  const paid=vi.fn(); render(<StudioRechargeDialog pack={pack} onClose={vi.fn()} onPaid={paid}/>);
  fireEvent.click(await screen.findByRole("button",{name:"确认支付"}));
  await screen.findByTestId("qr"); expect(api.checkout).toHaveBeenCalledWith("pkg","wechat","WX_NATIVE");
  expect(paid).not.toHaveBeenCalled(); expect(location.search).toContain("rechargeOrder=ro-test");
  fireEvent.click(screen.getByRole("button",{name:"我已支付，刷新结果"}));
  await screen.findByText("充值成功，积分已到账"); expect(paid).toHaveBeenCalledTimes(1);
});
test("reload recovers the existing order without creating another", async () => {
  render(<StudioRechargeDialog initialOrderId="ro-test" onClose={vi.fn()} onPaid={vi.fn()}/>);
  await screen.findByRole("button",{name:"重新打开支付"}); expect(api.order).toHaveBeenCalledWith("ro-test"); expect(api.checkout).not.toHaveBeenCalled();
});
test("empty channels do not allow payment", async () => {
  api.channels.mockResolvedValue([]); render(<StudioRechargeDialog pack={pack} onClose={vi.fn()} onPaid={vi.fn()}/>);
  await screen.findByText("暂无可用支付方式，请稍后再试或联系客服");
  expect((screen.getByRole("button",{name:"确认支付"}) as HTMLButtonElement).disabled).toBe(true);
});
test("query failure remains pending without declaring success", async () => {
  api.syncOrder.mockRejectedValue(new Error("支付结果暂未确认")); const paid=vi.fn();
  render(<StudioRechargeDialog initialOrderId="ro-test" onClose={vi.fn()} onPaid={paid}/>);
  fireEvent.click(await screen.findByRole("button",{name:"我已支付，刷新结果"}));
  await screen.findByText("支付结果暂未确认"); expect(paid).not.toHaveBeenCalled();
});
