"use client";

import * as React from "react";
import { Users, UserCheck, UserX, Search } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { ActionDialog } from "@/components/ActionDialog";
import { listUsers } from "@/api/users";
import { listTenants, listMemberships } from "@/api/tenants";
import { ACCOUNT_KIND, ACCOUNT_STATUS } from "@/constants/status";
import type { AepUser, AccountKind, AccountStatus, Tenant, Membership } from "@/types/account";
import { formatDateCN } from "@/lib/utils";

export default function AccountsPage() {
  const [users, setUsers] = React.useState<AepUser[]>([]);
  const [tenants, setTenants] = React.useState<Tenant[]>([]);
  const [memberships, setMemberships] = React.useState<Membership[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [query, setQuery] = React.useState("");
  const [kind, setKind] = React.useState<"all" | AccountKind>("all");
  const [status, setStatus] = React.useState<"all" | AccountStatus>("all");
  const [target, setTarget] = React.useState<{ user: AepUser; action: "suspend" | "reactivate" } | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [u, t, m] = await Promise.all([
        listUsers(0, 200),
        listTenants(0, 200),
        listMemberships(undefined, undefined, 0, 500),
      ]);
      setUsers(u);
      setTenants(t);
      setMemberships(m);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const tenantById = React.useMemo(() => new Map(tenants.map((t) => [t.id, t])), [tenants]);
  const membershipByUser = React.useMemo(() => {
    const m = new Map<string, Membership>();
    for (const x of memberships) if (!m.has(x.userId)) m.set(x.userId, x);
    return m;
  }, [memberships]);

  const filtered = users.filter((a) => {
    if (kind !== "all" && a.kind !== kind) return false;
    if (status !== "all" && a.status !== status) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!a.username.toLowerCase().includes(q) && !a.displayName.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const counts = {
    total: users.length,
    active: users.filter((a) => a.status === "active").length,
    suspended: users.filter((a) => a.status === "suspended").length,
    studio: users.filter((a) => a.kind === "studio").length,
  };

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="账号"
        description="AepUser：登录账号、身份（个人 / 工作室）与状态管理。"
        breadcrumb={[{ label: "平台账户" }, { label: "账号" }]}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="账号总数"  value={counts.total}     icon={Users}     />
        <StatCard label="启用中"    value={counts.active}    icon={UserCheck} tone="success" />
        <StatCard label="工作室账号" value={counts.studio}    icon={Users}     tone="default" />
        <StatCard label="已停用"    value={counts.suspended} icon={UserX}     tone={counts.suspended ? "warning" : "default"} />
      </section>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle>账号列表</CardTitle>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="pl-8 w-[220px]"
                  placeholder="用户名 / 展示名"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Select value={kind} onValueChange={(v) => setKind(v as "all" | AccountKind)}>
                <SelectTrigger className="w-[120px]"><SelectValue placeholder="身份" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部身份</SelectItem>
                  <SelectItem value="personal">个人</SelectItem>
                  <SelectItem value="studio">工作室</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v) => setStatus(v as "all" | AccountStatus)}>
                <SelectTrigger className="w-[120px]"><SelectValue placeholder="状态" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="active">启用</SelectItem>
                  <SelectItem value="suspended">停用</SelectItem>
                  <SelectItem value="deleted">注销</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>账号</TableHead>
                <TableHead>身份</TableHead>
                <TableHead>归属机构</TableHead>
                <TableHead>邮箱 / 手机</TableHead>
                <TableHead>最近登录</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">加载中…</TableCell>
                </TableRow>
              )}
              {!loading && loadError && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-rose-600">加载失败：{loadError}</TableCell>
                </TableRow>
              )}
              {!loading && !loadError && filtered.map((u) => {
                const m = membershipByUser.get(u.id);
                const t = m ? tenantById.get(m.tenantId) : undefined;
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{u.displayName}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">@{u.username}</span>
                      </div>
                    </TableCell>
                    <TableCell><StatusBadge meta={ACCOUNT_KIND[u.kind]} /></TableCell>
                    <TableCell className="text-sm">{t?.name ?? "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {[u.email, u.phone].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="text-xs">{u.lastLoginAt ? formatDateCN(u.lastLoginAt) : "—"}</TableCell>
                    <TableCell><StatusBadge meta={ACCOUNT_STATUS[u.status]} /></TableCell>
                    <TableCell className="text-right">
                      {u.status === "active" ? (
                        <Button size="sm" variant="destructive" onClick={() => setTarget({ user: u, action: "suspend" })}>
                          停用
                        </Button>
                      ) : u.status === "suspended" ? (
                        <Button size="sm" variant="success" onClick={() => setTarget({ user: u, action: "reactivate" })}>
                          恢复
                        </Button>
                      ) : (
                        <Button size="sm" variant="ghost">查看</Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && !loadError && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">没有匹配的账号</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {target && (
        <ActionDialog
          open={!!target}
          onOpenChange={(open) => !open && setTarget(null)}
          title={target.action === "suspend" ? `停用账号：${target.user.displayName}` : `恢复账号：${target.user.displayName}`}
          description={`@${target.user.username}`}
          tone={target.action === "suspend" ? "danger" : "success"}
          confirmLabel={target.action === "suspend" ? "停用" : "恢复"}
          requireReason
          reasonPlaceholder="操作原因（写入审计日志）"
        />
      )}
    </div>
  );
}
