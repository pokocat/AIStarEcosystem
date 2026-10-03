"use client";

export const dynamic = "force-dynamic";

// 数据分析（v0.197 起归入侧栏「即将上线」）。
// 这一页原来的完播率、人均收入、平台 / 演员 / 类型占比都是写死的数，趋势图是正弦曲线，
// 「同步于 2 分钟前」也是写死的 —— 对每个用户展示同一批编造的经营数据（违反 AGENTS.md §8.0）。
// 发布到平台还没接通，本来就没有真实的播放和收入可看，所以照 /trends 的先例改成如实空态。
import * as React from "react";
import { BarChart3 } from "lucide-react";
import { Card } from "@/components/premium";
import { EmptyState, ViewHeader } from "@/components/common";

export default function InsightsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="即将上线"
        title={
          <>
            数据{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              分析
            </span>
          </>
        }
        meta="作品发到平台之后的播放、完播和收入"
      />
      <Card style={{ padding: "52px 24px" }}>
        <EmptyState
          icon={<BarChart3 size={28} />}
          title="数据分析还没上线"
          description="发布到平台还没接通，所以这里还没有播放、完播和收入数据。接通之后，会按每部短剧列出这些数。"
        />
      </Card>
    </div>
  );
}
