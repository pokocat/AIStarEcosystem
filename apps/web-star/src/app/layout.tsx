import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "../styles/app.css";
import { AppProviders } from "./providers";

export const metadata: Metadata = {
  title: "明星商务工作台 — AI Star Eco",
  description: "明星 IP 资产托管、授权审核、商品准入与收益结算的一站式商务中枢",
  openGraph: {
    title: "明星商务工作台 — AI Star Eco",
    description: "明星 IP 资产托管、授权审核、商品准入与收益结算的一站式商务中枢",
    siteName: "AI Star Eco",
    locale: "zh_CN",
    type: "website",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f7f6f3",
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
