import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../styles/app.css";
import { AppProviders } from "./providers";

export const metadata: Metadata = {
  title: "AI 明星带货 — AI Star Eco",
  description: "基于真人明星授权的 AI 复刻 IP 带货平台",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

// 移动 H5：声明视口 + 适配刘海/底部安全区（viewport-fit=cover 让 env(safe-area-inset-*) 生效）。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#faf7f2",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="zh"
      data-theme="creator"
      suppressHydrationWarning
    >
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
