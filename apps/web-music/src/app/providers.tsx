"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@ai-star-eco/ui";
import { AuthProvider } from "@ai-star-eco/api-client";

// AI 音乐人独立 app 的公开路径（未登录可访问）：
// - "/"        landing
// - "/login"   登录
// - "/activate" 激活
// 工作台 /console/* 需要登录，由 AuthProvider 兜底重定向。
const PUBLIC_PREFIXES = ["/", "/login", "/activate"];

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider publicPathPrefixes={PUBLIC_PREFIXES} loginPath="/login">
        {children}
      </AuthProvider>
    </ThemeProvider>
  );
}
