"use client";

export const dynamic = "force-dynamic";

import * as React from "react";
import { Compass } from "lucide-react";
import { Card } from "@/components/premium";
import { EmptyState, ViewHeader } from "@/components/common";

// 趋势雷达暂无后端数据源 —— 不再编造话题/分数（早期写死的 ALL_TRENDS 对所有用户展示假分析，
// 已移除）。接入全网趋势数据前，老实展示「建设中」。
export default function TrendsPage() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      <ViewHeader
        eyebrow="内容雷达"
        title={
          <>
            趋势{" "}
            <span
              className="text-gradient-gold"
              style={{ fontFamily: "var(--font-serif)", fontStyle: "italic", fontWeight: 400 }}
            >
              雷达
            </span>
          </>
        }
        meta="趋势数据还在接入，接好后这里列当下的热门题材"
      />
      <Card style={{ padding: "52px 24px" }}>
        <EmptyState
          icon={<Compass size={28} />}
          title="趋势雷达建设中"
          description="还在接内容热度和站内数据。接好之后，这里会列出当下的热门题材，可以直接拿去立项。"
        />
      </Card>
    </div>
  );
}
