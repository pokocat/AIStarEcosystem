import { afterEach, describe, expect, it } from "vitest";
import { act, cleanup, render, within } from "@testing-library/react";
import { DramaConfirmHost, dramaConfirm } from "./confirm-dialog";

// §8.0.1 ⑩：钉行为，不钉文案 —— 按钮文案由用例自己传（ok-1 / ok-2），不依赖界面默认文案。
//
// 复核 P2：新确认已经顶掉旧的、但界面还没重画的那一下里，点了旧弹窗上的按钮。
// 旧回调无条件清空全局 pending → 清掉的是新的那个：Promise 永远不结束、界面上也没有弹窗，
// 等它的 CreditButton 一直在途。

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

afterEach(() => {
  cleanup();
});

/** 在 act 之外改 store：React 不会在同一个同步片段里重画，DOM 上还是旧弹窗和旧回调。 */
function outsideAct<T>(fn: () => T): T {
  const prev = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  try {
    return fn();
  } finally {
    globalThis.IS_REACT_ACT_ENVIRONMENT = prev;
  }
}

describe("DramaConfirmHost", () => {
  it("新确认顶掉旧的、还没重画时点了旧弹窗的按钮：新确认不丢，照样能答", async () => {
    const { getByRole } = render(<DramaConfirmHost />);
    let first!: Promise<boolean>;
    act(() => {
      first = dramaConfirm({ title: "A", confirmLabel: "ok-1" });
    });
    const staleOk = within(getByRole("dialog")).getByRole("button", { name: "ok-1" });

    let second: boolean | "pending" = "pending";
    outsideAct(() => {
      void dramaConfirm({ title: "B", confirmLabel: "ok-2" }).then((v) => (second = v));
      staleOk.click(); // 旧 DOM、旧闭包
    });
    await act(async () => {});

    await expect(first).resolves.toBe(false); // 被顶掉的按取消结束
    expect(second).toBe("pending");
    const dialog = getByRole("dialog"); // 新的那个还在界面上
    act(() => {
      within(dialog).getByRole("button", { name: "ok-2" }).click();
    });
    await act(async () => {});
    expect(second).toBe(true);
  });

  it("答完当前的确认：弹窗关掉，Promise 结束", async () => {
    const { getByRole, queryByRole } = render(<DramaConfirmHost />);
    let ret!: Promise<boolean>;
    act(() => {
      ret = dramaConfirm({ title: "C", confirmLabel: "ok-3", cancelLabel: "no-3" });
    });
    act(() => {
      within(getByRole("dialog")).getByRole("button", { name: "no-3" }).click();
    });
    await expect(ret).resolves.toBe(false);
    expect(queryByRole("dialog")).toBeNull();
  });
});
