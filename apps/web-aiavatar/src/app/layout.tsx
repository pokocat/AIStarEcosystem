import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../styles/app.css";
import { AppProviders } from "./providers";

export const metadata: Metadata = {
  title: "数字人资产管理中心 · AiAvatar Studio",
  description: "数字人 IP 形象创建 / 精调 / 美化 / 定稿 / 衍生 全链路 — AI Star Eco",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a0b0e",
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
