"use client";

import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { Eye, RotateCcw, Search, ShieldAlert, Sparkles } from "lucide-react";

import { StatusBadge } from "@/components/admin/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldContent, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { entitlements, users } from "@/lib/admin-data";
import type { UserRecord } from "@/types/admin";

type ViewMode = "all" | "attention" | "enterprise";

export function UsersWorkbench() {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [role, setRole] = useState("all");
  const [plan, setPlan] = useState("all");
  const [status, setStatus] = useState("all");
  const [view, setView] = useState<ViewMode>("all");
  const [filterOpen, setFilterOpen] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserRecord | null>(null);
  const [isPending, startTransition] = useTransition();

  const filteredUsers = useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return users.filter((user) => {
      if (view === "attention" && user.status === "active" && user.credits > 300) {
        return false;
      }

      if (view === "enterprise" && user.plan !== "enterprise") {
        return false;
      }

      if (role !== "all" && user.role !== role) {
        return false;
      }

      if (plan !== "all" && user.plan !== plan) {
        return false;
      }

      if (status !== "all" && user.status !== status) {
        return false;
      }

      if (!normalizedQuery) {
        return true;
      }

      return [user.name, user.email, user.phone, user.tenant]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [deferredQuery, plan, role, status, view]);

  const summary = useMemo(() => {
    return {
      total: filteredUsers.length,
      active: filteredUsers.filter((user) => user.status === "active").length,
      enterprise: filteredUsers.filter((user) => user.plan === "enterprise").length,
      attention: filteredUsers.filter((user) => user.status !== "active" || user.credits <= 300).length,
    };
  }, [filteredUsers]);

  function resetFilters() {
    startTransition(() => {
      setRole("all");
      setPlan("all");
      setStatus("all");
      setView("all");
      setQuery("");
    });
  }

  const currentEntitlements = useMemo(
    () =>
      entitlements.filter(
        (item) => item.subject === selectedUser?.name || item.subject === selectedUser?.tenant
      ),
    [selectedUser]
  );

  return (
    <div className="flex flex-col gap-6">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card className="border-white/70 bg-white/84 shadow-[0_16px_36px_rgba(15,23,42,0.05)] animate-surface-in">
          <CardHeader className="gap-1">
            <CardDescription>当前结果</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{summary.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-white/70 bg-white/84 shadow-[0_16px_36px_rgba(15,23,42,0.05)] animate-surface-in">
          <CardHeader className="gap-1">
            <CardDescription>活跃账号</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{summary.active}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-white/70 bg-white/84 shadow-[0_16px_36px_rgba(15,23,42,0.05)] animate-surface-in">
          <CardHeader className="gap-1">
            <CardDescription>Enterprise 用户</CardDescription>
            <CardTitle className="text-3xl tabular-nums">{summary.enterprise}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="border-white/70 bg-slate-950 text-slate-50 shadow-[0_16px_36px_rgba(15,23,42,0.10)] animate-surface-in">
          <CardHeader className="gap-1">
            <CardDescription className="text-slate-300">需关注账号</CardDescription>
            <CardTitle className="text-3xl tabular-nums text-slate-50">{summary.attention}</CardTitle>
          </CardHeader>
        </Card>
      </section>

      <Card className="border-white/70 bg-white/84 shadow-[0_18px_40px_rgba(15,23,42,0.05)] animate-surface-in">
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>用户工作台</CardTitle>
              <CardDescription>把搜索、组合筛选、快速视图和详情预览收进同一个工作面。</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <ToggleGroup
                className="rounded-2xl border bg-white p-1"
                onValueChange={(value) => {
                  if (value) {
                    startTransition(() => setView(value as ViewMode));
                  }
                }}
                type="single"
                value={view}
                variant="outline"
              >
                <ToggleGroupItem value="all">全部</ToggleGroupItem>
                <ToggleGroupItem value="attention">需关注</ToggleGroupItem>
                <ToggleGroupItem value="enterprise">Enterprise</ToggleGroupItem>
              </ToggleGroup>
              <Collapsible onOpenChange={setFilterOpen} open={filterOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="outline">{filterOpen ? "收起筛选" : "展开筛选"}</Button>
                </CollapsibleTrigger>
              </Collapsible>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <Collapsible onOpenChange={setFilterOpen} open={filterOpen}>
            <CollapsibleContent>
              <div className="rounded-[24px] border border-border/70 bg-secondary/35 p-4">
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(180px,1fr))]">
                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="user-search">关键词搜索</FieldLabel>
                      <FieldContent>
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            className="pl-9"
                            id="user-search"
                            onChange={(event) => setQuery(event.target.value)}
                            placeholder="搜索用户名、邮箱、手机号或租户"
                            value={query}
                          />
                        </div>
                      </FieldContent>
                    </Field>
                  </FieldGroup>

                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="role-filter">角色</FieldLabel>
                      <FieldContent>
                        <Select
                          onValueChange={(value) => startTransition(() => setRole(value))}
                          value={role}
                        >
                          <SelectTrigger id="role-filter">
                            <SelectValue placeholder="全部角色" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="all">全部角色</SelectItem>
                              <SelectItem value="fan">Fan</SelectItem>
                              <SelectItem value="producer">Producer</SelectItem>
                              <SelectItem value="coach">Coach</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </FieldContent>
                    </Field>
                  </FieldGroup>

                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="plan-filter">套餐</FieldLabel>
                      <FieldContent>
                        <Select
                          onValueChange={(value) => startTransition(() => setPlan(value))}
                          value={plan}
                        >
                          <SelectTrigger id="plan-filter">
                            <SelectValue placeholder="全部套餐" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="all">全部套餐</SelectItem>
                              <SelectItem value="free">Free</SelectItem>
                              <SelectItem value="pro">Pro</SelectItem>
                              <SelectItem value="enterprise">Enterprise</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </FieldContent>
                    </Field>
                  </FieldGroup>

                  <FieldGroup>
                    <Field>
                      <FieldLabel htmlFor="status-filter">状态</FieldLabel>
                      <FieldContent>
                        <Select
                          onValueChange={(value) => startTransition(() => setStatus(value))}
                          value={status}
                        >
                          <SelectTrigger id="status-filter">
                            <SelectValue placeholder="全部状态" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              <SelectItem value="all">全部状态</SelectItem>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="suspended">Suspended</SelectItem>
                              <SelectItem value="deleted">Deleted</SelectItem>
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </FieldContent>
                    </Field>
                  </FieldGroup>
                </div>
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    {isPending ? "正在更新筛选结果…" : `已匹配 ${summary.total} 个用户`}
                  </p>
                  <Button onClick={resetFilters} type="button" variant="outline">
                    <RotateCcw data-icon="inline-start" />
                    重置筛选
                  </Button>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <div className="overflow-hidden rounded-[24px] border border-border/70">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>用户</TableHead>
                  <TableHead>注册方式</TableHead>
                  <TableHead>角色</TableHead>
                  <TableHead>套餐</TableHead>
                  <TableHead>积分余额</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>最近登录</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredUsers.map((user) => (
                  <TableRow
                    key={user.id}
                    className="cursor-pointer transition-colors hover:bg-accent/45"
                    onClick={() => setSelectedUser(user)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="size-10">
                          <AvatarFallback>
                            {user.name
                              .split(" ")
                              .slice(0, 2)
                              .map((part) => part[0])
                              .join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col gap-1">
                          <p className="font-medium">{user.name}</p>
                          <p className="text-xs text-muted-foreground">{user.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{user.signupMethod}</TableCell>
                    <TableCell>
                      <StatusBadge kind="role" value={user.role} />
                    </TableCell>
                    <TableCell>
                      <StatusBadge kind="plan" value={user.plan} />
                    </TableCell>
                    <TableCell className="tabular-nums">{user.credits}</TableCell>
                    <TableCell>
                      <StatusBadge kind="user-status" value={user.status} />
                    </TableCell>
                    <TableCell>{user.lastLoginAt}</TableCell>
                    <TableCell>
                      <Button
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedUser(user);
                        }}
                        size="sm"
                        variant="outline"
                      >
                        <Eye data-icon="inline-start" />
                        预览
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog onOpenChange={(open) => !open && setSelectedUser(null)} open={!!selectedUser}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedUser?.name ?? "用户预览"}</DialogTitle>
            <DialogDescription>
              {selectedUser?.tenant ?? "—"} · 注册方式 {selectedUser?.signupMethod ?? "—"}
            </DialogDescription>
          </DialogHeader>
          {selectedUser ? (
            <div className="flex flex-col gap-5">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border bg-secondary/35 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Role</p>
                  <div className="mt-3">
                    <StatusBadge kind="role" value={selectedUser.role} />
                  </div>
                </div>
                <div className="rounded-2xl border bg-secondary/35 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Plan</p>
                  <div className="mt-3">
                    <StatusBadge kind="plan" value={selectedUser.plan} />
                  </div>
                </div>
                <div className="rounded-2xl border bg-secondary/35 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Status</p>
                  <div className="mt-3">
                    <StatusBadge kind="user-status" value={selectedUser.status} />
                  </div>
                </div>
                <div className="rounded-2xl border bg-secondary/35 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Credits</p>
                  <p className="mt-3 text-2xl font-semibold tabular-nums">{selectedUser.credits}</p>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.9fr)]">
                <div className="rounded-2xl border bg-white p-4">
                  <p className="text-sm font-medium text-slate-900">档案摘要</p>
                  <div className="mt-4 grid gap-3 text-sm text-muted-foreground">
                    <div>邮箱：{selectedUser.email}</div>
                    <div>手机号：{selectedUser.phone}</div>
                    <div>注册时间：{selectedUser.registeredAt}</div>
                    <div>最近登录：{selectedUser.lastLoginAt}</div>
                  </div>
                </div>
                <div className="rounded-2xl border bg-white p-4">
                  <p className="text-sm font-medium text-slate-900">相关权益</p>
                  <div className="mt-4 flex flex-col gap-3">
                    {currentEntitlements.length ? (
                      currentEntitlements.map((item) => (
                        <div key={item.id} className="rounded-2xl border bg-secondary/35 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-medium">{item.feature}</p>
                            <StatusBadge kind="entitlement-status" value={item.status} />
                          </div>
                          <p className="mt-2 text-xs text-muted-foreground">
                            {item.quota} · 到期 {item.expiresAt}
                          </p>
                        </div>
                      ))
                    ) : (
                      <div className="rounded-2xl border border-dashed bg-secondary/25 p-4 text-sm text-muted-foreground">
                        当前没有直接命中的权益记录，建议进入详情页进一步核查。
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline">
                  <Sparkles data-icon="inline-start" />
                  开通权益
                </Button>
                <Button variant="outline">
                  <Eye data-icon="inline-start" />
                  查看完整详情
                </Button>
                <Button variant="destructive">
                  <ShieldAlert data-icon="inline-start" />
                  封禁账号
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
