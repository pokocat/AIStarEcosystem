import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { ApiError } from "@ai-star-eco/api-client";
import type { RechargeOrder } from "@ai-star-eco/types/wallet";

// §8.0.1 ⑩：断行为不断文案。收银台从 ?order= 进来读不到订单时：
//   - 404 / 403：停止轮询，给出能离开的错误态（之前永远「加载中…」、每 3.5 秒请求一次）；
//   - 一直 5xx：轮询有上限，错误态里能重试。
// 页面状态按 data-checkout-state 取，不按字。

const getRechargeOrder = vi.fn();
const syncRechargeOrder = vi.fn();
vi.mock("@ai-star-eco/api-client", async (importOriginal) => {
  const orig = await importOriginal<Record<string, unknown>>();
  return {
    ...orig,
    AccountApi: {
      listRechargePackages: () => Promise.resolve([]),
      getRechargeChannels: () => Promise.resolve([]),
      getRechargeOrder: (...a: unknown[]) => getRechargeOrder(...a),
      syncRechargeOrder: (...a: unknown[]) => syncRechargeOrder(...a),
      getMyWallet: () => Promise.resolve(null),
    },
  };
});
let search = new URLSearchParams("order=ro-x");
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => search,
}));

import CashierPage from "./page";
import { checkoutErrorMessage, isOrderGone } from "./checkout-errors";

async function flush() {
  await act(async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  });
}
async function advance(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  await flush();
}
const stateOf = (c: HTMLElement) => c.querySelector<HTMLElement>("[data-checkout-state]")?.dataset.checkoutState;

const PENDING: RechargeOrder = {
  id: "ro-x",
  userId: "u",
  packageId: "pkg-1",
  packageTag: "基础包",
  credits: 1000,
  bonusCredits: 0,
  priceCents: 990,
  status: "pending",
  createdAt: "2026-09-28T01:00:00Z",
};

beforeEach(() => {
  vi.useFakeTimers();
  search = new URLSearchParams("order=ro-x");
  getRechargeOrder.mockReset();
  syncRechargeOrder.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("收银台 · ?order= 读不到订单", () => {
  it("订单不存在（404）：给错误态，停止轮询", async () => {
    const gone = new ApiError({ code: "ORDER_NOT_FOUND", message: "充值订单不存在" }, 404);
    getRechargeOrder.mockRejectedValue(gone);
    syncRechargeOrder.mockRejectedValue(gone);
    const { container } = render(<CashierPage />);
    await flush();
    expect(stateOf(container)).toBe("gone");
    const calls = syncRechargeOrder.mock.calls.length;
    await advance(3500 * 6);
    expect(syncRechargeOrder.mock.calls.length).toBe(calls);
  });

  it("不是本人的订单（403）同样停止轮询", async () => {
    const denied = new ApiError({ code: "FORBIDDEN", message: "无权访问" }, 403);
    getRechargeOrder.mockRejectedValue(denied);
    syncRechargeOrder.mockRejectedValue(denied);
    const { container } = render(<CashierPage />);
    await flush();
    expect(stateOf(container)).toBe("gone");
    const calls = syncRechargeOrder.mock.calls.length;
    await advance(3500 * 6);
    expect(syncRechargeOrder.mock.calls.length).toBe(calls);
  });

  it("接口一直 5xx：给能重试的错误态，轮询有上限", async () => {
    const down = new ApiError({ code: "HTTP_ERROR", message: "HTTP 502" }, 502);
    getRechargeOrder.mockRejectedValue(down);
    syncRechargeOrder.mockRejectedValue(down);
    const { container } = render(<CashierPage />);
    await flush();
    expect(stateOf(container)).toBe("error");
    await advance(3500 * 20);
    const capped = syncRechargeOrder.mock.calls.length;
    expect(capped).toBeLessThanOrEqual(5);
    await advance(3500 * 20);
    expect(syncRechargeOrder.mock.calls.length).toBe(capped);

    // 重试：接口恢复后读到订单，错误态消失
    getRechargeOrder.mockResolvedValue(PENDING);
    syncRechargeOrder.mockResolvedValue(PENDING);
    const retry = container.querySelector<HTMLButtonElement>("[data-checkout-retry]");
    expect(retry).not.toBeNull();
    await act(async () => {
      retry!.click();
    });
    await flush();
    expect(stateOf(container)).toBe("waiting");
  });

  it("读到了待支付订单：进入等待付款，继续轮询", async () => {
    getRechargeOrder.mockResolvedValue(PENDING);
    syncRechargeOrder.mockResolvedValue(PENDING);
    const { container } = render(<CashierPage />);
    await flush();
    expect(stateOf(container)).toBe("waiting");
    const calls = syncRechargeOrder.mock.calls.length;
    await advance(3500 * 2);
    expect(syncRechargeOrder.mock.calls.length).toBeGreaterThan(calls);
  });
});

describe("收银台 · 错误判定", () => {
  it("404 / 403 算订单不存在，其余不算", () => {
    expect(isOrderGone(new ApiError({ code: "X", message: "" }, 404))).toBe(true);
    expect(isOrderGone(new ApiError({ code: "X", message: "" }, 403))).toBe(true);
    expect(isOrderGone(new ApiError({ code: "X", message: "" }, 500))).toBe(false);
    expect(isOrderGone(new Error("network"))).toBe(false);
  });

  it("渠道没配好与其他下单失败给的是两种说法；技术细节不直出", () => {
    const notConfigured = checkoutErrorMessage(
      new ApiError({ code: "PAYMENT_CHANNEL_NOT_CONFIGURED", message: "支付宝商户私钥未配置" }, 503),
    );
    const other = checkoutErrorMessage(new ApiError({ code: "HTTP_ERROR", message: "HTTP 502" }, 502));
    expect(notConfigured).not.toBe(other);
    expect(notConfigured).not.toContain("私钥");
    expect(other).not.toContain("HTTP 502");
  });
});
