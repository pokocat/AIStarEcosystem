"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { LangProvider } from "@/lib/lang-context";
import { Toaster } from "@/components/ui/sonner";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LangProvider>
        {children}
        <Toaster />
      </LangProvider>
    </ThemeProvider>
  );
}
