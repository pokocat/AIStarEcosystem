"use client";

// AppProviders — AuthProvider（JWT + 平台访问隔离 + X-App-Code 审计短码）。
//
// AI IP 工作台与「数字资产平台」共用 aiavatar 开通（docs/ip-studio-plan.md §0）：
// 产出物本来就是 AiAvatar 数字资产，不新增产品码、不改 enrollment。
// appCode 未显式传入时由 AuthProvider 回退到 requiredPlatform（= aiavatar）。

import type { ReactNode } from "react";
import { AuthProvider } from "@ai-star-eco/api-client";
import { ToastProvider } from "@/components/common/toast";

// 注：/auth/callback（统一账号中心回调）由 AuthProvider 内置放行，无需在此声明。
const PUBLIC_PREFIXES = ["/", "/login"];

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider
      publicPathPrefixes={PUBLIC_PREFIXES}
      loginPath="/login"
      requiredPlatform="aiavatar"
    >
      <ToastProvider>{children}</ToastProvider>
    </AuthProvider>
  );
}
