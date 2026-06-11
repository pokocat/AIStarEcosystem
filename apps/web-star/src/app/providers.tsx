"use client";

// AppProviders — AuthProvider（JWT + 平台访问隔离 + X-App-Code 审计短码）。
// star 平台：明星 / 经纪团队专属端，未授予 star 平台的账号将被拦截。

import type { ReactNode } from "react";
import { AuthProvider } from "@ai-star-eco/api-client";

const PUBLIC_PREFIXES = ["/", "/login"];

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider
      publicPathPrefixes={PUBLIC_PREFIXES}
      loginPath="/login"
      requiredPlatform="star"
    >
      {children}
    </AuthProvider>
  );
}
