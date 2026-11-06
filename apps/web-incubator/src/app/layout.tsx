import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@/prototype/styles/index.css";

export const metadata: Metadata = {
  title: "AI 艺人孵化平台（演示）",
  description: "AI 艺人孵化平台全端演示，页面内容均为示例数据。",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
