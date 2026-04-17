"use client";

import * as React from "react";
import { PartyPopper, Calendar, CheckCircle2, Play, Heart, ThumbsUp, Trophy, CalendarDays } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionDialog } from "@/components/ActionDialog";
import { EVENTS } from "@/mocks/community";
import { COMMUNITY_EVENT_STATUS, COMMUNITY_EVENT_TYPE } from "@/constants/status";
import type { CommunityEvent, CommunityEventType } from "@/types/community";
import { formatDateCN } from "@/lib/utils";

const TYPE_ICON: Record<CommunityEventType, LucideIcon> = {
  meetup: Heart,
  vote: ThumbsUp,
  challenge: Trophy,
  anniversary: CalendarDays,
};

export default function EventsPage() {
  const [target, setTarget] = React.useState<{ event: CommunityEvent; action: "launch" | "end" | "cancel" } | null>(null);

  const live = EVENTS.filter((e) => e.status === "live").length;
  const upcoming = EVENTS.filter((e) => e.status === "upcoming").length;
  const ended = EVENTS.filter((e) => e.status === "ended").length;
  const participants = EVENTS.reduce((a, b) => a + b.participants, 0);

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="活动管理"
        description="粉丝投票 / 见面会 / 挑战赛 / 纪念活动 的生命周期管理"
        breadcrumb={[{ label: "社群与粉丝" }, { label: "活动管理" }]}
        actions={<Button size="sm">新建活动</Button>}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="进行中" value={live} icon={Play} tone="success" />
        <StatCard label="即将开始" value={upcoming} icon={Calendar} tone="warning" />
        <StatCard label="已结束" value={ended} icon={CheckCircle2} />
        <StatCard label="累计参与" value={participants.toLocaleString("zh-CN")} icon={PartyPopper} />
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {EVENTS.map((e) => {
          const Icon = TYPE_ICON[e.type];
          return (
            <Card key={e.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="truncate">{e.title}</CardTitle>
                      <div className="text-xs text-muted-foreground">
                        {COMMUNITY_EVENT_TYPE[e.type]} · {formatDateCN(e.date)}
                      </div>
                    </div>
                  </div>
                  <StatusBadge meta={COMMUNITY_EVENT_STATUS[e.status]} dot={e.status === "live"} />
                </div>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <div className="text-xs text-muted-foreground">参与人数</div>
                  <div className="text-2xl font-semibold tabular-nums">{e.participants.toLocaleString("zh-CN")}</div>
                </div>
                <div className="flex items-center gap-1.5">
                  {e.status === "upcoming" && (
                    <>
                      <Button size="sm" variant="success" className="flex-1" onClick={() => setTarget({ event: e, action: "launch" })}>立即启动</Button>
                      <Button size="sm" variant="destructive" onClick={() => setTarget({ event: e, action: "cancel" })}>取消</Button>
                    </>
                  )}
                  {e.status === "live" && (
                    <Button size="sm" variant="warning" className="flex-1" onClick={() => setTarget({ event: e, action: "end" })}>提前结束</Button>
                  )}
                  {e.status === "ended" && <Button size="sm" variant="outline" className="flex-1">查看结算</Button>}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </section>

      {target && (
        <ActionDialog
          open={!!target}
          onOpenChange={(open) => !open && setTarget(null)}
          title={
            target.action === "launch"
              ? `立即启动活动：${target.event.title}`
              : target.action === "end"
              ? `提前结束活动：${target.event.title}`
              : `取消活动：${target.event.title}`
          }
          description={`${COMMUNITY_EVENT_TYPE[target.event.type]} · ${formatDateCN(target.event.date)}`}
          tone={target.action === "cancel" ? "danger" : target.action === "launch" ? "success" : "warning"}
          confirmLabel={target.action === "launch" ? "启动" : target.action === "end" ? "结束" : "取消活动"}
          requireReason
        />
      )}
    </div>
  );
}
