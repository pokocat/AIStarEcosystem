import type { Metadata } from "next";
import "../styles/globals.css";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
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
        <div className="flex min-h-screen bg-background">
          <Sidebar badges={badges} />
          <div className="flex flex-1 min-w-0 flex-col">
            <Topbar unread={unread} />
            <main className="flex-1 min-w-0 px-6 py-6">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
