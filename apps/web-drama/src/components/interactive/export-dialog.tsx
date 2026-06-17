"use client";

// 导出 Story Config v2 弹窗（v0.79）。预览 + 下载下发给社媒平台播放器的配置 JSON（§1 目标形态）。
// 结构校验未通过（有 error）时禁止导出，列出问题让用户先修。
import * as React from "react";
import { Download, X, CircleAlert, TriangleAlert, Check } from "lucide-react";
import { toast } from "sonner";
import type { InteractiveStoryData } from "@/lib/interactive-types";
import { buildStoryConfig, validateStory } from "@/lib/interactive-graph";

interface Props {
  open: boolean;
  dramaId: string;
  title: string;
  data: InteractiveStoryData;
  onClose: () => void;
}

export function ExportDialog({ open, dramaId, title, data, onClose }: Props) {
  const { errors, warnings, ok } = React.useMemo(() => validateStory(data), [data]);
  const json = React.useMemo(
    () => (ok ? JSON.stringify(buildStoryConfig(dramaId, data), null, 2) : ""),
    [ok, dramaId, data],
  );
  if (!open) return null;

  const download = () => {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "interactive-drama").replace(/[^\w一-龥-]/g, "_")}.story-config.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("已下载 Story Config v2");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("复制失败，请手动选择文本");
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="card pop-in col"
        style={{ width: 680, maxWidth: "94vw", maxHeight: "88vh", padding: 0, boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row gap-2" style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <Download size={17} style={{ color: "var(--accent)" }} />
          <span style={{ fontWeight: 800, fontSize: 15 }}>导出互动配置 · Story Config v2</span>
          <span className="grow" />
          <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={onClose}>
            <X size={15} />
          </button>
        </div>

        <div className="scroll col gap-3" style={{ padding: 20, minHeight: 0 }}>
          {!ok ? (
            <div className="col gap-2">
              <div className="row gap-2" style={{ color: "var(--danger)", fontWeight: 700, fontSize: 13.5 }}>
                <CircleAlert size={16} /> 结构校验未通过，请先修复 {errors.length} 个问题再导出：
              </div>
              {errors.map((e, i) => (
                <div key={i} className="row gap-2" style={{ fontSize: 12.5, color: "var(--ink-2)" }}>
                  <span style={{ color: "var(--danger)", flex: "none" }}>•</span>
                  {e.message}
                </div>
              ))}
            </div>
          ) : (
            <>
              <div className="row gap-2" style={{ color: "var(--success)", fontWeight: 700, fontSize: 13.5 }}>
                <Check size={16} /> 校验通过，可下发给抖音 / TikTok 小程序播放器消费。
              </div>
              {warnings.length > 0 && (
                <div className="col gap-1" style={{ background: "#fffbeb", borderRadius: 10, padding: "10px 12px" }}>
                  <span className="row gap-1" style={{ color: "#b45309", fontWeight: 700, fontSize: 12.5 }}>
                    <TriangleAlert size={14} /> {warnings.length} 条提示（不阻断导出）
                  </span>
                  {warnings.map((w, i) => (
                    <span key={i} className="faint" style={{ fontSize: 11.5 }}>· {w.message}</span>
                  ))}
                </div>
              )}
              <pre
                className="scroll num"
                style={{
                  margin: 0,
                  background: "var(--surface-2)",
                  borderRadius: 10,
                  padding: 14,
                  fontSize: 11.5,
                  lineHeight: 1.55,
                  maxHeight: "46vh",
                  overflow: "auto",
                  whiteSpace: "pre",
                  color: "var(--ink-2)",
                }}
              >
                {json}
              </pre>
            </>
          )}
        </div>

        <div className="row gap-2" style={{ padding: "14px 20px", borderTop: "1px solid var(--line)", justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            关闭
          </button>
          {ok && (
            <>
              <button type="button" className="btn btn-line" onClick={copy}>
                复制 JSON
              </button>
              <button type="button" className="btn btn-grad" onClick={download}>
                <Download size={15} /> 下载配置
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
