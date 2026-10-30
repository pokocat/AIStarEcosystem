import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../styles/app.css";

export const metadata: Metadata = {
  title: "Studio Ops · 运营后台",
  description: "Studio 积分与生成只读看板，以及 AI 图片 / AI 视频场景模板配置",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#f4f6fb" };
export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
