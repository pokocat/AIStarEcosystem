"use client";

import type { ReactNode } from "react";
import { ThemeProvider } from "@/components/ThemeProvider";
import { AppPreferencesProvider } from "@/providers/app-preferences-provider";

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AppPreferencesProvider>{children}</AppPreferencesProvider>
    </ThemeProvider>
  );
}
