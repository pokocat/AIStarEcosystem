import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Noto_Sans_SC, Quicksand } from "next/font/google";
import "../styles/app.css";
import { AppProviders } from "./providers";

// 字体（视觉真源 styles.css）：
//   正文 = Noto Sans SC（中文优先）→ --font
//   数字 = Quicksand（等宽）→ --font-num
// 兼容旧别名 --font-sans / --font-display / --font-serif / --font-mono
// 由 tokens.css 中的 var 引用统一指向 --font / --font-num。
const notoSC = Noto_Sans_SC({
  subsets: ["latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font",
  display: "swap",
});

const quicksand = Quicksand({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-num",
  display: "swap",
});

export const metadata: Metadata = {
  title: "短剧工坊 — AI Star Eco",
  description: "从灵感到能直接开拍的成片配方,一条流水线搞定。",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fafaf9",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const fontClassNames = [notoSC.variable, quicksand.variable].join(" ");

  return (
    <html lang="zh" className={fontClassNames} suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
