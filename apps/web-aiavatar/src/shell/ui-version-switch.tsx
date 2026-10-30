"use client";

import { setUiVersion, useUiVersion } from "./ui-version";

/**
 * 新旧版切换按钮（见 ui-version.ts）。旧版在顶栏里；新版没有顶栏，放在页面标题栏右侧（inline），
 * 页面上有 inline 的那个，外壳右上角悬浮的那个就藏起来（styles/studio-scenes.css）。
 * 2026-10-30 线上走查：只有悬浮的那个时，它压住了卡片标题、面板标题和「新建创作」。
 */
export function UiVersionSwitch({ inline = false }: { inline?: boolean }) {
  const version = useUiVersion();
  return <button type="button" className={"ip-ui-switch" + (inline ? " ip-ui-switch-inline" : "")}
    onClick={() => setUiVersion(version === "next" ? "classic" : "next")}>{version === "next" ? "回到旧版" : "体验新版"}</button>;
}
