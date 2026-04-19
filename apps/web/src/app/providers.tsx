"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LangProvider } from "@/lib/lang-context";
import { AuthProvider } from "@/lib/auth-context";
import { Toaster } from "@/components/ui/sonner";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LangProvider>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </LangProvider>
    </ThemeProvider>
  );
}
