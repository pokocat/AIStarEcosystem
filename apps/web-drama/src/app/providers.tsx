"use client";

import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { ThemeProvider } from "@ai-star-eco/ui";
import { AuthProvider } from "@ai-star-eco/api-client";
import { GlobalApiErrorNotification } from "@/components/common/global-api-error-notification";
import { DramaConfirmHost } from "@/components/drama-ui";

// USE_MOCK 拦截层：side-effect import，在 apiFetch 网络层注册所有 mock handler。
// USE_MOCK=0 时 registry 不被读取，仅 bundle 多余 KB（后续可按需 tree-shake）。
import "@/mocks/_register";

// 注：/auth/callback（统一账号中心回调）由 AuthProvider 内置放行，无需在此声明。
const PUBLIC_PREFIXES = ["/", "/login", "/activate"];

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider publicPathPrefixes={PUBLIC_PREFIXES} loginPath="/login" requiredPlatform="drama">
        {children}
        <GlobalApiErrorNotification />
        <DramaConfirmHost />
        <Toaster
          position="top-center"
          theme="light"
          closeButton
          gap={10}
          toastOptions={{
            className: "drama-toast",
            style: {
              background: "var(--surface)",
              color: "var(--ink)",
              border: "1px solid var(--line)",
              borderRadius: "14px",
              boxShadow: "var(--shadow-lg)",
              fontFamily: "var(--font)",
              fontWeight: 600,
              fontSize: 13.5,
              padding: "13px 15px",
            },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  );
}
