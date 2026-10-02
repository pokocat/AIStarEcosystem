import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../styles/app.css";
// v0.197：各页面的响应式样式分文件放，导入顺序在 app.css 之后（同优先级时后者覆盖）。
import "../styles/pages/shared.css";
import "../styles/pages/home.css";
import "../styles/pages/shorts-entry.css";
import "../styles/pages/shorts-make.css";
import "../styles/pages/workbench.css";
import "../styles/pages/episode.css";
import "../styles/pages/market.css";
import "../styles/pages/account.css";
import { AppProviders } from "./providers";

export const metadata: Metadata = {
  title: "短剧工坊 · AI Star Eco",
  description: "说一个想法，或者贴一段写好的脚本，AI 帮你拆成分镜、逐镜生成画面和视频，做出多集短剧和单条短视频。",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fafaf9",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
