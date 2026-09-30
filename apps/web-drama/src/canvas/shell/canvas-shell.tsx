"use client";

// 一张画布的整屏外壳（[canvasId]/layout.tsx 用）：竖条 + 顶栏 + 文档 / 生成两个 Provider + 打开前的三种态。
// 四屏共用这一份文档，切步骤不重新加载。全站侧栏 / 顶栏在 (workspace)/layout.tsx 里对 /canvas/<id> 不挂（沉浸态）。
import * as React from "react";
import { CanvasDocProvider, CanvasRunsProvider } from "@/canvas/core";
import { CanvasRail } from "./canvas-rail";
import { CanvasGate } from "./canvas-gate";
import { CanvasTopbar, CanvasTopbarSlotProvider } from "./canvas-topbar";

export function CanvasShell({ canvasId, children }: { canvasId: string; children: React.ReactNode }) {
  return (
    <CanvasDocProvider canvasId={canvasId}>
      <CanvasRunsProvider>
        <CanvasTopbarSlotProvider>
          <div className="cv-shell">
            <CanvasRail canvasId={canvasId} />
            <div className="cv-main">
              <CanvasGate>
                <CanvasTopbar />
                <div className="cv-content">{children}</div>
              </CanvasGate>
            </div>
          </div>
        </CanvasTopbarSlotProvider>
      </CanvasRunsProvider>
    </CanvasDocProvider>
  );
}
