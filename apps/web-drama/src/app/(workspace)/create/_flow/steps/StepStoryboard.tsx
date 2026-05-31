"use client";

import * as React from "react";
import { Clapperboard } from "lucide-react";
import { Card } from "@/components/premium";
import { SectionHeader, EmptyState } from "@/components/common";
import { StoryboardGrid } from "@/components/short-drama/storyboard-grid";
import type { DramaDraftController } from "../useDramaDraft";

export function StepStoryboard({ ctrl }: { ctrl: DramaDraftController }) {
  const s = ctrl.activeScript;
  if (!s) {
    return (
      <Card style={{ padding: "22px 24px" }}>
        <EmptyState icon={<Clapperboard size={26} />} title="还没有脚本" description="先在前面的步骤生成或新建脚本。" />
      </Card>
    );
  }
  return (
    <Card style={{ padding: "20px 24px" }}>
      <SectionHeader eyebrow="分镜板" title="竖屏镜头预览" />
      <StoryboardGrid scenes={s.scenes ?? []} />
      <div style={{ fontSize: 11, color: "var(--fg-3)", marginTop: 12 }}>
        想调整镜头顺序 / 景别 / 时长？回到「剧本」步编辑分镜，这里会同步更新。
      </div>
    </Card>
  );
}
