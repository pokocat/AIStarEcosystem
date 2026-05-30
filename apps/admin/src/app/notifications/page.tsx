"use client";

import * as React from "react";
import {
  Bell,
  BellOff,
  CheckCheck,
  Wallet,
  Users,
  Megaphone,
  Settings,
  Trophy,
  Globe2,
  Building2,
  Sparkles,
  UserCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { listNotifications, markNotificationRead } from "@/api/notifications";
import { NOTIFICATION_TYPE } from "@/constants/status";
import type { Notification, NotificationAudienceScope, NotificationType } from "@/types/notification";

const TYPE_ICON: Record<NotificationType, LucideIcon> = {
  revenue: Wallet,
  fan: Users,
  content: Megaphone,
  system: Settings,
  achievement: Trophy,
};

const AUDIENCE_META: Record<
  NotificationAudienceScope,
  { label: string; icon: LucideIcon; className: string }
> = {
  all:     { label: "全体用户",   icon: Globe2,     className: "bg-sky-50 text-sky-700 ring-sky-200" },
  studio:  { label: "经纪公司",   icon: Building2,  className: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  artist:  { label: "艺人",       icon: Sparkles,   className: "bg-amber-50 text-amber-700 ring-amber-200" },
  account: { label: "个人账户",   icon: UserCircle, className: "bg-slate-100 text-slate-700 ring-slate-200" },
};

function AudienceBadge({ audience }: { audience: Notification["audience"] | undefined }) {
  const scope: NotificationAudienceScope = audience?.scope ?? "all";
  const meta = AUDIENCE_META[scope];
  const Icon = meta.icon;
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset whitespace-nowrap " +
        meta.className
      }
    >
      <Icon className="h-3 w-3" />
      <span>{meta.label}</span>
      {audience?.targetName && scope !== "all" && (
        <span className="opacity-70">· {audience.targetName}</span>
      )}
    </span>
  );
}

export default function NotificationsPage() {
  const [list, setList] = React.useState<Notification[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<NotificationType | "all" | "unread">("all");
  const [audienceFilter, setAudienceFilter] = React.useState<"all" | NotificationAudienceScope>("all");

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await listNotifications();
        if (active) setList(data);
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const unread = list.filter((n) => n.viewedAt == null).length;

  const filtered = list.filter((n) => {
    if (tab === "unread" && n.viewedAt != null) return false;
    if (tab !== "all" && tab !== "unread" && n.type !== tab) return false;
    const scope = n.audience?.scope ?? "all";
    if (audienceFilter !== "all" && scope !== audienceFilter) return false;
    return true;
  });

  const toggleRead = (id: string) => {
    // v0.34.x: 已读不可逆。toggle 仅作为运营 UI 上「切回未读」的乐观显示，
    // 后端 markNotificationRead 仅在 viewedAt==null 时落首次时间，再点不会改时间。
    setList((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, viewedAt: n.viewedAt ? null : new Date().toISOString() } : n
      )
    );
    markNotificationRead(id).catch(() => { /* 后端未读/已读切换暂未持久化时静默 */ });
  };
  const markAllRead = () => {
    const now = new Date().toISOString();
    setList((prev) => prev.map((n) => (n.viewedAt == null ? { ...n, viewedAt: now } : n)));
  };

  return (
    <div className="admin-page">
      <PageHeader
        title="消息中心"
        description="平台运营推送、收益到账与系统告警统一收件箱。每条消息标注推送对象，方便溯源。"
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
        <StatCard label="全体推送" value={list.filter((n) => (n.audience?.scope ?? "all") === "all").length} icon={Globe2} />
      </section>

      <Card>
        <CardHeader className="flex-row flex-wrap items-center gap-3">
          <CardTitle className="mr-auto">消息流</CardTitle>
          <div className="flex flex-wrap items-center gap-1">
            {(["all", "studio", "artist", "account"] as const).map((scope) => (
              <Button
                key={scope}
                size="sm"
                variant={audienceFilter === scope ? "default" : "ghost"}
                onClick={() => setAudienceFilter(scope === "all" ? "all" : scope)}
              >
                {scope === "all" ? "全部对象" : AUDIENCE_META[scope].label}
              </Button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <TabsList className="flex-wrap">
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
                {loading && <div className="py-8 text-center text-sm text-muted-foreground">加载中…</div>}
                {!loading && loadError && <div className="py-8 text-center text-sm text-rose-600">加载失败：{loadError}</div>}
                {!loading && !loadError && filtered.map((n) => {
                  const meta = NOTIFICATION_TYPE[n.type];
                  const Icon = TYPE_ICON[n.type];
                  return (
                    <div
                      key={n.id}
                      className={
                        "py-3 flex items-start gap-3 " + (n.viewedAt == null ? "bg-indigo-50/30 -mx-4 px-4" : "")
                      }
                    >
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground shrink-0">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={"text-sm " + (n.viewedAt != null ? "font-medium" : "font-semibold")}>{n.title}</span>
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          <AudienceBadge audience={n.audience} />
                          {n.viewedAt == null && <span className="h-2 w-2 rounded-full bg-rose-500" />}
                          <span className="text-xs text-muted-foreground">· {n.time} 前</span>
                        </div>
                        <div className="text-sm text-muted-foreground mt-0.5">{n.desc}</div>
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => toggleRead(n.id)} className="shrink-0">
                        {n.viewedAt != null ? "标为未读" : "已读"}
                      </Button>
                    </div>
                  );
                })}
                {!loading && !loadError && filtered.length === 0 && (
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
