import type { Metadata } from "next";
import "../styles/globals.css";
import { AppShell } from "@/components/shell/AppShell";

export const metadata: Metadata = {
  title: "AI Star Eco · 运营工作台",
  description: "AI 虚拟艺人孵化平台 · 运营人员管理后台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
