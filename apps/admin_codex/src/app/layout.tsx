import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "AI Star Eco Admin Codex",
  description: "统一认证、权益、分销与积分计量平台管理后台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
