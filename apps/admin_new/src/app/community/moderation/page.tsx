"use client";

import * as React from "react";
import { Heart, Gift, MessageSquare, Share2, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import { StatCard } from "@/components/shared/StatCard";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listActivities } from "@/api/community";
import type { FanActivity } from "@/types/community";

const ICONS = {
  gift: Gift,
  comment: MessageSquare,
  share: Share2,
  follow: UserPlus,
} as const;

const TONE: Record<FanActivity["type"], string> = {
  gift: "bg-rose-50 text-rose-600",
  comment: "bg-blue-50 text-blue-600",
  share: "bg-emerald-50 text-emerald-600",
  follow: "bg-violet-50 text-violet-600",
};

export default function ModerationPage() {
  const { data } = useAsyncList(() => listActivities());

  const counts = {
    gift: data.filter((a) => a.type === "gift").length,
    comment: data.filter((a) => a.type === "comment").length,
    share: data.filter((a) => a.type === "share").length,
    follow: data.filter((a) => a.type === "follow").length,
  };

  return (
    <>
      <PageHeader
        title="互动审核"
        description="粉丝动态流 · 打赏 / 评论 / 分享 / 关注。支持举报与下架。"
      />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard icon={Gift} label="打赏" value={counts.gift} tone="rose" />
        <StatCard icon={MessageSquare} label="评论" value={counts.comment} tone="sky" />
        <StatCard icon={Share2} label="分享" value={counts.share} tone="emerald" />
        <StatCard icon={UserPlus} label="新关注" value={counts.follow} tone="violet" />
      </div>

      <Section title="动态流" description="按时间倒序展示" padding={false}>
        <div className="divide-y divide-border">
          {data.map((a) => {
            const Icon = ICONS[a.type] ?? Heart;
            return (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${TONE[a.type]}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="shrink-0 text-lg">{a.avatar}</div>
                <div className="flex-1 min-w-0">
                  <div><span className="font-medium">{a.user}</span> <span className="text-muted-foreground">{a.action}</span></div>
                  <div className="text-xs text-muted-foreground">{a.time}</div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button className="rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted">置顶</button>
                  <button className="rounded px-2 py-1 text-xs text-destructive hover:bg-destructive-soft">下架</button>
                </div>
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}
