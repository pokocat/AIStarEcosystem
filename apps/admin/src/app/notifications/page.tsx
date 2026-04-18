"use client";

import * as React from "react";
import { Bell, BellOff, CheckCheck, Wallet, Users, Megaphone, Settings, Trophy } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { INITIAL_NOTIFICATIONS } from "@/mocks/notifications";
import { NOTIFICATION_TYPE } from "@/constants/status";
import type { Notification, NotificationType } from "@/types/notification";

const TYPE_ICON: Record<NotificationType, LucideIcon> = {
  revenue: Wallet,
  fan: Users,
  content: Megaphone,
  system: Settings,
  achievement: Trophy,
};

export default function NotificationsPage() {
  const [list, setList] = React.useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [tab, setTab] = React.useState<NotificationType | "all" | "unread">("all");

  const unread = list.filter((n) => !n.read).length;
  const filtered =
    tab === "all"
      ? list
      : tab === "unread"
      ? list.filter((n) => !n.read)
      : list.filter((n) => n.type === tab);

  const toggleRead = (id: string) =>
    setList((prev) => prev.map((n) => (n.id === id ? { ...n, read: !n.read } : n)));
  const markAllRead = () => setList((prev) => prev.map((n) => ({ ...n, read: true })));

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="消息中心"
        description="平台运营推送、收益到账与系统告警统一收件箱"
        breadcrumb={[{ label: "消息与日志" }, { label: "消息中心" }]}
        actions={
          <Button size="sm" variant="outline" onClick={markAllRead} disabled={unread === 0}>
            <CheckCheck className="h-3.5 w-3.5" /> 全部标记已读
          </Button>
        }
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="消息总量" value={list.length} icon={Bell} />
        <StatCard label="未读" value={unread} icon={BellOff} tone={unread ? "warning" : "default"} />
        <StatCard label="系统告警" value={list.filter((n) => n.type === "system").length} icon={Settings} />
        <StatCard label="收益到账" value={list.filter((n) => n.type === "revenue").length} icon={Wallet} tone="success" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>消息流</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList>
              <TabsTrigger value="all">全部 ({list.length})</TabsTrigger>
              <TabsTrigger value="unread">未读 ({unread})</TabsTrigger>
              <TabsTrigger value="revenue">收益</TabsTrigger>
              <TabsTrigger value="content">内容</TabsTrigger>
              <TabsTrigger value="fan">粉丝</TabsTrigger>
              <TabsTrigger value="system">系统</TabsTrigger>
              <TabsTrigger value="achievement">成就</TabsTrigger>
            </TabsList>

            <TabsContent value={tab}>
              <div className="divide-y divide-border">
                {filtered.map((n) => {
                  const meta = NOTIFICATION_TYPE[n.type];
                  const Icon = TYPE_ICON[n.type];
                  return (
                    <div
                      key={n.id}
                      className={
                        "py-3 flex items-start gap-3 " + (!n.read ? "bg-indigo-50/30 -mx-4 px-4" : "")
                      }
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={"text-sm " + (n.read ? "font-medium" : "font-semibold")}>{n.title}</span>
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          {!n.read && <span className="h-2 w-2 rounded-full bg-rose-500" />}
                          <span className="text-xs text-muted-foreground">· {n.time} 前</span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-0.5">{n.desc}</div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => toggleRead(n.id)} className="shrink-0">
                        {n.read ? "标为未读" : "已读"}
                      </Button>
                    </div>
                  );
                })}
                {filtered.length === 0 && (
                  <div className="py-8 text-center text-sm text-muted-foreground">暂无消息</div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
