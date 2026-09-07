"use client";

// ─────────────────────────────────────────────────────────────────────────────
// 画布宿主 —— 把搬来的画布（src/canvas）接到本仓的路由、账号与服务端上。
//
// 三件事：
//   ① antd 的 App / ConfigProvider（画布用 message、modal，没有 provider 会静默失效）
//   ② 从服务端把项目拉下来再渲染画布 —— 拉完之前不能渲染，否则画布会认为
//      「这个项目是空的」，紧接着的自动保存把服务端真正的内容覆盖掉
//   ③ 保存状态给用户看得见
// ─────────────────────────────────────────────────────────────────────────────

import * as React from "react";
import { App as AntdApp, ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import { AlertCircle, Loader2 } from "lucide-react";
import CanvasPage from "@/canvas/pages/canvas/project";
import { useProjectSync } from "@/canvas-bridge/project-sync";
import "@/canvas-bridge/i18n";

const SAVE_LABEL: Record<string, string> = {
  saving: "保存中",
  saved: "已保存",
  failed: "没保存上，改动还在本地",
};

function Host({ projectId }: { projectId: string }) {
  const { state, error, saveState } = useProjectSync(projectId);

  if (state === "loading") {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--primary)" }} />
        <p className="text-[12.5px]" style={{ color: "var(--ink-3)" }}>正在打开画布…</p>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 px-8 text-center">
        <AlertCircle className="w-6 h-6" style={{ color: "var(--err)" }} />
        <p className="text-[13px] max-w-sm" style={{ color: "var(--ink-2)" }}>{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 rounded-xl text-[12.5px] font-bold transition hover:brightness-95"
          style={{ background: "var(--action)", color: "var(--on-action)" }}
        >
          重新加载
        </button>
      </div>
    );
  }

  return (
    <div className="h-full relative">
      <CanvasPage />
      {saveState !== "idle" && (
        <span
          className="absolute top-3 right-4 z-50 px-2.5 py-1 rounded-full text-[11.5px] font-semibold pointer-events-none"
          style={
            saveState === "failed"
              ? { background: "var(--err-soft)", color: "var(--err)" }
              : { background: "var(--surface-2)", color: "var(--ink-3)" }
          }
        >
          {SAVE_LABEL[saveState]}
        </span>
      )}
    </div>
  );
}

export function CanvasHost({ projectId }: { projectId: string }) {
  return (
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: { colorPrimary: "#495b91", borderRadius: 9, fontFamily: "var(--font-sans)" },
      }}
    >
      <AntdApp>
        <Host projectId={projectId} />
      </AntdApp>
    </ConfigProvider>
  );
}
