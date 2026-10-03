import { describe, expect, it } from "vitest";
import { dramaConfirm } from "./confirm-dialog";

// §8.0.1 ⑩：钉行为 —— 没答的确认被新的顶掉时要按「取消」结束，
// 否则等它的调用方（CreditButton 的在途锁）会一直卡在「在途」。
describe("dramaConfirm", () => {
  it("上一个还没答就来了新的：上一个按取消结束", async () => {
    const first = dramaConfirm({ title: "第一个" });
    void dramaConfirm({ title: "第二个" });
    await expect(first).resolves.toBe(false);
  });
});
