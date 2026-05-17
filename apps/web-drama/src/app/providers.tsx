"use client";

import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { ThemeProvider } from "@ai-star-eco/ui";
import { AuthProvider } from "@ai-star-eco/api-client";

// USE_MOCK 拦截层：side-effect import，在 apiFetch 网络层注册所有 mock handler。
// USE_MOCK=0 时 registry 不被读取，仅 bundle 多余 KB（后续可按需 tree-shake）。
import "@/mocks/_register";

const PUBLIC_PREFIXES = ["/", "/login", "/activate"];

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider publicPathPrefixes={PUBLIC_PREFIXES} loginPath="/login">
        {children}
        <Toaster
          position="top-center"
          theme="dark"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: "var(--bg-1)",
              border: "1px solid var(--line-2)",
              color: "var(--fg-0)",
              fontFamily: "var(--font-sans)",
            },
          }}
        />
      </AuthProvider>
    </ThemeProvider>
  );
}
