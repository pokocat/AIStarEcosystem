import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../styles/app.css";
import { AppProviders } from "./providers";

export const metadata: Metadata = {
  title: "AiAvatar 形象资产管理中心 — AI Star Eco",
  description: "真人授权复刻 / AI 原创AiAvatar；打样→精调→定稿→衍生 3D/视频 全链路资产管理。",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f4f5f7",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh" data-theme="aiavatar" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
