import { describe, expect, it } from "vitest";

// vitest.setup.ts 的结构测试：本机（Node 25）和 CI（Node 22）拿到同一种能用的浏览器存储，每条用例从空的开始。
// 任何一条不成立，「记在 localStorage」的东西就会本机一个样、CI 一个样，或者在用例之间串（2026-10-04 的 CI 红）。
// 两条用例按声明顺序跑：第二条检查的正是第一条写进去的东西已经没了。

describe("测试环境的浏览器存储", () => {
  it("是 jsdom 的 Storage、能读写（不是 Node 25 自带的那个连 getItem 都没有的）", () => {
    for (const s of [window.localStorage, window.sessionStorage]) {
      expect(s).toBeInstanceOf(Storage);
      s.setItem("test-env:probe", "1");
      expect(s.getItem("test-env:probe")).toBe("1");
    }
  });

  it("每条用例从空的开始：上一条写进去的已经清掉", () => {
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });
});
