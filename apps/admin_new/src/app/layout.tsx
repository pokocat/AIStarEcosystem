import type { Metadata } from "next";
import "@/styles/globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { Toaster } from "sonner";

export const metadata: Metadata = {
  title: "AI Star Eco · 运营控制台",
  description: "AI 艺人孵化与分发平台的管理后台",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <AppShell>{children}</AppShell>
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
