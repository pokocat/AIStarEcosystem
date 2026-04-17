"use client";

import * as React from "react";
import { Heart, Gift, MessageSquare, Share2, UserPlus, ShieldAlert, EyeOff, Flame } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionDialog } from "@/components/ActionDialog";
import { ACTIVITIES } from "@/mocks/community";
import type { FanActivity, FanActionType } from "@/types/community";

const TYPE_META: Record<FanActionType, { label: string; icon: LucideIcon; tone: "success" | "info" | "primary" | "warning" }> = {
  gift: { label: "打赏", icon: Gift, tone: "warning" },
  comment: { label: "评论", icon: MessageSquare, tone: "info" },
  share: { label: "分享", icon: Share2, tone: "primary" },
  follow: { label: "关注", icon: UserPlus, tone: "success" },
};

function parseGift(action: string): number {
  const m = /¥(\d+)/.exec(action);
  return m ? Number(m[1]) : 0;
}

function riskLevel(a: FanActivity): "high" | "mid" | "low" | "none" {
  if (a.type === "gift") {
    const v = parseGift(a.action);
    if (v >= 500) return "high";
    if (v >= 200) return "mid";
    return "low";
  }
  return "none";
}

export default function ModerationPage() {
  const [tab, setTab] = React.useState<FanActionType | "all" | "flagged">("all");
  const [target, setTarget] = React.useState<{ a: FanActivity; action: "hide" | "ban" | "verify" } | null>(null);

  const flagged = ACTIVITIES.filter((a) => riskLevel(a) === "high" || riskLevel(a) === "mid");
  const list =
    tab === "all"
      ? ACTIVITIES
      : tab === "flagged"
      ? flagged
      : ACTIVITIES.filter((a) => a.type === tab);

  const counts = {
    gift: ACTIVITIES.filter((a) => a.type === "gift").length,
    comment: ACTIVITIES.filter((a) => a.type === "comment").length,
    share: ACTIVITIES.filter((a) => a.type === "share").length,
    follow: ACTIVITIES.filter((a) => a.type === "follow").length,
  };

  const giftTotal = ACTIVITIES.filter((a) => a.type === "gift").reduce((s, a) => s + parseGift(a.action), 0);

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="互动审核"
        description="粉丝动态、打赏与评论的人工核查，疑似刷单 / 不当内容统一处置"
        breadcrumb={[{ label: "社群与粉丝" }, { label: "互动审核" }]}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="互动总量" value={ACTIVITIES.length} icon={Heart} />
        <StatCard label="打赏金额" value={`¥${giftTotal.toLocaleString("zh-CN")}`} icon={Gift} tone="warning" />
        <StatCard label="疑似异常" value={flagged.length} icon={ShieldAlert} tone={flagged.length ? "danger" : "default"} />
        <StatCard label="高额打赏" value={ACTIVITIES.filter((a) => a.type === "gift" && parseGift(a.action) >= 500).length} icon={Flame} tone="danger" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>互动动态流</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="all">全部 ({ACTIVITIES.length})</TabsTrigger>
              <TabsTrigger value="flagged">疑似异常 ({flagged.length})</TabsTrigger>
              <TabsTrigger value="gift">打赏 ({counts.gift})</TabsTrigger>
              <TabsTrigger value="comment">评论 ({counts.comment})</TabsTrigger>
              <TabsTrigger value="share">分享 ({counts.share})</TabsTrigger>
              <TabsTrigger value="follow">关注 ({counts.follow})</TabsTrigger>
            </TabsList>

            <TabsContent value={tab}>
              <div className="divide-y divide-border">
                {list.map((a) => {
                  const meta = TYPE_META[a.type];
                  const Icon = meta.icon;
                  const risk = riskLevel(a);
                  return (
                    <div key={a.id} className="py-3 flex items-start gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-muted text-lg shrink-0">
                        {a.avatar}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium truncate">{a.user}</span>
                          <Badge tone={meta.tone}>
                            <Icon className="h-3 w-3" /> {meta.label}
                          </Badge>
                          {risk === "high" && <Badge tone="danger">高风险</Badge>}
                          {risk === "mid" && <Badge tone="warning">待核查</Badge>}
                          <span className="text-xs text-muted-foreground">· {a.time} 前</span>
                        </div>
                        <div className="text-sm text-foreground mt-0.5">{a.action}</div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {a.type === "gift" && risk !== "low" && (
                          <Button size="sm" variant="outline" onClick={() => setTarget({ a, action: "verify" })}>
                            标记已核查
                          </Button>
                        )}
                        {(a.type === "comment" || a.type === "share") && (
                          <Button size="sm" variant="outline" onClick={() => setTarget({ a, action: "hide" })}>
                            <EyeOff className="h-3.5 w-3.5" /> 隐藏
                          </Button>
                        )}
                        <Button size="sm" variant="destructive" onClick={() => setTarget({ a, action: "ban" })}>
                          封禁用户
                        </Button>
                      </div>
                    </div>
                  );
                })}
                {list.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">该分类暂无动态</div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {target && (
        <ActionDialog
          open={!!target}
          onOpenChange={(open) => !open && setTarget(null)}
          title={
            target.action === "hide"
              ? `隐藏动态：${target.a.user}`
              : target.action === "ban"
              ? `封禁用户：${target.a.user}`
              : `标记已核查：${target.a.user}`
          }
          description={target.a.action}
          tone={target.action === "ban" ? "danger" : target.action === "hide" ? "warning" : "success"}
          confirmLabel={target.action === "ban" ? "确认封禁" : target.action === "hide" ? "隐藏" : "标记已核查"}
          requireReason={target.action !== "verify"}
        />
      )}
    </div>
  );
}
