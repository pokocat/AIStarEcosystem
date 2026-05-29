"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@ai-star-eco/ui";
import { AuthProvider } from "@ai-star-eco/api-client";
import { GlobalApiErrorDialog } from "@/components/common/global-api-error-dialog";

const PUBLIC_PREFIXES = ["/", "/login", "/activate"];

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider publicPathPrefixes={PUBLIC_PREFIXES} loginPath="/login">
        {children}
        <GlobalApiErrorDialog />
      </AuthProvider>
    </ThemeProvider>
  );
}
