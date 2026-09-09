// 形态判定（桌面版 / 手机版）。
//
// 两条真实反馈钉在这里：
//   ① 手机浏览器选「请求桌面版网站」后仍是手机版 —— Chrome / Safari 那时用的是
//      约 980px 的布局视口，而断点卡在 1024。
//   ② 画布不该被断点判死 —— 用户可以选择在手机上打开（见 ip/canvas-gate.tsx）。

import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DESKTOP_MIN_WIDTH, LAYOUT_KEY, LAYOUT_BOOT_SCRIPT, resolvedLayout, storedLayout } from "./layout-mode";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** jsdom 这一版的 localStorage 不能直接用，自己塞一个够用的。 */
function stubStorage() {
  const box = new Map<string, string>();
  const api = {
    getItem: (k: string) => box.get(k) ?? null,
    setItem: (k: string, v: string) => void box.set(k, String(v)),
    removeItem: (k: string) => void box.delete(k),
    clear: () => box.clear(),
    key: () => null,
    get length() { return box.size; },
  };
  Object.defineProperty(window, "localStorage", { value: api, configurable: true, writable: true });
  return api;
}

function mockWidth(px: number) {
  vi.stubGlobal("matchMedia", (q: string) => {
    const m = /min-width:\s*(\d+)px/.exec(q);
    return { matches: m ? px >= Number(m[1]) : false, addEventListener() {}, removeEventListener() {} };
  });
}

describe("形态判定", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    stubStorage();
  });

  it("手机浏览器的「请求桌面版网站」要认得出来 —— 它给的是约 980 的布局视口", () => {
    expect(DESKTOP_MIN_WIDTH).toBeLessThanOrEqual(980);
    mockWidth(980);
    expect(resolvedLayout()).toBe("desktop");
  });

  it("但横屏手机不该被误判成桌面（iPhone 16 Pro Max 横屏 956）", () => {
    mockWidth(956);
    expect(resolvedLayout()).toBe("mobile");
  });

  it("竖持手机是手机版", () => {
    mockWidth(390);
    expect(resolvedLayout()).toBe("mobile");
  });

  it("用户显式选过的压过视口宽度 —— 两个方向都要认", () => {
    mockWidth(390);
    window.localStorage.setItem(LAYOUT_KEY, "desktop");
    expect(resolvedLayout()).toBe("desktop");

    mockWidth(1600);
    window.localStorage.setItem(LAYOUT_KEY, "mobile");
    expect(resolvedLayout()).toBe("mobile");
  });

  it("存了别的值当作没选过，不要因此判成桌面", () => {
    mockWidth(390);
    window.localStorage.setItem(LAYOUT_KEY, "yes-please");
    expect(storedLayout()).toBeNull();
    expect(resolvedLayout()).toBe("mobile");
  });

  it("首帧脚本能跑，且写出来的属性与 resolvedLayout 一致", () => {
    mockWidth(980);
    document.documentElement.removeAttribute("data-layout");
    new Function(LAYOUT_BOOT_SCRIPT)();
    expect(document.documentElement.getAttribute("data-layout")).toBe("desktop");
    expect(document.documentElement.getAttribute("data-layout")).toBe(resolvedLayout());
  });

  it("首帧脚本读得到用户的选择", () => {
    mockWidth(1600);
    window.localStorage.setItem(LAYOUT_KEY, "mobile");
    new Function(LAYOUT_BOOT_SCRIPT)();
    expect(document.documentElement.getAttribute("data-layout")).toBe("mobile");
  });
});

describe("CSS 与 JS 读的是同一个真值", () => {
  it("globals.css 不再用 1024 媒体查询决定形态，改看 data-layout", () => {
    const css = read("src/styles/globals.css");
    expect(css).not.toContain("@media (min-width: 1024px)");
    expect(css).toContain('html[data-layout="desktop"]');
    // 手机形态的兜底：没有属性时那批桌面规则一条都不该生效
    expect(css).toContain(".desktop-top-bar { display: none; }");
  });

  it("画布闸不再自己量宽度 —— 它和外壳必须同一个判定", () => {
    const gate = read("src/ip/canvas-gate.tsx");
    expect(gate).toContain("resolvedLayout");
    expect(gate).not.toMatch(/min-width:\s*1024/);
  });

  it("手机上画布是**可以进**的：提示屏必须给出继续打开的按钮", () => {
    const gate = read("src/ip/canvas-gate.tsx");
    expect(gate).toContain("仍然在手机上打开");
    expect(gate).toContain("onProceed");
    // 而且必须仍是按需加载 —— 手机默认不下那 15k 行的 chunk
    expect(gate).toContain("dynamic(");
    expect(gate).toContain("ssr: false");
  });
});
