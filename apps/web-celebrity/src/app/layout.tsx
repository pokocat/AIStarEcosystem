import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter, Space_Grotesk } from "next/font/google";
import "../styles/app.css";
import { AppProviders } from "./providers";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-sans",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI 明星带货 — AI Star Eco",
  description: "基于真人明星授权的 AI 复刻 IP 带货平台",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="zh"
      className={`dark ${inter.variable} ${spaceGrotesk.variable}`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground min-h-screen">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
