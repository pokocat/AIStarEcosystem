"use client";

// 导出互动配置文件弹窗（v0.79；文件格式是 Story Config v2）。预览 + 下载给社媒平台播放器用的配置 JSON。
// 检查没通过（有 error）时不能导出，列出问题让用户先改。
// v0.197：还有集没成片时不再说「可以下发」，把「这几集播不了」放在最上面。
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
  const noVideo = warnings.find((w) => w.code === "NO_VIDEO");
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
    toast.success("配置文件已下载");
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(json);
      toast.success("已复制到剪贴板");
    } catch {
      toast.error("没复制上，请手动选中文字复制");
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="card pop-in col"
        role="dialog"
        aria-modal="true"
        aria-label="导出互动配置文件"
        style={{ width: 680, maxWidth: "100%", maxHeight: "88vh", padding: 0, boxShadow: "var(--shadow-lg)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row gap-2" style={{ padding: "16px 20px", borderBottom: "1px solid var(--line)" }}>
          <Download size={17} style={{ color: "var(--accent)", flex: "none" }} />
          <span style={{ fontWeight: 800, fontSize: 15, minWidth: 0 }}>导出互动配置文件</span>
          <span className="grow" />
          <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={onClose} title="关闭" aria-label="关闭" style={{ flex: "none" }}>
            <X size={15} />
          </button>
        </div>

        <div className="scroll col gap-3" style={{ padding: 20, minHeight: 0 }}>
          {!ok ? (
            <div className="col gap-2">
              <div className="row gap-2" style={{ color: "var(--danger)", fontWeight: 700, fontSize: 13.5 }}>
                <CircleAlert size={16} style={{ flex: "none" }} /> 还有 {errors.length} 个问题，改好才能导出：
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
              {noVideo ? (
                <div className="row gap-2" style={{ color: "#b45309", fontWeight: 700, fontSize: 13.5, alignItems: "flex-start" }}>
                  <TriangleAlert size={16} style={{ flex: "none", marginTop: 2 }} /> 检查通过，但{noVideo.message}。可以先导出看看结构，等都成片了再导出一次给播放器。
                </div>
              ) : (
                <div className="row gap-2" style={{ color: "var(--success)", fontWeight: 700, fontSize: 13.5, alignItems: "flex-start" }}>
                  <Check size={16} style={{ flex: "none", marginTop: 2 }} /> 检查通过，可以导出给播放器（抖音 / TikTok 小程序）用。
                </div>
              )}
              {warnings.length > 0 && (
                <div className="col gap-1" style={{ background: "#fffbeb", borderRadius: 10, padding: "10px 12px" }}>
                  <span className="row gap-1" style={{ color: "#b45309", fontWeight: 700, fontSize: 12.5 }}>
                    <TriangleAlert size={14} /> {warnings.length} 条提醒（不影响导出）
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

        <div className="row gap-2" style={{ padding: "14px 20px", borderTop: "1px solid var(--line)", justifyContent: "flex-end", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            关闭
          </button>
          {ok && (
            <>
              <button type="button" className="btn btn-line" onClick={copy}>
                复制配置内容
              </button>
              <button type="button" className="btn btn-grad" onClick={download}>
                <Download size={15} /> 下载配置文件
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
