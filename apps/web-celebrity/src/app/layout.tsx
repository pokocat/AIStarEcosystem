import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Manrope, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import "../styles/app.css";
import { AppProviders } from "./providers";

// Creator-Friendly 主题字体（来源：AI IP Design Directions 02）：
//   Inter 做 sans，Manrope 做 display，Instrument Serif 做斜体点缀，
//   JetBrains Mono 做数据 / 标签。变量名与 tokens.css 中 var(--font-*) 对齐。

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
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
  title: "AI 明星带货 — AI Star Eco",
  description: "基于真人明星授权的 AI 复刻 IP 带货平台",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  const fontClassNames = [
    inter.variable,
    manrope.variable,
    instrumentSerif.variable,
    jetbrainsMono.variable,
  ].join(" ");

  return (
    <html
      lang="zh"
      data-theme="creator"
      className={fontClassNames}
      suppressHydrationWarning
    >
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
