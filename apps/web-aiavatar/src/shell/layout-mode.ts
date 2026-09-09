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
    /* 存不下也照样切这一次 */
  }
  document.documentElement.setAttribute("data-layout", mode);
  window.location.reload();
}

/**
 * 首帧之前把 `data-layout` 写到 `<html>` 上。
 *
 * 以字符串形式注入 `<script>`（见 layout.tsx）—— 必须**同步阻塞**执行，
 * 放进 React 的 effect 里就晚了：那时第一帧已经按媒体查询画完了，
 * 用户会看到手机版闪一下再跳成桌面版。
 */
export const LAYOUT_BOOT_SCRIPT = `(function(){try{
var k=${JSON.stringify(LAYOUT_KEY)},v=null;
try{v=localStorage.getItem(k)}catch(e){}
if(v!=='desktop'&&v!=='mobile'){v=matchMedia('(min-width:${DESKTOP_MIN_WIDTH}px)').matches?'desktop':'mobile'}
document.documentElement.setAttribute('data-layout',v);
}catch(e){}})();`;
