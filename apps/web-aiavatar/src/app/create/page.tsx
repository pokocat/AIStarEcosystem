"use client";
// 「画布·自由创作」：桌面上直接打开一张新画布（助手在右边），手机上是对话框 + 创作入口 + 模板。
// 规则见 docs/ip-studio-new-canvas-and-threads.md §2.2；形态按 html[data-layout] 判断（StudioCreateHome 内部）。
import { StudioCreateHome } from "@/ip/studio-create-home";

export default function CreatePage() {
  return <StudioCreateHome />;
}
