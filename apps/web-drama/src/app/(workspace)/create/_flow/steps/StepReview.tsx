"use client";

import * as React from "react";
import { ShieldCheck } from "lucide-react";
import { Card } from "@/components/premium";
import { SectionHeader, ComingSoon } from "@/components/common";

export function StepReview() {
  return (
    <Card style={{ padding: "20px 24px" }}>
      <SectionHeader eyebrow="审核 · 合规" title="导出前合规预审" />
      <ComingSoon
        icon={<ShieldCheck size={22} />}
        title="AI 合规预审"
        eta="后续版本"
        description="文本 / 画面 / 音频 / 版权四项自动校验，拦截违规内容并标注问题点；高风险内容转人工复审。当前不阻断流程，可直接归入项目并分发。"
      />
    </Card>
  );
}
