import type { Metadata } from "next";
import type { ReactNode } from "react";
import "../styles/app.css";
import { AppProviders } from "./providers";

export const metadata: Metadata = {
  title: "AI Star Eco — 虚拟艺人孵化生态",
  description: "AI 虚拟歌手孵化、发行与粉丝经济平台",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh" suppressHydrationWarning>
      <body className="bg-black text-white min-h-screen">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
