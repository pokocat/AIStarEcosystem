"use client";

import * as React from "react";
import { Bell, Send } from "lucide-react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Section } from "@/components/shared/Section";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { StatCard } from "@/components/shared/StatCard";
import { mapTone } from "@/components/shared/tone";
import { useAsyncList } from "@/components/shared/useAsyncList";
import { listNotifications, markNotificationRead } from "@/api/notifications";
import { NOTIFICATION_TYPE } from "@/constants/status";
import type { Notification } from "@/types/notification";
import { cn } from "@/lib/utils";

const SCOPE_LABEL: Record<string, string> = {
  all: "全体用户",
  studio: "工作室",
  artist: "艺人",
  account: "账户",
};

export default function NotificationsPage() {
  const { data: initial } = useAsyncList(() => listNotifications());
  const [list, setList] = React.useState<Notification[]>([]);

  React.useEffect(() => { setList(initial); }, [initial]);

  const unread = list.filter((n) => !n.read).length;

  const onRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setList((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    } catch { /* ignore */ }
  };

  return (
    <>
      <PageHeader
        title="消息中心"
        description="运营推送与告警 · 支持按受众范围分发（全站 / 工作室 / 艺人 / 账户）"
        actions={
          <button className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            <Send className="h-4 w-4" /> 发送公告
          </button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard icon={Bell} label="总消息" value={list.length} tone="primary" />
        <StatCard label="未读" value={unread} tone={unread > 0 ? "amber" : "emerald"} />
        <StatCard label="全站公告" value={list.filter((n) => n.audience.scope === "all").length} tone="violet" />
        <StatCard label="艺人相关" value={list.filter((n) => n.audience.scope === "artist").length} tone="sky" />
      </div>

      <Section padding={false}>
        <div className="divide-y divide-border">
          {list.map((n) => {
            const m = NOTIFICATION_TYPE[n.type];
            return (
              <div key={n.id} className={cn("flex items-start gap-3 px-4 py-3", !n.read && "bg-primary-soft/30")}>
                <div className={cn("h-9 w-9 rounded-full flex items-center justify-center shrink-0 ring-1 ring-inset", m ? "bg-muted" : "bg-muted")}>
                  <Bell className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-sm">{n.title}</span>
                    {m && <StatusBadge tone={mapTone(m.tone)} label={m.label} dot={false} className="text-[10px] px-1.5 py-0" />}
                    <StatusBadge tone="neutral" label={`${SCOPE_LABEL[n.audience.scope] ?? n.audience.scope}${n.audience.targetName ? " · " + n.audience.targetName : ""}`} dot={false} className="text-[10px] px-1.5 py-0" />
                    {!n.read && <span className="dot text-primary" />}
                  </div>
                  <div className="mt-0.5 text-sm text-muted-foreground">{n.desc}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{n.time}</div>
                </div>
                {!n.read && (
                  <button onClick={() => onRead(n.id)} className="shrink-0 text-xs text-primary hover:underline">
                    标记已读
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}
