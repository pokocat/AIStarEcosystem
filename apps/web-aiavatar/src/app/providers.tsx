"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@ai-star-eco/ui";
import { AuthProvider } from "@ai-star-eco/api-client";

// AiAvatar 中心独立部署：复用账户体系（aep_users），但不参与 music/drama/celebrity 的
// 平台访问隔离（requiredPlatform 仅支持那三者）。任何已登录账号均可访问 —— 见 DECISIONS.md。
const PUBLIC_PREFIXES = ["/", "/login"];

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider publicPathPrefixes={PUBLIC_PREFIXES} loginPath="/login">
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
