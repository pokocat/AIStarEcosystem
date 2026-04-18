import type { Metadata } from "next";
import "../styles/globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { computeBadges } from "@/lib/badges";

export const metadata: Metadata = {
  title: "AI Star Eco · 运营工作台",
  description: "AI 虚拟艺人孵化平台 · 运营人员管理后台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const badges = computeBadges();
  const unread = Object.values(badges).reduce<number>((s, v) => s + (v ?? 0), 0);

  return (
    <html lang="zh-CN">
      <body>
        <AppShell badges={badges} unread={unread}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
