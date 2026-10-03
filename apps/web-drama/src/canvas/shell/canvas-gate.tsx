"use client";

// 画布打开前的三种态：加载中（骨架，**不渲染编辑界面** —— 空文档一自动保存就会盖掉服务端的内容）/
// 找不到 / 打不开。ready 和 stale 时渲染 children（stale 时文档只读，顶栏有「载入最新」）。
import * as React from "react";
import Link from "next/link";
import { FileQuestion, RefreshCw, TriangleAlert } from "lucide-react";
import { useCanvasDoc } from "@/canvas/core";

export interface CanvasGateProps {
  children: React.ReactNode;
  /** 自定义加载骨架（缺省：一条顶栏 + 几块内容）。 */
  skeleton?: React.ReactNode;
}

export function CanvasGateSkeleton() {
  return (
    <div className="cv-gate-skel" aria-busy="true" aria-label="正在打开画布">
      <div className="cv-gate-skel-top">
        <div className="skel" style={{ width: 180, height: 22 }} />
        <div className="skel" style={{ width: 96, height: 26, borderRadius: 999 }} />
        <span className="grow" />
        <div className="skel" style={{ width: 72, height: 26, borderRadius: 999 }} />
      </div>
      <div className="cv-page">
        <div className="skel" style={{ width: "40%", height: 28, marginBottom: 18 }} />
        <div className="skel" style={{ width: "100%", height: 120, marginBottom: 12, borderRadius: 16 }} />
        <div className="skel" style={{ width: "100%", height: 220, borderRadius: 16 }} />
      </div>
    </div>
  );
}

export function CanvasGate({ children, skeleton }: CanvasGateProps) {
  const { status, errorMessage, reload } = useCanvasDoc();
  const [busy, setBusy] = React.useState(false);
  if (status === "loading") return <>{skeleton ?? <CanvasGateSkeleton />}</>;
  if (status === "not-found") {
    return (
      <div className="cv-gate">
        <FileQuestion size={28} />
        <div className="cv-gate-title">找不到这张画布</div>
        <div className="cv-gate-sub">可能已经删掉了，或者链接不对。</div>
        <Link href="/canvas" className="btn btn-primary btn-sm">
          回到我的画布
        </Link>
      </div>
    );
  }
  if (status === "error") {
    return (
      <div className="cv-gate">
        <TriangleAlert size={28} />
        <div className="cv-gate-title">这张画布没打开</div>
        <div className="cv-gate-sub">{errorMessage ?? "请稍后再试。"}</div>
        <div className="row gap-2" style={{ flexWrap: "wrap", justifyContent: "center" }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await reload();
              } finally {
                setBusy(false);
              }
            }}
          >
            <RefreshCw size={13} /> 重新打开
          </button>
          <Link href="/canvas" className="btn btn-ghost btn-sm">
            回到我的画布
          </Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
