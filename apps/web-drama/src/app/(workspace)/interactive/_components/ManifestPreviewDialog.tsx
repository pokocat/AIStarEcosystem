"use client";

// 互动配置 manifest 预览 / 导出 —— 交给社媒平台（抖音 / TikTok）的规范产物。
// manifest 本质 = 解析后带视频地址的剧集图（schema=ai-star-eco.interactive-drama/v1）。

import * as React from "react";
import { toast } from "sonner";
import { Download, AlertTriangle } from "lucide-react";
import { Dialog } from "@/components/common";
import { Button } from "@/components/premium";
import { buildManifest } from "@/lib/interactive-graph";
import type { InteractiveSeries } from "@/api/interactive-drama";

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  series: InteractiveSeries;
}

export function ManifestPreviewDialog({ open, onOpenChange, series }: Props) {
  const manifest = React.useMemo(() => buildManifest(series), [series]);
  const json = React.useMemo(() => JSON.stringify(manifest, null, 2), [manifest]);
  const ungenerated = series.episodes.filter((e) => !e.video_url).length;

  function download() {
    const blob = new Blob([json], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${series.title || "interactive-drama"}-互动配置.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("已导出互动配置 JSON");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="互动配置预览"
      description="这份配置 + 每集视频，就是交给抖音 / TikTok 的产物：它描述了起始集、每集播完弹什么互动、每个选项跳哪一集。"
      width={680}
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          <Button variant="primary" onClick={download}>
            <Download size={14} /> 下载 JSON
          </Button>
        </>
      }
    >
      {ungenerated > 0 && (
        <div
          className="row gap-2"
          style={{
            padding: "10px 12px",
            borderRadius: "var(--radius-sm)",
            background: "color-mix(in srgb, var(--warning) 12%, transparent)",
            border: "1px solid color-mix(in srgb, var(--warning) 30%, transparent)",
            color: "var(--warning)",
            fontSize: 12.5,
            marginBottom: 14,
            alignItems: "flex-start",
          }}
        >
          <AlertTriangle size={14} style={{ flex: "none", marginTop: 1 }} />
          <span>
            还有 <b>{ungenerated}</b> 集没有生成视频，导出的配置里这些集的 <code>video_url</code> 为空 —— 平台侧需要补齐才能完整播放。
          </span>
        </div>
      )}

      <div
        style={{
          fontFamily: "var(--font-num)",
          fontSize: 11.5,
          lineHeight: 1.6,
          color: "var(--ink-2)",
          background: "var(--surface-2)",
          border: "1px solid var(--line)",
          borderRadius: "var(--radius-sm)",
          padding: "14px 16px",
          maxHeight: "52vh",
          overflow: "auto",
          whiteSpace: "pre",
        }}
      >
        {json}
      </div>
    </Dialog>
  );
}
