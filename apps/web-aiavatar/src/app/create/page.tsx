"use client";
// 「画布·自由创作」：桌面和手机是同一个页面，最上面「新建画布」卡片（点了才建，进画布并打开助手），下面是功能入口和模板。
// 规则见 docs/ip-studio-new-canvas-and-threads.md §2.2。
import { StudioCreateHome } from "@/ip/studio-create-home";

export default function CreatePage() {
  return <StudioCreateHome />;
}
