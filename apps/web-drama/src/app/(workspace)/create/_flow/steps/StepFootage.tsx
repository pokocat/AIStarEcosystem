"use client";

import * as React from "react";
import { Film, Scissors, Send } from "lucide-react";
import { Button, Card } from "@/components/premium";
import { SectionHeader, ComingSoon, EmptyState } from "@/components/common";
import { VideoLibrary } from "@/components/short-drama/video-library";
import type { DramaDraftController } from "../useDramaDraft";

export function StepFootage({ ctrl }: { ctrl: DramaDraftController }) {
  const s = ctrl.activeScript;
  if (!s) {
    return (
      <Card style={{ padding: "22px 24px" }}>
        <EmptyState icon={<Film size={26} />} title="还没有脚本" description="先生成短剧视频，成片会出现在这里。" />
      </Card>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card style={{ padding: "20px 24px" }}>
        <SectionHeader
          eyebrow="成片"
          title="短剧视频库"
          right={
            <div style={{ display: "flex", gap: 8 }}>
              <Button variant="secondary" size="sm" loading={ctrl.publishing} onClick={ctrl.handlePublishToProject} disabled={ctrl.publishing}>
                <Send size={12} /> 归入项目
              </Button>
              <Button variant="primary" size="sm" onClick={ctrl.handleGoDistribute}>去分发 →</Button>
            </div>
          }
        />
        <VideoLibrary jobs={ctrl.jobs} />
      </Card>

      <ComingSoon
        compact
        icon={<Scissors size={16} />}
        title="剪辑微调"
        eta="后续版本"
        description="时间线裁剪、卡点特效、片头片尾模板将在这里提供；当前成片可直接归入项目并分发。"
      />
    </div>
  );
}
