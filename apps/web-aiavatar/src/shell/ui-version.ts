// ─────────────────────────────────────────────────────────────────────────────
// 新版 / 旧版（2026-10-30）。
//
// 场景化改版（左侧导航、首页场景卡片、灵感放到首页，docs/studio-scene-creation.md）先不给所有人：
// 默认还是旧版，和改版前线上一模一样；旧版右上角「体验新版」切到新版，新版右上角「回到旧版」
// （手机在「我的」里；`?ui=new` / `?ui=old` 也行）。选择按浏览器记，不跟账号走。
//
// 真值放在 `<html data-ui>` 上（只有新版才有这个属性），CSS 与 JS 读同一个，做法同 layout-mode.ts：
// 首帧之前由 layout.tsx 里那段内联脚本写好，所以新版用户的页面边距一开始就是对的；
// 导航和首页本来就挂载之后才画（AppChrome 先读登录态、首页先读形态），JS 读到的也已经是最终值，不会先闪一下旧版。
//
// AI 图片 / AI 视频两个页面不分新旧：旧版只是没有入口，链接直接打开照样能用。
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";

export const UI_KEY = "aiavatar_ui";
export type UiVersion = "classic" | "next";

/** 地址里的 `ui` 参数：new / next 进新版，old / classic 回旧版，别的值不认。 */
export function uiVersionFromQuery(value: string | null): UiVersion | null {
  if (value === "new" || value === "next") return "next";
  if (value === "old" || value === "classic") return "classic";
  return null;
}

/** 当前生效的版本：只看 `<html data-ui>`。SSR 没有 document，按旧版算。 */
export function currentUiVersion(): UiVersion {
  if (typeof document === "undefined") return "classic";
  return document.documentElement.getAttribute("data-ui") === "next" ? "next" : "classic";
}

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => { listeners.add(fn); return () => { listeners.delete(fn); }; };

/** 读当前版本。服务端渲染按旧版，客户端读 `<html data-ui>`。 */
export function useUiVersion(): UiVersion {
  return React.useSyncExternalStore(subscribe, currentUiVersion, () => "classic");
}

/** 去掉地址里的 `ui` 参数，别让它在之后的刷新里把选择又改回去。 */
export function withoutUiParam(href: string): string {
  const url = new URL(href);
  if (!url.searchParams.has("ui")) return href;
  url.searchParams.delete("ui");
  return url.pathname + url.search + url.hash;
}

/**
 * 切换版本并整页重载（两版的导航、首页差得多，就地切会留下一半旧一半新）。
 * 存不下（隐私模式）时只改这一页的属性、不重载：重载后读不到选择，等于没切。
 */
export function setUiVersion(version: UiVersion) {
  try {
    if (version === "next") window.localStorage.setItem(UI_KEY, "next");
    else window.localStorage.removeItem(UI_KEY);
  } catch {
    applyUiVersion(version);
    return;
  }
  applyUiVersion(version);
  window.location.replace(withoutUiParam(window.location.href));
}

function applyUiVersion(version: UiVersion) {
  if (version === "next") document.documentElement.setAttribute("data-ui", "next");
  else document.documentElement.removeAttribute("data-ui");
  listeners.forEach(fn => fn());
}

/**
 * 首帧之前读地址参数和本机记录，把 `data-ui` 写到 `<html>` 上。
 * 地址参数优先，并且记下来；存不下时这一页仍按参数显示。参数本身留给挂载后去掉（见 AppChrome）：
 * 在 Next 接管前改地址，路由初始化可能又写回去。
 */
export const UI_BOOT_SCRIPT = `(function(){try{
var k=${JSON.stringify(UI_KEY)},q=new URLSearchParams(location.search).get('ui'),v=null;
var w=q==='new'||q==='next'?'next':q==='old'||q==='classic'?'classic':null;
try{if(w==='next')localStorage.setItem(k,'next');else if(w==='classic')localStorage.removeItem(k);v=localStorage.getItem(k)}catch(e){}
if(w)v=w;
if(v==='next')document.documentElement.setAttribute('data-ui','next');else document.documentElement.removeAttribute('data-ui');
}catch(e){}})();`;
