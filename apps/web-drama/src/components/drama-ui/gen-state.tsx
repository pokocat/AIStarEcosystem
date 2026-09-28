"use client";

// AI 生成状态助手 + 骨架屏 + 失败块（有真实问题编号时才显示）。
// 设计真源：components.jsx `useGen / GenSkeleton / GenError`。
import * as React from "react";
import { Copy, RefreshCw, TriangleAlert } from "lucide-react";

export type GenPhase = "idle" | "gen" | "error" | "done";

interface UseGenOptions {
  /** 演示失败模式（开发用） */
  demoError?: boolean;
  /** 模拟时长 ms（默认 1400） */
  duration?: number;
  initial?: GenPhase;
}

export function useGen({ demoError, duration = 1400, initial = "idle" }: UseGenOptions = {}) {
  const [phase, setPhase] = React.useState<GenPhase>(initial);
  const run = React.useCallback(() => {
    setPhase("gen");
    setTimeout(() => setPhase(demoError ? "error" : "done"), duration);
  }, [demoError, duration]);
  const retry = React.useCallback(() => {
    setPhase("gen");
    setTimeout(() => setPhase("done"), Math.max(800, duration - 200));
  }, [duration]);
  return { phase, setPhase, run, retry };
}

interface GenSkeletonProps {
  lines?: number;
  label?: string;
}

export function GenSkeleton({ lines = 3, label = "AI 正在起草…" }: GenSkeletonProps) {
  return (
    <div className="col gap-3 fade-up">
      <div className="row gap-3" style={{ color: "var(--accent)", fontWeight: 600, fontSize: 13 }}>
        <span
          aria-hidden
          style={{
            width: 16,
            height: 16,
            border: "2px solid var(--accent-soft)",
            borderTopColor: "var(--accent)",
            borderRadius: "50%",
            animation: "drama-spin .8s linear infinite",
          }}
        />
        {label}
      </div>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="card" style={{ padding: 14 }}>
          <div className="skel" style={{ height: 13, width: `${70 - i * 8}%`, marginBottom: 9 }} />
          <div className="skel" style={{ height: 11, width: "100%", marginBottom: 6 }} />
          <div className="skel" style={{ height: 11, width: "85%" }} />
        </div>
      ))}
    </div>
  );
}

interface GenErrorProps {
  reason?: string;
  /** 服务端给的问题编号；没有就不显示（v0.197：之前现场随机编一个，用户报给客服谁也查不到） */
  trace?: string;
  onRetry?: () => void;
}

export function GenError({ reason, trace, onRetry }: GenErrorProps) {
  const id = trace?.trim() || null;
  const [copied, setCopied] = React.useState(false);
  function copy() {
    if (id && typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(id).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
    }
  }
  return (
    <div className="col gap-3 fade-up" style={{ padding: "8px 0" }}>
      <div
        className="card col gap-3"
        style={{ padding: 18, background: "#fef2f2", border: "1px solid #fecaca" }}
      >
        <div className="row gap-3" style={{ alignItems: "flex-start" }}>
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "#fee2e2",
              display: "grid",
              placeItems: "center",
              flex: "none",
            }}
          >
            <TriangleAlert size={18} color="#dc2626" />
          </div>
          <div className="grow">
            <div style={{ fontWeight: 700, color: "#b91c1c" }}>生成失败</div>
            <div style={{ fontSize: 13, color: "#7f1d1d", marginTop: 2, lineHeight: 1.55 }}>
              {reason ?? "AI 暂时没响应，你写的内容都还在，稍后再试一次。"}
            </div>
          </div>
        </div>
        <div className="row gap-3" style={{ paddingLeft: 46, flexWrap: "wrap" }}>
          {onRetry && (
            <button
              type="button"
              className="btn btn-sm"
              style={{ background: "#dc2626", color: "#fff" }}
              onClick={onRetry}
            >
              <RefreshCw size={14} /> 重新生成
            </button>
          )}
          {id && (
            <button type="button" className="chip" onClick={copy} title="联系我们时报这个编号，方便查问题">
              <Copy size={12} /> {copied ? "已复制" : "复制问题编号"}{" "}
              <b className="num" style={{ marginLeft: 2 }}>#{id}</b>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
