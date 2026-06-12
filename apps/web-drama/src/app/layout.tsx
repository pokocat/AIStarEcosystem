import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../styles/app.css";
import { AppProviders } from "./providers";

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
  return (
    <html lang="zh" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
