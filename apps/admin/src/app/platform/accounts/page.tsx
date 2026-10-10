"use client";

import * as React from "react";
import { getMe as getAdminMe } from "@/api/auth";
import { ImpersonationDialog } from "@/components/ImpersonationDialog";
import { Users, UserCheck, UserX, Search, Building2, Coins } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { useConfirm, useToast } from "@/components/feedback";
import { listUsersPage, suspendUser, reactivateUser } from "@/api/users";
import { listStudios } from "@/api/studios";
import { ACCOUNT_STATUS, STUDIO_KIND } from "@/constants/status";
import type { AepUser, AccountKind, AccountStatus } from "@/types/account";
import type { AdminStudio } from "@/types/studio";
import type { PaginationMeta } from "@/types/_shared";
import { formatDateCN } from "@/lib/utils";
import { formatCredits } from "@/lib/format";

export default function AccountsPage() {
  const [actingTarget, setActingTarget] = React.useState<AepUser | null>(null);
  const [canImpersonate, setCanImpersonate] = React.useState(false);
  React.useEffect(() => { void getAdminMe().then(u => setCanImpersonate(u.role === "super_admin")).catch(() => setCanImpersonate(false)); }, []);
  const [users, setUsers] = React.useState<AepUser[]>([]);
  const [studios, setStudios] = React.useState<AdminStudio[]>([]);
  const [studioLoadError, setStudioLoadError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);

  const [query, setQuery] = React.useState("");
  const [kind, setKind] = React.useState<"all" | AccountKind>("all");
  const [status, setStatus] = React.useState<"all" | AccountStatus>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [page, setPage] = React.useState(0);
  const [pagination, setPagination] = React.useState<PaginationMeta | null>(null);
  const requestSeq = React.useRef(0);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

  React.useEffect(() => {
    const timer = setTimeout(() => { setSearchQuery(query.trim()); setPage(0); }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  React.useEffect(() => {
    void listStudios(0, 100).then(setStudios).catch(err => setStudioLoadError(err instanceof Error ? err.message : "加载失败"));
  }, []);

  const reload = React.useCallback(async (signal?: AbortSignal) => {
    const seq = ++requestSeq.current;
    setLoading(true);
    setLoadError(null);
    try {
      const result = await listUsersPage({ page, size: 50, q: searchQuery || undefined,
        status: status === "all" ? undefined : status, kind: kind === "all" ? undefined : kind }, signal);
      if (signal?.aborted || seq !== requestSeq.current) return;
      setUsers(result.data);
      setPagination(result.pagination);
    } catch (err) {
      if (signal?.aborted || seq !== requestSeq.current) return;
      setLoadError(err instanceof Error ? err.message : "加载失败");
    } finally {
      if (!signal?.aborted && seq === requestSeq.current) setLoading(false);
    }
  }, [page, searchQuery, kind, status]);

  React.useEffect(() => {
    const controller = new AbortController();
    void reload(controller.signal);
    return () => controller.abort();
  }, [reload]);

  async function onSuspend(u: AepUser) {
    const res = await confirm({
      title: `停用账号：${u.displayName}`,
      tone: "danger",
      confirmLabel: "停用",
      requireReason: true,
      description:
        "停用后该账号的密码 / 短信登录将被拒绝（已签发的登录态最长保留至 token 过期）。原因将写入审计日志。",
      affected: (
        <div className="text-sm">
          {u.displayName} <span className="text-xs text-muted-foreground">@{u.username}</span>
        </div>
      ),
    });
    if (!res.ok) return;
    setBusyId(u.id);
    try {
      await suspendUser(u.id, res.reason);
      await reload();
      toast.success({ title: "已停用", description: `@${u.username} 已无法登录` });
    } catch (e) {
      toast.danger({ title: "停用失败", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusyId(null);
    }
  }

  async function onReactivate(u: AepUser) {
    const res = await confirm({
      title: `恢复账号：${u.displayName}`,
      tone: "success",
      confirmLabel: "恢复",
      requireReason: false,
      description: "恢复后该账号即可正常登录。操作将写入审计日志。",
      affected: (
        <div className="text-sm">
          {u.displayName} <span className="text-xs text-muted-foreground">@{u.username}</span>
        </div>
      ),
    });
    if (!res.ok) return;
    setBusyId(u.id);
    try {
      await reactivateUser(u.id, res.reason || undefined);
      await reload();
      toast.success({ title: "已恢复", description: `@${u.username} 可正常登录` });
    } catch (e) {
      toast.danger({ title: "恢复失败", description: e instanceof Error ? e.message : undefined });
    } finally {
      setBusyId(null);
    }
  }

  const studioByOwner = React.useMemo(
    () => new Map(studios.map((s) => [s.ownerUserId, s])),
    [studios]
  );

  const filtered = users;

  const counts = {
    total: pagination?.total ?? 0,
    active: users.filter((a) => a.status === "active").length,
    suspended: users.filter((a) => a.status === "suspended").length,
    studio: users.filter((a) => a.kind === "studio").length,
    studioSubjects: studios.length,
    revenueCredits: studios.reduce((s, x) => s + x.totalRevenueCredits, 0),
  };

  return (
    <div className="admin-page">
      <ImpersonationDialog user={actingTarget} onClose={() => setActingTarget(null)} />
      <PageHeader
        title="账号 & 经纪公司"
        description="AepUser ↔ Studio 1:1 绑定：登录账号、所属经纪公司 / 工作室、聚合收益与状态。"
        breadcrumb={[{ label: "平台账户" }, { label: "账号 & 经纪公司" }]}
      />

      <section className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label={searchQuery || kind !== "all" || status !== "all" ? "匹配账号" : "账号总数"} value={counts.total} icon={Users} />
        <StatCard label="本页启用中"      value={counts.active}                     icon={UserCheck} tone="success" />
        <StatCard label="经纪公司主体"    value={counts.studioSubjects}             icon={Building2} />
        <StatCard label="经纪公司累计收益" value={formatCredits(counts.revenueCredits)} icon={Coins}     tone="success" />
      </section>

      <Card>
        {studioLoadError && <p role="alert" className="px-4 pt-4 text-sm text-rose-600">经纪公司资料加载失败：{studioLoadError}</p>}
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <CardTitle>账号列表</CardTitle>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-auto">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  className="w-full pl-8 sm:w-[220px]"
                  placeholder="手机号 / 昵称 / 用户名 / 邮箱"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
              <Select value={kind} onValueChange={(v) => { setKind(v as "all" | AccountKind); setPage(0); }}>
                <SelectTrigger className="w-full sm:w-[120px]"><SelectValue placeholder="身份" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部身份</SelectItem>
                  <SelectItem value="personal">个人</SelectItem>
                  <SelectItem value="studio">工作室</SelectItem>
                </SelectContent>
              </Select>
              <Select value={status} onValueChange={(v) => { setStatus(v as "all" | AccountStatus); setPage(0); }}>
                <SelectTrigger className="w-full sm:w-[120px]"><SelectValue placeholder="状态" /></SelectTrigger>
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
          <Table className="min-w-[1200px]">
            <TableHeader>
              <TableRow>
                <TableHead>账号</TableHead>
                <TableHead>经纪公司 / 工作室</TableHead>
                <TableHead className="text-right">艺人</TableHead>
                <TableHead className="text-right">作品</TableHead>
                <TableHead className="text-right">月度收益</TableHead>
                <TableHead className="text-right">累计收益</TableHead>
                <TableHead>邮箱 / 手机</TableHead>
                <TableHead>最近登录</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">加载中…</TableCell>
                </TableRow>
              )}
              {!loading && loadError && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-rose-600">加载失败：{loadError}</TableCell>
                </TableRow>
              )}
              {!loading && !loadError && filtered.map((u) => {
                const studio = studioByOwner.get(u.id);
                return (
                  <TableRow key={u.id}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{u.displayName}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">@{u.username}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">
                      {studio ? (
                        <div className="flex flex-col gap-0.5">
                          <span>{studio.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {STUDIO_KIND[studio.kind]?.label ?? studio.kind}
                          </span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{studio?.artistCount ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{studio?.songCount ?? "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {studio ? formatCredits(studio.monthlyRevenueCredits) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium">
                      {studio ? formatCredits(studio.totalRevenueCredits) : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {[u.email, u.phone].filter(Boolean).join(" · ") || "—"}
                    </TableCell>
                    <TableCell className="text-xs">{u.lastLoginAt ? formatDateCN(u.lastLoginAt) : "—"}</TableCell>
                    <TableCell><StatusBadge meta={ACCOUNT_STATUS[u.status]} /></TableCell>
                    <TableCell className="text-right">
                      {canImpersonate && u.status === "active" && <Button size="sm" variant="outline" className="mr-2" onClick={() => setActingTarget(u)}>附身登录</Button>}
                      {u.status === "active" ? (
                        <Button size="sm" variant="destructive" disabled={busyId === u.id} onClick={() => void onSuspend(u)}>
                          {busyId === u.id ? "处理中…" : "停用"}
                        </Button>
                      ) : u.status === "suspended" ? (
                        <Button size="sm" variant="success" disabled={busyId === u.id} onClick={() => void onReactivate(u)}>
                          {busyId === u.id ? "处理中…" : "恢复"}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">已注销</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
              {!loading && !loadError && filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={10} className="text-center py-10 text-muted-foreground">没有匹配的账号</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {pagination && !loadError && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3 text-sm">
              <span className="text-muted-foreground">共 {pagination.total} 个账号 · 第 {pagination.totalPages ? pagination.page + 1 : 0} / {pagination.totalPages} 页</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={loading || !pagination.hasPrev} onClick={() => setPage(p => p - 1)}>上一页</Button>
                <Button variant="outline" size="sm" disabled={loading || !pagination.hasNext} onClick={() => setPage(p => p + 1)}>下一页</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
