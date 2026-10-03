import { describe, expect, it } from "vitest";
import { acquireActionLock, isActionLocked, withActionLock } from "./action-lock";

// §8.0.1 ⑩：钉行为 —— 跨组件实例的在途锁（组件卸载不释放，动作结束才释放）。
describe("action-lock", () => {
  it("同一个 key 同时只能占一次；释放后才能再占，释放函数多调也只放一次", () => {
    const r1 = acquireActionLock("t:a");
    expect(r1).not.toBeNull();
    expect(acquireActionLock("t:a")).toBeNull();
    expect(isActionLocked("t:a")).toBe(true);
    // 不同的 key 互不影响
    const other = acquireActionLock("t:b");
    expect(other).not.toBeNull();
    r1!();
    r1!();
    expect(isActionLocked("t:a")).toBe(false);
    const r2 = acquireActionLock("t:a");
    expect(r2).not.toBeNull();
    // r1 再调不能把 r2 占着的锁放掉
    r1!();
    expect(isActionLocked("t:a")).toBe(true);
    r2!();
    other!();
  });

  it("withActionLock：占着时第二次不跑、返回 false；fn 抛错照样放锁并往外抛", async () => {
    let finish!: () => void;
    const running = withActionLock("t:c", () => new Promise<void>((r) => (finish = r)));
    let ranSecond = false;
    await expect(withActionLock("t:c", () => { ranSecond = true; })).resolves.toBe(false);
    expect(ranSecond).toBe(false);
    finish();
    await expect(running).resolves.toBe(true);
    expect(isActionLocked("t:c")).toBe(false);

    await expect(withActionLock("t:c", () => { throw new Error("boom"); })).rejects.toThrow("boom");
    expect(isActionLocked("t:c")).toBe(false);
  });
});
