"use client";

import type { ReactNode } from "react";
import { AuthProvider, USE_MOCK } from "@ai-star-eco/api-client";
import { installAuthOverrides } from "@/mocks/auth-override";

// AiAvatar 暂不接入 v0.43 的 SubProduct(music/drama/celebrity) 平台隔离 —— 任何已登录账号
// 均可访问（见 DECISIONS.md §A）。故不传 requiredPlatform。
const PUBLIC_PREFIXES = ["/", "/login"];

// mock 模式：装上本地 auth 覆盖（按运营开关注入 operatorRole）。模块加载即生效，先于首个 /me。
if (USE_MOCK) installAuthOverrides();

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider publicPathPrefixes={PUBLIC_PREFIXES} loginPath="/login">
      {children}
    </AuthProvider>
  );
}
