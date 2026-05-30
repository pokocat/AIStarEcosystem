"use client";

import * as React from "react";
import { ShieldAlert, ShieldCheck, Hourglass } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { listSocialAccounts } from "@/api/social-account";
import { SOCIAL_ACCOUNT_STATUS } from "@/constants/status";
import { PUBLISH_PLATFORM_LABEL } from "@/types/publish-job";
import type { SocialAccount, SocialAccountStatus } from "@/types/social-account";
import { SocialPlatformLogo } from "@/components/SocialPlatformLogo";
import { formatDateCN } from "@/lib/utils";

const STATUS_TABS: { value: SocialAccountStatus | "all"; label: string }[] = [
  { value: "all",     label: "全部" },
  { value: "active",  label: "有效" },
  { value: "pending", label: "待扫码" },
  { value: "expired", label: "登录过期" },
  { value: "banned",  label: "已封禁" },
];

export default function SocialAccountsPage() {
  const [rows, setRows] = React.useState<SocialAccount[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<SocialAccountStatus | "all">("all");

  React.useEffect(() => {
    let active = true;
    (async () => {
      try {
        const data = await listSocialAccounts();
        if (active) setRows(data);
      } catch (err) {
        if (active) setLoadError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  const counts = {
    active:  rows.filter((r) => r.status === "active").length,
    pending: rows.filter((r) => r.status === "pending").length,
    expired: rows.filter((r) => r.status === "expired").length,
    banned:  rows.filter((r) => r.status === "banned").length,
  };

  const list = rows.filter((r) => tab === "all" || r.status === tab);

  return (
    <div className="admin-page">
      <PageHeader
        title="社交账号绑定"
        description="跨用户审计：sau-service 扫码绑定的第三方平台账号清单"
        breadcrumb={[{ label: "分发与变现" }, { label: "社交账号" }]}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="有效"     value={counts.active}  icon={ShieldCheck} tone="success" />
        <StatCard label="待扫码"   value={counts.pending} icon={Hourglass} />
        <StatCard label="登录过期" value={counts.expired} icon={ShieldAlert} tone="warning" />
        <StatCard label="已封禁"   value={counts.banned}  icon={ShieldAlert} tone="danger" />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>账号清单</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as SocialAccountStatus | "all")}>
            <TabsList>
              {STATUS_TABS.map((s) => (
                <TabsTrigger key={s.value} value={s.value}>{s.label}</TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value={tab}>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>平台</TableHead>
                    <TableHead>账号别名</TableHead>
                    <TableHead>显示昵称</TableHead>
                    <TableHead>平台账号号</TableHead>
                    <TableHead>归属用户</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>绑定时间</TableHead>
                    <TableHead>上次校验</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && (
                    <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">加载中…</TableCell></TableRow>
                  )}
                  {!loading && loadError && (
                    <TableRow><TableCell colSpan={8} className="text-center py-10 text-rose-600">加载失败：{loadError}</TableCell></TableRow>
                  )}
                  {!loading && !loadError && list.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center py-10 text-muted-foreground">暂无账号</TableCell></TableRow>
                  )}
                  {!loading && !loadError && list.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">
                        <span className="inline-flex items-center gap-1.5">
                          <SocialPlatformLogo platform={r.platform} />
                          {PUBLISH_PLATFORM_LABEL[r.platform] ?? r.platform}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">{r.accountName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.displayName ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{r.platformAccountId ?? "—"}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground">{r.userId}</TableCell>
                      <TableCell><StatusBadge meta={SOCIAL_ACCOUNT_STATUS[r.status]} /></TableCell>
                      <TableCell className="text-sm">{formatDateCN(r.boundAt)}</TableCell>
                      <TableCell className="text-sm">{r.lastVerifiedAt ? formatDateCN(r.lastVerifiedAt) : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
