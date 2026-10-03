import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// §8.0.1 ⑥：写完没人挂的组件，编译器不会告诉你。钉住通用外壳（app/(workspace)/layout.tsx）
// 里几处 v0.197 的接线：顶栏余额读 useWallet 并去积分钱包、≤860 的后台生成入口挂在顶栏上、
// 只有 /projects/<id> 这一层走沉浸式工作台。
const src = readFileSync(resolve(__dirname, "../../app/(workspace)/layout.tsx"), "utf8");

describe("workspace shell wiring", () => {
  it("顶栏余额读 useWallet()，点了去 /wallet", () => {
    expect(src).toMatch(/useWallet\(\)/);
    expect(src).toMatch(/router\.push\("\/wallet"\)/);
    expect(src).not.toMatch(/router\.push\("\/finance"\)/);
    expect(src).not.toMatch(/AccountApi\.getMyWallet/);
  });

  it("顶栏挂着后台生成的小入口", () => {
    expect(src).toMatch(/<RenderTaskTopbarEntry\b/);
  });

  it("沉浸式工作台只匹配 /projects/<id> 这一层", () => {
    const m = src.match(/const projectMatch = pathname\?\.match\((\/.*\/)\);/);
    expect(m).not.toBeNull();
    // eslint-disable-next-line no-eval
    const re = eval(m![1]) as RegExp;
    expect(re.test("/projects/p1")).toBe(true);
    expect(re.test("/projects/p1/")).toBe(true);
    expect(re.test("/projects/p1/distribute")).toBe(false);
  });

  it("Logo 回首页", () => {
    expect(src).toMatch(/href="\/dashboard"\s+onClick=\{onNavigate\}/);
  });
});
