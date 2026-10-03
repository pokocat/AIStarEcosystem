import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render } from "@testing-library/react";

// §8.0.1 ⑩：钉行为 —— 花积分的动作执行完要通知余额重读（v0.197，docs/drama-ux-copy-pass.md §4）。

vi.mock("@/api/drama-config", () => ({
  getDramaConfig: () => Promise.resolve({ confirmThreshold: 10, prices: {} }),
}));
const notifyWalletChanged = vi.fn();
vi.mock("@/lib/use-wallet", () => ({ notifyWalletChanged: () => notifyWalletChanged() }));
// 确认框：默认直接答「确认」；个别用例换成手动控制的 Promise
const dramaConfirm = vi.fn((_opts: unknown) => Promise.resolve(true));
vi.mock("./confirm-dialog", () => ({ dramaConfirm: (opts: unknown) => dramaConfirm(opts) }));

import { CreditButton } from "./credit";

async function flush() {
  await act(async () => {
    for (let i = 0; i < 5; i++) await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  notifyWalletChanged.mockReset();
  dramaConfirm.mockReset();
  dramaConfirm.mockImplementation(() => Promise.resolve(true));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("CreditButton", () => {
  it("onConfirm 返回 Promise：等它结束再通知余额", async () => {
    let resolve!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const { getByRole } = render(<CreditButton cost={2} onConfirm={onConfirm}>生成</CreditButton>);
    fireEvent.click(getByRole("button"));
    await flush();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(notifyWalletChanged).not.toHaveBeenCalled();
    resolve();
    await flush();
    expect(notifyWalletChanged).toHaveBeenCalledTimes(1);
  });

  it("onConfirm 同步返回：延迟一会儿再通知（给服务端扣费留时间）", async () => {
    const onConfirm = vi.fn();
    const { getByRole } = render(<CreditButton cost={2} onConfirm={onConfirm}>生成</CreditButton>);
    fireEvent.click(getByRole("button"));
    await flush();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(notifyWalletChanged).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(notifyWalletChanged).toHaveBeenCalledTimes(1);
  });

  // 评审 P0：小额免打扰要先 await 读配置，这段时间里第二下点击以前也会走到 onConfirm → 扣两份。
  it("连点两下（第一下还在读配置）：onConfirm 只执行一次", async () => {
    const onConfirm = vi.fn();
    const { getByRole } = render(<CreditButton cost={2} onConfirm={onConfirm}>生成</CreditButton>);
    const btn = getByRole("button");
    fireEvent.click(btn);
    fireEvent.click(btn);
    await flush();
    fireEvent.click(btn); // 同步动作已结束，这一下是新的一次
    await flush();
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it("onConfirm 的 Promise 没结束前再点无效，按钮标成在途；结束后可以再点", async () => {
    let resolve!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const { getByRole } = render(<CreditButton cost={2} onConfirm={onConfirm}>生成</CreditButton>);
    const btn = getByRole("button");
    fireEvent.click(btn);
    await flush();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(btn.getAttribute("aria-busy")).toBe("true");
    expect(btn.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(btn);
    fireEvent.click(btn);
    await flush();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    resolve();
    await flush();
    expect(btn.getAttribute("aria-busy")).toBeNull();
    fireEvent.click(btn);
    await flush();
    expect(onConfirm).toHaveBeenCalledTimes(2);
  });

  it("要确认的金额：确认框还没答时再点，不会再弹第二个、也不会多执行", async () => {
    let answer!: (ok: boolean) => void;
    dramaConfirm.mockImplementation(() => new Promise<boolean>((r) => (answer = r)));
    const onConfirm = vi.fn();
    const { getByRole } = render(<CreditButton cost={30} onConfirm={onConfirm}>出片</CreditButton>);
    const btn = getByRole("button");
    fireEvent.click(btn);
    await flush();
    fireEvent.click(btn);
    await flush();
    expect(dramaConfirm).toHaveBeenCalledTimes(1);
    answer(true);
    await flush();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("确认框点了取消：不执行，按钮解锁", async () => {
    dramaConfirm.mockImplementation(() => Promise.resolve(false));
    const onConfirm = vi.fn();
    const { getByRole } = render(<CreditButton cost={30} onConfirm={onConfirm}>出片</CreditButton>);
    const btn = getByRole("button");
    fireEvent.click(btn);
    await flush();
    expect(onConfirm).not.toHaveBeenCalled();
    expect(btn.getAttribute("aria-busy")).toBeNull();
    fireEvent.click(btn);
    await flush();
    expect(dramaConfirm).toHaveBeenCalledTimes(2);
  });

  // 复核 P2：只锁本实例时，切阶段 / 切集把按钮换成新实例，旧请求还在跑、新按钮却能再点 → 扣两份。
  it("传了 lockKey：动作没结束时按钮被卸载重挂，新按钮仍在途、点了不算；结束后才能再点", async () => {
    let resolve!: () => void;
    const onConfirm = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    const first = render(<CreditButton cost={2} lockKey="t:remount" onConfirm={onConfirm}>生成</CreditButton>);
    fireEvent.click(first.getByRole("button"));
    await flush();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    first.unmount();

    const second = render(<CreditButton cost={2} lockKey="t:remount" onConfirm={onConfirm}>生成</CreditButton>);
    const btn = second.getByRole("button");
    expect(btn.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(btn);
    await flush();
    expect(onConfirm).toHaveBeenCalledTimes(1);

    resolve();
    await flush();
    expect(btn.getAttribute("aria-busy")).toBeNull();
    fireEvent.click(btn);
    await flush();
    expect(onConfirm).toHaveBeenCalledTimes(2);
    resolve();
    await flush();
  });

  it("同一个 lockKey 的几个按钮互斥；确认框取消后锁放开", async () => {
    let answer!: (ok: boolean) => void;
    dramaConfirm.mockImplementation(() => new Promise<boolean>((r) => (answer = r)));
    const runA = vi.fn();
    const runB = vi.fn();
    const { getAllByRole } = render(
      <>
        <CreditButton cost={30} lockKey="t:shared" onConfirm={runA}>先写 3 集</CreditButton>
        <CreditButton cost={30} lockKey="t:shared" onConfirm={runB}>一次写完</CreditButton>
      </>,
    );
    const [a, b] = getAllByRole("button");
    fireEvent.click(a);
    await flush();
    expect(b.getAttribute("aria-busy")).toBe("true");
    fireEvent.click(b);
    await flush();
    expect(dramaConfirm).toHaveBeenCalledTimes(1);

    answer(false);
    await flush();
    expect(runA).not.toHaveBeenCalled();
    expect(b.getAttribute("aria-busy")).toBeNull();
    fireEvent.click(b);
    await flush();
    expect(dramaConfirm).toHaveBeenCalledTimes(2);
    answer(true);
    await flush();
    expect(runB).toHaveBeenCalledTimes(1);
    expect(runA).not.toHaveBeenCalled();
  });

  it("没传 title 时按钮上带着积分数（小额不弹确认，只能靠它知道花多少）", () => {
    const { getByRole } = render(<CreditButton cost={7} onConfirm={() => {}}>生成</CreditButton>);
    expect(getByRole("button").getAttribute("title")).toContain("7");
  });
});
