"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@ai-star-eco/api-client";

// AiAvatar 暂不接入 v0.43 的 SubProduct(music/drama/celebrity) 平台隔离 —— 任何已登录账号
// 均可访问（见 DECISIONS.md §A）。故不传 requiredPlatform。
const PUBLIC_PREFIXES = ["/", "/login"];

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider publicPathPrefixes={PUBLIC_PREFIXES} loginPath="/login">
      {children}
    </AuthProvider>
  );
}
