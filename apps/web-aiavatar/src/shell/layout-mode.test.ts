// 形态判定（桌面版 / 手机版）。
//
// 两条真实反馈钉在这里：
//   ① 手机浏览器选「请求桌面版网站」后仍是手机版 —— Chrome / Safari 那时用的是
//      约 980px 的布局视口，而断点卡在 1024。
//   ② 画布不该被断点判死 —— 用户可以选择在手机上打开（见 ip/canvas-gate.tsx）。

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// React 19 + testing-library：不声明就不会 flush effect 里的 setState
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DESKTOP_MIN_WIDTH, LAYOUT_KEY, LAYOUT_BOOT_SCRIPT, resolvedLayout, storedLayout } from "./layout-mode";

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");
/** 去掉注释再断言 —— 注释里解释「为什么不用 X」时也会出现 X，那不该让测试变红。 */
const readCode = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

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

/** 可变的视口 mock：监听是真的（Codex 指出空实现等于 resize 路径从没跑过）。 */
const mqListeners = new Set<() => void>();
let currentWidth = 1200;
function mockWidth(px: number) {
  currentWidth = px;
  vi.stubGlobal("matchMedia", (q: string) => {
    const m = /min-width:\s*(\d+)px/.exec(q);
    const min = m ? Number(m[1]) : 0;
    return {
      get matches() { return currentWidth >= min; },
      addEventListener: (_: string, fn: () => void) => void mqListeners.add(fn),
      removeEventListener: (_: string, fn: () => void) => void mqListeners.delete(fn),
    };
  });
}
/** 改视口并触发监听，模拟拖窗口 / 转屏。 */
function resizeTo(px: number) {
  currentWidth = px;
  mqListeners.forEach((fn) => fn());
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

  it("存的偏好与自动判定一致时会被清掉 —— 否则在手机上点过一次桌面版就永远粘住", () => {
    mockWidth(390);
    window.localStorage.setItem(LAYOUT_KEY, "mobile");   // 与自动一致
    new Function(LAYOUT_BOOT_SCRIPT)();
    expect(window.localStorage.getItem(LAYOUT_KEY)).toBeNull();
    expect(document.documentElement.getAttribute("data-layout")).toBe("mobile");
  });

  it("与自动判定**不同**的偏好要留着", () => {
    mockWidth(390);
    window.localStorage.setItem(LAYOUT_KEY, "desktop");
    new Function(LAYOUT_BOOT_SCRIPT)();
    expect(window.localStorage.getItem(LAYOUT_KEY)).toBe("desktop");
    expect(document.documentElement.getAttribute("data-layout")).toBe("desktop");
  });

  it("setLayout 只存「与自动不同」的那次", async () => {
    const { setLayout } = await import("./layout-mode");
    // 真的会调 location.reload，jsdom 里换成 noop
    Object.defineProperty(window, "location", {
      value: { ...window.location, reload: () => {} }, configurable: true, writable: true,
    });
    mockWidth(1600);
    setLayout("desktop");                                   // 与自动一致
    expect(window.localStorage.getItem(LAYOUT_KEY)).toBeNull();
    setLayout("mobile");                                    // 与自动不同
    expect(window.localStorage.getItem(LAYOUT_KEY)).toBe("mobile");
  });

  it("首帧脚本读得到用户的选择", () => {
    mockWidth(1600);
    window.localStorage.setItem(LAYOUT_KEY, "mobile");
    new Function(LAYOUT_BOOT_SCRIPT)();
    expect(document.documentElement.getAttribute("data-layout")).toBe("mobile");
  });
});

describe("视口变化时 CSS 与 JS 一起变", () => {
  afterEach(async () => {
    const { cleanup } = await import("@testing-library/react");
    cleanup();
  });

  beforeEach(() => {
    vi.unstubAllGlobals();
    stubStorage();
    mqListeners.clear();
    document.documentElement.removeAttribute("data-layout");
    vi.resetModules();
  });

  it("拖窗口变窄时属性跟着改 —— 不能只改 React state 留 CSS 在桌面形态", async () => {
    mockWidth(1200);
    const { useLayoutMode } = await import("./layout-mode");
    const { renderHook, act, waitFor } = await import("@testing-library/react");
    const { result } = renderHook(() => useLayoutMode());
    // effect 是异步 flush 的（与 project-sync.test.ts 同一套写法）
    await waitFor(() => expect(result.current).toBe("desktop"));

    act(() => resizeTo(800));
    await waitFor(() => expect(result.current).toBe("mobile"));
    expect(document.documentElement.getAttribute("data-layout"), "CSS 也要跟着变，不能只改 React state")
      .toBe("mobile");
  });

  it("用户显式选过就不跟视口跑 —— 那正是「选择压过宽度」的意思", async () => {
    mockWidth(390);
    window.localStorage.setItem(LAYOUT_KEY, "desktop");
    const { watchLayout } = await import("./layout-mode");
    let hits = 0;
    watchLayout(() => { hits++; });

    resizeTo(1600);
    resizeTo(390);
    expect(hits, "选过之后视口怎么变都不该改形态").toBe(0);
    expect(document.documentElement.getAttribute("data-layout")).toBe("desktop");
  });

  it("没选过时属性与通知都要发生，且同一形态不重复通知", async () => {
    mockWidth(1200);
    const { watchLayout } = await import("./layout-mode");
    let hits = 0;
    watchLayout(() => { hits++; });

    resizeTo(800);
    expect(hits).toBe(1);
    expect(document.documentElement.getAttribute("data-layout")).toBe("mobile");

    resizeTo(700);   // 还是手机形态
    expect(hits, "形态没变就别惊动订阅者").toBe(1);

    resizeTo(1400);
    expect(hits).toBe(2);
    expect(document.documentElement.getAttribute("data-layout")).toBe("desktop");
  });

});

describe("CSS 与 JS 读的是同一个真值", () => {
  it("每一条桌面形态规则都必须带 data-layout 前缀 —— 漏一条就是手机版被弄坏", () => {
    const css = read("src/styles/globals.css");
    expect(css).not.toContain("@media (min-width: 1024px)");

    // 逐条点名（不是「含有任意一个 data-layout 就算过」）。这些选择器只要有一条
    // 变成无条件生效，手机版就坏了：480 列被撑开、底部 tab 栏消失、内容被顶栏盖住…
    const mustBeGuarded = [
      ".hub-screen {\n  max-width: 1120px",
      ".wx-tabbar.hub-tabbar { display: none; }",
      "body.has-desktop-bar { padding-top:",
      "body.has-desktop-bar .app-root { top:",
      ".desktop-top-bar { display: flex; }",
      ".hub-list {\n  display: grid",
      ".hub-grid-2 { grid-template-columns: repeat(4",
      ".hub-section { margin-inline: 0",
      ".hub-screen--form { max-width: 720px; }",
      ".hub-grid-cards {\n  grid-template-columns: repeat(auto-fill, minmax(200px",
      "body.studio-desktop {",
    ];
    for (const sel of mustBeGuarded) {
      const at = css.indexOf(sel);
      expect(at, `globals.css 里找不到这条桌面规则（改名了？）：${sel}`).toBeGreaterThan(0);
      // 前缀必须紧贴在选择器前面
      const before = css.slice(Math.max(0, at - 40), at);
      expect(before, `这条桌面规则没有 data-layout 前缀，会无条件生效：${sel}`)
        .toContain('html[data-layout="desktop"]');
    }

    // 手机形态的兜底：没有属性时那批桌面规则一条都不该生效
    expect(css).toContain(".desktop-top-bar { display: none; }");
  });

  it("画布闸不再自己量宽度 —— 它和外壳必须同一个判定", () => {
    const gate = readCode("src/ip/canvas-gate.tsx");
    expect(gate).toContain("useLayoutMode");
    // 自己再 matchMedia 一次就又分岔了（不管断点写多少）
    expect(gate).not.toContain("matchMedia");
    expect(gate).not.toMatch(/min-width:\s*\d/);
  });

  it("首帧脚本必须是裸 <script> 放 body —— next/script 实测太晚（readyState 已 interactive）", () => {
    const layout = readCode("src/app/layout.tsx");
    expect(layout).toContain("LAYOUT_BOOT_SCRIPT");
    expect(layout).toContain("dangerouslySetInnerHTML");
    expect(layout).not.toContain("beforeInteractive");
    // async 会消掉报错，但也就不保证首帧前执行了
    expect(layout).not.toMatch(/<script[^>]*\basync\b/);
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
