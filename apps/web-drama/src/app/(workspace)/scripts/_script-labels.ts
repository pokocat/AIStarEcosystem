// 脚本库共用的界面文案与小工具（v0.197）。
// 第三轮去掉了状态文案表（草稿 / 待定稿 / 已定稿）：服务端每次保存都把状态写成 ready，
// 那套状态存不住，界面只如实显示「已保存 · 时间」/「有改动没保存」。
import type { ScriptKind } from "@ai-star-eco/types/script";

export const SCRIPT_KIND_LABEL: Record<ScriptKind, string> = {
  drama: "剧集",
  ad: "广告",
  trailer: "宣传片",
  voice: "配音稿",
};

/** 把脚本正文下载成 .txt（原来是 .fountain，普通用户双击打不开）。 */
export function downloadScriptText(title: string, content: string) {
  const safe = (title || "脚本").replace(/[\\/:*?"<>|]+/g, "_");
  const blob = new Blob([`${title}\n\n${content}`], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${safe}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}
