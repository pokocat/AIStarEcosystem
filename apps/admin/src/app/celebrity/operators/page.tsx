"use client";

import * as React from "react";
import { Loader2, Search, ShieldCheck, ShieldOff, UserCog } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AepUsersApi } from "@/api";
import type { AepUser, OperatorRole } from "@/types/account";
import { formatDateCN } from "@/lib/utils";
import { useToast } from "@/components/feedback";

/**
 * v0.31+: 平台运营 · celebrity 内嵌运营管理。
 * 列出 aep_users，并改某账号的 operatorRole（OPERATOR / SUPER_ADMIN / 无）。
 *
 * 与 admin 后台的 admin_users 体系**独立** —— 这里管的是「让一个 celebrity 用户
 * 也能在 web-celebrity 里做运营动作」的内嵌身份。
 */
export default function CelebrityOperatorsPage() {
  const toast = useToast();
  const [users, setUsers] = React.useState<AepUser[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [loadError, setLoadError] = React.useState<string | null>(null);
  const [savingId, setSavingId] = React.useState<string | null>(null);

  const [q, setQ] = React.useState("");
  const [scope, setScope] = React.useState<"all" | "operators" | "non-operators">("all");

  const reload = React.useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const list = await AepUsersApi.listAepUsers({
        q: q.trim() || undefined,
        hasOperator: scope === "operators" ? true : scope === "non-operators" ? false : undefined,
      });
      setUsers(list);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  }, [q, scope]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const handleChange = async (user: AepUser, next: OperatorRole | null) => {
    if ((user.operatorRole ?? null) === next) return;
    setSavingId(user.id);
    try {
      await AepUsersApi.updateOperatorRole(user.id, next);
      await reload();
      toast.success({
        title: next ? `已设为${next === "super_admin" ? "超管" : "运营"}` : "已移除运营角色",
        description: user.displayName || user.username,
      });
    } catch (err) {
      toast.danger({
        title: "保存失败",
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSavingId(null);
    }
  };

  const opCount = users.filter((u) => !!u.operatorRole).length;

  return (
    <div className="max-w-screen-2xl mx-auto">
      <PageHeader
        title="平台运营 · 明星带货"
        description="把 celebrity 用户升级为内嵌运营，让他在 web-celebrity 里也能录入 / 编辑公共商品池等运营动作。与后台管理员是两套独立体系。"
        breadcrumb={[{ label: "明星带货" }, { label: "平台运营" }]}
      />

      <Card>
        <CardHeader className="flex-row flex-wrap items-center gap-3">
          <CardTitle className="mr-auto inline-flex items-center gap-2">
            <UserCog className="h-4 w-4" />
            celebrity 账号 · {users.length} 个（其中运营 {opCount}）
          </CardTitle>
          <div className="relative w-60">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="按用户名 / 显示名 / 邮箱 / 手机号搜索"
              className="pl-8"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={scope} onValueChange={(v) => setScope(v as typeof scope)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部账号</SelectItem>
              <SelectItem value="operators">仅运营</SelectItem>
              <SelectItem value="non-operators">仅普通用户</SelectItem>
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="p-0">
          {loadError && (
            <div className="border-b border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
              加载失败：{loadError}
            </div>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户</TableHead>
                <TableHead>联系方式</TableHead>
                <TableHead>账号类型</TableHead>
                <TableHead>当前角色</TableHead>
                <TableHead>更新时间</TableHead>
                <TableHead className="text-right">设为</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    加载中…
                  </TableCell>
                </TableRow>
              )}
              {!loading && users.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{u.displayName || u.username}</span>
                      <span className="text-xs text-muted-foreground">{u.username}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {u.phone && <div>📱 {u.phone}</div>}
                    {u.email && <div>✉️ {u.email}</div>}
                    {!u.phone && !u.email && <span>—</span>}
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="rounded-md border px-2 py-0.5">{u.kind}</span>
                  </TableCell>
                  <TableCell>
                    {u.operatorRole ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/8 px-2 py-0.5 text-xs font-medium text-primary">
                        <ShieldCheck className="h-3 w-3" />
                        {u.operatorRole === "super_admin" ? "超管" : "运营"}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <ShieldOff className="h-3 w-3" />
                        普通用户
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDateCN(u.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex items-center gap-1">
                      {savingId === u.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                      ) : null}
                      <Button
                        size="sm"
                        variant={u.operatorRole === "operator" ? "default" : "outline"}
                        disabled={savingId === u.id}
                        onClick={() => handleChange(u, "operator")}
                      >
                        运营
                      </Button>
                      <Button
                        size="sm"
                        variant={u.operatorRole === "super_admin" ? "default" : "outline"}
                        disabled={savingId === u.id}
                        onClick={() => handleChange(u, "super_admin")}
                      >
                        超管
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={savingId === u.id || !u.operatorRole}
                        onClick={() => handleChange(u, null)}
                      >
                        移除
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!loading && users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                    暂无账号
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
