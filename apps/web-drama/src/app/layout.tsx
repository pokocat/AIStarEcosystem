import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "../styles/app.css";
import { AppProviders } from "./providers";

// Premium 主题字体（来源：AI IP Design Directions 03）：
//   Plus Jakarta Sans 做 sans + display
//   Instrument Serif 做点缀（hero、eyebrow 等）
//   JetBrains Mono 做数据 / 标签
// 变量名 --font-sans / --font-display / --font-serif / --font-mono 与 tokens.css 对齐。
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const jakartaDisplay = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

const instrumentSerif = Instrument_Serif({
  subsets: ["latin"],
  weight: ["400"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI 短剧 — AI Star Eco",
  description: "演员 IP 阵容、脚本工坊、短剧项目与多平台分发的一体化工坊",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const fontClassNames = [
    jakarta.variable,
    jakartaDisplay.variable,
    instrumentSerif.variable,
    jetbrainsMono.variable,
  ].join(" ");

  return (
    <html
      lang="zh"
      data-theme="premium"
      className={`dark ${fontClassNames}`}
      suppressHydrationWarning
    >
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
