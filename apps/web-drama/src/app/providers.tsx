"use client";

import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { ThemeProvider } from "@ai-star-eco/ui";
import { AuthProvider } from "@ai-star-eco/api-client";

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
