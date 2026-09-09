// ─────────────────────────────────────────────────────────────────────────────
// 桌面版 / 手机版的判定与**手动切换**。
//
// 一个应用两套形态（v0.190）此前只看视口宽度。够用，但漏了两类真实情况：
//
//   ① **手机浏览器的「请求桌面版网站」被吃掉了。** Chrome / Safari 开这个开关时会
//      忽略 `<meta viewport>`，改用约 **980px** 的布局视口 —— 而我们的断点是 1024，
//      于是用户明明选了桌面版，看到的还是那条 480 的窄列。断点因此下调到 960：
//      恰好接住 980，又不会误伤横屏手机（iPhone 16 Pro Max 横屏 956、
//      多数安卓旗舰横屏 < 940）。
//
//   ② **宽度之外的意图。** 竖持平板（768）上想看桌面版、小窗口里想要手机版 ——
//      这些光靠量宽度永远猜不准。所以再给一个显式开关，用户选了就以他为准。
//
// 真值放在 `<html data-layout>` 上，**CSS 与 JS 读同一个**：
//   · 没有这个属性 = 跟着视口走（媒体查询自己判断）
//   · `desktop` / `mobile` = 用户点过开关，压过媒体查询
// 属性由 layout.tsx 里那段**阻塞式内联脚本**在首帧之前写好，所以不会先闪一下另一套。
//
// 只存「和自动判定不一致」的那次选择：在电脑上点「桌面版」不写任何东西 ——
// 否则用户换了台设备，一个当时随手点的选择还跟着他走。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";

export const DESKTOP_MIN_WIDTH = 960;
export const LAYOUT_KEY = "aiavatar_layout";

export type LayoutMode = "desktop" | "mobile";

/** 视口本身够不够宽（不看用户的选择）。 */
export function viewportIsWide(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`).matches;
}

/** 用户显式选过的形态；没选过返回 null。 */
export function storedLayout(): LayoutMode | null {
  try {
    const v = window.localStorage.getItem(LAYOUT_KEY);
    return v === "desktop" || v === "mobile" ? v : null;
  } catch {
    return null;   // 隐私模式会抛 —— 当作没选过
  }
}

/** 当下**实际生效**的形态 = 用户的选择优先，其次看视口。 */
export function resolvedLayout(): LayoutMode {
  return storedLayout() ?? (viewportIsWide() ? "desktop" : "mobile");
}

/**
 * 切换形态并**整页重载**。
 *
 * 为什么重载而不是改个 state：两套形态的差别不只在 CSS —— 画布走
 * `dynamic({ ssr:false })` 按形态决定要不要下那 15k 行的 chunk，老 SPA 的
 * `.app-root` 定位也随之变。就地切会留下一半旧一半新的中间态；重载一次干净。
 */
export function setLayout(mode: LayoutMode) {
  try {
    // 与自动判定一致就把记录删掉，别让一次随手的选择跟着用户换设备
    if (mode === (viewportIsWide() ? "desktop" : "mobile")) {
      window.localStorage.removeItem(LAYOUT_KEY);
    } else {
      window.localStorage.setItem(LAYOUT_KEY, mode);
    }
  } catch {
    // 存不下（隐私模式）：写属性能让这一刻的界面变过来，但紧接着的 reload 会读不到
    // 偏好、退回自动判定。如实说明比假装成功强 —— 所以这种情况下干脆不 reload，
    // 让这次切换只在当前页生效。
    document.documentElement.setAttribute("data-layout", mode);
    listeners.forEach((fn) => fn());
    return;
  }
  document.documentElement.setAttribute("data-layout", mode);
  window.location.reload();
}

// ── 视口变化时保持同源 ────────────────────────────────────────────────────
//
// 属性是首帧写死的，而窗口会变（拖窗口、转屏）。此前只有画布组件自己听 matchMedia，
// 于是 1200 打开、拖到 800 时：画布的 React state 切成了手机，`data-layout` 还是 desktop
// —— CSS 一套、JS 另一套，会出现「桌面顶栏 + 手机提示屏」这种组合。
// 现在只有这一处监听：它改属性（CSS 跟着走）**并**通知订阅者（JS 跟着走）。
// 用户显式选过就不跟视口跑 —— 那正是「选择压过宽度」的意思。

let watching = false;
const listeners = new Set<() => void>();
let snapshot: LayoutMode | null = null;

function sync() {
  const next = resolvedLayout();
  if (next === snapshot) return;
  snapshot = next;
  document.documentElement.setAttribute("data-layout", next);
  listeners.forEach((fn) => fn());
}

/**
 * 订阅形态变化。返回退订函数。
 *
 * 导出成一个**不依赖 React** 的函数，是为了能直接测它 —— 这段逻辑
 * （视口变了要改属性、但用户选过就不跟着跑）是本文件的核心，
 * 不该只能透过 renderHook 间接验证。`useLayoutMode` 就是它的一层薄壳。
 */
export function watchLayout(fn: () => void) {
  listeners.add(fn);
  if (!watching) {
    watching = true;
    // 装上监听时先把属性对齐一次。正常情况下首帧脚本已经写好了，这一下什么都不改；
    // 但脚本被 CSP 拦掉、或哪天有人把它删了的时候，这里是**第二道**保险 ——
    // 代价只是晚一点（hydration 之后），总好过桌面用户一直卡在 480 窄列里。
    snapshot = resolvedLayout();
    document.documentElement.setAttribute("data-layout", snapshot);
    window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`).addEventListener("change", sync);
  }
  return () => { listeners.delete(fn); };
}

/**
 * 当前形态。**SSR 与首帧返回 null**（= 还不知道）—— 服务端量不到视口，
 * 硬猜一个会让 hydration 前后不一致，用户看到闪一下。
 *
 * 订阅的是上面那个全局监听，所以任何一个用到它的组件都会让「视口变了 → 属性跟着改」
 * 生效。根布局里的 AppChrome 一直挂着，所以每一页都至少有一个订阅者。
 */
export function useLayoutMode(): LayoutMode | null {
  const [mode, setMode] = React.useState<LayoutMode | null>(null);
  React.useEffect(() => {
    setMode(resolvedLayout());
    return watchLayout(() => setMode(resolvedLayout()));
  }, []);
  return mode;
}

/**
 * 首帧之前把 `data-layout` 写到 `<html>` 上。
 *
 * 以字符串形式注入 `<script>`（见 layout.tsx）—— 必须**同步阻塞**执行，
 * 放进 React 的 effect 里就晚了：那时第一帧已经按媒体查询画完了，
 * 用户会看到手机版闪一下再跳成桌面版。
 */
export const LAYOUT_BOOT_SCRIPT = `(function(){try{
var k=${JSON.stringify(LAYOUT_KEY)},v=null,a=matchMedia('(min-width:${DESKTOP_MIN_WIDTH}px)').matches?'desktop':'mobile';
try{v=localStorage.getItem(k)}catch(e){}
if(v!=='desktop'&&v!=='mobile'){v=null}
// 存的值和自动判定一致就把它删掉：偏好只该记「与自动不同」的那次。
// 不自愈的话，在手机上点过一次桌面版之后，这台设备就永远是桌面版了 ——
// 哪怕后来他只是想看看手机版长什么样（Codex 复核 v0.193 指出）。
if(v===a){try{localStorage.removeItem(k)}catch(e){}v=null}
document.documentElement.setAttribute('data-layout',v||a);
}catch(e){}})();`;
