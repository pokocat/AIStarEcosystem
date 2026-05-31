"use client";

import type { ReactNode } from "react";
import * as React from "react";
import { useAuth } from "@ai-star-eco/api-client";
import { Sidebar } from "@/components/shell/sidebar";
import { DataSourceBanner } from "@/components/common/data-source-banner";

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();

  // 未登录由 AuthProvider 跳 /login；这里加载态给个占位避免闪烁。
  if (loading || !user) {
    return (
      <div style={{ display: "grid", placeItems: "center", height: "100vh", color: "var(--ink-2)", fontFamily: "var(--font-mono)", fontSize: 13 }}>
        载入工作台…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden" }}>
      <Sidebar />
      <main style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, height: "100%" }}>
        <div id="scroll-main" className="tex-grid" style={{ flex: 1, overflowY: "auto", position: "relative" }}>
          {children}
        </div>
      </main>
      <DataSourceBanner />
    </div>
  );
}
