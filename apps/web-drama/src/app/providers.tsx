"use client";

import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { ThemeProvider } from "@ai-star-eco/ui";
import { AuthProvider } from "@ai-star-eco/api-client";
import { GlobalApiErrorNotification } from "@/components/common/global-api-error-notification";

// USE_MOCK 拦截层：side-effect import。USE_MOCK=0 时 registerMocks 为 no-op。
import "@/mocks/_register";

const PUBLIC_PREFIXES = ["/", "/login", "/activate"];

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider publicPathPrefixes={PUBLIC_PREFIXES} loginPath="/login" requiredPlatform="drama">
        {children}
        <GlobalApiErrorNotification />
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
